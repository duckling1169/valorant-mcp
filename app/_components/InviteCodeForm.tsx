"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { inputStyle, monoFont, primaryButtonStyle } from "@/app/_components/theme";

// Landing-page CTA: collects the invite code the operator was given and
// hands off to /claim?code=..., which does the actual session check
// (redirecting to /login first if the visitor isn't signed in yet) and
// redemption. This form's only job is turning "I have a code" into that URL.
export function InviteCodeForm() {
  const router = useRouter();
  const [code, setCode] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = code.trim();
    if (!trimmed) return;
    router.push(`/claim?code=${encodeURIComponent(trimmed)}`);
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{ display: "flex", gap: 8, flexWrap: "wrap" }}
    >
      <input
        type="text"
        value={code}
        onChange={(event) => setCode(event.target.value)}
        placeholder="invite code"
        required
        style={{ ...inputStyle, width: 180, fontSize: 13, padding: "12px 14px" }}
      />
      <button
        type="submit"
        style={{ ...primaryButtonStyle, fontSize: 13, padding: "12px 18px" }}
      >
        ENTER INVITE CODE →
      </button>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          fontFamily: monoFont,
          fontSize: 12,
          color: "#6b6b74",
          letterSpacing: "0.06em",
        }}
      >
        INVITE-ONLY: ASK THE OWNER TO ADD YOUR RIOT ID
      </div>
    </form>
  );
}
