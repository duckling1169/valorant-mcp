import { NextResponse } from "next/server";
import { z } from "zod";
import { requireEnv } from "@/src/require-env";
import { loadConfig } from "@/src/config";
import { HenrikClient } from "@/src/henrik-client";
import { Endpoints } from "@/src/endpoints";
import { createServiceClient } from "@/src/supabase-service-client";
import { createInvite } from "@/src/create-invite";
import { InputError } from "@/src/errors";

// POST /api/admin/invite { name, tag } — the API-endpoint version of the
// manual onboarding steps in ARCHITECTURE.md's M4 slice 3 note (resolve Riot
// ID -> puuid, add to consented_profiles, mint an mcp_invites code). Gated by
// a shared-secret bearer token (ADMIN_API_KEY) rather than a Supabase
// session, since this is a standalone admin action with no existing session
// context of its own — same "server-only secret gates server-only access"
// shape as SUPABASE_SERVICE_ROLE_KEY.

const adminApiKey = requireEnv("ADMIN_API_KEY", process.env.ADMIN_API_KEY);
const config = loadConfig(process.env);
const client = new HenrikClient({ apiKey: config.henrikApiKey });
const endpoints = new Endpoints(client);
const serviceClient = createServiceClient();

const bodySchema = z.object({
  name: z.string().min(1),
  tag: z.string().min(1),
});

export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${adminApiKey}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const parsedBody = bodySchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsedBody.success) {
    return NextResponse.json(
      { error: "name and tag are required" },
      { status: 400 },
    );
  }

  try {
    const { code } = await createInvite(
      { endpoints, serviceClient },
      parsedBody.data,
    );
    const url = new URL(request.url);
    return NextResponse.json({
      code,
      claim_url: `${url.origin}/claim?code=${code}`,
    });
  } catch (err) {
    if (err instanceof InputError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    return NextResponse.json(
      { error: "failed to create invite" },
      { status: 500 },
    );
  }
}
