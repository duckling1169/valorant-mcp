import type { MatchByIdResponse } from "./henrik-schemas";

// M2's T2 facets — folded into get_match_detail behind include_insight (opt-in:
// the compute cost is negligible next to the network fetch already paid, but the
// token cost is real, ~3.7x the compact response). Every threshold/algorithm here
// was verified against the operator's real match history during M2 slice 2's
// grilling session, not just assumed from legacy or HenrikDev's (twice-wrong)
// OpenAPI spec — see ARCHITECTURE.md for the dated decisions.

type Match = MatchByIdResponse["data"];

export const TRADE_WINDOW_MS = 3000;
export const ECONOMY_THRESHOLDS = { eco: 2000, semi: 3900 };

export interface MultiKills {
  doubles: number;
  triples: number;
  quads: number;
  aces: number;
}

export interface WeaponKillCount {
  weapon: string;
  kills: number;
}

export interface WeaponAccuracy {
  weapon: string;
  headshot_pct: number;
  /** Inferred from the round's buy-phase loadout, not a per-shot weapon tag —
   * HenrikDev's damage_events carry no weapon field (see ARCHITECTURE.md). */
  approximate: true;
}

export interface SideStats {
  win_rate: number;
  acs: number;
  kills: number;
  deaths: number;
  first_bloods: number;
}

export interface EconomyBucketStats {
  rounds: number;
  win_rate: number;
}

export interface ClutchStats {
  attempts: number;
  wins: number;
  by: Record<"1v1" | "1v2" | "1v3+", number>;
}

export interface PlayerInsight {
  kast: number;
  trade_rate: number;
  traded_out_rate: number;
  first_bloods: number;
  first_deaths: number;
  multi_kills: MultiKills;
  weapon_kills: WeaponKillCount[];
  weapon_accuracy: WeaponAccuracy[];
  side: { attack: SideStats; defense: SideStats };
  economy: {
    eco: EconomyBucketStats;
    semi: EconomyBucketStats;
    full: EconomyBucketStats;
  };
  plants: number;
  defuses: number;
  clutches: ClutchStats;
  party_id: string;
}

export interface MatchInsight {
  trade_window_ms: number;
  economy_thresholds: { eco: number; semi: number };
  party: { operator_party_size: number; other_party_sizes: number[] };
  operator_lobby_percentile: { acs: number; adr: number };
  players: Record<string, PlayerInsight>;
}

function teamOf(match: Match, puuid: string): string | undefined {
  return match.players.find((p) => p.puuid === puuid)?.team_id;
}

function roundKillsSorted(match: Match, roundId: number) {
  return match.kills
    .filter((k) => k.round === roundId)
    .sort((a, b) => a.time_in_round_in_ms - b.time_in_round_in_ms);
}

function computeKast(match: Match, puuid: string): number {
  const team = teamOf(match, puuid);
  if (!team || match.rounds.length === 0) return 0;

  let counted = 0;
  for (const round of match.rounds) {
    const roundKills = roundKillsSorted(match, round.id);
    const died = roundKills.find((k) => k.victim.puuid === puuid);
    const gotKill = roundKills.some((k) => k.killer.puuid === puuid);
    const gotAssist = roundKills.some((k) =>
      k.assistants.some((a) => a.puuid === puuid),
    );

    let traded = false;
    if (died) {
      traded = roundKills.some(
        (k2) =>
          k2.victim.puuid === died.killer.puuid &&
          k2.time_in_round_in_ms > died.time_in_round_in_ms &&
          k2.time_in_round_in_ms - died.time_in_round_in_ms <=
            TRADE_WINDOW_MS &&
          teamOf(match, k2.killer.puuid) === team,
      );
    }

    if (gotKill || gotAssist || !died || traded) counted++;
  }
  return counted / match.rounds.length;
}

