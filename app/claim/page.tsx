"use client";

import { useEffect, useState } from "react";
import { createBrowserSupabaseClient } from "@/src/supabase-browser";
import { requireSession } from "@/src/require-session";

type Status = "loading" | "claiming" | "done" | "error";

export default function ClaimPage() {
  const [status, setStatus] = useState<Status>("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function run() {
      const code = new URLSearchParams(window.location.search).get("code");
      if (!code) {
        setStatus("error");
        setMessage("Missing invite code.");
        return;
      }

      const supabase = createBrowserSupabaseClient();
      const session = await requireSession(
        supabase,
        `/claim?code=${encodeURIComponent(code)}`,
      );
      if (!session) return;

      setStatus("claiming");
      const res = await fetch("/api/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const body: { error?: string } = await res.json();
      if (!res.ok) {
        setStatus("error");
        setMessage(body.error ?? "Something went wrong.");
        return;
      }
      setStatus("done");
    }
    void run();
  }, []);

  if (status === "loading" || status === "claiming") return <p>Loading…</p>;
  if (status === "error") return <p>{message}</p>;
  return <p>You&apos;re all set — you can now connect your MCP client.</p>;
}
