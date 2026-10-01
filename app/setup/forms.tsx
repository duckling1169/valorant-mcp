"use client";

import { useActionState } from "react";
import { ConnectTabs } from "@/app/_components/ConnectTabs";
import type { ActionState } from "./actions";

type Action = (prev: ActionState, form: FormData) => Promise<ActionState>;

export function PasswordForm({ action }: { action: Action }) {
  const [state, run, pending] = useActionState(action, {});
  return (
    <form action={run} className="field">
      <input
        name="password"
        type="password"
        placeholder="Owner password"
        aria-label="Owner password"
        autoComplete="current-password"
        required
      />
      <button className="button" disabled={pending}>
        Unlock
      </button>
      {state.error && <p className="error">{state.error}</p>}
    </form>
  );
}

/** Creates a connector URL for a Riot ID and shows where to paste it. */
export function ConnectForm({ action }: { action: Action }) {
  const [state, run, pending] = useActionState(action, {});
  if (state.url) {
    return (
      <>
        <p className="lead">
          Here&apos;s the connector URL. It&apos;s shown once and works like a
          password.
        </p>
        <ConnectTabs url={state.url} />
      </>
    );
  }
  return (
    <RiotIdField
      run={run}
      pending={pending}
      error={state.error}
      button="Create connector URL"
    />
  );
}

/** Creates a single-use invite link for a friend's Riot ID. */
export function InviteForm({ action }: { action: Action }) {
  const [state, run, pending] = useActionState(action, {});
  return (
    <>
      <RiotIdField
        run={run}
        pending={pending}
        error={state.error}
        button="Create invite link"
      />
      {state.url && (
        <div className="field" style={{ marginTop: 16 }}>
          <p className="lead" style={{ margin: 0 }}>
            Send this single-use link to your friend:
          </p>
          <input
            className="url"
            readOnly
            value={state.url}
            aria-label="Invite link"
            onFocus={(e) => e.currentTarget.select()}
          />
        </div>
      )}
    </>
  );
}

function RiotIdField({
  run,
  pending,
  error,
  button,
}: {
  run: (form: FormData) => void;
  pending: boolean;
  error?: string;
  button: string;
}) {
  return (
    <form action={run} className="field">
      <input
        name="riotId"
        placeholder="Name#TAG"
        aria-label="Riot ID"
        autoComplete="off"
        required
      />
      <button className="button" disabled={pending}>
        {pending ? "Looking up…" : button}
      </button>
      {error && <p className="error">{error}</p>}
    </form>
  );
}
