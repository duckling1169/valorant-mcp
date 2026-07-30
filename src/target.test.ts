import { describe, it, expect, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveTarget } from "./target";
import { InputError } from "./errors";

const self = {
  operatorPuuid: "self-puuid",
  operatorRegion: "na" as const,
  operatorPlatform: "pc" as const,
};

function fakeClient(result: {
  data?: unknown;
  error?: { message: string } | null;
}): { client: SupabaseClient; ilike: ReturnType<typeof vi.fn> } {
  const builder = {} as {
    select: ReturnType<typeof vi.fn>;
    ilike: ReturnType<typeof vi.fn>;
    maybeSingle: ReturnType<typeof vi.fn>;
  };
  const ilike = vi.fn(() => builder);
  builder.select = vi.fn(() => builder);
  builder.ilike = ilike;
  builder.maybeSingle = vi.fn(async () => result);
  const from = vi.fn(() => builder);
  return { client: { from } as unknown as SupabaseClient, ilike };
}

describe("resolveTarget", () => {
  it("returns self unchanged when no target is given", async () => {
    const { client } = fakeClient({ data: null, error: null });
    const identity = await resolveTarget(client, self, {});
    expect(identity).toBe(self);
  });

  it("throws InputError when only target_name is given", async () => {
    const { client } = fakeClient({ data: null, error: null });
    await expect(
      resolveTarget(client, self, { target_name: "foo" }),
    ).rejects.toThrow(InputError);
  });

  it("throws InputError when only target_tag is given", async () => {
    const { client } = fakeClient({ data: null, error: null });
    await expect(
      resolveTarget(client, self, { target_tag: "bar" }),
    ).rejects.toThrow(InputError);
  });

  it("resolves a consented profile's identity, matching name/tag case-insensitively", async () => {
    const { client, ilike } = fakeClient({
      data: { puuid: "friend-puuid", region: "na", platform: "pc" },
      error: null,
    });
    const identity = await resolveTarget(client, self, {
      target_name: "Friend",
      target_tag: "1234",
    });
    expect(identity).toEqual({
      operatorPuuid: "friend-puuid",
      operatorRegion: "na",
      operatorPlatform: "pc",
    });
    expect(ilike).toHaveBeenCalledWith("name", "Friend");
  });

  it("throws InputError when the target isn't a consented profile", async () => {
    const { client } = fakeClient({ data: null, error: null });
    await expect(
      resolveTarget(client, self, {
        target_name: "nobody",
        target_tag: "0000",
      }),
    ).rejects.toThrow(InputError);
  });

  it("throws InputError when the lookup errors", async () => {
    const { client } = fakeClient({ error: { message: "boom" } });
    await expect(
      resolveTarget(client, self, { target_name: "x", target_tag: "y" }),
    ).rejects.toThrow(InputError);
  });
});
