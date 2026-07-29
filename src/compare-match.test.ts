import { describe, it, expect, vi } from "vitest";
import { compareMatch } from "./compare-match";
import type { Endpoints } from "./endpoints";
import { UpstreamError } from "./errors";

const config = { operatorPuuid: "op-puuid", operatorRegion: "na" as const };

const rawMatch = {
  metadata: {
    match_id: "match-abc",
    map: { name: "Ascent" },
    queue: { id: "competitive", name: "Competitive" },
    started_at: "t1",
    game_length_in_ms: 2100000,
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
        score: 250,
        kills: 20,
        deaths: 15,
        assists: 5,
        headshots: 10,
        bodyshots: 20,
        legshots: 2,
        damage: { dealt: 4000, received: 3000 },
      },
    },
    {
      puuid: "en-puuid",
      name: "EnemyName",
      tag: "EN1",
      team_id: "Blue",
      party_id: "p2",
      platform: "pc",
      agent: { name: "Omen" },
      tier: { id: 9, name: "Silver 1" },
      stats: {
        score: 200,
        kills: 15,
        deaths: 18,
        assists: 6,
        headshots: 8,
        bodyshots: 18,
        legshots: 1,
        damage: { dealt: 3200, received: 3400 },
      },
    },
  ],
  teams: [
    { team_id: "Red", rounds: { won: 13, lost: 8 }, won: true },
    { team_id: "Blue", rounds: { won: 8, lost: 13 }, won: false },
  ],
  rounds: [],
  kills: [],
};

function fakeEndpoints(match: unknown = rawMatch): Endpoints {
  return { getMatchById: vi.fn(async () => match) } as unknown as Endpoints;
}

describe("compareMatch", () => {
  it("returns ok:true with both players' base stats and insight, matched by name/tag case-insensitively", async () => {
    const envelope = await compareMatch(
      { endpoints: fakeEndpoints(), config },
      {
        match_id: "match-abc",
        opponent_name: "enemyname",
        opponent_tag: "en1",
      },
    );
    expect(envelope.ok).toBe(true);
    expect(envelope.data?.operator.name).toBe("OperatorName");
    expect(envelope.data?.operator.kills).toBe(20);
    expect(envelope.data?.operator.insight).toBeDefined();
    expect(envelope.data?.opponent.name).toBe("EnemyName");
    expect(envelope.data?.opponent.kills).toBe(15);
    expect(envelope.data?.opponent.insight).toBeDefined();
  });

  it("rejects with kind:'input' when the operator was not a participant", async () => {
    const matchWithoutOperator = {
      ...rawMatch,
      players: rawMatch.players.filter((p) => p.puuid !== "op-puuid"),
    };
    const envelope = await compareMatch(
      { endpoints: fakeEndpoints(matchWithoutOperator), config },
      {
        match_id: "match-abc",
        opponent_name: "EnemyName",
        opponent_tag: "EN1",
      },
    );
    expect(envelope.ok).toBe(false);
    expect(envelope.error?.kind).toBe("input");
  });

  it("rejects with kind:'input' when the named opponent was not a participant", async () => {
    const envelope = await compareMatch(
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
    const envelope = await compareMatch(
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
