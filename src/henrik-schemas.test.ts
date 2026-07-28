import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  accountByPuuidSchema,
  mmrByPuuidSchema,
  parseHenrikPayload,
} from "./henrik-schemas";
import { SchemaError } from "./errors";

function loadFixture(name: string): unknown {
  const path = fileURLToPath(
    new URL(`../test/fixtures/${name}`, import.meta.url),
  );
  return JSON.parse(readFileSync(path, "utf-8"));
}

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
});
