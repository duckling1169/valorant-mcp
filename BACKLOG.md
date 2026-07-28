# Backlog

Keep only ordered, near-term, actionable work. Each item should say what “done” means. Remove completed items; Git history records completed implementation.

1. **M2: bounded cache, rate-budget behavior, historical discovery, richer match insight, and ChatGPT compatibility** — Supabase Postgres cache limited to authorized data, 100 match records, or 90 days (resolve the tension flagged in ARCHITECTURE.md's 2026-07-28 retention decision before shipping the cache); add a bounded `search_match_history` tool for map, agent, date, act, and rank queries; validate ChatGPT as an MCP client; then review the legacy MCP's derived match facets and carry forward only the ones that improve the new MCP's factual, context-efficient output.
