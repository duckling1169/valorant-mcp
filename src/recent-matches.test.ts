import { describe, it, expect, vi } from "vitest";
import { getRecentMatches } from "./recent-matches";
import type { Endpoints } from "./endpoints";
import { UpstreamError } from "./errors";

const config = { operatorPuuid: "abc-123", operatorRegion: "na" as const };

const rawMatches = [
  {
    meta: {
      id: "match-1",
      map: { name: "Ascent" },
      mode: "competitive",
      started_at: "t1",
      season: { id: "season-1", short: "e11a3" },
    },
    stats: {
      team: "Red",
      character: { name: "Jett" },
      tier: 10,
      score: 250,
      kills: 20,
      deaths: 15,
      assists: 5,
    },
    teams: { red: 13, blue: 8 },
  },
  {
    meta: {
      id: "match-2",
      map: { name: "Bind" },
      mode: "competitive",
      started_at: "t2",
      season: { id: "season-1", short: "e11a3" },
    },
    stats: {
      team: "Blue",
      character: { name: "Omen" },
      tier: 10,
      score: 180,
      kills: 12,
      deaths: 18,
      assists: 8,
    },
    teams: { red: 13, blue: 7 },
  },
  {
    meta: {
      id: "match-3",
      map: { name: null },
      mode: "competitive",
      started_at: "t3",
      season: { id: "season-1", short: "e11a3" },
    },
    stats: {
      team: "Red",
      character: { name: null },
      tier: 10,
      score: 100,
      kills: 5,
      deaths: 20,
      assists: 2,
    },
    teams: { red: null, blue: null },
  },
];

function fakeEndpoints(): Endpoints {
  return {
    getRecentMatches: vi.fn(async () => rawMatches),
  } as unknown as Endpoints;
}

describe("getRecentMatches", () => {
  it("returns ok:true with compact matches, deriving won for both sides", async () => {
    const envelope = await getRecentMatches(
      { endpoints: fakeEndpoints(), config },
      { limit: 10 },
    );
    expect(envelope.ok).toBe(true);
    expect(envelope.data?.matches).toEqual([
      {
        match_id: "match-1",
        map: "Ascent",
        mode: "competitive",
        started_at: "t1",
        agent: "Jett",
        tier: { id: 10, name: "Silver 2" },
        score: 250,
        kills: 20,
        deaths: 15,
        assists: 5,
        won: true,
      },
      {
        match_id: "match-2",
        map: "Bind",
        mode: "competitive",
        started_at: "t2",
        agent: "Omen",
        tier: { id: 10, name: "Silver 2" },
        score: 180,
        kills: 12,
        deaths: 18,
        assists: 8,
        won: false,
      },
      {
        match_id: "match-3",
        map: null,
        mode: "competitive",
        started_at: "t3",
        agent: null,
        tier: { id: 10, name: "Silver 2" },
        score: 100,
        kills: 5,
        deaths: 20,
        assists: 2,
        won: null,
      },
    ]);
  });

  it("passes the requested limit through to Endpoints", async () => {
    const endpoints = fakeEndpoints();
    await getRecentMatches({ endpoints, config }, { limit: 3 });
    expect(endpoints.getRecentMatches).toHaveBeenCalledWith("na", "abc-123", 3);
  });

  it("maps a thrown error to the envelope, same as get_profile", async () => {
    const endpoints = {
      getRecentMatches: vi.fn(async () => {
        throw new UpstreamError("boom", 500);
      }),
    } as unknown as Endpoints;
    const envelope = await getRecentMatches(
      { endpoints, config },
      { limit: 10 },
    );
    expect(envelope.ok).toBe(false);
    expect(envelope.error?.kind).toBe("upstream");
  });

  it("write-throughs light cache rows for every fetched match", async () => {
    const insertLightMatches = vi.fn(async () => {});
    const cache = {
      insertLightMatches,
    } as unknown as import("./match-cache").MatchCache;
    const envelope = await getRecentMatches(
      { endpoints: fakeEndpoints(), config, cache },
      { limit: 10 },
    );
    expect(envelope.ok).toBe(true);
    expect(insertLightMatches).toHaveBeenCalledWith([
      expect.objectContaining({ match_id: "match-1", operator_won: true }),
      expect.objectContaining({ match_id: "match-2", operator_won: false }),
      expect.objectContaining({ match_id: "match-3", operator_won: null }),
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
    const envelope = await getRecentMatches(
      { endpoints: fakeEndpoints(), config, cache },
      { limit: 10 },
    );
    expect(envelope.ok).toBe(true);
    consoleError.mockRestore();
  });
});
