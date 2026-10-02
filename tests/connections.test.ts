import { describe, expect, it } from "vitest";
import {
  claimInvite,
  createConnection,
  createInvite,
  identityForKey,
  listConnections,
  revokeConnection,
} from "@/lib/connections";
import { InputError } from "@/lib/errors";
import { testDb } from "./test-db";

const friend = {
  puuid: "p1",
  name: "Friend",
  tag: "NA1",
  region: "na",
  platform: "pc",
};

describe("connections", () => {
  it("maps a key to its profile until revoked", async () => {
    const db = await testDb();
    const key = await createConnection(db, friend);

    expect(await identityForKey(db, key)).toEqual({
      operatorPuuid: "p1",
      operatorRegion: "na",
      operatorPlatform: "pc",
    });
    expect(await identityForKey(db, "wrong-key")).toBeNull();

    const [summary] = await listConnections(db);
    expect(summary).toMatchObject({ name: "Friend", tag: "NA1" });
    expect(summary?.lastUsedAt).not.toBeNull();

    await revokeConnection(db, summary!.keyHash);
    expect(await identityForKey(db, key)).toBeNull();
  });

  it("claims an invite once: consent recorded, key minted, invite gone", async () => {
    const db = await testDb();
    const code = await createInvite(db, friend);

    const key = await claimInvite(db, code);
    expect(await identityForKey(db, key)).toMatchObject({
      operatorPuuid: "p1",
    });
    expect(await db.sql`select * from invites`).toEqual([]);
    await expect(claimInvite(db, code)).rejects.toThrow(InputError);
  });
});
