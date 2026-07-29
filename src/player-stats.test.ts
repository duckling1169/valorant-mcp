import { describe, it, expect, vi } from "vitest";
import { getPlayerStats } from "./player-stats";
import type { Endpoints } from "./endpoints";
import { UpstreamError } from "./errors";

const config = {
  operatorPuuid: "abc-123",
  operatorRegion: "na" as const,
  operatorPlatform: "pc" as const,
};

function rawMatch(overrides: {
  id: string;
  agent: string | null;
  team: string;
  score: number;
  kills: number;
  deaths: number;
  assists: number;
  headshots: number;
  bodyshots: number;
  legshots: number;
  made: number;
  red: number | null;
  blue: number | null;
  started_at: string;
  map?: string | null;
}) {
  return {
    meta: {
      id: overrides.id,
      map: { name: overrides.map ?? "Ascent" },
      mode: "competitive",
      started_at: overrides.started_at,
      season: { id: "season-1", short: "e11a3" },
    },
    stats: {
      team: overrides.team,
      character: { name: overrides.agent },
      tier: 10,
      score: overrides.score,
      kills: overrides.kills,
      deaths: overrides.deaths,
      assists: overrides.assists,
      shots: {
        head: overrides.headshots,
        body: overrides.bodyshots,
        leg: overrides.legshots,
      },
      damage: { made: overrides.made, received: 0 },
    },
    teams: { red: overrides.red, blue: overrides.blue },
  };
}

const rawMatches = [
  rawMatch({
    id: "match-1",
    agent: "Jett",
    team: "Red",
    score: 420,
    kills: 20,
    deaths: 15,
    assists: 5,
    headshots: 10,
    bodyshots: 20,
    legshots: 0,
    made: 3000,
    red: 13,
    blue: 8,
    started_at: "t1",
  }),
  rawMatch({
    id: "match-2",
    agent: "Jett",
    team: "Blue",
    score: 260,
    kills: 12,
    deaths: 18,
    assists: 8,
    headshots: 4,
    bodyshots: 16,
    legshots: 0,
    made: 2400,
    red: 13,
    blue: 7,
    started_at: "t2",
  }),
  rawMatch({
    id: "match-3",
    agent: "Omen",
    team: "Red",
    score: 300,
    kills: 15,
    deaths: 10,
    assists: 3,
    headshots: 6,
    bodyshots: 14,
    legshots: 0,
    made: 2600,
    red: 13,
    blue: 5,
    started_at: "t3",
  }),
];

const mmr = {
  account: { puuid: "abc-123", name: "testname", tag: "TEST" },
  peak: {
    season: { id: "s1", short: "e11a3" },
    tier: { id: 20, name: "Diamond 1" },
    rr: 50,
  },
  current: {
    tier: { id: 18, name: "Platinum 3" },
    rr: 60,
    elo: 400,
    leaderboard_placement: null,
  },
};

const mmrHistory = {
  history: [{ last_change: 12 }, { last_change: -18 }, { last_change: 20 }],
};

function fakeEndpoints(): Endpoints {
  return {
    getRecentMatches: vi.fn(async () => rawMatches),
    getMmr: vi.fn(async () => mmr),
    getMmrHistory: vi.fn(async () => mmrHistory),
  } as unknown as Endpoints;
}

describe("getPlayerStats", () => {
  it("returns ok:true with pooled distributions, agent breakdown, rank, and climb", async () => {
    const envelope = await getPlayerStats(
      { endpoints: fakeEndpoints(), config },
      { sample_size: 20 },
    );
    expect(envelope.ok).toBe(true);
    const data = envelope.data;
    if (!data) throw new Error("expected data");

    expect(data.sample_size).toBe(3);
    // acs = score/rounds: 420/21=20, 260/20=13, 300/18≈16.67
    expect(data.acs.mean).toBeCloseTo((20 + 13 + 300 / 18) / 3, 5);
    expect(data.survival_rate).toBeCloseTo(
      1 - (15 + 18 + 10) / (21 + 20 + 18),
      5,
    );

    expect(data.agents).toHaveLength(2);
    const jett = data.agents.find((a) => a.agent === "Jett");
    expect(jett?.games).toBe(2);
    expect(jett?.role).toBe("duelist");
    expect(jett?.win_rate).toBe(0.5);

    expect(data.rank.tier.name).toBe("Platinum 3");
    expect(data.rr_climb).toBe(12 - 18 + 20);

    expect(data.best_game?.match_id).toBe("match-1");
    expect(data.worst_game?.match_id).toBe("match-2");
  });

  it("passes sample_size through to Endpoints.getRecentMatches", async () => {
    const endpoints = fakeEndpoints();
    await getPlayerStats({ endpoints, config }, { sample_size: 30 });
    expect(endpoints.getRecentMatches).toHaveBeenCalledWith(
      "na",
      "abc-123",
      30,
    );
  });

  it("maps a thrown error to the envelope, same as other tools", async () => {
    const endpoints = {
      getRecentMatches: vi.fn(async () => {
        throw new UpstreamError("boom", 500);
      }),
      getMmr: vi.fn(async () => mmr),
      getMmrHistory: vi.fn(async () => mmrHistory),
    } as unknown as Endpoints;
    const envelope = await getPlayerStats(
      { endpoints, config },
      { sample_size: 20 },
    );
    expect(envelope.ok).toBe(false);
    expect(envelope.error?.kind).toBe("upstream");
  });

  it("write-throughs light cache rows for every fetched match", async () => {
    const insertLightMatches = vi.fn(async () => {});
    const cache = {
      insertLightMatches,
    } as unknown as import("./match-cache").MatchCache;
    const envelope = await getPlayerStats(
      { endpoints: fakeEndpoints(), config, cache },
      { sample_size: 20 },
    );
    expect(envelope.ok).toBe(true);
    expect(insertLightMatches).toHaveBeenCalledWith([
      expect.objectContaining({ match_id: "match-1" }),
      expect.objectContaining({ match_id: "match-2" }),
      expect.objectContaining({ match_id: "match-3" }),
    ]);
  });

  it("still returns ok:true when the light write-through throws (fail-open)", async () => {
    const cache = {
      insertLightMatches: vi.fn(async () => {
        throw new Error("cache is down");
      }),
    } as unknown as import("./match-cache").MatchCache;
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    const envelope = await getPlayerStats(
      { endpoints: fakeEndpoints(), config, cache },
      { sample_size: 20 },
    );
    expect(envelope.ok).toBe(true);
    consoleError.mockRestore();
  });
});
