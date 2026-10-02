import { z } from "zod";
import type { Db } from "@/lib/db";
import { SchemaError, UpstreamError } from "@/lib/errors";

// Bounded, per-profile match cache. get_match_detail writes full rows (with
// has_insight recording whether `detail` includes insight); get_recent_matches and
// get_player_stats write "light" rows (the operator's own stat line, detail null),
// which only fill gaps and never overwrite. Every method is scoped to operatorPuuid,
// and the primary key is (operator_puuid, match_id), so a profile can only read rows
// it wrote: a cache hit can never skip that request's own participant check.
// Retention (100 rows, 90 days, oldest cached first) is enforced per profile after
// every write. Callers treat every error as a cache miss (fail-open).

const RETENTION_MAX_ROWS = 100;
const RETENTION_MAX_AGE_DAYS = 90;

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

export interface NewCachedMatchRow extends NewLightCachedMatchRow {
  has_insight: boolean;
  // Verbatim get_match_detail response, served back on a cache hit.
  detail: unknown;
}

export interface CachedDetail {
  detail: unknown;
  has_insight: boolean;
}

const iso = z
  .union([z.string(), z.date()])
  .transform((v) => (typeof v === "string" ? v : v.toISOString()));

const cachedMatchRowSchema = z.object({
  match_id: z.string(),
  map: z.string().nullable(),
  mode: z.string().nullable(),
  started_at: iso,
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

/** Runs a query, converting any database error into UpstreamError. */
async function run<T>(what: string, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new UpstreamError(`${what}: ${message}`);
  }
}

export class MatchCache {
  constructor(private readonly db: Db) {}

  /** Insert or replace one full row, then enforce retention. */
  async upsert(operatorPuuid: string, row: NewCachedMatchRow): Promise<void> {
    const r = row;
    await run(
      "cache upsert failed",
      () => this.db.sql`
        insert into cached_matches (
          operator_puuid, match_id, map, mode, started_at, season_id, season_short,
          operator_agent, operator_tier_id, operator_tier_name, operator_score,
          operator_kills, operator_deaths, operator_assists, operator_won,
          detail, has_insight, cached_at
        ) values (
          ${operatorPuuid}, ${r.match_id}, ${r.map}, ${r.mode}, ${r.started_at},
          ${r.season_id}, ${r.season_short}, ${r.operator_agent}, ${r.operator_tier_id},
          ${r.operator_tier_name}, ${r.operator_score}, ${r.operator_kills},
          ${r.operator_deaths}, ${r.operator_assists}, ${r.operator_won},
          ${JSON.stringify(r.detail)}::jsonb, ${r.has_insight}, now()
        )
        on conflict (operator_puuid, match_id) do update set
          map = excluded.map, mode = excluded.mode, started_at = excluded.started_at,
          season_id = excluded.season_id, season_short = excluded.season_short,
          operator_agent = excluded.operator_agent,
          operator_tier_id = excluded.operator_tier_id,
          operator_tier_name = excluded.operator_tier_name,
          operator_score = excluded.operator_score,
          operator_kills = excluded.operator_kills,
          operator_deaths = excluded.operator_deaths,
          operator_assists = excluded.operator_assists,
          operator_won = excluded.operator_won, detail = excluded.detail,
          has_insight = excluded.has_insight, cached_at = excluded.cached_at`,
    );
    await this.evict(operatorPuuid);
  }

  /** One row's stored detail and insight flag, or null when not cached. */
  async getDetail(
    operatorPuuid: string,
    matchId: string,
  ): Promise<CachedDetail | null> {
    const rows = await run(
      "cache detail lookup failed",
      () => this.db.sql`
        select detail, has_insight from cached_matches
        where operator_puuid = ${operatorPuuid} and match_id = ${matchId}`,
    );
    const row = rows[0];
    if (!row) return null;
    return z
      .object({ detail: z.unknown(), has_insight: z.boolean() })
      .parse(row);
  }

  /** Inserts light rows in one statement, skipping matches already cached. */
  async insertLightMatches(
    operatorPuuid: string,
    rows: NewLightCachedMatchRow[],
  ): Promise<void> {
    if (rows.length === 0) return;
    const cachedAt = new Date().toISOString();
    const records = rows.map((row) => ({
      ...row,
      operator_puuid: operatorPuuid,
      has_insight: false,
      detail: null,
      cached_at: cachedAt,
    }));
    await run(
      "cache light-insert failed",
      () => this.db.sql`
        insert into cached_matches
        select * from json_populate_recordset(null::cached_matches, ${JSON.stringify(records)}::json)
        on conflict (operator_puuid, match_id) do nothing`,
    );
    await this.evict(operatorPuuid);
  }

  private async evict(operatorPuuid: string): Promise<void> {
    await run(
      "cache eviction failed",
      () => this.db.sql`
        delete from cached_matches
        where operator_puuid = ${operatorPuuid}
          and (
            cached_at < now() - make_interval(days => ${RETENTION_MAX_AGE_DAYS})
            or match_id in (
              select match_id from cached_matches
              where operator_puuid = ${operatorPuuid}
              order by cached_at desc
              offset ${RETENTION_MAX_ROWS}
            )
          )`,
    );
  }

  async search(
    operatorPuuid: string,
    filters: SearchMatchHistoryFilters,
  ): Promise<CachedMatchRow[]> {
    const where = ["operator_puuid = $1"];
    const params: unknown[] = [operatorPuuid];
    const add = (clause: string, value: unknown) => {
      params.push(value);
      where.push(clause.replaceAll("?", `$${params.length}`));
    };
    // Case-insensitive exact matches (no LIKE, so % and _ are literal).
    if (filters.map !== undefined) add("lower(map) = lower(?)", filters.map);
    if (filters.agent !== undefined)
      add("lower(operator_agent) = lower(?)", filters.agent);
    if (filters.act !== undefined) add("season_short = ?", filters.act);
    if (filters.rank !== undefined)
      add("lower(operator_tier_name) = lower(?)", filters.rank);
    if (filters.date_from !== undefined)
      add("started_at >= ?", filters.date_from);
    if (filters.date_to !== undefined) add("started_at <= ?", filters.date_to);
    params.push(filters.limit);

    const rows = await run("cache search failed", () =>
      this.db.query(
        `select match_id, map, mode, started_at, season_short, operator_agent,
           operator_tier_id, operator_tier_name, operator_score, operator_kills,
           operator_deaths, operator_assists, operator_won
         from cached_matches
         where ${where.join(" and ")}
         order by started_at desc
         limit $${params.length}`,
        params,
      ),
    );
    const result = z.array(cachedMatchRowSchema).safeParse(rows);
    if (!result.success) {
      throw new SchemaError(
        "cached_matches row did not match the expected shape",
      );
    }
    return result.data;
  }
}
