import { z } from "zod";
import { createMcpHandler } from "mcp-handler";
import { getProfile } from "@/lib/tools/profile";
import { getRecentMatches } from "@/lib/tools/recent-matches";
import { getMatchDetail } from "@/lib/tools/match-detail";
import { getPlayerStats } from "@/lib/tools/player-stats";
import { compareMatch } from "@/lib/tools/compare-match";
import { compareRank } from "@/lib/tools/compare-rank";
import { getRankHistory } from "@/lib/tools/rank-history";
import { searchMatchHistory } from "@/lib/tools/search-match-history";
import { identityForKey } from "@/lib/connections";
import { getServices } from "@/lib/services";
import { currentIdentity, requestIdentity } from "@/lib/identity";
import { resolveTarget } from "@/lib/target";

// Each request acts as the consented profile its connection key belongs to
// (lib/connections.ts). Services are created on first request (lib/services.ts).

// M4 slice 4: any tool taking this input may act on a consented profile
// (List 2) instead of the caller's own identity — resolved only against
// consented_profiles, never a live HenrikDev name/tag lookup.
const targetInputSchema = {
  target_name: z.string().min(1).optional(),
  target_tag: z.string().min(1).optional(),
};

/** Every registerTool callback wraps its envelope the same way — MCP's
 * CallToolResult content array, one text block of the JSON-stringified
 * envelope (README.md: "return stable structured JSON from MCP tools"). */
function toToolResult(envelope: unknown): {
  content: [{ type: "text"; text: string }];
} {
  return { content: [{ type: "text", text: JSON.stringify(envelope) }] };
}

/** Every target-widened tool resolves the caller's own identity, then swaps
 * in a consented target's identity if target_name/target_tag were given. */
async function resolveEffectiveIdentity(target: {
  target_name?: string;
  target_tag?: string;
}) {
  return resolveTarget(getServices().db, currentIdentity(), target);
}

