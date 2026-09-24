import { describe, it, expect } from "vitest";
import { loadConfig } from "./config";
import { tierName } from "./recent-matches";

describe("loadConfig", () => {
  it("loads the HenrikDev API key", () => {
    const config = loadConfig({ HENRIKDEV_API_KEY: "test-key" });
    expect(config).toEqual({ henrikApiKey: "test-key" });
  });

  it("throws when HENRIKDEV_API_KEY is missing", () => {
    expect(() => loadConfig({})).toThrow("HENRIKDEV_API_KEY is required");
  });
});

describe("tierName", () => {
  it("returns null for an out-of-range id rather than throwing", () => {
    expect(tierName(999)).toBeNull();
    expect(tierName(-1)).toBeNull();
  });
});
