import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { requireEnv } from "@/lib/util";

// Server-only Supabase client (service-role key, bypasses RLS). The database
// is only ever accessed from the server.
export function createServiceClient(): SupabaseClient {
  const supabaseUrl = requireEnv(
    "SUPABASE_URL",
    process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL,
  );
  const serviceRoleKey = requireEnv(
    "SUPABASE_SERVICE_ROLE_KEY",
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
  return createClient(supabaseUrl, serviceRoleKey);
}
