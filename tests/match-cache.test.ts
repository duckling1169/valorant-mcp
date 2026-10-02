import { describe, expect, it } from "vitest";
import { UpstreamError } from "@/lib/errors";
import {
  MatchCache,
  type NewCachedMatchRow,
  type NewLightCachedMatchRow,
} from "@/lib/match-cache";
import { testDb } from "./test-db";

const ME = "operator-1";
const FRIEND = "operator-2";

const light = (
  n: number,
  startedAt = "2026-07-20T00:00:00Z",
): NewLightCachedMatchRow => ({
  match_id: `match-${n}`,
  map: "Ascent",
  mode: "Competitive",
  started_at: startedAt,
  season_id: "season-1",
  season_short: "e11a3",
  operator_agent: "Jett",
  operator_tier_id: 10,
  operator_tier_name: "Silver 2",
  operator_score: 250,
  operator_kills: 20,
  operator_deaths: 15,
  operator_assists: 5,
  operator_won: true,
});

const full = (n: number): NewCachedMatchRow => ({
  ...light(n),
  has_insight: true,
  detail: { match_id: `match-${n}` },
});

describe("MatchCache", () => {
  it("serves a full row back only to the profile that wrote it", async () => {
    const cache = new MatchCache(await testDb());
    await cache.upsert(ME, full(1));
    expect(await cache.getDetail(ME, "match-1")).toEqual({
      detail: { match_id: "match-1" },
      has_insight: true,
    });
    expect(await cache.getDetail(FRIEND, "match-1")).toBeNull();
  });

  it("never lets a light row overwrite a cached match", async () => {
    const cache = new MatchCache(await testDb());
    await cache.upsert(ME, full(1));
    await cache.insertLightMatches(ME, [light(1), light(2)]);
    expect(await cache.getDetail(ME, "match-1")).toMatchObject({
      has_insight: true,
    });
    expect(await cache.getDetail(ME, "match-2")).toEqual({
      detail: null,
      has_insight: false,
    });
  });

  it("keeps the newest 100 rows per profile without touching others", async () => {
    const db = await testDb();
    const cache = new MatchCache(db);
    await cache.insertLightMatches(FRIEND, [light(0)]);
    for (let n = 1; n <= 105; n++) await cache.upsert(ME, full(n));
    const counts = await db.query(
      "select operator_puuid, count(*)::int as n from cached_matches group by 1 order by 1",
    );
    expect(counts).toEqual([
      { operator_puuid: ME, n: 100 },
      { operator_puuid: FRIEND, n: 1 },
    ]);
    expect(await cache.getDetail(ME, "match-1")).toBeNull();
    expect(await cache.getDetail(ME, "match-105")).not.toBeNull();
  });

  it("searches one profile's matches with case-insensitive filters", async () => {
    const cache = new MatchCache(await testDb());
    await cache.insertLightMatches(ME, [
      light(1, "2026-07-01T00:00:00Z"),
      { ...light(2, "2026-07-02T00:00:00Z"), map: "Bind" },
      light(3, "2026-07-03T00:00:00Z"),
    ]);
    await cache.insertLightMatches(FRIEND, [light(9)]);

    const ascent = await cache.search(ME, { map: "ASCENT", limit: 20 });
    expect(ascent.map((r) => r.match_id)).toEqual(["match-3", "match-1"]);
    expect(ascent[0]?.started_at).toBe("2026-07-03T00:00:00.000Z");

    const wildcard = await cache.search(ME, { map: "%", limit: 20 });
    expect(wildcard).toEqual([]);
  });

  it("reports database failures as UpstreamError (callers fail open)", async () => {
    const db = await testDb();
    await db.pg.query("drop table cached_matches");
    await expect(new MatchCache(db).upsert(ME, full(1))).rejects.toThrow(
      UpstreamError,
    );
  });
});
