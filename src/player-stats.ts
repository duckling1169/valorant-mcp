import type { Endpoints } from "./endpoints";
import type { ServerConfig } from "./config";
import { guardTool, type Envelope } from "./envelope";
import { computeWon, toLightCachedMatchRow } from "./recent-matches";
import { agentRole, type AgentRole } from "./agent-roles";
import type { MatchCache } from "./match-cache";

// get_player_stats({ sample_size? }) — pooled descriptive stats across the
// operator's recent competitive matches (M2's T1 facets: impact distributions,
// headshot %, per-agent breakdown, survival rate, rank/RR/peak/climb, best/worst
// game). No new consent boundary — same operator-only scope as M1's tools.
// Standard error is deliberately omitted: it describes confidence in the mean
// estimator, not the player's actual performance, so it doesn't meet
// ARCHITECTURE.md's "descriptive statistics" bar (ARCHITECTURE.md, 2026-07-28).

export interface StatDistribution {
  mean: number;
  std_dev: number;
  /** mean(recent half) - mean(older half); positive means trending up. */
  trend: number;
}

export interface AgentBreakdownEntry {
  agent: string;
  role: AgentRole | null;
  games: number;
  win_rate: number;
  avg_kda: number;
}

export interface BestWorstGame {
  match_id: string;
  map: string | null;
  acs: number;
  started_at: string;
}

export interface PlayerStats {
  sample_size: number;
  acs: StatDistribution;
  adr: StatDistribution;
  kda: StatDistribution;
  headshot_pct: StatDistribution;
  survival_rate: number;
  agents: AgentBreakdownEntry[];
  rank: {
    tier: { id: number; name: string };
    rr: number;
    elo: number;
    leaderboard_placement: number | null;
    peak: {
      tier: { id: number; name: string };
      season: { id: string; short: string };
    };
  };
  rr_climb: number;
  best_game: BestWorstGame | null;
  worst_game: BestWorstGame | null;
}

export interface PlayerStatsDeps {
  endpoints: Endpoints;
  config: Pick<
    ServerConfig,
    "operatorPuuid" | "operatorRegion" | "operatorPlatform"
  >;
  cache?: MatchCache;
}

interface DerivedMatch {
  match_id: string;
  map: string | null;
  started_at: string;
  agent: string | null;
  rounds: number;
  acs: number;
  adr: number;
  kda: number;
  headshot_pct: number;
  deaths: number;
  won: boolean | null;
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function stdDev(values: number[]): number {
  if (values.length === 0) return 0;
  const avg = mean(values);
  const variance = mean(values.map((v) => (v - avg) ** 2));
  return Math.sqrt(variance);
}

function distribution(values: number[]): StatDistribution {
  // First half of `values` is the more recent matches (matches arrive newest-first).
  const half = Math.floor(values.length / 2);
  const recent = values.slice(0, half);
  const older = values.slice(values.length - half);
  return {
    mean: mean(values),
    std_dev: stdDev(values),
    trend: mean(recent) - mean(older),
  };
}

export async function getPlayerStats(
  deps: PlayerStatsDeps,
  { sample_size }: { sample_size: number },
): Promise<Envelope<PlayerStats>> {
  return guardTool(async () => {
    const { operatorPuuid, operatorRegion, operatorPlatform } = deps.config;

    const [matches, mmr, mmrHistory] = await Promise.all([
      deps.endpoints.getRecentMatches(
        operatorRegion,
        operatorPuuid,
        sample_size,
      ),
      deps.endpoints.getMmr(operatorRegion, operatorPlatform, operatorPuuid),
      deps.endpoints.getMmrHistory(
        operatorRegion,
        operatorPlatform,
        operatorPuuid,
      ),
    ]);

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

    const derived: DerivedMatch[] = matches.map((match) => {
      const rounds = (match.teams.red ?? 0) + (match.teams.blue ?? 0);
      const totalShots =
        match.stats.shots.head + match.stats.shots.body + match.stats.shots.leg;
      return {
        match_id: match.meta.id,
        map: match.meta.map.name,
        started_at: match.meta.started_at,
        agent: match.stats.character.name,
        rounds,
        acs: rounds > 0 ? match.stats.score / rounds : 0,
        adr: rounds > 0 ? match.stats.damage.made / rounds : 0,
        kda:
          (match.stats.kills + match.stats.assists) /
          Math.max(match.stats.deaths, 1),
        headshot_pct: totalShots > 0 ? match.stats.shots.head / totalShots : 0,
        deaths: match.stats.deaths,
        won: computeWon(match.stats.team, match.teams.red, match.teams.blue),
      };
    });

    const totalRounds = derived.reduce((sum, m) => sum + m.rounds, 0);
    const totalDeaths = derived.reduce((sum, m) => sum + m.deaths, 0);

    const agentGroups = new Map<string, DerivedMatch[]>();
    for (const m of derived) {
      const key = m.agent ?? "unknown";
      const group = agentGroups.get(key) ?? [];
      group.push(m);
      agentGroups.set(key, group);
    }
    const agents: AgentBreakdownEntry[] = Array.from(agentGroups.entries()).map(
      ([agent, group]) => {
        const decided = group.filter((m) => m.won !== null);
        return {
          agent,
          role: agentRole(agent === "unknown" ? null : agent),
          games: group.length,
          win_rate:
            decided.length > 0
              ? decided.filter((m) => m.won).length / decided.length
              : 0,
          avg_kda: mean(group.map((m) => m.kda)),
        };
      },
    );

    const bestGame = derived.reduce<DerivedMatch | null>(
      (best, m) => (!best || m.acs > best.acs ? m : best),
      null,
    );
    const worstGame = derived.reduce<DerivedMatch | null>(
      (worst, m) => (!worst || m.acs < worst.acs ? m : worst),
      null,
    );

    return {
      sample_size: derived.length,
      acs: distribution(derived.map((m) => m.acs)),
      adr: distribution(derived.map((m) => m.adr)),
      kda: distribution(derived.map((m) => m.kda)),
      headshot_pct: distribution(derived.map((m) => m.headshot_pct)),
      survival_rate: totalRounds > 0 ? 1 - totalDeaths / totalRounds : 0,
      agents,
      rank: {
        tier: mmr.current.tier,
        rr: mmr.current.rr,
        elo: mmr.current.elo,
        leaderboard_placement: mmr.current.leaderboard_placement,
        peak: {
          tier: mmr.peak.tier,
          season: mmr.peak.season,
        },
      },
      rr_climb: mmrHistory.history.reduce((sum, h) => sum + h.last_change, 0),
      best_game: bestGame
        ? {
            match_id: bestGame.match_id,
            map: bestGame.map,
            acs: bestGame.acs,
            started_at: bestGame.started_at,
          }
        : null,
      worst_game: worstGame
        ? {
            match_id: worstGame.match_id,
            map: worstGame.map,
            acs: worstGame.acs,
            started_at: worstGame.started_at,
          }
        : null,
    };
  });
}
