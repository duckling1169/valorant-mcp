# Roadmap

Optional, noncommitted longer-term direction. Do not duplicate the near-term backlog.

## Now

- **M2 — tool-list expansion.** Exhaustive review of the legacy MCP's derived match facets, cross-referenced against HenrikDev's current API shapes (not legacy's possibly-stale assumptions); build whatever facets meet the existing bar (factual, context-efficient, no coaching/editorial output) as new MCP tools. See [BACKLOG.md](BACKLOG.md).

## Later / exploratory

- **M3 — bounded cache.** Supabase Postgres cache for already-authorized match/profile/MMR data, sized against M2's final tool/field set (avoids a follow-up schema migration). The 100-match/90-day bound caps how much history is retained, not staleness — completed-match data is immutable, so it doesn't conflict with HenrikDev's own short-lived served-cache TTL. Write-through population only (no backfill job); FIFO eviction by match date past the bound. Add a cache-only `search_match_history` tool (map/agent/date/act/rank filters, bounded `limit`, no live HenrikDev fallback) returning the same lightweight `Match` shape `get_recent_matches` uses; `get_match_detail` returns that shape with `players` populated. Re-verify M1's existing rate-budget behavior once cache-driven call volume drops, rather than building new rate-budget logic.
- **M4 — other-user go/no-go.** Evaluate verified consent scope and HenrikDev approval before any multi-user access. If pursued, add a managed service-access approval gate (quota, cost, and policy protection) separately from player-data consent, plus a minimal authenticated route to bind a Riot profile or remove the person's profile, cached data, consent/access records, and MCP grants. This is not a commitment to implement it.
