# Backlog

Keep only ordered, near-term, actionable work. Each item should say what “done” means. Remove completed items; Git history records completed implementation.

1. **M1: securely hosted personal MCP** — Vercel deployment with Supabase Auth (email magic-link), explicit client approval, authentication enforced on both production and preview deployments; Claude launch validation; exactly three factual tools operating on the one configured PC profile: `get_profile()`, `get_recent_matches({ limit? })` (default 10, max 10 competitive matches), and `get_match_detail({ match_id })`. No persistent cache in M1 (see ARCHITECTURE.md Decisions, 2026-07-28).
