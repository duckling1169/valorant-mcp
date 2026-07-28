import { describe, it, expect, vi } from "vitest";
import { getProfile } from "./profile.js";
import type { Endpoints } from "./endpoints.js";
import {
  RateBudgetExhaustedError,
  UpstreamError,
  SchemaError,
  InputError,
} from "./errors.js";

const config = {
  operatorPuuid: "abc-123",
  operatorRegion: "na" as const,
  operatorPlatform: "pc" as const,
};

const accountData = {
  puuid: "abc-123",
  region: "na",
  account_level: 123,
  name: "testname",
  tag: "TEST",
  card: "card-id",
  title: "title-id",
  platforms: ["pc"],
  updated_at: "2026-07-01T00:00:00Z",
};

const mmrData = {
  account: { puuid: "abc-123", name: "testname", tag: "TEST" },
  peak: {
    season: { id: "s1", short: "e1a1" },
    tier: { id: 21, name: "Immortal 1" },
    rr: 42,
  },
  current: {
    tier: { id: 18, name: "Platinum 3" },
    rr: 57,
    elo: 918,
    leaderboard_placement: null,
  },
};

function fakeEndpoints(overrides: Partial<Endpoints> = {}): Endpoints {
  return {
    getAccountByPuuid: vi.fn(async () => accountData),
    getMmr: vi.fn(async () => mmrData),
    ...overrides,
  } as unknown as Endpoints;
}

describe("getProfile", () => {
  it("returns ok:true with the composed, compact profile", async () => {
    const envelope = await getProfile({ endpoints: fakeEndpoints(), config });
    expect(envelope.ok).toBe(true);
    expect(envelope.data).toEqual({
      puuid: "abc-123",
      name: "testname",
      tag: "TEST",
      account_level: 123,
      card: "card-id",
      title: "title-id",
      region: "na",
      platforms: ["pc"],
      rank: {
        tier: { id: 18, name: "Platinum 3" },
        rr: 57,
        elo: 918,
        leaderboard_placement: null,
        peak: {
          tier: { id: 21, name: "Immortal 1" },
          season: { id: "s1", short: "e1a1" },
        },
      },
    });
  });

  it.each([
    ["rate", new RateBudgetExhaustedError(5000, true), 5000],
    ["upstream", new UpstreamError("boom", 500), undefined],
    ["schema", new SchemaError("bad shape", "data.x"), undefined],
    ["input", new InputError("bad input"), undefined],
  ] as const)(
    "maps a thrown error to error.kind %s",
    async (kind, thrown, retryAfterMs) => {
      const endpoints = fakeEndpoints({
        getAccountByPuuid: vi.fn(async () => {
          throw thrown;
        }),
      });
      const envelope = await getProfile({ endpoints, config });
      expect(envelope.ok).toBe(false);
      expect(envelope.error?.kind).toBe(kind);
      expect(envelope.error?.retryAfterMs).toBe(retryAfterMs);
    },
  );
});
