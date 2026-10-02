import { z } from "zod";
import type { Db } from "@/lib/db";
import { InputError } from "@/lib/errors";
import { regionSchema, platformSchema } from "@/lib/config";
import type { OperatorIdentity } from "@/lib/identity";

// A tool call with target_name/target_tag acts on that consented profile's
// identity instead of the caller's own, resolved only against
// consented_profiles, never a live HenrikDev lookup. A name/tag that isn't a
// consented profile is rejected the same way whether it doesn't exist or simply
// hasn't consented.

const consentedProfileSchema = z.object({
  puuid: z.string().min(1),
  region: regionSchema,
  platform: platformSchema,
});

export interface TargetArgs {
  target_name?: string;
  target_tag?: string;
}

/** Resolves an optional target to act on in place of `self`. No target given
 * -> self, unchanged. Throws InputError if only one of target_name/target_tag
 * is given, or if the pair doesn't match a consented profile. */
export async function resolveTarget(
  db: Db,
  self: OperatorIdentity,
  target: TargetArgs,
): Promise<OperatorIdentity> {
  if (target.target_name === undefined && target.target_tag === undefined) {
    return self;
  }
  if (target.target_name === undefined || target.target_tag === undefined) {
    throw new InputError("target_name and target_tag must both be given");
  }

  const rows = await db.sql`
    select puuid, region, platform from consented_profiles
    where lower(name) = lower(${target.target_name})
      and lower(tag) = lower(${target.target_tag})
    limit 1`.catch(() => []);
  const data = rows[0];
  if (!data) {
    throw new InputError("target is not a consented profile");
  }
  const parsed = consentedProfileSchema.safeParse(data);
  if (!parsed.success) {
    throw new InputError("target is not a consented profile");
  }

  return {
    operatorPuuid: parsed.data.puuid,
    operatorRegion: parsed.data.region,
    operatorPlatform: parsed.data.platform,
  };
}
