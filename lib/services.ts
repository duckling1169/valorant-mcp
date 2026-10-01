import { loadConfig } from "@/lib/config";
import { Endpoints } from "@/lib/endpoints";
import { HenrikClient } from "@/lib/henrik-client";
import { MatchCache } from "@/lib/match-cache";
import { createServiceClient } from "@/lib/supabase";

// Server-only singletons shared by the MCP route and the setup/claim pages.
// Created on first use so builds don't need runtime env vars.

let services:
  | {
      endpoints: Endpoints;
      db: ReturnType<typeof createServiceClient>;
      cache: MatchCache;
    }
  | undefined;

export function getServices() {
  if (!services) {
    const config = loadConfig(process.env);
    const db = createServiceClient();
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
