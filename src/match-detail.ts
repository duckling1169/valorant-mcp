import type { Endpoints } from "./endpoints";
import type { ServerConfig } from "./config";
import { guardTool, type Envelope } from "./envelope";
import { InputError } from "./errors";
import { getMatchInsight, type PlayerInsight } from "./match-insight";
import type { MatchCache } from "./match-cache";

// get_match_detail({ match_id }) — compact selected-match detail. Unlike
// get_profile/get_recent_matches (inherently scoped to the operator), this tool
// takes an arbitrary match_id, so it's the first place we must actively enforce
// the M0 consent-scope decision in code: match-participant data is in-scope only
// when the operator was a player in that match (ARCHITECTURE.md, 2026-07-28).
//
// M3's first cache slice (ARCHITECTURE.md, 2026-07-28 "bounded cache"): every
// successful call here also write-throughs a row to MatchCache so
// search_match_history can find it later. The cache write is best-effort —
// fail-open, logged and swallowed, never surfaced as a tool error — since
// get_match_detail's own contract (return this match's detail) has already
// been satisfied by the point the write happens.

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
  insight?: PlayerInsight;
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
  trade_window_ms?: number;
  economy_thresholds?: { eco: number; semi: number };
  party?: { operator_party_size: number; other_party_sizes: number[] };
  operator_lobby_percentile?: { acs: number; adr: number };
}

export interface MatchDetailDeps {
  endpoints: Endpoints;
  config: Pick<ServerConfig, "operatorPuuid" | "operatorRegion">;
  cache?: MatchCache;
}

export async function getMatchDetail(
  deps: MatchDetailDeps,
  {
    match_id,
    include_insight,
  }: { match_id: string; include_insight?: boolean },
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

    const insight = include_insight
      ? getMatchInsight(match, operatorPuuid)
      : null;

    const detail: MatchDetail = {
      match_id: match.metadata.match_id,
      map: match.metadata.map.name,
      mode: match.metadata.queue.name,
      started_at: match.metadata.started_at,
      game_length_in_ms: match.metadata.game_length_in_ms,
      is_completed: match.metadata.is_completed,
      ...(insight
        ? {
            trade_window_ms: insight.trade_window_ms,
            economy_thresholds: insight.economy_thresholds,
            party: insight.party,
            operator_lobby_percentile: insight.operator_lobby_percentile,
          }
        : {}),
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
        ...(insight ? { insight: insight.players[player.puuid] } : {}),
      })),
      teams: match.teams.map((team) => ({
        team_id: team.team_id,
        rounds_won: team.rounds.won,
        rounds_lost: team.rounds.lost,
        won: team.won,
      })),
    };

    if (deps.cache) {
      const operatorPlayer = match.players.find(
        (player) => player.puuid === operatorPuuid,
      );
      const operatorTeam = match.teams.find(
        (team) => team.team_id === operatorPlayer?.team_id,
      );
      try {
        await deps.cache.upsert({
          match_id: match.metadata.match_id,
          map: match.metadata.map.name,
          mode: match.metadata.queue.name,
          started_at: match.metadata.started_at,
          season_id: match.metadata.season.id,
          season_short: match.metadata.season.short,
          operator_agent: operatorPlayer?.agent.name ?? null,
          operator_tier_id: operatorPlayer?.tier.id ?? null,
          operator_tier_name: operatorPlayer?.tier.name ?? null,
          operator_score: operatorPlayer?.stats.score ?? null,
          operator_kills: operatorPlayer?.stats.kills ?? null,
          operator_deaths: operatorPlayer?.stats.deaths ?? null,
          operator_assists: operatorPlayer?.stats.assists ?? null,
          operator_won: operatorTeam?.won ?? null,
          detail,
        });
      } catch (err) {
        // Best-effort write-through (ARCHITECTURE.md's fail-open decision) —
        // never let a cache outage fail an otherwise-successful tool call.
        // Operational metadata only: no player data, no match content.
        console.error(
          "match cache write-through failed",
          err instanceof Error ? err.message : String(err),
        );
      }
    }

    return detail;
  });
}
