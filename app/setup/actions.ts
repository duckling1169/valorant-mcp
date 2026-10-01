"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import {
  createConnection,
  createInvite,
  deleteInvite,
  resolveRiotId,
  revokeConnection,
} from "@/lib/connections";
import { InputError, UpstreamError } from "@/lib/errors";
import { isOwner, passwordMatches, signIn } from "@/lib/owner";
import { getServices } from "@/lib/services";

export type ActionState = { url?: string; error?: string };

async function origin() {
  const h = await headers();
  return `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host")}`;
}

function parseRiotId(value: FormDataEntryValue | null) {
  const [name, tag] = String(value ?? "")
    .trim()
    .split("#");
  if (!name || !tag) throw new InputError("Enter a Riot ID like name#tag.");
  return { name: name.trim(), tag: tag.trim() };
}

function message(error: unknown) {
  if (error instanceof InputError || error instanceof UpstreamError) {
    return error.message;
  }
  return "Something went wrong. Try again.";
}

async function requireOwner() {
  if (!(await isOwner())) throw new InputError("Sign in again.");
}

export async function signInAction(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  if (!passwordMatches(String(form.get("password") ?? ""))) {
    return { error: "Wrong password." };
  }
  await signIn();
  revalidatePath("/setup");
  return {};
}

/** Adds the owner's own Riot ID and returns its connector URL. */
export async function connectAction(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  try {
    await requireOwner();
    const { name, tag } = parseRiotId(form.get("riotId"));
    const { db, endpoints } = getServices();
    const key = await createConnection(
      db,
      await resolveRiotId(endpoints, name, tag),
    );
    revalidatePath("/setup");
    return { url: `${await origin()}/mcp?key=${key}` };
  } catch (error) {
    return { error: message(error) };
  }
}

/** Creates a single-use invite link for a friend's Riot ID. */
export async function inviteAction(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  try {
    await requireOwner();
    const { name, tag } = parseRiotId(form.get("riotId"));
    const { db, endpoints } = getServices();
    const code = await createInvite(
      db,
      await resolveRiotId(endpoints, name, tag),
    );
    revalidatePath("/setup");
    return { url: `${await origin()}/claim?code=${code}` };
  } catch (error) {
    return { error: message(error) };
  }
}

export async function revokeAction(form: FormData) {
  await requireOwner();
  await revokeConnection(getServices().db, String(form.get("keyHash")));
  revalidatePath("/setup");
}

export async function cancelInviteAction(form: FormData) {
  await requireOwner();
  await deleteInvite(getServices().db, String(form.get("code")));
  revalidatePath("/setup");
}
