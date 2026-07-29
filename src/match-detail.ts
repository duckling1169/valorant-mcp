import { z } from "zod";
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
//
// M3 slice 2: read-through. A cached row only satisfies a request if
// !include_insight, or include_insight && the row's has_insight is true —
// otherwise it's a miss (falls through to the live path, which then upgrades
// the row). Any lookup failure (thrown error) or a stored `detail` that no
// longer matches this shape (e.g. after a future field change) is also
// treated as a plain miss, never a tool error — the live path is always a
// working fallback, unlike HenrikDev's own schema-drift failures.

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

// Mirrors MatchDetail above — used only to validate a cached row's `detail`
// jsonb on read (see the slice-2 note above), not to construct responses.
const playerInsightSchema = z.object({
  kast: z.number(),
  trade_rate: z.number(),
  traded_out_rate: z.number(),
  first_bloods: z.number(),
  first_deaths: z.number(),
  multi_kills: z.object({
    doubles: z.number(),
    triples: z.number(),
    quads: z.number(),
    aces: z.number(),
  }),
  weapon_kills: z.array(z.object({ weapon: z.string(), kills: z.number() })),
  weapon_accuracy: z.array(
    z.object({
      weapon: z.string(),
      headshot_pct: z.number(),
      approximate: z.literal(true),
    }),
  ),
  side: z.object({
    attack: z.object({
      win_rate: z.number(),
      acs: z.number(),
      kills: z.number(),
      deaths: z.number(),
      first_bloods: z.number(),
    }),
    defense: z.object({
      win_rate: z.number(),
      acs: z.number(),
      kills: z.number(),
      deaths: z.number(),
      first_bloods: z.number(),
    }),
  }),
  economy: z.object({
    eco: z.object({ rounds: z.number(), win_rate: z.number() }),
    semi: z.object({ rounds: z.number(), win_rate: z.number() }),
    full: z.object({ rounds: z.number(), win_rate: z.number() }),
  }),
  plants: z.number(),
  defuses: z.number(),
  clutches: z.object({
    attempts: z.number(),
    wins: z.number(),
    by: z.object({
      "1v1": z.number(),
      "1v2": z.number(),
      "1v3+": z.number(),
    }),
  }),
  party_id: z.string(),
});

const matchDetailSchema = z.object({
  match_id: z.string(),
  map: z.string(),
  mode: z.string().nullable(),
  started_at: z.string(),
  game_length_in_ms: z.number(),
  is_completed: z.boolean(),
  players: z.array(
    z.object({
      name: z.string(),
      tag: z.string(),
      team_id: z.string(),
      agent: z.string().nullable(),
      tier: z.object({ id: z.number(), name: z.string() }),
      kills: z.number(),
      deaths: z.number(),
      assists: z.number(),
      score: z.number(),
      headshots: z.number(),
      bodyshots: z.number(),
      legshots: z.number(),
      damage_dealt: z.number(),
      damage_received: z.number(),
      insight: playerInsightSchema.optional(),
    }),
  ),
  teams: z.array(
    z.object({
      team_id: z.string(),
      rounds_won: z.number(),
      rounds_lost: z.number(),
      won: z.boolean(),
    }),
  ),
  trade_window_ms: z.number().optional(),
  economy_thresholds: z
    .object({ eco: z.number(), semi: z.number() })
    .optional(),
  party: z
    .object({
      operator_party_size: z.number(),
      other_party_sizes: z.array(z.number()),
    })
    .optional(),
  operator_lobby_percentile: z
    .object({ acs: z.number(), adr: z.number() })
    .optional(),
});

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

    if (deps.cache) {
      try {
        const cached = await deps.cache.getDetail(match_id);
        if (cached && (!include_insight || cached.has_insight)) {
          const parsed = matchDetailSchema.safeParse(cached.detail);
          if (parsed.success) return parsed.data;
        }
      } catch (err) {
        // Fail-open (ARCHITECTURE.md's cache decisions) — a lookup failure
        // or a shape mismatch is just a miss; the live path below always
        // works. Operational metadata only: no player data, no match content.
        console.error(
          "match cache read-through failed",
          err instanceof Error ? err.message : String(err),
        );
      }
    }

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
          has_insight: include_insight === true,
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
