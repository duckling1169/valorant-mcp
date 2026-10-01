"use client";

import { useActionState } from "react";
import {
  colors,
  inputStyle,
  monoFont,
  primaryButtonStyle,
} from "@/app/_components/theme";
import type { ActionState } from "./actions";

type Action = (prev: ActionState, form: FormData) => Promise<ActionState>;

const formStyle = {
  display: "flex",
  flexDirection: "column",
  gap: 10,
} as const;

export function PasswordForm({ action }: { action: Action }) {
  const [state, run, pending] = useActionState(action, {});
  return (
    <form action={run} style={formStyle}>
      <input
        name="password"
        type="password"
        placeholder="Owner password"
        required
        style={inputStyle}
      />
      <button disabled={pending} style={primaryButtonStyle}>
        Unlock
      </button>
      {state.error && <p style={{ color: colors.redLight }}>{state.error}</p>}
    </form>
  );
}

/** A Riot ID form whose result is a URL shown once. */
export function RiotIdForm({
  action,
  button,
  resultLabel,
}: {
  action: Action;
  button: string;
  resultLabel: string;
}) {
  const [state, run, pending] = useActionState(action, {});
  return (
    <form action={run} style={formStyle}>
      <input name="riotId" placeholder="name#tag" required style={inputStyle} />
      <button disabled={pending} style={primaryButtonStyle}>
        {pending ? "Working…" : button}
      </button>
      {state.error && <p style={{ color: colors.redLight }}>{state.error}</p>}
      {state.url && <OneTimeUrl label={resultLabel} url={state.url} />}
    </form>
  );
}

export function OneTimeUrl({ label, url }: { label: string; url: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <p style={{ color: colors.textDim, fontSize: 13 }}>{label}</p>
      <input
        readOnly
        value={url}
        onFocus={(e) => e.currentTarget.select()}
        style={{ ...inputStyle, fontFamily: monoFont, fontSize: 12 }}
      />
      <button
        type="button"
        onClick={() => navigator.clipboard.writeText(url)}
        style={{ ...primaryButtonStyle, alignSelf: "flex-start" }}
      >
        Copy
      </button>
    </div>
  );
}
