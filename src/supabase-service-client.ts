import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { requireEnv } from "./require-env";

// Server-only Supabase client (service-role key, bypasses RLS) for the MCP
// route's own tables — cached_matches (M3) and mcp_users/consented_profiles
// (M4) — distinct from supabase-server.ts/supabase-browser.ts, which are
// cookie/session-bound for the separate web magic-link login flow and
// unusable in the MCP route's bearer-token request context. Constructed once
// at module scope, same pattern as route.ts's HenrikClient/Endpoints.
export function createServiceClient(): SupabaseClient {
  const supabaseUrl = requireEnv(
    "NEXT_PUBLIC_SUPABASE_URL",
    process.env.NEXT_PUBLIC_SUPABASE_URL,
  );
  const serviceRoleKey = requireEnv(
    "SUPABASE_SERVICE_ROLE_KEY",
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
  return createClient(supabaseUrl, serviceRoleKey);
}
