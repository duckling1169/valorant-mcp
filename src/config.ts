// Server configuration loaded from the environment. As of M4, the operator
// identity (puuid/region/platform) is no longer env-bound — it's resolved
// per-request from mcp_users/consented_profiles (src/verify-token.ts,
// src/identity.ts), so every request can carry a different operator. Only
// the HenrikDev API key, shared across all users, stays here.

import { z } from "zod";

export type Region = "na" | "eu" | "ap" | "kr" | "latam" | "br";
export type Platform = "pc" | "console";

export const REGIONS: readonly Region[] = [
  "na",
  "eu",
  "ap",
  "kr",
  "latam",
  "br",
];
export const PLATFORMS: readonly Platform[] = ["pc", "console"];

// Shared by every place that validates a stored/claimed Region or Platform
// (identity.ts, verify-token.ts, target.ts) — one derivation of the zod enum
// from REGIONS/PLATFORMS instead of each file re-deriving it independently.
export const regionSchema = z.enum(REGIONS as [Region, ...Region[]]);
export const platformSchema = z.enum(PLATFORMS as [Platform, ...Platform[]]);

export interface ServerConfig {
  /** HenrikDev API key (Authorization header). */
  henrikApiKey: string;
}

type Env = Record<string, string | undefined>;

export function loadConfig(env: Env): ServerConfig {
  const henrikApiKey = env.HENRIKDEV_API_KEY?.trim();
  if (!henrikApiKey) throw new Error("HENRIKDEV_API_KEY is required");

  return { henrikApiKey };
}
