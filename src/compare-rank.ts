import type { Endpoints } from "./endpoints";
import type { Platform } from "./config";
import type { OperatorIdentity } from "./identity";
import { guardTool, type Envelope } from "./envelope";
import { InputError } from "./errors";
import { findOpponent, requireOperatorParticipant } from "./compare-match";

// HenrikDev's mmr endpoint only accepts "pc"|"console", but the raw match
// player's platform field is unconfirmed to be that narrow (may report a more
// granular console platform name) — normalize rather than fail-closed reject.
function toMmrPlatform(raw: string): Platform {
  return raw === "pc" ? "pc" : "console";
}

// compare_rank({ match_id, opponent_name, opponent_tag }) — the operator's
// current rank/RR vs. a named opponent's current rank/RR (not their rank at
// match time, which get_match_detail already shows). A live MMR lookup for a
// non-operator player is a narrower consent question than M0's existing
// "match-participant data incidental to a shared match" scope, so it's gated
// even more tightly: the opponent must be found via a specific match the
// operator provides (same lookup as compare_match, never a fresh Riot-ID
// search) — see ARCHITECTURE.md's provisional resolution, 2026-07-28.

export interface RankCompareEntry {
  tier: { id: number; name: string };
  rr: number;
  elo: number;
  leaderboard_placement: number | null;
}

export interface RankCompare {
  operator: RankCompareEntry;
  opponent: { name: string; tag: string } & RankCompareEntry;
}

export interface CompareRankDeps {
  endpoints: Endpoints;
  config: OperatorIdentity;
}

export async function compareRank(
  deps: CompareRankDeps,
  {
    match_id,
    opponent_name,
    opponent_tag,
  }: { match_id: string; opponent_name: string; opponent_tag: string },
): Promise<Envelope<RankCompare>> {
  return guardTool(async () => {
    const { operatorPuuid, operatorRegion, operatorPlatform } = deps.config;
    const match = await deps.endpoints.getMatchById(operatorRegion, match_id);
    requireOperatorParticipant(match, operatorPuuid);

    const opponent = findOpponent(match, opponent_name, opponent_tag);
    if (!opponent) {
      throw new InputError("opponent was not a participant in match_id");
    }

    const [operatorMmr, opponentMmr] = await Promise.all([
      deps.endpoints.getMmr(operatorRegion, operatorPlatform, operatorPuuid),
      deps.endpoints.getMmr(
        operatorRegion,
        toMmrPlatform(opponent.platform),
        opponent.puuid,
      ),
    ]);

    return {
      operator: {
        tier: operatorMmr.current.tier,
        rr: operatorMmr.current.rr,
        elo: operatorMmr.current.elo,
        leaderboard_placement: operatorMmr.current.leaderboard_placement,
      },
      opponent: {
        name: opponent.name,
        tag: opponent.tag,
        tier: opponentMmr.current.tier,
        rr: opponentMmr.current.rr,
        elo: opponentMmr.current.elo,
        leaderboard_placement: opponentMmr.current.leaderboard_placement,
      },
    };
  });
}