const mcpHandler = createMcpHandler(
  (server) => {
    server.registerTool(
      "get_profile",
      {
        description:
          "The operator's own VALORANT account profile and current/peak competitive rank. Pass target_name/target_tag together to look up a consented friend's profile instead — rejected if that name/tag hasn't consented.",
        inputSchema: z.object(targetInputSchema),
      },
      async ({ target_name, target_tag }) => {
        const identity = await resolveEffectiveIdentity({
          target_name,
          target_tag,
        });
        const envelope = await getProfile({
          endpoints: getServices().endpoints,
          config: identity,
        });
        return toToolResult(envelope);
      },
    );

    server.registerTool(
      "get_recent_matches",
      {
        description:
          "The operator's recent competitive VALORANT matches (default 10, maximum 10). Pass target_name/target_tag together to look up a consented friend's matches instead — rejected if that name/tag hasn't consented.",
        inputSchema: z.object({
          limit: z.number().int().min(1).max(10).optional(),
          ...targetInputSchema,
        }),
      },
      async ({ limit, target_name, target_tag }) => {
        const identity = await resolveEffectiveIdentity({
          target_name,
          target_tag,
        });
        const envelope = await getRecentMatches(
          { ...getServices(), config: identity },
          { limit: limit ?? 10 },
        );
        return toToolResult(envelope);
      },
    );

    server.registerTool(
      "get_match_detail",
      {
        description:
          "Compact detail for one of the operator's own matches (map, per-player stats, final team scores). Rejected if the operator wasn't a participant. Set include_insight for deeper per-player facets (KAST, trade rate, first bloods, multi-kills, weapon kills/accuracy, attack/defense side splits, economy buckets, plants/defuses, clutch stats) plus match-level party grouping and the operator's lobby percentile — larger response (~3.7x), opt-in. Pass target_name/target_tag together to check a consented friend's participation instead — rejected if that name/tag hasn't consented.",
        inputSchema: z.object({
          match_id: z.string().min(1),
          include_insight: z.boolean().optional(),
          ...targetInputSchema,
        }),
      },
      async ({ match_id, include_insight, target_name, target_tag }) => {
        const identity = await resolveEffectiveIdentity({
          target_name,
          target_tag,
        });
        const envelope = await getMatchDetail(
          { ...getServices(), config: identity },
          { match_id, include_insight },
        );
        return toToolResult(envelope);
      },
    );

    server.registerTool(
      "get_player_stats",
      {
        description:
          "Pooled descriptive stats across the operator's recent competitive matches: ACS/ADR/KDA/headshot % distributions with trend, survival rate, per-agent breakdown, rank/RR/peak/climb, and best/worst game (default 20 matches, maximum 50). Pass target_name/target_tag together to look up a consented friend's stats instead — rejected if that name/tag hasn't consented.",
        inputSchema: z.object({
          sample_size: z.number().int().min(5).max(50).optional(),
          ...targetInputSchema,
        }),
      },
      async ({ sample_size, target_name, target_tag }) => {
        const identity = await resolveEffectiveIdentity({
          target_name,
          target_tag,
        });
        const envelope = await getPlayerStats(
          { ...getServices(), config: identity },
          { sample_size: sample_size ?? 20 },
        );
        return toToolResult(envelope);
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
        inputSchema: z.object(compareInputSchema),
      },
      async ({ match_id, opponent_name, opponent_tag }) => {
        const identity = currentIdentity();
        const envelope = await compareMatch(
          { endpoints: getServices().endpoints, config: identity },
          { match_id, opponent_name, opponent_tag },
        );
        return toToolResult(envelope);
      },
    );

    server.registerTool(
      "compare_rank",
      {
        description:
          "The operator's current rank/RR vs. a named opponent's current rank/RR (live, not their rank at match time). The opponent must be found via a shared match (name/tag as shown by get_match_detail) — never a fresh lookup. Rejected if either player wasn't a participant in match_id.",
        inputSchema: z.object(compareInputSchema),
      },
      async ({ match_id, opponent_name, opponent_tag }) => {
        const identity = currentIdentity();
        const envelope = await compareRank(
          { endpoints: getServices().endpoints, config: identity },
          { match_id, opponent_name, opponent_tag },
        );
        return toToolResult(envelope);
      },
    );

    server.registerTool(
      "get_rank_history",
      {
        description:
          "The operator's per-match competitive RR/tier trajectory (rank, RR, RR change, elo, derank-protection flag), newest first. Default 20 entries, maximum 50. " +
          "HenrikDev's underlying mmr-history endpoint has no server-side pagination — every call returns its full available history, and `limit` only truncates that same list. " +
          "This means calling again with a larger `limit` re-returns entries you already have, byte-for-byte identical (match results are immutable), at full token cost for the overlap. " +
          "If you already hold rank-history entries from a prior call in this conversation, pass their most-recent match_id as `since_match_id` to get only entries strictly newer than it — avoids re-paying tokens for entries you've already seen. " +
          "Errors (input) if since_match_id isn't found in the operator's rank history. " +
          "Pass target_name/target_tag together to look up a consented friend's rank history instead — rejected if that name/tag hasn't consented.",
        inputSchema: z.object({
          limit: z.number().int().min(1).max(50).optional(),
          since_match_id: z.string().min(1).optional(),
          ...targetInputSchema,
        }),
      },
      async ({ limit, since_match_id, target_name, target_tag }) => {
        const identity = await resolveEffectiveIdentity({
          target_name,
          target_tag,
        });
        const envelope = await getRankHistory(
          { endpoints: getServices().endpoints, config: identity },
          { limit: limit ?? 20, since_match_id },
        );
        return toToolResult(envelope);
      },
    );

    server.registerTool(
      "search_match_history",
      {
        description:
          "Cache-only search over the operator's own matches already fetched via get_match_detail (map/agent/act/rank/date filters, default 20 results, maximum 100). " +
          "No live HenrikDev call and no fallback — only matches previously detailed via get_match_detail are found here, so an empty result means nothing cached matches the filters, not an error. " +
          "Coverage grows opportunistically as get_match_detail is called on more matches; it is not a full match-history index. " +
          "Returns the same lightweight shape as get_recent_matches, newest first.",
        inputSchema: z.object({
          map: z.string().min(1).optional(),
          agent: z.string().min(1).optional(),
          act: z.string().min(1).optional(),
          rank: z.string().min(1).optional(),
          date_from: z.string().min(1).optional(),
          date_to: z.string().min(1).optional(),
          limit: z.number().int().min(1).max(100).optional(),
        }),
      },
      async ({ map, agent, act, rank, date_from, date_to, limit }) => {
        const identity = currentIdentity();
        const envelope = await searchMatchHistory(
          { cache: getServices().cache, config: identity },
          { map, agent, act, rank, date_from, date_to, limit: limit ?? 20 },
        );
        return toToolResult(envelope);
      },
    );
  },
  { serverInfo: { name: "valorant-mcp", version: "0.0.0" } },
);

function extractKey(req: Request): string | null {
  const header = req.headers.get("authorization") ?? "";
  if (header.startsWith("Bearer ") && header.slice(7).trim()) {
    return header.slice(7).trim();
  }
  return new URL(req.url).searchParams.get("key")?.trim() || null;
}

// A JSON body plus a plain Bearer challenge (no resource_metadata), so clients
// don't mistake this for an invitation to attempt OAuth.
function unauthorized(): Response {
  return Response.json(
    {
      error:
        "Missing or invalid connection key. Ask the owner for a connector URL.",
    },
    {
      status: 401,
      headers: { "WWW-Authenticate": 'Bearer realm="valorant-mcp"' },
    },
  );
}

async function handler(req: Request): Promise<Response> {
  const key = extractKey(req);
  const identity = key
    ? await identityForKey(getServices().db, key).catch(() => null)
    : null;
  if (!identity) return unauthorized();
  return requestIdentity.run(identity, () => mcpHandler(req));
}

export const maxDuration = 60;

export { handler as GET, handler as POST, handler as DELETE };
