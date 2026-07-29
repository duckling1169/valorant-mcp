import type { Endpoints } from "./endpoints";
import type { ServerConfig } from "./config";
import { guardTool, type Envelope } from "./envelope";
import { tierName } from "./tiers";
import type { StoredMatchesResponse } from "./henrik-schemas";
import type { MatchCache, NewLightCachedMatchRow } from "./match-cache";

// get_recent_matches({ limit? }) — recent competitive matches only, bound to the
// one configured operator profile. `limit` is validated by the MCP tool's declared
// zod inputSchema (1-10, default 10), not our own InputError — see ARCHITECTURE.md
// decisions and the Slice 4 plan for why that split is the right one here.
//
// M3 slice 3: also write-throughs "light" rows to MatchCache (operator's own
// stat line only — stored-matches has no other participants, so this can
// never be a valid MatchDetail). Never overwrites an existing row, light or
// full (see match-cache.ts); fail-open, same as get_match_detail's write path.
// player-stats.ts reuses toLightCachedMatchRow for the same mapping.

export interface RecentMatch {
  match_id: string;
  map: string | null;
  mode: string;
  started_at: string;
  agent: string | null;
  tier: { id: number; name: string | null };
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
  cache?: MatchCache;
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

export function toLightCachedMatchRow(
  match: StoredMatchesResponse["data"][number],
): NewLightCachedMatchRow {
  return {
    match_id: match.meta.id,
    map: match.meta.map.name,
    mode: match.meta.mode,
    started_at: match.meta.started_at,
    season_id: match.meta.season.id,
    season_short: match.meta.season.short,
    operator_agent: match.stats.character.name,
    operator_tier_id: match.stats.tier,
    operator_tier_name: tierName(match.stats.tier),
    operator_score: match.stats.score,
    operator_kills: match.stats.kills,
    operator_deaths: match.stats.deaths,
    operator_assists: match.stats.assists,
    operator_won: computeWon(
      match.stats.team,
      match.teams.red,
      match.teams.blue,
    ),
  };
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

    if (deps.cache) {
      try {
        await deps.cache.insertLightMatches(matches.map(toLightCachedMatchRow));
      } catch (err) {
        // Best-effort write-through (ARCHITECTURE.md's fail-open decision).
        console.error(
          "match cache light write-through failed",
          err instanceof Error ? err.message : String(err),
        );
      }
    }

    return {
      matches: matches.map((match) => ({
        match_id: match.meta.id,
        map: match.meta.map.name,
        mode: match.meta.mode,
        started_at: match.meta.started_at,
        agent: match.stats.character.name,
        tier: { id: match.stats.tier, name: tierName(match.stats.tier) },
        score: match.stats.score,
        kills: match.stats.kills,
        deaths: match.stats.deaths,
        assists: match.stats.assists,
        won: computeWon(match.stats.team, match.teams.red, match.teams.blue),
      })),
    };
  });
}
