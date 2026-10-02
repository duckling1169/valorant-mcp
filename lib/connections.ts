import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import { platformSchema, regionSchema } from "@/lib/config";
import type { Endpoints } from "@/lib/endpoints";
import type { Db } from "@/lib/db";
import { InputError, UpstreamError } from "@/lib/errors";
import type { OperatorIdentity } from "@/lib/identity";

// A connection is one connector URL (`/mcp?key=<key>`) bound to one consented
// VALORANT profile. Only SHA-256(key) is stored. Profiles enter
// consented_profiles only by their own action: the owner adding their own
// Riot ID on /setup, or a friend accepting an invite on /claim.

export const hashKey = (key: string) =>
  createHash("sha256").update(key).digest("hex");

const newSecret = (bytes: number) => randomBytes(bytes).toString("base64url");

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

/** Runs a query, converting any database error into UpstreamError. */
async function run<T>(what: string, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new UpstreamError(`${what}: ${message}`);
  }
}

const iso = z
  .union([z.string(), z.date()])
  .transform((v) => (typeof v === "string" ? v : v.toISOString()));

/** Records consent for `profile` and mints a connector key for it. */
export async function createConnection(
  db: Db,
  profile: Profile,
): Promise<string> {
  const { puuid, name, tag, region, platform } = profile;
  const key = newSecret(32);
  await run(
    "failed to save connection",
    () => db.sql`
      with profile as (
        insert into consented_profiles (puuid, name, tag, region, platform)
        values (${puuid}, ${name}, ${tag}, ${region}, ${platform})
        on conflict (puuid) do update
        set name = excluded.name, tag = excluded.tag,
            region = excluded.region, platform = excluded.platform
        returning puuid
      )
      insert into connections (key_hash, puuid)
      select ${hashKey(key)}, puuid from profile`,
  );
  return key;
}

const identityRowSchema = z.object({
  puuid: z.string().min(1),
  region: regionSchema,
  platform: platformSchema,
});

/** The identity a connector key acts as, or null if the key is unknown. */
export async function identityForKey(
  db: Db,
  key: string,
): Promise<OperatorIdentity | null> {
  const rows = await db.sql`
    update connections c set last_used_at = now()
    from consented_profiles p
    where c.key_hash = ${hashKey(key)} and p.puuid = c.puuid
    returning p.puuid, p.region, p.platform`;
  const row = identityRowSchema.safeParse(rows[0]);
  if (!row.success) return null;
  return {
    operatorPuuid: row.data.puuid,
    operatorRegion: row.data.region,
    operatorPlatform: row.data.platform,
  };
}

export interface ConnectionSummary {
  keyHash: string;
  name: string;
  tag: string;
  createdAt: string;
  lastUsedAt: string | null;
}

const summarySchema = z.object({
  key_hash: z.string(),
  name: z.string(),
  tag: z.string(),
  created_at: iso,
  last_used_at: iso.nullable(),
});

export async function listConnections(db: Db): Promise<ConnectionSummary[]> {
  const rows = await run(
    "failed to list connections",
    () => db.sql`
      select c.key_hash, p.name, p.tag, c.created_at, c.last_used_at
      from connections c join consented_profiles p on p.puuid = c.puuid
      order by c.created_at`,
  );
  return z
    .array(summarySchema)
    .parse(rows)
    .map((r) => ({
      keyHash: r.key_hash,
      name: r.name,
      tag: r.tag,
      createdAt: r.created_at,
      lastUsedAt: r.last_used_at,
    }));
}

export async function revokeConnection(db: Db, keyHash: string) {
  await run(
    "failed to revoke connection",
    () => db.sql`delete from connections where key_hash = ${keyHash}`,
  );
}

// Invites: the owner names a friend's Riot ID; the friend consents on /claim.

export async function createInvite(db: Db, profile: Profile): Promise<string> {
  const code = newSecret(12);
  const { puuid, name, tag, region, platform } = profile;
  await run(
    "failed to save invite",
    () => db.sql`
      insert into invites (code, puuid, name, tag, region, platform)
      values (${code}, ${puuid}, ${name}, ${tag}, ${region}, ${platform})`,
  );
  return code;
}

const inviteSchema = z.object({
  code: z.string(),
  puuid: z.string(),
  name: z.string(),
  tag: z.string(),
  region: z.string(),
  platform: z.string(),
  created_at: iso,
});
export type Invite = z.infer<typeof inviteSchema>;

export async function getInvite(db: Db, code: string): Promise<Invite | null> {
  const rows = await db.sql`select * from invites where code = ${code}`;
  const invite = inviteSchema.safeParse(rows[0]);
  return invite.success ? invite.data : null;
}

export async function listInvites(db: Db): Promise<Invite[]> {
  const rows = await run(
    "failed to list invites",
    () => db.sql`select * from invites order by created_at`,
  );
  return z.array(inviteSchema).parse(rows);
}

export async function deleteInvite(db: Db, code: string) {
  await run(
    "failed to delete invite",
    () => db.sql`delete from invites where code = ${code}`,
  );
}

/** Consent: turns a single-use invite into the friend's own connector key. The
 * delete-and-return is one statement, so two simultaneous claims can't both win. */
export async function claimInvite(db: Db, code: string): Promise<string> {
  const rows =
    await db.sql`delete from invites where code = ${code} returning *`;
  const invite = inviteSchema.safeParse(rows[0]);
  if (!invite.success) {
    throw new InputError("This invite is invalid or already used.");
  }
  const { puuid, name, tag, region, platform } = invite.data;
  return createConnection(db, { puuid, name, tag, region, platform });
}
