import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/services", () => ({
  getServices: () => ({ endpoints: {}, db: {}, cache: {} }),
}));

vi.mock("@/lib/connections", () => ({
  identityForKey: async (_db: unknown, key: string) =>
    key === "good-key"
      ? { operatorPuuid: "p", operatorRegion: "na", operatorPlatform: "pc" }
      : null,
}));

const { POST } = await import("@/app/mcp/route");

function rpc(method: string, key: string) {
  return POST(
    new Request(`https://test.local/mcp?key=${key}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
      },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params: {} }),
    }),
  );
}

describe("/mcp", () => {
  it("rejects an unknown key with a plain Bearer challenge", async () => {
    const res = await rpc("tools/list", "bad-key");
    expect(res.status).toBe(401);
    expect(res.headers.get("www-authenticate")).toBe(
      'Bearer realm="valorant-mcp"',
    );
  });

  it("lists the tools for a valid key", async () => {
    const text = await (await rpc("tools/list", "good-key")).text();
    const body = text.startsWith("{")
      ? text
      : text
          .split("\n")
          .find((l) => l.startsWith("data:"))!
          .slice(5);
    const names = JSON.parse(body).result.tools.map(
      (t: { name: string }) => t.name,
    );
    expect(names.sort()).toEqual([
      "compare_match",
      "compare_rank",
      "get_match_detail",
      "get_player_stats",
      "get_profile",
      "get_rank_history",
      "get_recent_matches",
      "search_match_history",
    ]);
  });
});
