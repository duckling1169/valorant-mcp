import { describe, it, expect } from "vitest";
import { loadConfig } from "./config.js";

const validEnv = {
  HENRIKDEV_API_KEY: "test-key",
  VALORANT_OPERATOR_PUUID: "698d1ebe-27b1-5f0d-8148-6955719f84ff",
  VALORANT_REGION: "na",
};

describe("loadConfig", () => {
  it("loads a valid config and defaults platform to pc", () => {
    const config = loadConfig(validEnv);
    expect(config).toEqual({
      henrikApiKey: "test-key",
      operatorPuuid: "698d1ebe-27b1-5f0d-8148-6955719f84ff",
      operatorRegion: "na",
      operatorPlatform: "pc",
    });
  });

  it("respects an explicit platform", () => {
    const config = loadConfig({ ...validEnv, VALORANT_PLATFORM: "console" });
    expect(config.operatorPlatform).toBe("console");
  });

  it("throws when HENRIKDEV_API_KEY is missing", () => {
    const { HENRIKDEV_API_KEY: _drop, ...rest } = validEnv;
    expect(() => loadConfig(rest)).toThrow("HENRIKDEV_API_KEY is required");
  });

  it("throws when VALORANT_OPERATOR_PUUID is missing", () => {
    const { VALORANT_OPERATOR_PUUID: _drop, ...rest } = validEnv;
    expect(() => loadConfig(rest)).toThrow(
      "VALORANT_OPERATOR_PUUID is required",
    );
  });

  it("throws on an invalid region", () => {
    expect(() => loadConfig({ ...validEnv, VALORANT_REGION: "mars" })).toThrow(
      "VALORANT_REGION must be one of",
    );
  });

  it("throws on an invalid platform", () => {
    expect(() =>
      loadConfig({ ...validEnv, VALORANT_PLATFORM: "xbox" }),
    ).toThrow("VALORANT_PLATFORM must be one of");
  });
});
