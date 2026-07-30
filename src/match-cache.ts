import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { SchemaError, UpstreamError } from "./errors";

// Bounded write-through cache for get_match_detail (ARCHITECTURE.md, 2026-07-28
// "bounded cache" decision). This first M3 slice: only get_match_detail writes
// (search_match_history only reads); retention is two independent caps (100
// rows, 90 days by cached_at) enforced synchronously after every write, not by
// a scheduled job. Slice 2 adds getDetail for get_match_detail's read-through:
// has_insight makes explicit whether a row's stored `detail` was written with
// include_insight, since a request for insight can only be satisfied by a row
// that has it (match-detail.ts's cache-hit rule).
//
// Slice 3 widens write-through to get_recent_matches/get_player_stats via
// insertLightMatches: a "light" row from stored-matches (operator's own stat
// line only, no full player roster) can never be a valid MatchDetail, so it
// never overwrites an existing row (light or full) — it only fills gaps
// (`ON CONFLICT (operator_puuid, match_id) DO NOTHING`, via ignoreDuplicates).
// Eviction stays uniform cached_at-FIFO across light and full rows (no
// two-tier priority).
//
// M4 slice 2: every method takes operatorPuuid, and the table's primary key
// is (operator_puuid, match_id), not match_id alone — a lookup scoped to one
// operator can only ever find rows that operator itself wrote. This is what
// makes the read-through in match-detail.ts safe for a second real user:
// without it, a cache hit would skip that request's own participant check
// (ARCHITECTURE.md's M4 slice 2 decision). Retention (100 rows / 90 days) is
// also enforced per-operator now, not cache-wide — one operator's usage must
// never evict another's rows.

const RETENTION_MAX_ROWS = 100;
const RETENTION_MAX_AGE_DAYS = 90;
const TABLE = "cached_matches";

/** Every Postgres error from this class is fail-open at the caller (write-
 * through/read-through swallow it) — this just standardizes "throw
 * UpstreamError with this message" so each call site doesn't hand-roll it. */
function assertNoError(
  error: { message: string } | null,
  message: string,
): void {
  if (error) throw new UpstreamError(`${message}: ${error.message}`);
}

export interface NewCachedMatchRow {
  match_id: string;
  map: string | null;
  mode: string | null;
  started_at: string;
  season_id: string | null;
  season_short: string | null;
  operator_agent: string | null;
  operator_tier_id: number | null;
  operator_tier_name: string | null;
  operator_score: number | null;
  operator_kills: number | null;
  operator_deaths: number | null;
  operator_assists: number | null;
  operator_won: boolean | null;
  has_insight: boolean;
  // Verbatim get_match_detail response — served back on a read-through
  // cache hit (match-detail.ts validates it against MatchDetail's shape).
  detail: unknown;
}

export interface CachedDetail {
  detail: unknown;
  has_insight: boolean;
}

export interface NewLightCachedMatchRow {
  match_id: string;
  map: string | null;
  mode: string | null;
  started_at: string;
  season_id: string | null;
  season_short: string | null;
  operator_agent: string | null;
  operator_tier_id: number | null;
  operator_tier_name: string | null;
  operator_score: number | null;
  operator_kills: number | null;
  operator_deaths: number | null;
  operator_assists: number | null;
  operator_won: boolean | null;
}

const cachedMatchRowSchema = z.object({
  match_id: z.string(),
  map: z.string().nullable(),
  mode: z.string().nullable(),
  started_at: z.string(),
  season_short: z.string().nullable(),
  operator_agent: z.string().nullable(),
  operator_tier_id: z.number().nullable(),
  operator_tier_name: z.string().nullable(),
  operator_score: z.number().nullable(),
  operator_kills: z.number().nullable(),
  operator_deaths: z.number().nullable(),
  operator_assists: z.number().nullable(),
  operator_won: z.boolean().nullable(),
});
export type CachedMatchRow = z.infer<typeof cachedMatchRowSchema>;

export interface SearchMatchHistoryFilters {
  map?: string;
  agent?: string;
  act?: string;
  rank?: string;
  date_from?: string;
  date_to?: string;
  limit: number;
}

export class MatchCache {
  constructor(private readonly client: SupabaseClient) {}

  /** Upsert one row, then enforce retention. Throws on any Postgres error —
   * callers that want write-through to be best-effort (get_match_detail) must
   * catch and swallow, per ARCHITECTURE.md's fail-open cache-write decision. */
  async upsert(operatorPuuid: string, row: NewCachedMatchRow): Promise<void> {
    const { error } = await this.client.from(TABLE).upsert({
      ...row,
      operator_puuid: operatorPuuid,
      cached_at: new Date().toISOString(),
    });
    assertNoError(error, "cache upsert failed");
    await this.evict(operatorPuuid);
  }

