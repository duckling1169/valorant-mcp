import type { Endpoints } from "./endpoints";
import type { OperatorIdentity } from "./identity";
import { guardTool, type Envelope } from "./envelope";
import { InputError } from "./errors";

// get_rank_history({ limit?, since_match_id? }) — the operator's per-match
// RR/tier trajectory (mmr-history), newest first. No new consent boundary —
// same operator-only scope as get_player_stats, just the raw trend data
// instead of a pooled rr_climb figure.
//
// HenrikDev's mmr-history endpoint has no query params at all (confirmed
// against docs.henrikdev.xyz, 2026-07-29: no page/size/before/after — it
// always returns its full available history in one call, undocumented
// length). That means a second call with a larger `limit` re-fetches and
// re-truncates the *same* underlying list; any entries already seen by the
// caller come back byte-identical (matches are immutable), just at extra
// token cost. `since_match_id` exists purely to let a caller who already has
// entries in context avoid re-paying for them: it filters the fetched list
// down to only entries strictly newer than that match (this client does the
// windowing HenrikDev doesn't), *then* applies `limit`. If the given
// match_id isn't present in the returned history, that's treated as a bad
// input (typo'd or never-seen id) rather than silently returning everything.

export interface RankHistoryEntry {
  match_id: string;
  map: string | null;
  season: { id: string; short: string };
  tier: { id: number; name: string };
  rr: number;
  last_change: number;
  elo: number;
  refunded_rr: number;
  was_derank_protected: boolean;
  date: string;
}

export interface RankHistoryDeps {
  endpoints: Endpoints;
  config: OperatorIdentity;
}

export async function getRankHistory(
  deps: RankHistoryDeps,
  { limit, since_match_id }: { limit: number; since_match_id?: string },
): Promise<Envelope<RankHistoryEntry[]>> {
  return guardTool(async () => {
    const { operatorPuuid, operatorRegion, operatorPlatform } = deps.config;
    const mmrHistory = await deps.endpoints.getMmrHistory(
      operatorRegion,
      operatorPlatform,
      operatorPuuid,
    );

    let history = mmrHistory.history;
    if (since_match_id !== undefined) {
      const cutoff = history.findIndex((h) => h.match_id === since_match_id);
      if (cutoff === -1) {
        throw new InputError("since_match_id was not found in rank history");
      }
      history = history.slice(0, cutoff);
    }

    return history.slice(0, limit).map((h) => ({
      match_id: h.match_id,
      map: h.map.name,
      season: h.season,
      tier: h.tier,
      rr: h.rr,
      last_change: h.last_change,
      elo: h.elo,
      refunded_rr: h.refunded_rr,
      was_derank_protected: h.was_derank_protected,
      date: h.date,
    }));
  });
}
