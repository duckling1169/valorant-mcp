"use server";

import { headers } from "next/headers";
import { claimInvite } from "@/lib/connections";
import { InputError } from "@/lib/errors";
import { getServices } from "@/lib/services";
import type { ActionState } from "@/app/setup/actions";

export async function claimAction(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  try {
    const key = await claimInvite(getServices().db, String(form.get("code")));
    const h = await headers();
    const origin = `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host")}`;
    return { url: `${origin}/mcp?key=${key}` };
  } catch (error) {
    return {
      error:
        error instanceof InputError
          ? error.message
          : "Something went wrong. Try again.",
    };
  }
}
