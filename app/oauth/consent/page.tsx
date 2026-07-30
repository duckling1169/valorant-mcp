"use client";

import { useEffect, useState } from "react";
import { createBrowserSupabaseClient } from "@/src/supabase-browser";
import { requireSession } from "@/src/require-session";
import type { OAuthAuthorizationDetails } from "@supabase/supabase-js";

type Status = "loading" | "ready" | "error";

export default function ConsentPage() {
  const [authorizationId, setAuthorizationId] = useState<string | null>(null);
  const [details, setDetails] = useState<OAuthAuthorizationDetails | null>(
    null,
  );
  const [status, setStatus] = useState<Status>("loading");

  useEffect(() => {
    async function load() {
      const id = new URLSearchParams(window.location.search).get(
        "authorization_id",
      );
      if (!id) {
        setStatus("error");
        return;
      }
      setAuthorizationId(id);

      const supabase = createBrowserSupabaseClient();
      const session = await requireSession(
        supabase,
        `/oauth/consent?authorization_id=${encodeURIComponent(id)}`,
      );
      if (!session) return;

      const { data, error } =
        await supabase.auth.oauth.getAuthorizationDetails(id);
      if (error) {
        setStatus("error");
        return;
      }
      if ("redirect_url" in data) {
        window.location.href = data.redirect_url;
        return;
      }
      setDetails(data);
      setStatus("ready");
    }

    void load();
  }, []);

  async function respond(approve: boolean) {
    if (!authorizationId) return;
    const supabase = createBrowserSupabaseClient();
    // Both calls redirect the browser on success by default; only surface an
    // error state if something went wrong before that redirect happened.
    const { error } = approve
      ? await supabase.auth.oauth.approveAuthorization(authorizationId)
      : await supabase.auth.oauth.denyAuthorization(authorizationId);
    if (error) setStatus("error");
  }

  if (status === "loading") return <p>Loading…</p>;
  if (status === "error")
    return <p>Something went wrong. Close this tab and try again.</p>;

  return (
    <div>
      <p>
        <strong>{details?.client.name}</strong> is requesting access to your
        valorant-mcp profile.
      </p>
      <p>Scopes: {details?.scope}</p>
      <button onClick={() => respond(true)}>Approve</button>
      <button onClick={() => respond(false)}>Deny</button>
    </div>
  );
}
