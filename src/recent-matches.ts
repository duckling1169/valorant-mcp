import type { Endpoints } from "./endpoints";
import type { OperatorIdentity } from "./identity";
import { guardTool, type Envelope } from "./envelope";
import type { StoredMatchesResponse } from "./henrik-schemas";
import type { MatchCache, NewLightCachedMatchRow } from "./match-cache";
import { cacheFailOpen } from "./cache-fail-open";

const TIER_NAMES: readonly string[] = [
  "Unrated",
  "Unknown 1",
  "Unknown 2",
  "Iron 1",
  "Iron 2",
  "Iron 3",
  "Bronze 1",
  "Bronze 2",
  "Bronze 3",
  "Silver 1",
  "Silver 2",
  "Silver 3",
  "Gold 1",
  "Gold 2",
  "Gold 3",
  "Platinum 1",
  "Platinum 2",
  "Platinum 3",
  "Diamond 1",
  "Diamond 2",
  "Diamond 3",
  "Ascendant 1",
  "Ascendant 2",
  "Ascendant 3",
  "Immortal 1",
  "Immortal 2",
  "Immortal 3",
  "Radiant",
];

export function tierName(id: number): string | null {
  return TIER_NAMES[id] ?? null;
}

// Recent competitive matches for the operator's identity.

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
  config: Pick<OperatorIdentity, "operatorPuuid" | "operatorRegion">;
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

    const cache = deps.cache;
    if (cache) {
      await cacheFailOpen("match cache light write-through failed", () =>
        cache.insertLightMatches(
          operatorPuuid,
          matches.map(toLightCachedMatchRow),
        ),
      );
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
