import type { Endpoints } from "./endpoints";
import type { OperatorIdentity } from "./identity";
import { guardTool, type Envelope } from "./envelope";
import { InputError } from "./errors";
import { getMatchInsight, type PlayerInsight } from "./match-insight";
import type { MatchByIdResponse } from "./henrik-schemas";

// compare_match({ match_id, opponent_name, opponent_tag }) — single-match
// head-to-head between the operator and a named opponent, both of whom must
// have played match_id (found via name/tag as already surfaced by
// get_match_detail, never a fresh Riot-ID lookup — ARCHITECTURE.md, 2026-07-28).
// Essentially free: Slice 2's getMatchInsight already computes full per-player
// insight for every participant in one call; this just picks out two.

type Match = MatchByIdResponse["data"];
type MatchPlayer = Match["players"][number];

export interface MatchCompareEntry {
  name: string;
  tag: string;
  team_id: string;
  agent: string | null;
  tier: { id: number; name: string };
  kills: number;
  deaths: number;
  assists: number;
  score: number;
  headshots: number;
  bodyshots: number;
  legshots: number;
  damage_dealt: number;
  damage_received: number;
  insight: PlayerInsight;
}

export interface MatchCompare {
  match_id: string;
  map: string;
  operator: MatchCompareEntry;
  opponent: MatchCompareEntry;
}

export interface CompareMatchDeps {
  endpoints: Endpoints;
  config: Pick<OperatorIdentity, "operatorPuuid" | "operatorRegion">;
}

export function findOpponent(
  match: Match,
  name: string,
  tag: string,
): MatchPlayer | undefined {
  return match.players.find(
    (p) =>
      p.name.toLowerCase() === name.toLowerCase() &&
      p.tag.toLowerCase() === tag.toLowerCase(),
  );
}

/** Shared by get_match_detail/compare_match/compare_rank: every arbitrary-
 * match_id tool must enforce M0's participant-consent gate the same way. */
export function requireOperatorParticipant(
  match: Match,
  operatorPuuid: string,
): MatchPlayer {
  const operator = match.players.find((p) => p.puuid === operatorPuuid);
  if (!operator) {
    throw new InputError("match_id does not include the configured operator");
  }
  return operator;
}

function toCompareEntry(
  player: MatchPlayer,
  insight: PlayerInsight,
): MatchCompareEntry {
  return {
    name: player.name,
    tag: player.tag,
    team_id: player.team_id,
    agent: player.agent.name,
    tier: player.tier,
    kills: player.stats.kills,
    deaths: player.stats.deaths,
    assists: player.stats.assists,
    score: player.stats.score,
    headshots: player.stats.headshots,
    bodyshots: player.stats.bodyshots,
    legshots: player.stats.legshots,
    damage_dealt: player.stats.damage.dealt,
    damage_received: player.stats.damage.received,
    insight,
  };
}

export async function compareMatch(
  deps: CompareMatchDeps,
  {
    match_id,
    opponent_name,
    opponent_tag,
  }: { match_id: string; opponent_name: string; opponent_tag: string },
): Promise<Envelope<MatchCompare>> {
  return guardTool(async () => {
    const { operatorPuuid, operatorRegion } = deps.config;
    const match = await deps.endpoints.getMatchById(operatorRegion, match_id);
    const operator = requireOperatorParticipant(match, operatorPuuid);

    const opponent = findOpponent(match, opponent_name, opponent_tag);
    if (!opponent) {
      throw new InputError("opponent was not a participant in match_id");
    }

    const insight = getMatchInsight(match, operatorPuuid);
    const operatorInsight = insight.players[operator.puuid];
    const opponentInsight = insight.players[opponent.puuid];
    if (!operatorInsight || !opponentInsight) {
      throw new Error(
        "internal: missing computed insight for a known match participant",
      );
    }

    return {
      match_id: match.metadata.match_id,
      map: match.metadata.map.name,
      operator: toCompareEntry(operator, operatorInsight),
      opponent: toCompareEntry(opponent, opponentInsight),
    };
  });
}
