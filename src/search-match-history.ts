import { guardTool, type Envelope } from "./envelope";
import type { MatchCache } from "./match-cache";
import type { RecentMatch } from "./recent-matches";

// search_match_history({ map?, agent?, act?, rank?, date_from?, date_to?, limit? })
// — cache-only query over matches the operator has already individually
// detailed via get_match_detail (ARCHITECTURE.md, 2026-07-28 "bounded cache").
// No live HenrikDev fallback: an empty result means nothing cached matches the
// filters, not an error — a cache populated only opportunistically by
// get_match_detail calls is expected to have gaps.

export interface SearchMatchHistoryDeps {
  cache: MatchCache;
}

export interface SearchMatchHistoryFilters {
  map?: string;
  agent?: string;
  act?: string;
  rank?: string;
  date_from?: string;
  date_to?: string;
  limit: number;
}

export async function searchMatchHistory(
  deps: SearchMatchHistoryDeps,
  filters: SearchMatchHistoryFilters,
): Promise<Envelope<RecentMatch[]>> {
  return guardTool(async () => {
    const rows = await deps.cache.search(filters);
    return rows.map((row) => ({
      match_id: row.match_id,
      map: row.map,
      mode: row.mode ?? "",
      started_at: row.started_at,
      agent: row.operator_agent,
      tier: { id: row.operator_tier_id ?? 0, name: row.operator_tier_name },
      score: row.operator_score ?? 0,
      kills: row.operator_kills ?? 0,
      deaths: row.operator_deaths ?? 0,
      assists: row.operator_assists ?? 0,
      won: row.operator_won,
    }));
  });
}
