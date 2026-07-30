import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { InputError } from "./errors";
import { regionSchema, platformSchema } from "./config";
import type { OperatorIdentity } from "./identity";

// M4 slice 4: widened lookup. A tool call with target_name/target_tag acts on
// that consented profile's identity instead of the caller's own — resolved
// only against consented_profiles (List 2), never a live HenrikDev name/tag
// lookup (ARCHITECTURE.md's M0 "never a fresh Riot-ID search" pattern applies
// here too). A name/tag that isn't a consented profile is rejected the same
// way whether it doesn't exist or simply hasn't consented — never
// distinguishing the two, same as compare_match's opponent-not-found.

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
  client: SupabaseClient,
  self: OperatorIdentity,
  target: TargetArgs,
): Promise<OperatorIdentity> {
  if (target.target_name === undefined && target.target_tag === undefined) {
    return self;
  }
  if (target.target_name === undefined || target.target_tag === undefined) {
    throw new InputError("target_name and target_tag must both be given");
  }

  const { data, error } = await client
    .from("consented_profiles")
    .select("puuid, region, platform")
    .ilike("name", target.target_name)
    .ilike("tag", target.target_tag)
    .maybeSingle();
  if (error || !data) {
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
