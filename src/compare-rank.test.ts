import { describe, it, expect, vi } from "vitest";
import { compareRank } from "./compare-rank";
import type { Endpoints } from "./endpoints";
import { UpstreamError } from "./errors";

const config = {
  operatorPuuid: "op-puuid",
  operatorRegion: "na" as const,
  operatorPlatform: "pc" as const,
};

const rawMatch = {
  metadata: {
    match_id: "match-abc",
    map: { name: "Ascent" },
    queue: { id: "competitive", name: "Competitive" },
    started_at: "t1",
    game_length_in_ms: 0,
    is_completed: true,
  },
  players: [
    {
      puuid: "op-puuid",
      name: "OperatorName",
      tag: "OP1",
      team_id: "Red",
      party_id: "p1",
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
    },
    {
      puuid: "en-puuid",
      name: "EnemyName",
      tag: "EN1",
      team_id: "Blue",
      party_id: "p2",
      platform: "playstation",
      agent: { name: "Omen" },
      tier: { id: 9, name: "Silver 1" },
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
    },
  ],
  teams: [
    { team_id: "Red", rounds: { won: 0, lost: 0 }, won: true },
    { team_id: "Blue", rounds: { won: 0, lost: 0 }, won: false },
  ],
  rounds: [],
  kills: [],
};

function mmrFor(tierName: string, rr: number) {
  return {
    account: { puuid: "x", name: "x", tag: "x" },
    peak: {
      season: { id: "s", short: "e1" },
      tier: { id: 1, name: "Iron 1" },
      rr: 0,
    },
    current: {
      tier: { id: 1, name: tierName },
      rr,
      elo: 500,
      leaderboard_placement: null,
    },
  };
}

function fakeEndpoints(): Endpoints {
  return {
    getMatchById: vi.fn(async () => rawMatch),
    getMmr: vi.fn(async (_region: string, platform: string) =>
      platform === "console" ? mmrFor("Gold 2", 40) : mmrFor("Platinum 1", 60),
    ),
  } as unknown as Endpoints;
}

describe("compareRank", () => {
  it("returns ok:true with both players' current rank, normalizing a non-pc platform to console", async () => {
    const endpoints = fakeEndpoints();
    const envelope = await compareRank(
      { endpoints, config },
      {
        match_id: "match-abc",
        opponent_name: "EnemyName",
        opponent_tag: "EN1",
      },
    );
    expect(envelope.ok).toBe(true);
    expect(envelope.data?.operator.tier.name).toBe("Platinum 1");
    expect(envelope.data?.opponent.tier.name).toBe("Gold 2");
    expect(envelope.data?.opponent.name).toBe("EnemyName");
    expect(endpoints.getMmr).toHaveBeenCalledWith("na", "console", "en-puuid");
  });

  it("rejects with kind:'input' when the named opponent was not a participant", async () => {
    const envelope = await compareRank(
      { endpoints: fakeEndpoints(), config },
      {
        match_id: "match-abc",
        opponent_name: "NobodyHere",
        opponent_tag: "XX1",
      },
    );
    expect(envelope.ok).toBe(false);
    expect(envelope.error?.kind).toBe("input");
  });

  it("maps a thrown error to the envelope, same as other tools", async () => {
    const endpoints = {
      getMatchById: vi.fn(async () => {
        throw new UpstreamError("boom", 500);
      }),
    } as unknown as Endpoints;
    const envelope = await compareRank(
      { endpoints, config },
      {
        match_id: "match-abc",
        opponent_name: "EnemyName",
        opponent_tag: "EN1",
      },
    );
    expect(envelope.ok).toBe(false);
    expect(envelope.error?.kind).toBe("upstream");
  });
});
