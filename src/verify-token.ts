import { createRemoteJWKSet, jwtVerify } from "jose";
import { z } from "zod";
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import { requireEnv } from "./require-env";
import { createServiceClient } from "./supabase-service-client";
import { regionSchema, platformSchema } from "./config";

const supabaseUrl = requireEnv(
  "NEXT_PUBLIC_SUPABASE_URL",
  process.env.NEXT_PUBLIC_SUPABASE_URL,
);

// Supabase's OAuth 2.1 server issues tokens signed with an asymmetric key
// (RS256/ES256), verifiable against its published JWKS — no round trip to
// Supabase needed per request.
const issuer = `${supabaseUrl}/auth/v1`;
const jwks = createRemoteJWKSet(new URL(`${issuer}/.well-known/jwks.json`));

// M4: identity resolution. A verified JWT only proves *which Supabase account*
// made the request — mcp_users maps that account's email to the puuid it's
// allowed to act as, and consented_profiles carries that puuid's region/
// platform. An email not present in mcp_users is treated identically to an
// invalid token (undefined -> 401): List 1 (service access) is the gate here,
// not List 2 (consented_profiles) directly — see ARCHITECTURE.md's two-list
// consent model, decided via grilling session, 2026-07-29.
const serviceClient = createServiceClient();

const mcpUserRowSchema = z.object({ puuid: z.string().min(1) });
const profileRowSchema = z.object({
  region: regionSchema,
  platform: platformSchema,
});

/** mcp-handler's withMcpAuth verifyToken callback. */
export async function verifyToken(
  _request: Request,
  bearerToken?: string,
): Promise<AuthInfo | undefined> {
  if (!bearerToken) return undefined;

  try {
    const { payload } = await jwtVerify(bearerToken, jwks, {
      issuer,
      audience: "authenticated",
    });
    const clientId = typeof payload.sub === "string" ? payload.sub : "";
    const email = typeof payload.email === "string" ? payload.email : "";
    if (!email) return undefined;

    const { data: userRow, error: userError } = await serviceClient
      .from("mcp_users")
      .select("puuid")
      .eq("email", email)
      .maybeSingle();
    if (userError || !userRow) return undefined;
    const user = mcpUserRowSchema.safeParse(userRow);
    if (!user.success) return undefined;

    const { data: profileRow, error: profileError } = await serviceClient
      .from("consented_profiles")
      .select("region, platform")
      .eq("puuid", user.data.puuid)
      .maybeSingle();
    if (profileError || !profileRow) return undefined;
    const profile = profileRowSchema.safeParse(profileRow);
    if (!profile.success) return undefined;

    return {
      token: bearerToken,
      clientId,
      scopes: [],
      extra: {
        operatorPuuid: user.data.puuid,
        operatorRegion: profile.data.region,
        operatorPlatform: profile.data.platform,
      },
    };
  } catch {
    // Invalid/expired/wrong-issuer token — never log the token itself.
    return undefined;
  }
}
