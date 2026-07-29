import { describe, it, expect } from "vitest";
import { getMatchInsight } from "./match-insight";
import type { MatchByIdResponse } from "./henrik-schemas";

type Match = MatchByIdResponse["data"];
type MatchPlayer = Match["players"][number];
type MatchRound = Match["rounds"][number];
type MatchKill = Match["kills"][number];

function buildPlayer(
  overrides: Partial<MatchPlayer> & { puuid: string },
): MatchPlayer {
  return {
    name: overrides.puuid,
    tag: "T1",
    team_id: "Red",
    party_id: "party-default",
    platform: "pc",
    agent: { name: "Jett" },
    tier: { id: 10, name: "Silver 2" },
    stats: {
      score: 0,
      kills: 0,
      deaths: 0,
      assists: 0,
      headshots: 0,
      bodyshots: 0,
      legshots: 0,
      damage: { dealt: 0, received: 0 },
    },
    ...overrides,
  };
}

function ref(puuid: string, team: string) {
  return { puuid, team };
}

function buildRound(
  overrides: Partial<MatchRound> & { id: number },
): MatchRound {
  return {
    winning_team: "Red",
    plant: null,
    defuse: null,
    stats: [],
    ...overrides,
  };
}

function buildRoundPlayerStats(
  puuid: string,
  team: string,
  overrides: Partial<MatchRound["stats"][number]> = {},
): MatchRound["stats"][number] {
  return {
    player: ref(puuid, team),
    damage_events: [],
    stats: { bodyshots: 0, headshots: 0, legshots: 0, kills: 0, score: 0 },
    economy: { loadout_value: 3900, weapon: { name: "Vandal" } },
    ...overrides,
  };
}

function buildKill(overrides: Partial<MatchKill>): MatchKill {
  return {
    round: 0,
    time_in_round_in_ms: 0,
    killer: ref("killer", "Red"),
    victim: ref("victim", "Blue"),
    assistants: [],
    weapon: { name: "Vandal" },
    ...overrides,
  };
}

const OP = "op";
const OP2 = "op2";
const EN1 = "en1";
const EN2 = "en2";

function baseMatch(overrides: Partial<Match> = {}): Match {
  return {
    metadata: {
      match_id: "match-1",
      map: { name: "Ascent" },
      queue: { id: "competitive", name: "Competitive" },
      started_at: "t1",
      game_length_in_ms: 0,
      is_completed: true,
    },
    players: [
      buildPlayer({ puuid: OP, team_id: "Red", party_id: "p1" }),
      buildPlayer({ puuid: OP2, team_id: "Red", party_id: "p1" }),
      buildPlayer({ puuid: EN1, team_id: "Blue", party_id: "p2" }),
      buildPlayer({ puuid: EN2, team_id: "Blue", party_id: "p3" }),
    ],
    teams: [
      { team_id: "Red", rounds: { won: 0, lost: 0 }, won: false },
      { team_id: "Blue", rounds: { won: 0, lost: 0 }, won: false },
    ],
    rounds: [],
    kills: [],
    ...overrides,
  };
}

describe("getMatchInsight — KAST and trades", () => {
  it("credits a traded death and the trading kill correctly", () => {
    const match = baseMatch({
      rounds: [buildRound({ id: 0, winning_team: "Red" })],
      kills: [
        buildKill({
          round: 0,
          time_in_round_in_ms: 1000,
          killer: ref(EN1, "Blue"),
          victim: ref(OP, "Red"),
        }),
        buildKill({
          round: 0,
          time_in_round_in_ms: 2500,
          killer: ref(OP2, "Red"),
          victim: ref(EN1, "Blue"),
        }),
      ],
    });

    const insight = getMatchInsight(match, OP);
    // op died but was traded within the window -> counts toward KAST and traded_out_rate
    expect(insight.players[OP]?.kast).toBe(1);
    expect(insight.players[OP]?.traded_out_rate).toBe(1);
    // op2's kill avenged a teammate's death within the window -> counts as a trade kill
    expect(insight.players[OP2]?.trade_rate).toBe(1);
    expect(insight.players[OP2]?.kast).toBe(1);
  });

  it("does not credit a trade outside the window", () => {
    const match = baseMatch({
      rounds: [buildRound({ id: 0, winning_team: "Blue" })],
      kills: [
        buildKill({
          round: 0,
          time_in_round_in_ms: 0,
          killer: ref(EN1, "Blue"),
          victim: ref(OP, "Red"),
        }),
        buildKill({
          round: 0,
          time_in_round_in_ms: 5000, // 5000ms later, outside the 3000ms window
          killer: ref(OP2, "Red"),
          victim: ref(EN1, "Blue"),
        }),
      ],
    });

    const insight = getMatchInsight(match, OP);
    expect(insight.players[OP]?.traded_out_rate).toBe(0);
    expect(insight.players[OP2]?.trade_rate).toBe(0);
  });
});

