import type { SupabaseClient, Session } from "@supabase/supabase-js";

/** Checks for an active session; if absent, redirects the browser to
 * `/login?next=<nextPath>` and returns null so the caller can just `return`.
 * Shared by app/oauth/consent/page.tsx and app/claim/page.tsx — both need a
 * session before they can do anything else, and redirect to the same login
 * flow (with `next` bringing the user back) when there isn't one. */
export async function requireSession(
  supabase: SupabaseClient,
  nextPath: string,
): Promise<Session | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (session) return session;
  window.location.href = `/login?next=${encodeURIComponent(nextPath)}`;
  return null;
}
