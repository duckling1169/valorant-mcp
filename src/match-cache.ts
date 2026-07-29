import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { SchemaError, UpstreamError } from "./errors";

// Bounded write-through cache for get_match_detail (ARCHITECTURE.md, 2026-07-28
// "bounded cache" decision). This first M3 slice: only get_match_detail writes
// (search_match_history only reads); retention is two independent caps (100
// rows, 90 days by cached_at) enforced synchronously after every write, not by
// a scheduled job.

const RETENTION_MAX_ROWS = 100;
const RETENTION_MAX_AGE_DAYS = 90;
const TABLE = "cached_matches";

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
  // Verbatim get_match_detail response — kept for a future read-through
  // cache-hit path (deferred; not read by anything in this slice).
  detail: unknown;
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
  async upsert(row: NewCachedMatchRow): Promise<void> {
    const { error } = await this.client
      .from(TABLE)
      .upsert({ ...row, cached_at: new Date().toISOString() });
    if (error) {
      throw new UpstreamError(`cache upsert failed: ${error.message}`);
    }
    await this.evict();
  }

  private async evict(): Promise<void> {
    const cutoff = new Date(
      Date.now() - RETENTION_MAX_AGE_DAYS * 24 * 60 * 60 * 1000,
    ).toISOString();
    const { error: ageError } = await this.client
      .from(TABLE)
      .delete()
      .lt("cached_at", cutoff);
    if (ageError) {
      throw new UpstreamError(`cache age eviction failed: ${ageError.message}`);
    }

    const { data, error: listError } = await this.client
      .from(TABLE)
      .select("match_id")
      .order("cached_at", { ascending: false });
    if (listError) {
      throw new UpstreamError(
        `cache eviction list failed: ${listError.message}`,
      );
    }

    const rows = z.array(z.object({ match_id: z.string() })).parse(data ?? []);
    const excess = rows.slice(RETENTION_MAX_ROWS).map((r) => r.match_id);
    if (excess.length > 0) {
      const { error: deleteError } = await this.client
        .from(TABLE)
        .delete()
        .in("match_id", excess);
      if (deleteError) {
        throw new UpstreamError(
          `cache row-count eviction failed: ${deleteError.message}`,
        );
      }
    }
  }

  async search(filters: SearchMatchHistoryFilters): Promise<CachedMatchRow[]> {
    let query = this.client
      .from(TABLE)
      .select(
        "match_id, map, mode, started_at, season_short, operator_agent, operator_tier_id, operator_tier_name, operator_score, operator_kills, operator_deaths, operator_assists, operator_won",
      )
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
    if (error) {
      throw new UpstreamError(`cache search failed: ${error.message}`);
    }

    const result = z.array(cachedMatchRowSchema).safeParse(data ?? []);
    if (!result.success) {
      throw new SchemaError(
        "cached_matches row did not match the expected shape",
      );
    }
    return result.data;
  }
}