function computeTrades(
  match: Match,
  puuid: string,
): { trade_rate: number; traded_out_rate: number } {
  const team = teamOf(match, puuid);
  if (!team) return { trade_rate: 0, traded_out_rate: 0 };

  const ownKills = match.kills.filter((k) => k.killer.puuid === puuid);
  const ownDeaths = match.kills.filter((k) => k.victim.puuid === puuid);

  let tradeKills = 0;
  for (const kill of ownKills) {
    const victimRecentKill = match.kills.find(
      (k2) =>
        k2.round === kill.round &&
        k2.killer.puuid === kill.victim.puuid &&
        k2.time_in_round_in_ms < kill.time_in_round_in_ms &&
        kill.time_in_round_in_ms - k2.time_in_round_in_ms <= TRADE_WINDOW_MS &&
        teamOf(match, k2.victim.puuid) === team,
    );
    if (victimRecentKill) tradeKills++;
  }

  let tradedOutDeaths = 0;
  for (const death of ownDeaths) {
    const revenge = match.kills.find(
      (k2) =>
        k2.round === death.round &&
        k2.victim.puuid === death.killer.puuid &&
        k2.time_in_round_in_ms > death.time_in_round_in_ms &&
        k2.time_in_round_in_ms - death.time_in_round_in_ms <= TRADE_WINDOW_MS &&
        teamOf(match, k2.killer.puuid) === team,
    );
    if (revenge) tradedOutDeaths++;
  }

  return {
    trade_rate: ownKills.length > 0 ? tradeKills / ownKills.length : 0,
    traded_out_rate:
      ownDeaths.length > 0 ? tradedOutDeaths / ownDeaths.length : 0,
  };
}

function computeFirstBloodsDeaths(
  match: Match,
  puuid: string,
): { first_bloods: number; first_deaths: number } {
  let first_bloods = 0;
  let first_deaths = 0;
  for (const round of match.rounds) {
    const roundKills = roundKillsSorted(match, round.id);
    const first = roundKills[0];
    if (!first) continue;
    if (first.killer.puuid === puuid) first_bloods++;
    if (first.victim.puuid === puuid) first_deaths++;
  }
  return { first_bloods, first_deaths };
}

function computeMultiKills(match: Match, puuid: string): MultiKills {
  const result: MultiKills = { doubles: 0, triples: 0, quads: 0, aces: 0 };
  for (const round of match.rounds) {
    const count = match.kills.filter(
      (k) => k.round === round.id && k.killer.puuid === puuid,
    ).length;
    if (count === 2) result.doubles++;
    else if (count === 3) result.triples++;
    else if (count === 4) result.quads++;
    else if (count >= 5) result.aces++;
  }
  return result;
}

function computeWeaponKills(match: Match, puuid: string): WeaponKillCount[] {
  const counts = new Map<string, number>();
  for (const kill of match.kills) {
    if (kill.killer.puuid !== puuid) continue;
    const weapon = kill.weapon.name ?? "Unknown";
    counts.set(weapon, (counts.get(weapon) ?? 0) + 1);
  }
  return Array.from(counts.entries()).map(([weapon, kills]) => ({
    weapon,
    kills,
  }));
}

function computeWeaponAccuracy(match: Match, puuid: string): WeaponAccuracy[] {
  const totals = new Map<string, { head: number; body: number; leg: number }>();
  for (const round of match.rounds) {
    const playerRoundStats = round.stats.find((s) => s.player.puuid === puuid);
    if (!playerRoundStats) continue;
    const weapon = playerRoundStats.economy.weapon?.name ?? "Unknown";
    const entry = totals.get(weapon) ?? { head: 0, body: 0, leg: 0 };
    for (const de of playerRoundStats.damage_events) {
      entry.head += de.headshots;
      entry.body += de.bodyshots;
      entry.leg += de.legshots;
    }
    totals.set(weapon, entry);
  }
  return Array.from(totals.entries()).map(([weapon, t]) => {
    const totalShots = t.head + t.body + t.leg;
    return {
      weapon,
      headshot_pct: totalShots > 0 ? t.head / totalShots : 0,
      approximate: true as const,
    };
  });
}

// Verified live against 10 real matches (Red always attacks first half) and one
// real 30-round overtime match (OT alternates every round, starting with
// whichever team defended in the second half attacking first at round 24) —
// ARCHITECTURE.md records both findings. No approximation needed: side is a
// deterministic function of team_id + round parity.
function attackingTeam(roundId: number): "Red" | "Blue" {
  if (roundId < 12) return "Red";
  if (roundId < 24) return "Blue";
  const otIndex = roundId - 24;
  return otIndex % 2 === 0 ? "Red" : "Blue";
}

function emptySideStats(): SideStats {
  return { win_rate: 0, acs: 0, kills: 0, deaths: 0, first_bloods: 0 };
}

