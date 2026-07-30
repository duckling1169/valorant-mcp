import { NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabaseClient } from "@/src/supabase-server";
import { createServiceClient } from "@/src/supabase-service-client";

// POST /api/claim { code } — redeems an mcp_invites code for the calling
// user's *current* Supabase session, whatever email they signed in with
// (app/claim/page.tsx collects the code and ensures a session exists before
// calling this). Single-use: an already-claimed code is rejected. This is
// the only way mcp_users gets a row for anyone other than the admin's own
// one-off seed insert (ARCHITECTURE.md's M4 slice 3 decision).

const bodySchema = z.object({ code: z.string().min(1) });
const inviteRowSchema = z.object({
  puuid: z.string().min(1),
  claimed_at: z.string().nullable(),
});

export async function POST(request: Request) {
  const parsedBody = bodySchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsedBody.success) {
    return NextResponse.json({ error: "code is required" }, { status: 400 });
  }
  const { code } = parsedBody.data;

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) {
    return NextResponse.json({ error: "not signed in" }, { status: 401 });
  }

  const service = createServiceClient();

  const { data: inviteRow, error: inviteError } = await service
    .from("mcp_invites")
    .select("puuid, claimed_at")
    .eq("code", code)
    .maybeSingle();
  if (inviteError || !inviteRow) {
    return NextResponse.json({ error: "invalid invite code" }, { status: 404 });
  }
  const invite = inviteRowSchema.safeParse(inviteRow);
  if (!invite.success) {
    return NextResponse.json({ error: "invalid invite code" }, { status: 404 });
  }
  if (invite.data.claimed_at) {
    return NextResponse.json(
      { error: "invite code already used" },
      { status: 409 },
    );
  }

  const { error: userError } = await service
    .from("mcp_users")
    .upsert({ email: user.email, puuid: invite.data.puuid });
  if (userError) {
    return NextResponse.json(
      { error: "failed to grant access" },
      { status: 500 },
    );
  }

  await service
    .from("mcp_invites")
    .update({
      claimed_at: new Date().toISOString(),
      claimed_email: user.email,
    })
    .eq("code", code);

  return NextResponse.json({ ok: true });
}
