import { describe, expect, it } from "vitest";
import { InputError } from "@/lib/errors";
import { resolveTarget } from "@/lib/target";
import { testDb } from "./test-db";

const self = {
  operatorPuuid: "self-puuid",
  operatorRegion: "na" as const,
  operatorPlatform: "pc" as const,
};

async function dbWithFriend() {
  const db = await testDb();
  await db.sql`insert into consented_profiles (puuid, name, tag, region, platform)
    values ('friend-puuid', 'Friend', 'NA1', 'eu', 'console')`;
  return db;
}

describe("resolveTarget", () => {
  it("returns self when no target is given", async () => {
    expect(await resolveTarget(await testDb(), self, {})).toBe(self);
  });

  it("requires both target_name and target_tag", async () => {
    await expect(
      resolveTarget(await testDb(), self, { target_name: "Friend" }),
    ).rejects.toThrow(InputError);
  });

  it("resolves a consented profile, ignoring case", async () => {
    expect(
      await resolveTarget(await dbWithFriend(), self, {
        target_name: "friend",
        target_tag: "na1",
      }),
    ).toEqual({
      operatorPuuid: "friend-puuid",
      operatorRegion: "eu",
      operatorPlatform: "console",
    });
  });

  it("rejects profiles that haven't consented, and LIKE wildcards", async () => {
    const db = await dbWithFriend();
    for (const target of [
      { target_name: "Stranger", target_tag: "NA1" },
      { target_name: "%", target_tag: "%" },
    ]) {
      await expect(resolveTarget(db, self, target)).rejects.toThrow(InputError);
    }
  });
});
