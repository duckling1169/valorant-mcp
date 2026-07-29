import { z } from "zod";
import { createMcpHandler, withMcpAuth } from "mcp-handler";
import { loadConfig } from "@/src/config";
import { HenrikClient } from "@/src/henrik-client";
import { Endpoints } from "@/src/endpoints";
import { getProfile } from "@/src/profile";
import { getRecentMatches } from "@/src/recent-matches";
import { getMatchDetail } from "@/src/match-detail";
import { getPlayerStats } from "@/src/player-stats";
import { compareMatch } from "@/src/compare-match";
import { compareRank } from "@/src/compare-rank";
import { verifyToken } from "@/src/verify-token";

// mcp-handler expects a dynamic [transport] route segment, not a fixed folder —
// it dispatches on the actual path itself (mcp/sse/message); `basePath` only tells
// it what prefix to assume for URLs it constructs internally. SSE is disabled: the
// MCP spec deprecated it (2025-03-26) and we only need streamable HTTP.
//
// Bound to the one operator profile configured via env (ARCHITECTURE.md's
// PUUID-binding decision) — constructed once at module scope and reused across
// warm serverless invocations.
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

    server.registerTool(
      "get_recent_matches",
      {
        description:
          "The operator's recent competitive VALORANT matches (default 10, maximum 10).",
        inputSchema: { limit: z.number().int().min(1).max(10).optional() },
      },
      async ({ limit }) => {
        const envelope = await getRecentMatches(
          { endpoints, config },
          { limit: limit ?? 10 },
        );
        return { content: [{ type: "text", text: JSON.stringify(envelope) }] };
      },
    );

    server.registerTool(
      "get_match_detail",
      {
        description:
          "Compact detail for one of the operator's own matches (map, per-player stats, final team scores). Rejected if the operator wasn't a participant. Set include_insight for deeper per-player facets (KAST, trade rate, first bloods, multi-kills, weapon kills/accuracy, attack/defense side splits, economy buckets, plants/defuses, clutch stats) plus match-level party grouping and the operator's lobby percentile — larger response (~3.7x), opt-in.",
        inputSchema: {
          match_id: z.string().min(1),
          include_insight: z.boolean().optional(),
        },
      },
      async ({ match_id, include_insight }) => {
        const envelope = await getMatchDetail(
          { endpoints, config },
          { match_id, include_insight },
        );
        return { content: [{ type: "text", text: JSON.stringify(envelope) }] };
      },
    );

    server.registerTool(
      "get_player_stats",
      {
        description:
          "Pooled descriptive stats across the operator's recent competitive matches: ACS/ADR/KDA/headshot % distributions with trend, survival rate, per-agent breakdown, rank/RR/peak/climb, and best/worst game (default 20 matches, maximum 50).",
        inputSchema: {
          sample_size: z.number().int().min(5).max(50).optional(),
        },
      },
      async ({ sample_size }) => {
        const envelope = await getPlayerStats(
          { endpoints, config },
          { sample_size: sample_size ?? 20 },
        );
        return { content: [{ type: "text", text: JSON.stringify(envelope) }] };
      },
    );

    const compareInputSchema = {
      match_id: z.string().min(1),
      opponent_name: z.string().min(1),
      opponent_tag: z.string().min(1),
    };

    server.registerTool(
      "compare_match",
      {
        description:
          "Head-to-head stats for the operator vs. a named opponent (name/tag as shown by get_match_detail) within one shared match. Rejected if either player wasn't a participant in match_id.",
        inputSchema: compareInputSchema,
      },
      async ({ match_id, opponent_name, opponent_tag }) => {
        const envelope = await compareMatch(
          { endpoints, config },
          { match_id, opponent_name, opponent_tag },
        );
        return { content: [{ type: "text", text: JSON.stringify(envelope) }] };
      },
    );

    server.registerTool(
      "compare_rank",
      {
        description:
          "The operator's current rank/RR vs. a named opponent's current rank/RR (live, not their rank at match time). The opponent must be found via a shared match (name/tag as shown by get_match_detail) — never a fresh lookup. Rejected if either player wasn't a participant in match_id.",
        inputSchema: compareInputSchema,
      },
      async ({ match_id, opponent_name, opponent_tag }) => {
        const envelope = await compareRank(
          { endpoints, config },
          { match_id, opponent_name, opponent_tag },
        );
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
