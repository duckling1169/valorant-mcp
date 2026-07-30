import type { Endpoints } from "./endpoints";
import type { OperatorIdentity } from "./identity";
import type { MmrByPuuidResponse } from "./henrik-schemas";
import { guardTool, type Envelope } from "./envelope";

// get_profile() — no arguments; bound to the one configured operator profile
// (ARCHITECTURE.md's PUUID-binding decision). Composes account + current/peak
// rank into one compact factual object. No coaching, no derived commentary.

export interface Profile {
  puuid: string;
  name: string;
  tag: string;
  account_level: number;
  card: string;
  title: string;
  region: string;
  platforms: string[];
  rank: {
    tier: { id: number; name: string };
    rr: number;
    elo: number;
    leaderboard_placement: number | null;
    peak: {
      tier: { id: number; name: string };
      season: { id: string; short: string };
    };
  };
}

export interface ProfileDeps {
  endpoints: Endpoints;
  config: OperatorIdentity;
}

/** Shared by get_profile and get_player_stats — both compose the same
 * current/peak rank summary from an MmrByPuuidResponse. */
export function toRankSummary(
  mmr: MmrByPuuidResponse["data"],
): Profile["rank"] {
  return {
    tier: mmr.current.tier,
    rr: mmr.current.rr,
    elo: mmr.current.elo,
    leaderboard_placement: mmr.current.leaderboard_placement,
    peak: {
      tier: mmr.peak.tier,
      season: mmr.peak.season,
    },
  };
}

export async function getProfile(
  deps: ProfileDeps,
): Promise<Envelope<Profile>> {
  return guardTool(async () => {
    const { operatorPuuid, operatorRegion, operatorPlatform } = deps.config;
    const [account, mmr] = await Promise.all([
      deps.endpoints.getAccountByPuuid(operatorPuuid),
      deps.endpoints.getMmr(operatorRegion, operatorPlatform, operatorPuuid),
    ]);

    return {
      puuid: account.puuid,
      name: account.name,
      tag: account.tag,
      account_level: account.account_level,
      card: account.card,
      title: account.title,
      region: account.region,
      platforms: account.platforms,
      rank: toRankSummary(mmr),
    };
  });
}