describe("getMatchInsight — first bloods, multi-kills, weapons", () => {
  it("computes first blood, a double kill, weapon kills, and approximate weapon accuracy", () => {
    const match = baseMatch({
      rounds: [
        buildRound({
          id: 0,
          winning_team: "Red",
          stats: [
            buildRoundPlayerStats(OP, "Red", {
              economy: { loadout_value: 3900, weapon: { name: "Vandal" } },
              damage_events: [
                {
                  player: ref(EN1, "Blue"),
                  headshots: 1,
                  bodyshots: 2,
                  legshots: 0,
                  damage: 150,
                },
                {
                  player: ref(EN2, "Blue"),
                  headshots: 0,
                  bodyshots: 2,
                  legshots: 1,
                  damage: 80,
                },
              ],
            }),
          ],
        }),
      ],
      kills: [
        buildKill({
          round: 0,
          time_in_round_in_ms: 1000,
          killer: ref(OP, "Red"),
          victim: ref(EN1, "Blue"),
          weapon: { name: "Vandal" },
        }),
        buildKill({
          round: 0,
          time_in_round_in_ms: 2000,
          killer: ref(OP, "Red"),
          victim: ref(EN2, "Blue"),
          weapon: { name: "Ghost" },
        }),
      ],
    });

    const insight = getMatchInsight(match, OP);
    const op = insight.players[OP];
    expect(op?.first_bloods).toBe(1);
    expect(op?.multi_kills.doubles).toBe(1);
    expect(op?.weapon_kills).toEqual(
      expect.arrayContaining([
        { weapon: "Vandal", kills: 1 },
        { weapon: "Ghost", kills: 1 },
      ]),
    );
    // both kills' damage_events are attributed to the round's buy-phase weapon
    // (Vandal), even though the second kill's finishing shot was with a Ghost —
    // this is the documented approximation, not a bug.
    expect(op?.weapon_accuracy).toEqual([
      { weapon: "Vandal", headshot_pct: 1 / 6, approximate: true },
    ]);
  });
});

describe("getMatchInsight — side splits (regulation and overtime)", () => {
  it("attributes attack/defense correctly across half 1, half 2, and overtime", () => {
    const match = baseMatch({
      rounds: [
        buildRound({
          id: 0,
          winning_team: "Red",
          stats: [buildRoundPlayerStats(OP, "Red")],
        }), // regulation half 1: Red attacks -> op (Red) attacking, round won
        buildRound({
          id: 12,
          winning_team: "Blue",
          stats: [buildRoundPlayerStats(OP, "Red")],
        }), // regulation half 2: Blue attacks -> op (Red) defending, round lost
        buildRound({
          id: 24,
          winning_team: "Red",
          stats: [buildRoundPlayerStats(OP, "Red")],
        }), // OT round 1: Red attacks (verified live) -> op attacking, round won
        buildRound({
          id: 25,
          winning_team: "Blue",
          stats: [buildRoundPlayerStats(OP, "Red")],
        }), // OT round 2: Blue attacks -> op defending, round lost
      ],
    });

    const insight = getMatchInsight(match, OP);
    const side = insight.players[OP]?.side;
    expect(side?.attack.win_rate).toBe(1);
    expect(side?.defense.win_rate).toBe(0);
  });
});

describe("getMatchInsight — economy buckets", () => {
  it("buckets rounds into eco/semi/full by the disclosed thresholds", () => {
    const match = baseMatch({
      rounds: [
        buildRound({
          id: 0,
          winning_team: "Blue",
          stats: [
            buildRoundPlayerStats(OP, "Red", {
              economy: { loadout_value: 500, weapon: null },
            }),
          ],
        }),
        buildRound({
          id: 1,
          winning_team: "Blue",
          stats: [
            buildRoundPlayerStats(OP, "Red", {
              economy: { loadout_value: 2500, weapon: { name: "Spectre" } },
            }),
          ],
        }),
        buildRound({
          id: 2,
          winning_team: "Red",
          stats: [
            buildRoundPlayerStats(OP, "Red", {
              economy: { loadout_value: 4500, weapon: { name: "Vandal" } },
            }),
          ],
        }),
      ],
    });

    const insight = getMatchInsight(match, OP);
    const economy = insight.players[OP]?.economy;
    expect(economy?.eco).toEqual({ rounds: 1, win_rate: 0 });
    expect(economy?.semi).toEqual({ rounds: 1, win_rate: 0 });
    expect(economy?.full).toEqual({ rounds: 1, win_rate: 1 });
  });
});

