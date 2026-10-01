import { describe, expect, it } from "vitest";
import { claimInvite, hashKey } from "@/lib/connections";
import { InputError } from "@/lib/errors";

/** Minimal in-memory stand-in for the supabase-js query builder. */
function fakeDb(tables: Record<string, Record<string, unknown>[]>) {
  return {
    from(table: string) {
      const rows = (tables[table] ??= []);
      let filter: [string, unknown] | null = null;
      const match = (r: Record<string, unknown>) =>
        !filter || r[filter[0]] === filter[1];
      const query = {
        select: () => query,
        eq: (col: string, value: unknown) => ((filter = [col, value]), query),
        maybeSingle: async () => ({ data: rows.find(match) ?? null }),
        delete: () => ({
          eq: async (col: string, value: unknown) => {
            tables[table] = rows.filter((r) => r[col] !== value);
            return { error: null };
          },
        }),
        upsert: async (row: Record<string, unknown>) => (
          rows.push(row),
          { error: null }
        ),
        insert: async (row: Record<string, unknown>) => (
          rows.push(row),
          { error: null }
        ),
      };
      return query;
    },
  };
}

const invite = {
  code: "abc",
  puuid: "p1",
  name: "Friend",
  tag: "NA1",
  region: "na",
  platform: "pc",
  created_at: "2026-10-01T00:00:00Z",
};

describe("claimInvite", () => {
  it("records consent and mints a key bound to the invited profile, once", async () => {
    const tables: Record<string, Record<string, unknown>[]> = {
      invites: [{ ...invite }],
    };
    const db = fakeDb(tables) as never;

    const key = await claimInvite(db, "abc");

    expect(tables.consented_profiles).toEqual([
      { puuid: "p1", name: "Friend", tag: "NA1", region: "na", platform: "pc" },
    ]);
    expect(tables.connections).toEqual([
      { key_hash: hashKey(key), puuid: "p1" },
    ]);
    expect(tables.invites).toEqual([]);
    await expect(claimInvite(db, "abc")).rejects.toBeInstanceOf(InputError);
  });
});
