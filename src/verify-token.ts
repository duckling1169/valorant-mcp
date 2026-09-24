import { createRemoteJWKSet, jwtVerify } from "jose";
import { z } from "zod";
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import { requireEnv } from "./require-env";
import { createServiceClient } from "./supabase-service-client";
import { regionSchema, platformSchema } from "./config";

type TokenFailureCategory =
  "signature" | "issuer" | "expiry" | "audience" | "other";

function tokenFailureCategory(error: unknown): TokenFailureCategory {
  if (!(error instanceof Error)) return "other";
  switch (error.name) {
    case "JWSSignatureVerificationFailed":
    case "JWSInvalid":
    case "JWKSNoMatchingKey":
      return "signature";
    case "JWTClaimValidationFailed":
      if (error.message.includes('"iss"')) return "issuer";
      if (error.message.includes('"aud"')) return "audience";
      if (
        ["exp", "nbf", "iat"].some((claim) =>
          error.message.includes(`"${claim}"`),
        )
      ) {
        return "expiry";
      }
      return "other";
    case "JWTExpired":
      return "expiry";
    default:
      return "other";
  }
}

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
  request: Request,
  bearerToken?: string,
): Promise<AuthInfo | undefined> {
  const requestId = request.headers.get("x-vercel-id") ?? "unavailable";
  const hasAuthorization = request.headers.has("authorization");
  const logRejection = (
    result: "missing_bearer_token" | "jwt_rejected" | "authorization_rejected",
    reason?: string,
  ): undefined => {
    console.info("mcp_auth_diagnostic", {
      requestId,
      hasAuthorization,
      result,
      ...(reason ? { reason } : {}),
    });
    return undefined;
  };

  if (!bearerToken) {
    return logRejection("missing_bearer_token");
  }

  try {
    const { payload } = await jwtVerify(bearerToken, jwks, {
      issuer,
      audience: "authenticated",
    });
    const clientId = typeof payload.sub === "string" ? payload.sub : "";
    const email = typeof payload.email === "string" ? payload.email : "";
    if (!email)
      return logRejection("authorization_rejected", "missing_email_claim");

    const { data: userRow, error: userError } = await serviceClient
      .from("mcp_users")
      .select("puuid")
      .eq("email", email)
      .maybeSingle();
    if (userError) {
      return logRejection("authorization_rejected", "mcp_user_lookup_error");
    }
    if (!userRow) {
      return logRejection("authorization_rejected", "mcp_user_not_found");
    }
    const user = mcpUserRowSchema.safeParse(userRow);
    if (!user.success) {
      return logRejection("authorization_rejected", "mcp_user_invalid");
    }

    const { data: profileRow, error: profileError } = await serviceClient
      .from("consented_profiles")
      .select("region, platform")
      .eq("puuid", user.data.puuid)
      .maybeSingle();
    if (profileError) {
      return logRejection(
        "authorization_rejected",
        "consented_profile_lookup_error",
      );
    }
    if (!profileRow) {
      return logRejection(
        "authorization_rejected",
        "consented_profile_not_found",
      );
    }
    const profile = profileRowSchema.safeParse(profileRow);
    if (!profile.success) {
      return logRejection(
        "authorization_rejected",
        "consented_profile_invalid",
      );
    }

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
  } catch (error) {
    // Only a bounded category is logged; never include tokens, claims, or raw errors.
    logRejection("jwt_rejected", tokenFailureCategory(error));
    return undefined;
  }
}
