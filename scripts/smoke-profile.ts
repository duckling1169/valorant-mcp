// Manual-only smoke test against the real HenrikDev API (CONTRIBUTING.md: "a real
// HenrikDev smoke test uses the maintainer's key and is manually invoked; it never
// runs in CI"). Run with: pnpm smoke:profile

import { loadConfig, type Region, type Platform } from "../src/config";
import { HenrikClient } from "../src/henrik-client";
import { Endpoints } from "../src/endpoints";
import { getProfile } from "../src/profile";

// M4 moved operator identity out of env-loaded ServerConfig (it's resolved
// per-request from mcp_users/consented_profiles in the real server) — this
// manual smoke script still needs *some* identity to call HenrikDev with, so
// it reads the same env vars directly, standalone from loadConfig.
const config = loadConfig(process.env);
const client = new HenrikClient({ apiKey: config.henrikApiKey });
const endpoints = new Endpoints(client);

const operatorPuuid = process.env.VALORANT_OPERATOR_PUUID;
if (!operatorPuuid) throw new Error("VALORANT_OPERATOR_PUUID is required");
const operatorRegion = (process.env.VALORANT_REGION ?? "na") as Region;
const operatorPlatform = (process.env.VALORANT_PLATFORM ?? "pc") as Platform;

const envelope = await getProfile({
  endpoints,
  config: { operatorPuuid, operatorRegion, operatorPlatform },
});
console.log(JSON.stringify(envelope, null, 2));

if (!envelope.ok) {
  process.exitCode = 1;
}
