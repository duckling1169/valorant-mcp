"use client";

import { useActionState } from "react";
import { ConnectTabs } from "@/app/_components/ConnectTabs";
import { claimAction } from "./actions";

export function ClaimForm({ code }: { code: string }) {
  const [state, run, pending] = useActionState(claimAction, {});
  if (state.url) {
    return (
      <>
        <p className="lead">
          You&apos;re in. Here&apos;s your connector URL. It&apos;s shown once
          and works like a password.
        </p>
        <ConnectTabs url={state.url} />
      </>
    );
  }
  return (
    <form action={run} className="field">
      <input type="hidden" name="code" value={code} />
      <button className="button" disabled={pending}>
        {pending ? "Connecting…" : "Accept and get my URL"}
      </button>
      {state.error && <p className="error">{state.error}</p>}
    </form>
  );
}
