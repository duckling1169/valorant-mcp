import { describe, it, expect, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { MatchCache, type NewCachedMatchRow } from "./match-cache";
import { UpstreamError, SchemaError } from "./errors";

const OPERATOR_PUUID = "operator-1";

interface FakeResult {
  data?: unknown;
  error?: { message: string } | null;
}

interface FakeBuilder {
  select: ReturnType<typeof vi.fn>;
  upsert: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
  order: ReturnType<typeof vi.fn>;
  limit: ReturnType<typeof vi.fn>;
  ilike: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  gte: ReturnType<typeof vi.fn>;
  lte: ReturnType<typeof vi.fn>;
  lt: ReturnType<typeof vi.fn>;
  in: ReturnType<typeof vi.fn>;
  maybeSingle: ReturnType<typeof vi.fn>;
  then: (resolve: (r: FakeResult) => void) => Promise<void>;
}

/** Fakes supabase-js's chainable `.from(table)....` builder. Each call to
 * `.from()` pops the next queued result and returns a fresh chainable builder
 * that resolves to it when awaited — matching how MatchCache issues one
 * `.from()` chain per logical DB operation. */
function fakeClient(results: FakeResult[]): {
  client: SupabaseClient;
  builders: FakeBuilder[];
} {
  const builders: FakeBuilder[] = [];
  let i = 0;
  const from = vi.fn(() => {
    const result = results[i] ?? { data: null, error: null };
    i++;
    const builder = {} as FakeBuilder;
    const chain = () => builder;
    builder.select = vi.fn(chain);
    builder.upsert = vi.fn(chain);
    builder.delete = vi.fn(chain);
    builder.order = vi.fn(chain);
    builder.limit = vi.fn(chain);
    builder.ilike = vi.fn(chain);
    builder.eq = vi.fn(chain);
    builder.gte = vi.fn(chain);
    builder.lte = vi.fn(chain);
    builder.lt = vi.fn(chain);
    builder.in = vi.fn(chain);
    builder.maybeSingle = vi.fn(chain);
    builder.then = (resolve: (r: FakeResult) => void) =>
      Promise.resolve(result).then(resolve);
    builders.push(builder);
    return builder;
  });
  return { client: { from } as unknown as SupabaseClient, builders };
}

const row: NewCachedMatchRow = {
  match_id: "match-1",
  map: "Ascent",
  mode: "Competitive",
  started_at: "2026-07-20T00:00:00Z",
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
  has_insight: false,
  detail: { match_id: "match-1" },
};

describe("MatchCache.upsert", () => {
  it("upserts and evicts with no excess rows, without throwing", async () => {
    const { client } = fakeClient([
      { error: null }, // upsert
      { error: null }, // age-based delete
      { data: [{ match_id: "match-1" }], error: null }, // list for count eviction
    ]);
    await expect(
      new MatchCache(client).upsert(OPERATOR_PUUID, row),
    ).resolves.toBeUndefined();
  });

  it("scopes both the upsert row and eviction to operatorPuuid", async () => {
    const { client, builders } = fakeClient([
      { error: null }, // upsert
      { error: null }, // age-based delete
      { data: [{ match_id: "match-1" }], error: null }, // list for count eviction
    ]);
    await new MatchCache(client).upsert(OPERATOR_PUUID, row);
    const upsertBuilder = builders[0];
    if (!upsertBuilder) throw new Error("expected an upsert builder call");
    expect(upsertBuilder.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ operator_puuid: OPERATOR_PUUID }),
    );
    const ageDeleteBuilder = builders[1];
    if (!ageDeleteBuilder) throw new Error("expected an age-delete builder");
    expect(ageDeleteBuilder.eq).toHaveBeenCalledWith(
      "operator_puuid",
      OPERATOR_PUUID,
    );
  });

  it("evicts rows beyond the 100-row retention bound, scoped to operatorPuuid", async () => {
    const rows = Array.from({ length: 105 }, (_, n) => ({
      match_id: `match-${n}`,
    }));
    const { client, builders } = fakeClient([
      { error: null }, // upsert
      { error: null }, // age-based delete
      { data: rows, error: null }, // list
      { error: null }, // count-based delete
    ]);
    await new MatchCache(client).upsert(OPERATOR_PUUID, row);
    const countDeleteBuilder = builders[3];
    if (!countDeleteBuilder) throw new Error("expected a 4th builder call");
    expect(countDeleteBuilder.eq).toHaveBeenCalledWith(
      "operator_puuid",
      OPERATOR_PUUID,
    );
    expect(countDeleteBuilder.in).toHaveBeenCalledWith(
      "match_id",
      rows.slice(100).map((r) => r.match_id),
    );
  });

  it("throws UpstreamError when the insert fails", async () => {
    const { client } = fakeClient([{ error: { message: "boom" } }]);
    await expect(
      new MatchCache(client).upsert(OPERATOR_PUUID, row),
    ).rejects.toThrow(UpstreamError);
  });
});

