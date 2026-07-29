import { describe, it, expect, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { MatchCache, type NewCachedMatchRow } from "./match-cache";
import { UpstreamError, SchemaError } from "./errors";

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
  detail: { match_id: "match-1" },
};

describe("MatchCache.upsert", () => {
  it("upserts and evicts with no excess rows, without throwing", async () => {
    const { client } = fakeClient([
      { error: null }, // upsert
      { error: null }, // age-based delete
      { data: [{ match_id: "match-1" }], error: null }, // list for count eviction
    ]);
    await expect(new MatchCache(client).upsert(row)).resolves.toBeUndefined();
  });

  it("evicts rows beyond the 100-row retention bound", async () => {
    const rows = Array.from({ length: 105 }, (_, n) => ({
      match_id: `match-${n}`,
    }));
    const { client, builders } = fakeClient([
      { error: null }, // upsert
      { error: null }, // age-based delete
      { data: rows, error: null }, // list
      { error: null }, // count-based delete
    ]);
    await new MatchCache(client).upsert(row);
    const countDeleteBuilder = builders[3];
    if (!countDeleteBuilder) throw new Error("expected a 4th builder call");
    expect(countDeleteBuilder.in).toHaveBeenCalledWith(
      "match_id",
      rows.slice(100).map((r) => r.match_id),
    );
  });

  it("throws UpstreamError when the insert fails", async () => {
    const { client } = fakeClient([{ error: { message: "boom" } }]);
    await expect(new MatchCache(client).upsert(row)).rejects.toThrow(
      UpstreamError,
    );
  });
});

describe("MatchCache.search", () => {
  it("returns validated rows", async () => {
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
    const { client } = fakeClient([{ data: [cachedRow], error: null }]);
    const result = await new MatchCache(client).search({ limit: 20 });
    expect(result).toEqual([cachedRow]);
  });

  it("throws UpstreamError when the query fails", async () => {
    const { client } = fakeClient([{ error: { message: "boom" } }]);
    await expect(new MatchCache(client).search({ limit: 20 })).rejects.toThrow(
      UpstreamError,
    );
  });

  it("throws SchemaError when a row doesn't match the expected shape", async () => {
    const { client } = fakeClient([
      { data: [{ match_id: "match-1" }], error: null },
    ]);
    await expect(new MatchCache(client).search({ limit: 20 })).rejects.toThrow(
      SchemaError,
    );
  });
});
