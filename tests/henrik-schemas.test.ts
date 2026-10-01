import { describe, it, expect } from "vitest";
import { loadFixture } from "./fixtures";
import {
  accountByPuuidSchema,
  mmrByPuuidSchema,
  storedMatchesSchema,
  matchByIdSchema,
  mmrHistorySchema,
  parseHenrikPayload,
} from "@/lib/henrik-schemas";
import { SchemaError } from "@/lib/errors";

describe("henrik-schemas", () => {
  it("parses a valid account-v2 fixture", () => {
    const body = loadFixture("account-v2.json");
    const parsed = parseHenrikPayload(accountByPuuidSchema, body);
    expect(parsed.data.name).toBe("testname");
  });

  it("parses a valid mmr-v3 fixture", () => {
    const body = loadFixture("mmr-v3.json");
    const parsed = parseHenrikPayload(mmrByPuuidSchema, body);
    expect(parsed.data.current.tier.name).toBe("Platinum 3");
  });

  it("fails closed with SchemaError when a required field is missing", () => {
    const body = loadFixture("account-v2.json") as {
      data: Record<string, unknown>;
    };
    delete body.data.account_level;
    expect(() => parseHenrikPayload(accountByPuuidSchema, body)).toThrow(
      SchemaError,
    );
  });

  it("fails closed with SchemaError when a field has the wrong type, and names the field path without the value", () => {
    const body = loadFixture("mmr-v3.json") as {
      data: { current: { rr: unknown } };
    };
    body.data.current.rr = "not-a-number-but-a-secret-looking-string";
    try {
      parseHenrikPayload(mmrByPuuidSchema, body);
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(SchemaError);
      expect((err as SchemaError).fieldPath).toBe("data.current.rr");
      expect((err as SchemaError).message).not.toContain(
        "not-a-number-but-a-secret-looking-string",
      );
    }
  });

  it("parses a valid stored-matches-v1 fixture", () => {
    const body = loadFixture("stored-matches-v1.json");
    const parsed = parseHenrikPayload(storedMatchesSchema, body);
    expect(parsed.data).toHaveLength(2);
    expect(parsed.data[0]?.meta.map.name).toBe("Ascent");
    expect(parsed.data[0]?.stats.shots.head).toBe(10);
    expect(parsed.data[0]?.stats.damage.made).toBe(4000);
  });

  it.each(["damage", "kills"] as const)(
    "fails closed with SchemaError when stored-matches stats.%s is missing",
    (field) => {
      const body = loadFixture("stored-matches-v1.json") as {
        data: Array<{ stats: Record<string, unknown> }>;
      };
      const first = body.data[0];
      if (!first) throw new Error("fixture missing first match");
      delete first.stats[field];
      expect(() => parseHenrikPayload(storedMatchesSchema, body)).toThrow(
        SchemaError,
      );
    },
  );

  it("parses a valid match-v4 fixture", () => {
    const body = loadFixture("match-v4.json");
    const parsed = parseHenrikPayload(matchByIdSchema, body);
    expect(parsed.data.players).toHaveLength(2);
    expect(parsed.data.metadata.map.name).toBe("Ascent");
    expect(parsed.data.rounds).toHaveLength(1);
    expect(parsed.data.rounds[0]?.plant?.site).toBe("B");
    expect(parsed.data.kills).toHaveLength(1);
    expect(parsed.data.kills[0]?.weapon.name).toBe("Vandal");
    expect(parsed.data.players[0]?.platform).toBe("pc");
  });

  it("parses a round-player's economy with a null weapon (no weapon purchased that round, confirmed live)", () => {
    const body = loadFixture("match-v4.json") as {
      data: {
        rounds: Array<{ stats: Array<{ economy: { weapon: unknown } }> }>;
      };
    };
    const firstRoundStats = body.data.rounds[0]?.stats[0];
    if (!firstRoundStats) throw new Error("fixture missing first round stats");
    firstRoundStats.economy.weapon = null;
    const parsed = parseHenrikPayload(matchByIdSchema, body);
    expect(parsed.data.rounds[0]?.stats[0]?.economy.weapon).toBeNull();
  });

  it("parses a valid mmr-history-v2 fixture", () => {
    const body = loadFixture("mmr-history-v2.json");
    const parsed = parseHenrikPayload(mmrHistorySchema, body);
    expect(parsed.data.history).toHaveLength(2);
    expect(parsed.data.history[0]?.last_change).toBe(12);
  });
});
