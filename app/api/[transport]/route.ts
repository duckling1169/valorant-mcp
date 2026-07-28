import { createMcpHandler, withMcpAuth } from "mcp-handler";
import { loadConfig } from "@/src/config";
import { HenrikClient } from "@/src/henrik-client";
import { Endpoints } from "@/src/endpoints";
import { getProfile } from "@/src/profile";
import { verifyToken } from "@/src/verify-token";

// mcp-handler expects a dynamic [transport] route segment, not a fixed folder —
// it dispatches on the actual path itself (mcp/sse/message); `basePath` only tells
// it what prefix to assume for URLs it constructs internally. SSE is disabled: the
// MCP spec deprecated it (2025-03-26) and we only need streamable HTTP.
//
// No auth yet (Slice 3). Bound to the one operator profile configured via env
// (ARCHITECTURE.md's PUUID-binding decision) — constructed once at module scope
// and reused across warm serverless invocations.
const config = loadConfig(process.env);
const client = new HenrikClient({ apiKey: config.henrikApiKey });
const endpoints = new Endpoints(client);

const mcpHandler = createMcpHandler(
  (server) => {
    server.registerTool(
      "get_profile",
      {
        description:
          "The operator's own VALORANT account profile and current/peak competitive rank. No arguments.",
      },
      async () => {
        const envelope = await getProfile({ endpoints, config });
        // The envelope (ok/error.kind) is our own application-level contract, not
        // an MCP protocol error — a "rate" or "upstream" result is a legitimate,
        // well-typed outcome for the client model to read, not a thrown exception
        // (ARCHITECTURE.md: "return stable structured JSON from MCP tools").
        return { content: [{ type: "text", text: JSON.stringify(envelope) }] };
      },
    );
  },
  { serverInfo: { name: "valorant-mcp", version: "0.0.0" } },
  { basePath: "/api", disableSse: true },
);

// Every request must carry a bearer token issued by Supabase's OAuth 2.1 server
// and verified against its JWKS (src/verify-token.ts). Unauthenticated requests
// get a 401 pointing at the protected-resource metadata below, which is how an
// MCP client (Claude) discovers Supabase as the authorization server.
const handler = withMcpAuth(mcpHandler, verifyToken, {
  required: true,
  resourceMetadataPath: "/.well-known/oauth-protected-resource",
});

export const maxDuration = 60;

export { handler as GET, handler as POST, handler as DELETE };
