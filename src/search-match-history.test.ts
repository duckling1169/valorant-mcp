import { describe, it, expect, vi } from "vitest";
import { searchMatchHistory } from "./search-match-history";
import type { MatchCache } from "./match-cache";
import { UpstreamError } from "./errors";

function fakeCache(rows: unknown[] = []): MatchCache {
  return { search: vi.fn(async () => rows) } as unknown as MatchCache;
}

describe("searchMatchHistory", () => {
  it("maps cached rows to the get_recent_matches shape", async () => {
    const cache = fakeCache([
      {
        match_id: "match-1",
        map: "Ascent",
        mode: "Competitive",
        started_at: "2026-07-20T00:00:00Z",
        operator_agent: "Jett",
        operator_tier_id: 10,
        operator_tier_name: "Silver 2",
        operator_score: 250,
        operator_kills: 20,
        operator_deaths: 15,
        operator_assists: 5,
        operator_won: true,
      },
    ]);
    const envelope = await searchMatchHistory({ cache }, { limit: 20 });
    expect(envelope.ok).toBe(true);
    expect(envelope.data).toEqual([
      {
        match_id: "match-1",
        map: "Ascent",
        mode: "Competitive",
        started_at: "2026-07-20T00:00:00Z",
        agent: "Jett",
        tier: { id: 10, name: "Silver 2" },
        score: 250,
        kills: 20,
        deaths: 15,
        assists: 5,
        won: true,
      },
    ]);
  });

  it("returns ok:true with an empty list when nothing matches, not an error", async () => {
    const envelope = await searchMatchHistory(
      { cache: fakeCache([]) },
      {
        limit: 20,
      },
    );
    expect(envelope.ok).toBe(true);
    expect(envelope.data).toEqual([]);
  });

  it("maps a thrown error to the envelope, same as other tools", async () => {
    const cache = {
      search: vi.fn(async () => {
        throw new UpstreamError("boom", 500);
      }),
    } as unknown as MatchCache;
    const envelope = await searchMatchHistory({ cache }, { limit: 20 });
    expect(envelope.ok).toBe(false);
    expect(envelope.error?.kind).toBe("upstream");
  });
});
