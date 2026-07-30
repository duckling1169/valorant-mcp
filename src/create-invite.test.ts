import { describe, it, expect, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Endpoints } from "./endpoints";
import { createInvite } from "./create-invite";
import { InputError, UpstreamError } from "./errors";

const account = {
  puuid: "friend-puuid",
  region: "na",
  account_level: 100,
  name: "friend",
  tag: "1234",
  card: "card-id",
  title: "title-id",
  platforms: ["PC"],
  updated_at: "t",
};

function fakeEndpoints(): Endpoints {
  return {
    getAccountByName: vi.fn(async () => account),
  } as unknown as Endpoints;
}

function fakeServiceClient(results: {
  profileError?: { message: string } | null;
  inviteError?: { message: string } | null;
}): { client: SupabaseClient; upsert: ReturnType<typeof vi.fn> } {
  const upsert = vi.fn(async () => ({
    error: results.profileError ?? null,
  }));
  const insert = vi.fn(async () => ({ error: results.inviteError ?? null }));
  const from = vi.fn((table: string) =>
    table === "consented_profiles" ? { upsert } : { insert },
  );
  return { client: { from } as unknown as SupabaseClient, upsert };
}

describe("createInvite", () => {
  it("resolves the Riot ID, writes consented_profiles, and mints an invite code", async () => {
    const { client, upsert } = fakeServiceClient({});
    const result = await createInvite(
      { endpoints: fakeEndpoints(), serviceClient: client },
      { name: "friend", tag: "1234" },
    );
    expect(result.puuid).toBe("friend-puuid");
    expect(result.code).toMatch(/^[\w-]+$/);
    expect(upsert).toHaveBeenCalledWith({
      puuid: "friend-puuid",
      name: "friend",
      tag: "1234",
      region: "na",
    });
  });

  it("throws InputError when HenrikDev returns an unsupported region", async () => {
    const endpoints = {
      getAccountByName: vi.fn(async () => ({ ...account, region: "mars" })),
    } as unknown as Endpoints;
    const { client } = fakeServiceClient({});
    await expect(
      createInvite(
        { endpoints, serviceClient: client },
        { name: "friend", tag: "1234" },
      ),
    ).rejects.toThrow(InputError);
  });

  it("throws UpstreamError when the consented_profiles write fails", async () => {
    const { client } = fakeServiceClient({
      profileError: { message: "boom" },
    });
    await expect(
      createInvite(
        { endpoints: fakeEndpoints(), serviceClient: client },
        { name: "friend", tag: "1234" },
      ),
    ).rejects.toThrow(UpstreamError);
  });

  it("throws UpstreamError when the mcp_invites write fails", async () => {
    const { client } = fakeServiceClient({ inviteError: { message: "boom" } });
    await expect(
      createInvite(
        { endpoints: fakeEndpoints(), serviceClient: client },
        { name: "friend", tag: "1234" },
      ),
    ).rejects.toThrow(UpstreamError);
  });
});