function computeSide(
  match: Match,
  puuid: string,
): { attack: SideStats; defense: SideStats } {
  const team = teamOf(match, puuid);
  if (!team) return { attack: emptySideStats(), defense: emptySideStats() };

  const accum = {
    attack: {
      rounds: 0,
      wins: 0,
      score: 0,
      kills: 0,
      deaths: 0,
      first_bloods: 0,
    },
    defense: {
      rounds: 0,
      wins: 0,
      score: 0,
      kills: 0,
      deaths: 0,
      first_bloods: 0,
    },
  };

  for (const round of match.rounds) {
    const playerRoundStats = round.stats.find((s) => s.player.puuid === puuid);
    if (!playerRoundStats) continue;

    const side = attackingTeam(round.id) === team ? "attack" : "defense";
    const bucket = accum[side];
    bucket.rounds++;
    if (round.winning_team === team) bucket.wins++;
    bucket.score += playerRoundStats.stats.score;
    bucket.kills += playerRoundStats.stats.kills;

    const roundKills = roundKillsSorted(match, round.id);
    if (roundKills.some((k) => k.victim.puuid === puuid)) bucket.deaths++;
    if (roundKills[0]?.killer.puuid === puuid) bucket.first_bloods++;
  }

  const finalize = (b: (typeof accum)["attack"]): SideStats => ({
    win_rate: b.rounds > 0 ? b.wins / b.rounds : 0,
    acs: b.rounds > 0 ? b.score / b.rounds : 0,
    kills: b.kills,
    deaths: b.deaths,
    first_bloods: b.first_bloods,
  });

  return { attack: finalize(accum.attack), defense: finalize(accum.defense) };
}

function economyBucket(loadoutValue: number): "eco" | "semi" | "full" {
  if (loadoutValue < ECONOMY_THRESHOLDS.eco) return "eco";
  if (loadoutValue < ECONOMY_THRESHOLDS.semi) return "semi";
  return "full";
}

function computeEconomy(
  match: Match,
  puuid: string,
): {
  eco: EconomyBucketStats;
  semi: EconomyBucketStats;
  full: EconomyBucketStats;
} {
  const team = teamOf(match, puuid);
  const accum = {
    eco: { rounds: 0, wins: 0 },
    semi: { rounds: 0, wins: 0 },
    full: { rounds: 0, wins: 0 },
  };

  for (const round of match.rounds) {
    const playerRoundStats = round.stats.find((s) => s.player.puuid === puuid);
    if (!playerRoundStats) continue;
    const bucket = economyBucket(playerRoundStats.economy.loadout_value);
    accum[bucket].rounds++;
    if (round.winning_team === team) accum[bucket].wins++;
  }

  const finalize = (b: {
    rounds: number;
    wins: number;
  }): EconomyBucketStats => ({
    rounds: b.rounds,
    win_rate: b.rounds > 0 ? b.wins / b.rounds : 0,
  });

  return {
    eco: finalize(accum.eco),
    semi: finalize(accum.semi),
    full: finalize(accum.full),
  };
}

function computePlantsDefuses(
  match: Match,
  puuid: string,
): { plants: number; defuses: number } {
  const plants = match.rounds.filter(
    (r) => r.plant?.player.puuid === puuid,
  ).length;
  const defuses = match.rounds.filter(
    (r) => r.defuse?.player.puuid === puuid,
  ).length;
  return { plants, defuses };
}

