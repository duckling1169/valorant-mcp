import { z } from "zod";
import type { Endpoints } from "./endpoints";
import type { OperatorIdentity } from "./identity";
import { guardTool, type Envelope } from "./envelope";
import { getMatchInsight } from "./match-insight";
import type { MatchCache } from "./match-cache";
import { requireOperatorParticipant } from "./compare-match";
import { cacheFailOpen } from "./cache-fail-open";

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

// The schema below is the single source of truth for MatchDetail's shape —
// both the tool's own response shape and what validates a cached row's
// `detail` jsonb on read (see the slice-2 note above). Types are derived via
// z.infer rather than hand-kept-in-sync interfaces, same pattern as
// henrik-schemas.ts's own response types.
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

export type MatchDetail = z.infer<typeof matchDetailSchema>;
export type MatchPlayerDetail = MatchDetail["players"][number];
export type MatchTeamDetail = MatchDetail["teams"][number];

export interface MatchDetailDeps {
  endpoints: Endpoints;
  config: Pick<OperatorIdentity, "operatorPuuid" | "operatorRegion">;
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

    const cache = deps.cache;
    if (cache) {
      // A thrown lookup error or a shape mismatch (e.g. after a future
      // response-shape change making an old cached row stale) is just a
      // miss; the live path below always works.
      const cached = await cacheFailOpen(
        "match cache read-through failed",
        () => cache.getDetail(operatorPuuid, match_id),
      );
      if (cached && (!include_insight || cached.has_insight)) {
        const parsed = matchDetailSchema.safeParse(cached.detail);
        if (parsed.success) return parsed.data;
      }
    }

    const match = await deps.endpoints.getMatchById(operatorRegion, match_id);
    requireOperatorParticipant(match, operatorPuuid);

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

    if (cache) {
      const operatorPlayer = match.players.find(
        (player) => player.puuid === operatorPuuid,
      );
      const operatorTeam = match.teams.find(
        (team) => team.team_id === operatorPlayer?.team_id,
      );
      await cacheFailOpen("match cache write-through failed", () =>
        cache.upsert(operatorPuuid, {
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
        }),
      );
    }

    return detail;
  });
}
