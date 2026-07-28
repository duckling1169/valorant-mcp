import {
  protectedResourceHandler,
  metadataCorsOptionsRequestHandler,
} from "mcp-handler";
import { requireEnv } from "@/src/require-env";

const supabaseUrl = requireEnv(
  "NEXT_PUBLIC_SUPABASE_URL",
  process.env.NEXT_PUBLIC_SUPABASE_URL,
);

// RFC 9728 — tells an MCP client (Claude) that Supabase's OAuth 2.1 server is
// the authorization server for this resource.
const handler = protectedResourceHandler({
  authServerUrls: [`${supabaseUrl}/auth/v1`],
});

export { handler as GET };
export const OPTIONS = metadataCorsOptionsRequestHandler();
