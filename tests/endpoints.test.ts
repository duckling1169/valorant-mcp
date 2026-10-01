import { describe, it, expect, vi } from "vitest";
import { loadFixture } from "./fixtures";
import { Endpoints } from "@/lib/endpoints";
import type { HenrikClient } from "@/lib/henrik-client";
import { SchemaError } from "@/lib/errors";

function fakeClient(data: unknown): HenrikClient {
  return {
    get: vi.fn(async () => ({ data, status: 200 })),
  } as unknown as HenrikClient;
}

describe("Endpoints", () => {
  it("getAccountByPuuid requests the correct path and returns validated data", async () => {
    const client = fakeClient(loadFixture("account-v2.json"));
    const endpoints = new Endpoints(client);
    const account = await endpoints.getAccountByPuuid("abc-123");
    expect(client.get).toHaveBeenCalledWith(
      "/valorant/v2/by-puuid/account/abc-123",
    );
    expect(account.name).toBe("testname");
  });

  it("encodes special characters in the puuid path segment", async () => {
    const client = fakeClient(loadFixture("account-v2.json"));
    const endpoints = new Endpoints(client);
    await endpoints.getAccountByPuuid("a/b c");
    expect(client.get).toHaveBeenCalledWith(
      "/valorant/v2/by-puuid/account/a%2Fb%20c",
    );
  });

  it("propagates SchemaError when the payload fails validation", async () => {
    const bad = loadFixture("account-v2.json") as {
      data: Record<string, unknown>;
    };
    delete bad.data.puuid;
    const client = fakeClient(bad);
    const endpoints = new Endpoints(client);
    await expect(endpoints.getAccountByPuuid("abc-123")).rejects.toThrow(
      SchemaError,
    );
  });
});
