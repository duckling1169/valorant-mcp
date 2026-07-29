import { readFileSync } from "node:fs";
import { describe, it, expect, vi } from "vitest";
import { getRankHistory } from "./rank-history";
import type { Endpoints } from "./endpoints";
import { UpstreamError } from "./errors";

function loadFixture(name: string): unknown {
  const path = new URL(`../test/fixtures/${name}`, import.meta.url);
  return JSON.parse(readFileSync(path, "utf-8"));
}

const config = {
  operatorPuuid: "abc-123",
  operatorRegion: "na" as const,
  operatorPlatform: "pc" as const,
};

const fixture = loadFixture("mmr-history-v2.json") as {
  data: { history: unknown[] };
};

function fakeEndpoints(): Endpoints {
  return {
    getMmrHistory: vi.fn(async () => fixture.data),
  } as unknown as Endpoints;
}

describe("getRankHistory", () => {
  it("returns ok:true with the operator's RR trajectory, newest first", async () => {
    const envelope = await getRankHistory(
      { endpoints: fakeEndpoints(), config },
      { limit: 20 },
    );
    expect(envelope.ok).toBe(true);
    expect(envelope.data).toHaveLength(2);
    expect(envelope.data?.[0]).toEqual({
      match_id: "match-1",
      map: "Ascent",
      season: { id: "season-1", short: "e11a3" },
      tier: { id: 10, name: "Silver 2" },
      rr: 45,
      last_change: 12,
      elo: 745,
      refunded_rr: 0,
      was_derank_protected: false,
      date: "2026-07-20T00:00:00Z",
    });
  });

  it("with since_match_id, returns only entries strictly newer than that match", async () => {
    const envelope = await getRankHistory(
      { endpoints: fakeEndpoints(), config },
      { limit: 20, since_match_id: "match-2" },
    );
    expect(envelope.ok).toBe(true);
    expect(envelope.data?.map((h) => h.match_id)).toEqual(["match-1"]);
  });

  it("with since_match_id set to the newest entry, returns nothing new", async () => {
    const envelope = await getRankHistory(
      { endpoints: fakeEndpoints(), config },
      { limit: 20, since_match_id: "match-1" },
    );
    expect(envelope.ok).toBe(true);
    expect(envelope.data).toEqual([]);
  });

  it("errors with kind:input when since_match_id isn't in rank history", async () => {
    const envelope = await getRankHistory(
      { endpoints: fakeEndpoints(), config },
      { limit: 20, since_match_id: "never-seen" },
    );
    expect(envelope.ok).toBe(false);
    expect(envelope.error?.kind).toBe("input");
  });

  it("truncates to limit", async () => {
    const envelope = await getRankHistory(
      { endpoints: fakeEndpoints(), config },
      { limit: 1 },
    );
    expect(envelope.ok).toBe(true);
    expect(envelope.data).toHaveLength(1);
  });

  it("maps a thrown error to the envelope, same as other tools", async () => {
    const endpoints = {
      getMmrHistory: vi.fn(async () => {
        throw new UpstreamError("boom", 500);
      }),
    } as unknown as Endpoints;
    const envelope = await getRankHistory({ endpoints, config }, { limit: 20 });
    expect(envelope.ok).toBe(false);
    expect(envelope.error?.kind).toBe("upstream");
  });
});
