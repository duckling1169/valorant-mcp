import { z } from "zod";
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import {
  regionSchema,
  platformSchema,
  type Region,
  type Platform,
} from "./config";

// M4: per-request operator identity, resolved once in verify-token.ts against
// mcp_users/consented_profiles and stashed on AuthInfo.extra. Every tool
// handler in route.ts reads it back via resolveIdentity instead of a
// module-scoped config — this is what lets the same deployed server serve a
// different operator per authenticated request.

// Field names match the pre-M4 ServerConfig shape (operatorPuuid/Region/
// Platform) so every tool module's existing `deps.config` destructuring is
// unchanged — only the type these fields come from moved, from env-loaded
// ServerConfig to a per-request resolution.
export interface OperatorIdentity {
  operatorPuuid: string;
  operatorRegion: Region;
  operatorPlatform: Platform;
}

const operatorIdentitySchema = z.object({
  operatorPuuid: z.string().min(1),
  operatorRegion: regionSchema,
  operatorPlatform: platformSchema,
});

/** AuthInfo.extra is typed as Record<string, unknown> by the SDK, so this is
 * parsed rather than cast even though verify-token.ts (the only producer) is
 * our own trusted code. withMcpAuth's `required: true` guarantees a request
 * never reaches a tool handler without an AuthInfo — a parse failure here
 * means that invariant broke, not a client-supplied bad value. */
export function resolveIdentity(
  authInfo: AuthInfo | undefined,
): OperatorIdentity {
  const result = operatorIdentitySchema.safeParse(authInfo?.extra);
  if (!result.success) {
    throw new Error(
      "internal: tool handler reached without a resolved operator identity",
    );
  }
  return result.data;
}