// A clutch win requires the player to survive past the moment they became the
// lone survivor, not just for their team to win the round — a team can win via
// spike detonation after its last player dies (post-plant), which isn't a
// personal clutch win (a real bug caught and fixed during verification against
// real matches; see ARCHITECTURE.md).
function computeClutches(match: Match, puuid: string): ClutchStats {
  const team = teamOf(match, puuid);
  const by: Record<"1v1" | "1v2" | "1v3+", number> = {
    "1v1": 0,
    "1v2": 0,
    "1v3+": 0,
  };
  if (!team) return { attempts: 0, wins: 0, by };

  let attempts = 0;
  let wins = 0;

  for (const round of match.rounds) {
    const roundKills = roundKillsSorted(match, round.id);
    const alive = new Set(match.players.map((p) => p.puuid));
    let clutchMomentMs: number | null = null;
    let enemiesAlive = 0;

    for (const kill of roundKills) {
      alive.delete(kill.victim.puuid);
      if (clutchMomentMs === null && alive.has(puuid)) {
        const teammatesAlive = Array.from(alive).filter(
          (p) => p !== puuid && teamOf(match, p) === team,
        );
        const enemies = Array.from(alive).filter(
          (p) => teamOf(match, p) !== team,
        );
        if (teammatesAlive.length === 0 && enemies.length >= 1) {
          clutchMomentMs = kill.time_in_round_in_ms;
          enemiesAlive = enemies.length;
        }
      }
    }

    if (clutchMomentMs !== null) {
      attempts++;
      const key =
        enemiesAlive === 1 ? "1v1" : enemiesAlive === 2 ? "1v2" : "1v3+";
      by[key]++;
      const diedAfter = roundKills.some(
        (k) =>
          k.victim.puuid === puuid && k.time_in_round_in_ms > clutchMomentMs!,
      );
      if (round.winning_team === team && !diedAfter) wins++;
    }
  }

  return { attempts, wins, by };
}

function computePartySize(
  match: Match,
  operatorPuuid: string,
): { operator_party_size: number; other_party_sizes: number[] } {
  const operator = match.players.find((p) => p.puuid === operatorPuuid);
  const groups = new Map<string, number>();
  for (const p of match.players) {
    groups.set(p.party_id, (groups.get(p.party_id) ?? 0) + 1);
  }
  const operatorPartySize = operator ? (groups.get(operator.party_id) ?? 1) : 1;
  const otherPartySizes = Array.from(groups.entries())
    .filter(([partyId]) => partyId !== operator?.party_id)
    .map(([, size]) => size);
  return {
    operator_party_size: operatorPartySize,
    other_party_sizes: otherPartySizes,
  };
}

function percentileRank(values: number[], value: number): number {
  if (values.length === 0) return 0;
  // Inclusive ("at or below") so the lobby's actual top performer reads 100,
  // not <100 — more intuitive for a "better than X% of the lobby" readout.
  const atOrBelow = values.filter((v) => v <= value).length;
  return Math.round((atOrBelow / values.length) * 100);
}

function computeLobbyPercentile(
  match: Match,
  operatorPuuid: string,
): { acs: number; adr: number } {
  const totalRounds = match.rounds.length;
  const perPlayer = match.players.map((p) => ({
    puuid: p.puuid,
    acs: totalRounds > 0 ? p.stats.score / totalRounds : 0,
    adr: totalRounds > 0 ? p.stats.damage.dealt / totalRounds : 0,
  }));
  const operator = perPlayer.find((p) => p.puuid === operatorPuuid);
  if (!operator) return { acs: 0, adr: 0 };
  return {
    acs: percentileRank(
      perPlayer.map((p) => p.acs),
      operator.acs,
    ),
    adr: percentileRank(
      perPlayer.map((p) => p.adr),
      operator.adr,
    ),
  };
}

export function getMatchInsight(
  match: Match,
  operatorPuuid: string,
): MatchInsight {
  const players: Record<string, PlayerInsight> = {};
  for (const p of match.players) {
    const { first_bloods, first_deaths } = computeFirstBloodsDeaths(
      match,
      p.puuid,
    );
    const trades = computeTrades(match, p.puuid);
    const { plants, defuses } = computePlantsDefuses(match, p.puuid);
    players[p.puuid] = {
      kast: computeKast(match, p.puuid),
      trade_rate: trades.trade_rate,
      traded_out_rate: trades.traded_out_rate,
      first_bloods,
      first_deaths,
      multi_kills: computeMultiKills(match, p.puuid),
      weapon_kills: computeWeaponKills(match, p.puuid),
      weapon_accuracy: computeWeaponAccuracy(match, p.puuid),
      side: computeSide(match, p.puuid),
      economy: computeEconomy(match, p.puuid),
      plants,
      defuses,
      clutches: computeClutches(match, p.puuid),
      party_id: p.party_id,
    };
  }

  return {
    trade_window_ms: TRADE_WINDOW_MS,
    economy_thresholds: ECONOMY_THRESHOLDS,
    party: computePartySize(match, operatorPuuid),
    operator_lobby_percentile: computeLobbyPercentile(match, operatorPuuid),
    players,
  };
}
