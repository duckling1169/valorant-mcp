import type { Endpoints } from "./endpoints";
import type { ServerConfig } from "./config";
import { guardTool, type Envelope } from "./envelope";

// get_recent_matches({ limit? }) — recent competitive matches only, bound to the
// one configured operator profile. `limit` is validated by the MCP tool's declared
// zod inputSchema (1-10, default 10), not our own InputError — see ARCHITECTURE.md
// decisions and the Slice 4 plan for why that split is the right one here.

export interface RecentMatch {
  match_id: string;
  map: string | null;
  mode: string;
  started_at: string;
  agent: string | null;
  tier: number;
  score: number;
  kills: number;
  deaths: number;
  assists: number;
  /** null when either team's round count is missing from the payload. */
  won: boolean | null;
}

export interface RecentMatches {
  matches: RecentMatch[];
}

export interface RecentMatchesDeps {
  endpoints: Endpoints;
  config: Pick<ServerConfig, "operatorPuuid" | "operatorRegion">;
}

export function computeWon(
  team: string,
  red: number | null,
  blue: number | null,
): boolean | null {
  if (red === null || blue === null) return null;
  const own = team.toLowerCase() === "red" ? red : blue;
  const other = team.toLowerCase() === "red" ? blue : red;
  return own > other;
}

export async function getRecentMatches(
  deps: RecentMatchesDeps,
  { limit }: { limit: number },
): Promise<Envelope<RecentMatches>> {
  return guardTool(async () => {
    const { operatorPuuid, operatorRegion } = deps.config;
    const matches = await deps.endpoints.getRecentMatches(
      operatorRegion,
      operatorPuuid,
      limit,
    );

    return {
      matches: matches.map((match) => ({
        match_id: match.meta.id,
        map: match.meta.map.name,
        mode: match.meta.mode,
        started_at: match.meta.started_at,
        agent: match.stats.character.name,
        tier: match.stats.tier,
        score: match.stats.score,
        kills: match.stats.kills,
        deaths: match.stats.deaths,
        assists: match.stats.assists,
        won: computeWon(match.stats.team, match.teams.red, match.teams.blue),
      })),
    };
  });
}
