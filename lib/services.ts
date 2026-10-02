import { loadConfig } from "@/lib/config";
import { Endpoints } from "@/lib/endpoints";
import { HenrikClient } from "@/lib/henrik-client";
import { MatchCache } from "@/lib/match-cache";
import { createDb, type Db } from "@/lib/db";

// Server-only singletons shared by the MCP route and the setup/claim pages.
// Created on first use so builds don't need runtime env vars.

let services:
  | {
      endpoints: Endpoints;
      db: Db;
      cache: MatchCache;
    }
  | undefined;

export function getServices() {
  if (!services) {
    const config = loadConfig(process.env);
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set.");
    const db = createDb(url);
    services = {
      endpoints: new Endpoints(
        new HenrikClient({ apiKey: config.henrikApiKey }),
      ),
      db,
      cache: new MatchCache(db),
    };
  }
  return services;
}
