"use client";

import { useActionState } from "react";
import { colors, primaryButtonStyle } from "@/app/_components/theme";
import { OneTimeUrl } from "@/app/setup/forms";
import { claimAction } from "./actions";

export function ClaimForm({ code }: { code: string }) {
  const [state, run, pending] = useActionState(claimAction, {});
  if (state.url) {
    return (
      <OneTimeUrl
        label="Add this as a custom connector in Claude, ChatGPT or any MCP client. It is shown once and works like a password."
        url={state.url}
      />
    );
  }
  return (
    <form action={run}>
      <input type="hidden" name="code" value={code} />
      <button disabled={pending} style={primaryButtonStyle}>
        {pending ? "Connecting…" : "Accept and get my connector URL"}
      </button>
      {state.error && <p style={{ color: colors.redLight }}>{state.error}</p>}
    </form>
  );
}
