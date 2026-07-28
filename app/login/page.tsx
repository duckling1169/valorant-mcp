"use client";

import { useState, type FormEvent } from "react";
import { createBrowserSupabaseClient } from "@/src/supabase-browser";

type Status = "idle" | "sending" | "sent" | "error";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("sending");

    const next = new URLSearchParams(window.location.search).get("next") ?? "/";
    const emailRedirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;

    const supabase = createBrowserSupabaseClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo },
    });
    setStatus(error ? "error" : "sent");
  }

  if (status === "sent") {
    return <p>Check your email for a sign-in link.</p>;
  }

  return (
    <form onSubmit={handleSubmit}>
      <label>
        Email
        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />
      </label>
      <button type="submit" disabled={status === "sending"}>
        Send magic link
      </button>
      {status === "error" && <p>Something went wrong. Try again.</p>}
    </form>
  );
}
