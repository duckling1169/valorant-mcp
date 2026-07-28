// Server configuration loaded from the environment. M1 binds to exactly one
// operator profile by PUUID (durable) + region + platform, per ARCHITECTURE.md's
// 2026-07-27 decision — no name#tag, no allowlist (that's M3, behind its own gate).

export type Region = "na" | "eu" | "ap" | "kr" | "latam" | "br";
export type Platform = "pc" | "console";

const REGIONS: readonly Region[] = ["na", "eu", "ap", "kr", "latam", "br"];
const PLATFORMS: readonly Platform[] = ["pc", "console"];

export interface ServerConfig {
  /** HenrikDev API key (Authorization header). */
  henrikApiKey: string;
  /** the operator's durable PUUID — the one profile M1 serves. */
  operatorPuuid: string;
  operatorRegion: Region;
  operatorPlatform: Platform;
}

type Env = Record<string, string | undefined>;

export function loadConfig(env: Env): ServerConfig {
  const henrikApiKey = env.HENRIKDEV_API_KEY?.trim();
  if (!henrikApiKey) throw new Error("HENRIKDEV_API_KEY is required");

  const operatorPuuid = env.VALORANT_OPERATOR_PUUID?.trim();
  if (!operatorPuuid) throw new Error("VALORANT_OPERATOR_PUUID is required");

  const regionRaw = env.VALORANT_REGION?.trim().toLowerCase();
  if (!regionRaw || !REGIONS.includes(regionRaw as Region)) {
    throw new Error(
      `VALORANT_REGION must be one of ${REGIONS.join(", ")} (got "${env.VALORANT_REGION ?? ""}")`,
    );
  }

  const platformRaw = (env.VALORANT_PLATFORM?.trim().toLowerCase() ||
    "pc") as Platform;
  if (!PLATFORMS.includes(platformRaw)) {
    throw new Error(
      `VALORANT_PLATFORM must be one of ${PLATFORMS.join(", ")} (got "${env.VALORANT_PLATFORM ?? ""}")`,
    );
  }

  return {
    henrikApiKey,
    operatorPuuid,
    operatorRegion: regionRaw as Region,
    operatorPlatform: platformRaw,
  };
}
