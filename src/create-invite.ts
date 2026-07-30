import { randomBytes } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Endpoints } from "./endpoints";
import { regionSchema } from "./config";
import { InputError, UpstreamError } from "./errors";

// Admin-only onboarding step (app/api/admin/invite/route.ts): given a Riot ID,
// resolve it to a puuid via HenrikDev, add it to consented_profiles (List 2),
// and mint a one-time mcp_invites code (ARCHITECTURE.md's M4 slice 3 decision
// — whoever redeems the code becomes that puuid's mcp_users row under
// whatever email they actually sign in with, via app/claim).

export interface CreateInviteDeps {
  endpoints: Endpoints;
  serviceClient: SupabaseClient;
}

export interface CreateInviteResult {
  code: string;
  puuid: string;
}

export async function createInvite(
  deps: CreateInviteDeps,
  { name, tag }: { name: string; tag: string },
): Promise<CreateInviteResult> {
  const account = await deps.endpoints.getAccountByName(name, tag);

  const region = regionSchema.safeParse(account.region);
  if (!region.success) {
    throw new InputError(
      `HenrikDev account region "${account.region}" is not a supported region`,
    );
  }

  const { error: profileError } = await deps.serviceClient
    .from("consented_profiles")
    .upsert({
      puuid: account.puuid,
      name: account.name,
      tag: account.tag,
      region: region.data,
    });
  if (profileError) {
    throw new UpstreamError(
      `failed to write consented_profiles: ${profileError.message}`,
    );
  }

  const code = randomBytes(9).toString("base64url");
  const { error: inviteError } = await deps.serviceClient
    .from("mcp_invites")
    .insert({ code, puuid: account.puuid });
  if (inviteError) {
    throw new UpstreamError(
      `failed to write mcp_invites: ${inviteError.message}`,
    );
  }

  return { code, puuid: account.puuid };
}
