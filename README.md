# valorant-mcp

An always-available, private MCP server that gives its owner’s LLM client factual VALORANT account and match data through HenrikDev’s API.

## Quick start

The project targets Node.js 24.x and pnpm 10.x. M1–M4 are complete and deployed (see [ARCHITECTURE.md](ARCHITECTURE.md)); [BACKLOG.md](BACKLOG.md) tracks any active near-term work.

```sh
pnpm install
pnpm dev
```

## Verify

```sh
sh scripts/check-agent-docs.sh
```

## Normal use

Any OAuth-authenticated, consented user asks an MCP client (e.g. Claude) for VALORANT data via eight tools: `get_profile`, `get_recent_matches`, `get_match_detail`, `get_player_stats`, `get_rank_history`, `compare_match`, `compare_rank`, and `search_match_history`. Most accept optional `target_name`/`target_tag` to look up a consented friend's data instead of the caller's own. See [ARCHITECTURE.md](ARCHITECTURE.md) for the full tool table and consent model.

## Onboarding a new user

Access is invite-only (M4's two-list consent model — see [ARCHITECTURE.md](ARCHITECTURE.md)). To invite someone, call the admin endpoint with their Riot ID (name#tag):

```sh
curl -X POST https://valorant-mcp.vercel.app/api/admin/invite \
  -H "Authorization: Bearer <ADMIN_API_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"name": "friend", "tag": "1234"}'
```

This resolves the Riot ID via HenrikDev, adds them to `consented_profiles`, and mints a one-time invite code. The response is `{"code": "...", "claim_url": "..."}` — send `claim_url` to the person being invited. They open it, sign in via Supabase magic link with whatever email they want, and that email becomes their `mcp_users` row (their MCP client should then point at `https://valorant-mcp.vercel.app/api/mcp`, same as any other user). `ADMIN_API_KEY` lives in Vercel's Preview/Production env vars and the owner's local `.env` — never commit or share it.

## Project documents

- [ARCHITECTURE.md](ARCHITECTURE.md): boundaries, data flow, and public contracts.
- [CONTRIBUTING.md](CONTRIBUTING.md): development and release workflow.
- [BACKLOG.md](BACKLOG.md): bounded near-term work.
- [ROADMAP.md](ROADMAP.md): optional longer-term direction.

## License

[MIT](LICENSE)
