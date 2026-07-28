# Roadmap

Optional, noncommitted longer-term direction. Do not duplicate the near-term backlog.

## Now

- **M2 — bounded cache, rate-budget behavior, historical discovery, richer match insight, and ChatGPT compatibility.** Supabase Postgres cache limited to authorized data, 100 match records, or 90 days; add a bounded `search_match_history` tool for map, agent, date, act, and rank queries; validate ChatGPT as an MCP client; then review the legacy MCP's derived match facets and carry forward only the ones that improve the new MCP's factual, context-efficient output. See [BACKLOG.md](BACKLOG.md).

## Later / exploratory

- **M3 — other-user go/no-go.** Evaluate verified consent scope and HenrikDev approval before any multi-user access. If pursued, add a managed service-access approval gate (quota, cost, and policy protection) separately from player-data consent, plus a minimal authenticated route to bind a Riot profile or remove the person's profile, cached data, consent/access records, and MCP grants. This is not a commitment to implement it.
