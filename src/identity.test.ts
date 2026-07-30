import { describe, it, expect } from "vitest";
import { resolveIdentity } from "./identity";

describe("resolveIdentity", () => {
  it("parses a valid identity out of AuthInfo.extra", () => {
    const identity = resolveIdentity({
      token: "t",
      clientId: "c",
      scopes: [],
      extra: {
        operatorPuuid: "abc-123",
        operatorRegion: "na",
        operatorPlatform: "pc",
      },
    });
    expect(identity).toEqual({
      operatorPuuid: "abc-123",
      operatorRegion: "na",
      operatorPlatform: "pc",
    });
  });

  it("throws when authInfo is undefined", () => {
    expect(() => resolveIdentity(undefined)).toThrow(
      "internal: tool handler reached without a resolved operator identity",
    );
  });

  it("throws when extra is missing required fields", () => {
    expect(() =>
      resolveIdentity({ token: "t", clientId: "c", scopes: [], extra: {} }),
    ).toThrow();
  });

  it("throws when region/platform aren't in the allowed enums", () => {
    expect(() =>
      resolveIdentity({
        token: "t",
        clientId: "c",
        scopes: [],
        extra: {
          operatorPuuid: "abc-123",
          operatorRegion: "mars",
          operatorPlatform: "pc",
        },
      }),
    ).toThrow();
  });
});