  /** Look up one row's stored detail + insight flag by match_id, scoped to
   * operatorPuuid (the composite primary key — see the slice-2 note above).
   * Returns null on no row; throws on any Postgres error — callers that want
   * read-through to be best-effort (get_match_detail) must catch and treat as
   * a miss, per ARCHITECTURE.md's fail-open cache decision. */
  async getDetail(
    operatorPuuid: string,
    matchId: string,
  ): Promise<CachedDetail | null> {
    const { data, error } = await this.client
      .from(TABLE)
      .select("detail, has_insight")
      .eq("operator_puuid", operatorPuuid)
      .eq("match_id", matchId)
      .maybeSingle();
    assertNoError(error, "cache detail lookup failed");
    if (!data) return null;
    return z
      .object({ detail: z.unknown(), has_insight: z.boolean() })
      .parse(data);
  }

  /** Batch-insert light rows (from stored-matches) for one operator, skipping
   * any (operatorPuuid, match_id) that already has a row — light data never
   * overwrites, light or full (ARCHITECTURE.md's slice-3 decision). One
   * eviction pass for the whole batch, not one per row. Throws on any
   * Postgres error — callers (get_recent_matches/get_player_stats) must catch
   * and swallow, same fail-open contract as upsert(). */
  async insertLightMatches(
    operatorPuuid: string,
    rows: NewLightCachedMatchRow[],
  ): Promise<void> {
    if (rows.length === 0) return;
    const cachedAt = new Date().toISOString();
    const { error } = await this.client.from(TABLE).upsert(
      rows.map((row) => ({
        ...row,
        operator_puuid: operatorPuuid,
        has_insight: false,
        detail: null,
        cached_at: cachedAt,
      })),
      { onConflict: "operator_puuid,match_id", ignoreDuplicates: true },
    );
    assertNoError(error, "cache light-insert failed");
    await this.evict(operatorPuuid);
  }

  private async evict(operatorPuuid: string): Promise<void> {
    const cutoff = new Date(
      Date.now() - RETENTION_MAX_AGE_DAYS * 24 * 60 * 60 * 1000,
    ).toISOString();
    const { error: ageError } = await this.client
      .from(TABLE)
      .delete()
      .eq("operator_puuid", operatorPuuid)
      .lt("cached_at", cutoff);
    assertNoError(ageError, "cache age eviction failed");

    const { data, error: listError } = await this.client
      .from(TABLE)
      .select("match_id")
      .eq("operator_puuid", operatorPuuid)
      .order("cached_at", { ascending: false });
    assertNoError(listError, "cache eviction list failed");

    const rows = z.array(z.object({ match_id: z.string() })).parse(data ?? []);
    const excess = rows.slice(RETENTION_MAX_ROWS).map((r) => r.match_id);
    if (excess.length > 0) {
      const { error: deleteError } = await this.client
        .from(TABLE)
        .delete()
        .eq("operator_puuid", operatorPuuid)
        .in("match_id", excess);
      assertNoError(deleteError, "cache row-count eviction failed");
    }
  }

  async search(
    operatorPuuid: string,
    filters: SearchMatchHistoryFilters,
  ): Promise<CachedMatchRow[]> {
    let query = this.client
      .from(TABLE)
      .select(
        "match_id, map, mode, started_at, season_short, operator_agent, operator_tier_id, operator_tier_name, operator_score, operator_kills, operator_deaths, operator_assists, operator_won",
      )
      .eq("operator_puuid", operatorPuuid)
      .order("started_at", { ascending: false })
      .limit(filters.limit);

    if (filters.map !== undefined) query = query.ilike("map", filters.map);
    if (filters.agent !== undefined) {
      query = query.ilike("operator_agent", filters.agent);
    }
    if (filters.act !== undefined)
      query = query.eq("season_short", filters.act);
    if (filters.rank !== undefined) {
      query = query.ilike("operator_tier_name", filters.rank);
    }
    if (filters.date_from !== undefined) {
      query = query.gte("started_at", filters.date_from);
    }
    if (filters.date_to !== undefined) {
      query = query.lte("started_at", filters.date_to);
    }

    const { data, error } = await query;
    assertNoError(error, "cache search failed");

    const result = z.array(cachedMatchRowSchema).safeParse(data ?? []);
    if (!result.success) {
      throw new SchemaError(
        "cached_matches row did not match the expected shape",
      );
    }
    return result.data;
  }
}
