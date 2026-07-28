import type { Endpoints } from "./endpoints";
import type { ServerConfig } from "./config";
import { guardTool, type Envelope } from "./envelope";
import { InputError } from "./errors";

// get_match_detail({ match_id }) — compact selected-match detail. Unlike
// get_profile/get_recent_matches (inherently scoped to the operator), this tool
// takes an arbitrary match_id, so it's the first place we must actively enforce
// the M0 consent-scope decision in code: match-participant data is in-scope only
// when the operator was a player in that match (ARCHITECTURE.md, 2026-07-28).

export interface MatchPlayerDetail {
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
}

export interface MatchTeamDetail {
  team_id: string;
  rounds_won: number;
  rounds_lost: number;
  won: boolean;
}

export interface MatchDetail {
  match_id: string;
  map: string;
  mode: string | null;
  started_at: string;
  game_length_in_ms: number;
  is_completed: boolean;
  players: MatchPlayerDetail[];
  teams: MatchTeamDetail[];
}

export interface MatchDetailDeps {
  endpoints: Endpoints;
  config: Pick<ServerConfig, "operatorPuuid" | "operatorRegion">;
}

export async function getMatchDetail(
  deps: MatchDetailDeps,
  { match_id }: { match_id: string },
): Promise<Envelope<MatchDetail>> {
  return guardTool(async () => {
    const { operatorPuuid, operatorRegion } = deps.config;
    const match = await deps.endpoints.getMatchById(operatorRegion, match_id);

    const operatorInMatch = match.players.some(
      (player) => player.puuid === operatorPuuid,
    );
    if (!operatorInMatch) {
      throw new InputError("match_id does not include the configured operator");
    }

    return {
      match_id: match.metadata.match_id,
      map: match.metadata.map.name,
      mode: match.metadata.queue.name,
      started_at: match.metadata.started_at,
      game_length_in_ms: match.metadata.game_length_in_ms,
      is_completed: match.metadata.is_completed,
      players: match.players.map((player) => ({
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
      })),
      teams: match.teams.map((team) => ({
        team_id: team.team_id,
        rounds_won: team.rounds.won,
        rounds_lost: team.rounds.lost,
        won: team.won,
      })),
    };
  });
}
