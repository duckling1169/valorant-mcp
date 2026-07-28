import { createBrowserClient } from "@supabase/ssr";
import { requireEnv } from "./require-env";

const supabaseUrl = requireEnv(
  "NEXT_PUBLIC_SUPABASE_URL",
  process.env.NEXT_PUBLIC_SUPABASE_URL,
);
const supabaseKey = requireEnv(
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
);

export function createBrowserSupabaseClient() {
  return createBrowserClient(supabaseUrl, supabaseKey);
}
