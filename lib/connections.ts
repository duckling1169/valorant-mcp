import { createHash, randomBytes } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { platformSchema, regionSchema } from "@/lib/config";
import type { Endpoints } from "@/lib/endpoints";
import { InputError, UpstreamError } from "@/lib/errors";
import type { OperatorIdentity } from "@/lib/identity";

// A connection is one connector URL (`/mcp?key=<key>`) bound to one consented
// VALORANT profile. Only SHA-256(key) is stored. Profiles enter
// consented_profiles only by their own action: the owner adding their own
// Riot ID on /setup, or a friend accepting an invite on /claim.

export const hashKey = (key: string) =>
  createHash("sha256").update(key).digest("hex");

const newSecret = (bytes: number) => randomBytes(bytes).toString("base64url");

type Db = SupabaseClient;

export interface Profile {
  puuid: string;
  name: string;
  tag: string;
  region: string;
  platform: string;
}

/** Resolves a Riot ID to a profile via HenrikDev. */
export async function resolveRiotId(
  endpoints: Endpoints,
  name: string,
  tag: string,
): Promise<Profile> {
  const account = await endpoints.getAccountByName(name, tag);
  const region = regionSchema.safeParse(account.region);
  if (!region.success) {
    throw new InputError(`Unsupported region "${account.region}".`);
  }
  return {
    puuid: account.puuid,
    name: account.name,
    tag: account.tag,
    region: region.data,
    platform: "pc",
  };
}

function check(error: { message: string } | null, what: string) {
  if (error) throw new UpstreamError(`${what}: ${error.message}`);
}

/** Records consent for `profile` and mints a connector key for it. */
export async function createConnection(
  db: Db,
  profile: Profile,
): Promise<string> {
  const { error: profileError } = await db
    .from("consented_profiles")
    .upsert(profile);
  check(profileError, "failed to save profile");

  const key = newSecret(32);
  const { error } = await db
    .from("connections")
    .insert({ key_hash: hashKey(key), puuid: profile.puuid });
  check(error, "failed to save connection");
  return key;
}

const identityRowSchema = z.object({
  consented_profiles: z.object({
    puuid: z.string().min(1),
    region: regionSchema,
    platform: platformSchema,
  }),
});

/** The identity a connector key acts as, or null if the key is unknown. */
export async function identityForKey(
  db: Db,
  key: string,
): Promise<OperatorIdentity | null> {
  const keyHash = hashKey(key);
  const { data } = await db
    .from("connections")
    .select("consented_profiles (puuid, region, platform)")
    .eq("key_hash", keyHash)
    .maybeSingle();
  const row = identityRowSchema.safeParse(data);
  if (!row.success) return null;

  void db
    .from("connections")
    .update({ last_used_at: new Date().toISOString() })
    .eq("key_hash", keyHash)
    .then(() => {});

  const p = row.data.consented_profiles;
  return {
    operatorPuuid: p.puuid,
    operatorRegion: p.region,
    operatorPlatform: p.platform,
  };
}

export interface ConnectionSummary {
  keyHash: string;
  name: string;
  tag: string;
  createdAt: string;
  lastUsedAt: string | null;
}

export async function listConnections(db: Db): Promise<ConnectionSummary[]> {
  const { data, error } = await db
    .from("connections")
    .select(
      "key_hash, created_at, last_used_at, consented_profiles (name, tag)",
    )
    .order("created_at");
  check(error, "failed to list connections");
  return (data ?? []).map((r) => {
    const p = r.consented_profiles as unknown as { name: string; tag: string };
    return {
      keyHash: r.key_hash as string,
      name: p.name,
      tag: p.tag,
      createdAt: r.created_at as string,
      lastUsedAt: r.last_used_at as string | null,
    };
  });
}

export async function revokeConnection(db: Db, keyHash: string) {
  const { error } = await db
    .from("connections")
    .delete()
    .eq("key_hash", keyHash);
  check(error, "failed to revoke connection");
}

// Invites: the owner names a friend's Riot ID; the friend consents on /claim.

export async function createInvite(db: Db, profile: Profile): Promise<string> {
  const code = newSecret(12);
  const { error } = await db.from("invites").insert({ code, ...profile });
  check(error, "failed to save invite");
  return code;
}

const inviteSchema = z.object({
  code: z.string(),
  puuid: z.string(),
  name: z.string(),
  tag: z.string(),
  region: z.string(),
  platform: z.string(),
  created_at: z.string(),
});
export type Invite = z.infer<typeof inviteSchema>;

export async function getInvite(db: Db, code: string): Promise<Invite | null> {
  const { data } = await db
    .from("invites")
    .select("*")
    .eq("code", code)
    .maybeSingle();
  const invite = inviteSchema.safeParse(data);
  return invite.success ? invite.data : null;
}

export async function listInvites(db: Db): Promise<Invite[]> {
  const { data, error } = await db
    .from("invites")
    .select("*")
    .order("created_at");
  check(error, "failed to list invites");
  return z.array(inviteSchema).parse(data ?? []);
}

export async function deleteInvite(db: Db, code: string) {
  const { error } = await db.from("invites").delete().eq("code", code);
  check(error, "failed to delete invite");
}

/** Consent: turns a single-use invite into the friend's own connector key. */
export async function claimInvite(db: Db, code: string): Promise<string> {
  const invite = await getInvite(db, code);
  if (!invite) throw new InputError("This invite is invalid or already used.");
  await deleteInvite(db, code);
  const { puuid, name, tag, region, platform } = invite;
  return createConnection(db, { puuid, name, tag, region, platform });
}
