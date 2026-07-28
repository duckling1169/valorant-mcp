import { describe, it, expect, vi } from "vitest";
import { getMatchDetail } from "./match-detail";
import type { Endpoints } from "./endpoints";
import { UpstreamError } from "./errors";

const config = {
  operatorPuuid: "operator-puuid",
  operatorRegion: "na" as const,
};

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
      puuid: "operator-puuid",
      name: "testname",
      tag: "TEST",
      team_id: "Red",
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
      puuid: "opponent-puuid",
      name: "opponent",
      tag: "OPP1",
      team_id: "Blue",
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
};

function fakeEndpoints(match: unknown = rawMatch): Endpoints {
  return { getMatchById: vi.fn(async () => match) } as unknown as Endpoints;
}

describe("getMatchDetail", () => {
  it("returns ok:true with the compact match detail when the operator was a participant", async () => {
    const envelope = await getMatchDetail(
      { endpoints: fakeEndpoints(), config },
      { match_id: "match-abc" },
    );
    expect(envelope.ok).toBe(true);
    expect(envelope.data).toEqual({
      match_id: "match-abc",
      map: "Ascent",
      mode: "Competitive",
      started_at: "t1",
      game_length_in_ms: 2100000,
      is_completed: true,
      players: [
        {
          name: "testname",
          tag: "TEST",
          team_id: "Red",
          agent: "Jett",
          tier: { id: 10, name: "Silver 2" },
          kills: 20,
          deaths: 15,
          assists: 5,
          score: 250,
          headshots: 10,
          bodyshots: 20,
          legshots: 2,
          damage_dealt: 4000,
          damage_received: 3000,
        },
        {
          name: "opponent",
          tag: "OPP1",
          team_id: "Blue",
          agent: "Omen",
          tier: { id: 9, name: "Silver 1" },
          kills: 15,
          deaths: 18,
          assists: 6,
          score: 200,
          headshots: 8,
          bodyshots: 18,
          legshots: 1,
          damage_dealt: 3200,
          damage_received: 3400,
        },
      ],
      teams: [
        { team_id: "Red", rounds_won: 13, rounds_lost: 8, won: true },
        { team_id: "Blue", rounds_won: 8, rounds_lost: 13, won: false },
      ],
    });
  });

  it("rejects with kind:'input' when the operator was not a participant, without naming the match_id", async () => {
    const matchWithoutOperator = {
      ...rawMatch,
      players: rawMatch.players.filter((p) => p.puuid !== "operator-puuid"),
    };
    const envelope = await getMatchDetail(
      { endpoints: fakeEndpoints(matchWithoutOperator), config },
      { match_id: "match-abc" },
    );
    expect(envelope.ok).toBe(false);
    expect(envelope.error?.kind).toBe("input");
    expect(envelope.error?.message).not.toContain("match-abc");
  });

  it("maps a thrown error to the envelope, same as get_profile/get_recent_matches", async () => {
    const endpoints = {
      getMatchById: vi.fn(async () => {
        throw new UpstreamError("boom", 500);
      }),
    } as unknown as Endpoints;
    const envelope = await getMatchDetail(
      { endpoints, config },
      { match_id: "match-abc" },
    );
    expect(envelope.ok).toBe(false);
    expect(envelope.error?.kind).toBe("upstream");
  });
});
