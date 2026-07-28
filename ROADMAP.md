# Roadmap

Optional, noncommitted longer-term direction. Do not duplicate the near-term backlog.

## Now

- **M0 — policy research and scope decision.** Establish the HenrikDev/Riot data-use boundary before implementation. See [BACKLOG.md](BACKLOG.md).

## Next

- **M1 — securely hosted personal MCP.** Vercel deployment with Supabase Auth, Discord login, explicit client approval, and authentication enforced on both production and preview deployments; Claude launch validation; and exactly three factual tools operating only on the one configured PC profile: `get_profile()`, `get_recent_matches({ limit? })` for recent **competitive** matches (default 10, maximum 10), and `get_match_detail({ match_id })` with compact selected-match detail using current HenrikDev endpoints.
- **M2 — bounded cache, rate-budget behavior, historical discovery, richer match insight, and ChatGPT compatibility.** Supabase Postgres cache limited to authorized data, 100 match records, or 90 days; add a bounded `search_match_history` tool for map, agent, date, act, and rank queries; validate ChatGPT as an MCP client; then review the legacy MCP's derived match facets and carry forward only the ones that improve the new MCP's factual, context-efficient output.

## Later / exploratory

- **M3 — other-user go/no-go.** Evaluate verified consent scope and HenrikDev approval before any multi-user access. If pursued, add a managed service-access approval gate (quota, cost, and policy protection) separately from player-data consent, plus a minimal authenticated route to bind a Riot profile or remove the person's profile, cached data, consent/access records, and MCP grants. This is not a commitment to implement it.
