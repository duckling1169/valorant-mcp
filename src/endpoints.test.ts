import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Endpoints } from "./endpoints";
import type { HenrikClient } from "./henrik-client";
import { SchemaError } from "./errors";

function loadFixture(name: string): unknown {
  const path = fileURLToPath(
    new URL(`../test/fixtures/${name}`, import.meta.url),
  );
  return JSON.parse(readFileSync(path, "utf-8"));
}

function fakeClient(data: unknown): HenrikClient {
  return {
    get: vi.fn(async () => ({ data, status: 200 })),
  } as unknown as HenrikClient;
}

describe("Endpoints", () => {
  it("getAccountByPuuid requests the correct path and returns validated data", async () => {
    const client = fakeClient(loadFixture("account-v2.json"));
    const endpoints = new Endpoints(client);
    const account = await endpoints.getAccountByPuuid("abc-123");
    expect(client.get).toHaveBeenCalledWith(
      "/valorant/v2/by-puuid/account/abc-123",
    );
    expect(account.name).toBe("testname");
  });

  it("getMmr requests the correct path (region/platform/puuid) and returns validated data", async () => {
    const client = fakeClient(loadFixture("mmr-v3.json"));
    const endpoints = new Endpoints(client);
    const mmr = await endpoints.getMmr("na", "pc", "abc-123");
    expect(client.get).toHaveBeenCalledWith(
      "/valorant/v3/by-puuid/mmr/na/pc/abc-123",
    );
    expect(mmr.current.rr).toBe(57);
  });

  it("encodes special characters in the puuid path segment", async () => {
    const client = fakeClient(loadFixture("account-v2.json"));
    const endpoints = new Endpoints(client);
    await endpoints.getAccountByPuuid("a/b c");
    expect(client.get).toHaveBeenCalledWith(
      "/valorant/v2/by-puuid/account/a%2Fb%20c",
    );
  });

  it("getRecentMatches requests the correct path with mode=competitive and size", async () => {
    const client = fakeClient(loadFixture("stored-matches-v1.json"));
    const endpoints = new Endpoints(client);
    const matches = await endpoints.getRecentMatches("na", "abc-123", 5);
    expect(client.get).toHaveBeenCalledWith(
      "/valorant/v1/by-puuid/stored-matches/na/abc-123?mode=competitive&size=5",
    );
    expect(matches).toHaveLength(2);
  });

  it("getMatchById requests the correct path (region/matchid, no platform)", async () => {
    const client = fakeClient(loadFixture("match-v4.json"));
    const endpoints = new Endpoints(client);
    const match = await endpoints.getMatchById("na", "match-abc");
    expect(client.get).toHaveBeenCalledWith("/valorant/v4/match/na/match-abc");
    expect(match.players).toHaveLength(2);
  });

  it("propagates SchemaError when the payload fails validation", async () => {
    const bad = loadFixture("account-v2.json") as {
      data: Record<string, unknown>;
    };
    delete bad.data.puuid;
    const client = fakeClient(bad);
    const endpoints = new Endpoints(client);
    await expect(endpoints.getAccountByPuuid("abc-123")).rejects.toThrow(
      SchemaError,
    );
  });
});
