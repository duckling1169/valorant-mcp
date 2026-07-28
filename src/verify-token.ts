import { createRemoteJWKSet, jwtVerify } from "jose";
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import { requireEnv } from "./require-env";

const supabaseUrl = requireEnv(
  "NEXT_PUBLIC_SUPABASE_URL",
  process.env.NEXT_PUBLIC_SUPABASE_URL,
);

// Supabase's OAuth 2.1 server issues tokens signed with an asymmetric key
// (RS256/ES256), verifiable against its published JWKS — no round trip to
// Supabase needed per request.
const issuer = `${supabaseUrl}/auth/v1`;
const jwks = createRemoteJWKSet(new URL(`${issuer}/.well-known/jwks.json`));

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
    return { token: bearerToken, clientId, scopes: [] };
  } catch {
    // Invalid/expired/wrong-issuer token — never log the token itself.
    return undefined;
  }
}