describe("MatchCache.search", () => {
  it("returns validated rows, scoped to operatorPuuid", async () => {
    const cachedRow = {
      match_id: "match-1",
      map: "Ascent",
      mode: "Competitive",
      started_at: "2026-07-20T00:00:00Z",
      season_short: "e11a3",
      operator_agent: "Jett",
      operator_tier_id: 10,
      operator_tier_name: "Silver 2",
      operator_score: 250,
      operator_kills: 20,
      operator_deaths: 15,
      operator_assists: 5,
      operator_won: true,
    };
    const { client, builders } = fakeClient([
      { data: [cachedRow], error: null },
    ]);
    const result = await new MatchCache(client).search(OPERATOR_PUUID, {
      limit: 20,
    });
    expect(result).toEqual([cachedRow]);
    const builder = builders[0];
    if (!builder) throw new Error("expected a builder call");
    expect(builder.eq).toHaveBeenCalledWith("operator_puuid", OPERATOR_PUUID);
  });

  it("throws UpstreamError when the query fails", async () => {
    const { client } = fakeClient([{ error: { message: "boom" } }]);
    await expect(
      new MatchCache(client).search(OPERATOR_PUUID, { limit: 20 }),
    ).rejects.toThrow(UpstreamError);
  });

  it("throws SchemaError when a row doesn't match the expected shape", async () => {
    const { client } = fakeClient([
      { data: [{ match_id: "match-1" }], error: null },
    ]);
    await expect(
      new MatchCache(client).search(OPERATOR_PUUID, { limit: 20 }),
    ).rejects.toThrow(SchemaError);
  });
});

const lightRow = {
  match_id: "match-2",
  map: "Bind",
  mode: "Competitive",
  started_at: "2026-07-19T00:00:00Z",
  season_id: "season-1",
  season_short: "e11a3",
  operator_agent: "Omen",
  operator_tier_id: 10,
  operator_tier_name: "Silver 2",
  operator_score: 180,
  operator_kills: 12,
  operator_deaths: 18,
  operator_assists: 8,
  operator_won: false,
};

describe("MatchCache.insertLightMatches", () => {
  it("does nothing for an empty batch (no from() call)", async () => {
    const { client } = fakeClient([]);
    await new MatchCache(client).insertLightMatches(OPERATOR_PUUID, []);
    expect(client.from).not.toHaveBeenCalled();
  });

  it("upserts with operator_puuid + ignoreDuplicates, evicts once for the batch", async () => {
    const { client, builders } = fakeClient([
      { error: null }, // batch upsert
      { error: null }, // age-based delete
      { data: [{ match_id: "match-2" }], error: null }, // list for count eviction
    ]);
    await new MatchCache(client).insertLightMatches(OPERATOR_PUUID, [lightRow]);
    expect(client.from).toHaveBeenCalledTimes(3);
    const upsertBuilder = builders[0];
    if (!upsertBuilder) throw new Error("expected an upsert builder call");
    expect(upsertBuilder.upsert).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          match_id: "match-2",
          operator_puuid: OPERATOR_PUUID,
          has_insight: false,
          detail: null,
        }),
      ],
      { onConflict: "operator_puuid,match_id", ignoreDuplicates: true },
    );
  });

  it("throws UpstreamError when the batch upsert fails", async () => {
    const { client } = fakeClient([{ error: { message: "boom" } }]);
    await expect(
      new MatchCache(client).insertLightMatches(OPERATOR_PUUID, [lightRow]),
    ).rejects.toThrow(UpstreamError);
  });
});

describe("MatchCache.getDetail", () => {
  it("returns detail + has_insight when a row exists", async () => {
    const { client, builders } = fakeClient([
      {
        data: { detail: { match_id: "match-1" }, has_insight: true },
        error: null,
      },
    ]);
    const result = await new MatchCache(client).getDetail(
      OPERATOR_PUUID,
      "match-1",
    );
    expect(result).toEqual({
      detail: { match_id: "match-1" },
      has_insight: true,
    });
    const builder = builders[0];
    if (!builder) throw new Error("expected a builder call");
    expect(builder.eq).toHaveBeenCalledWith("operator_puuid", OPERATOR_PUUID);
  });

  it("returns null when no row exists", async () => {
    const { client } = fakeClient([{ data: null, error: null }]);
    const result = await new MatchCache(client).getDetail(
      OPERATOR_PUUID,
      "match-1",
    );
    expect(result).toBeNull();
  });

  it("throws UpstreamError when the lookup fails", async () => {
    const { client } = fakeClient([{ error: { message: "boom" } }]);
    await expect(
      new MatchCache(client).getDetail(OPERATOR_PUUID, "match-1"),
    ).rejects.toThrow(UpstreamError);
  });
});