describe("getMatchInsight — plants and defuses", () => {
  it("counts a plant and a defuse", () => {
    const match = baseMatch({
      rounds: [
        buildRound({
          id: 0,
          plant: { round_time_in_ms: 40000, site: "A", player: ref(OP, "Red") },
        }),
        buildRound({
          id: 1,
          defuse: { round_time_in_ms: 50000, player: ref(OP, "Red") },
        }),
      ],
    });

    const insight = getMatchInsight(match, OP);
    expect(insight.players[OP]?.plants).toBe(1);
    expect(insight.players[OP]?.defuses).toBe(1);
  });
});

describe("getMatchInsight — clutches", () => {
  it("credits a true clutch win but not a post-plant death (corrected definition)", () => {
    const match = baseMatch({
      rounds: [
        buildRound({ id: 0, winning_team: "Red" }), // true 1v1 win
        buildRound({ id: 1, winning_team: "Red" }), // team wins, but op dies after clutch moment
      ],
      kills: [
        // Round 0: en2 dies first, then op2 dies leaving op alone vs en1 only
        // (a true 1v1) — op kills en1 and survives.
        buildKill({
          round: 0,
          time_in_round_in_ms: 200,
          killer: ref(OP2, "Red"),
          victim: ref(EN2, "Blue"),
        }),
        buildKill({
          round: 0,
          time_in_round_in_ms: 500,
          killer: ref(EN1, "Blue"),
          victim: ref(OP2, "Red"),
        }),
        buildKill({
          round: 0,
          time_in_round_in_ms: 1500,
          killer: ref(OP, "Red"),
          victim: ref(EN1, "Blue"),
        }),
        // Round 1: en1 dies first, then op2 dies leaving op alone vs en2 only
        // (another true 1v1 moment) — but en2 then kills op before the round
        // ends. Red still wins the round (post-plant detonation), so the old,
        // buggy "won" definition would have wrongly credited this as a win.
        buildKill({
          round: 1,
          time_in_round_in_ms: 200,
          killer: ref(OP2, "Red"),
          victim: ref(EN1, "Blue"),
        }),
        buildKill({
          round: 1,
          time_in_round_in_ms: 500,
          killer: ref(EN2, "Blue"),
          victim: ref(OP2, "Red"),
        }),
        buildKill({
          round: 1,
          time_in_round_in_ms: 3000,
          killer: ref(EN2, "Blue"),
          victim: ref(OP, "Red"),
        }),
      ],
    });

    const insight = getMatchInsight(match, OP);
    const clutches = insight.players[OP]?.clutches;
    expect(clutches?.attempts).toBe(2);
    expect(clutches?.wins).toBe(1);
    expect(clutches?.by["1v1"]).toBe(2);
  });
});

describe("getMatchInsight — party size", () => {
  it("groups the operator's party separately from other parties", () => {
    const match = baseMatch();
    const insight = getMatchInsight(match, OP);
    expect(insight.party.operator_party_size).toBe(2);
    expect(insight.party.other_party_sizes.sort()).toEqual([1, 1]);
  });
});

describe("getMatchInsight — lobby percentile", () => {
  it("ranks the operator's ACS/ADR against the full lobby", () => {
    const match = baseMatch({
      rounds: [buildRound({ id: 0 }), buildRound({ id: 1 })],
      players: [
        buildPlayer({
          puuid: OP,
          team_id: "Red",
          party_id: "p1",
          stats: {
            score: 400,
            kills: 0,
            deaths: 0,
            assists: 0,
            headshots: 0,
            bodyshots: 0,
            legshots: 0,
            damage: { dealt: 300, received: 0 },
          },
        }),
        buildPlayer({
          puuid: OP2,
          team_id: "Red",
          party_id: "p1",
          stats: {
            score: 200,
            kills: 0,
            deaths: 0,
            assists: 0,
            headshots: 0,
            bodyshots: 0,
            legshots: 0,
            damage: { dealt: 150, received: 0 },
          },
        }),
        buildPlayer({
          puuid: EN1,
          team_id: "Blue",
          party_id: "p2",
          stats: {
            score: 100,
            kills: 0,
            deaths: 0,
            assists: 0,
            headshots: 0,
            bodyshots: 0,
            legshots: 0,
            damage: { dealt: 100, received: 0 },
          },
        }),
      ],
    });

    const insight = getMatchInsight(match, OP);
    // op has the highest ACS/ADR of the 3 players -> 100th percentile (nothing above)
    expect(insight.operator_lobby_percentile.acs).toBe(100);
    expect(insight.operator_lobby_percentile.adr).toBe(100);
  });
});
