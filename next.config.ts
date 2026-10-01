import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The MCP endpoint moved from /api/mcp to /mcp; keep old connector URLs working.
  rewrites: async () => [{ source: "/api/mcp", destination: "/mcp" }],
};

export default nextConfig;
