# valorant-mcp

A self-hosted MCP server that gives your AI assistant factual VALORANT account and match data
through [HenrikDev's API](https://docs.henrikdev.xyz).

## Use

1. Deploy your own copy (Vercel + Supabase) and set the env vars in `.env.example`.
2. Open `/setup`, unlock it with `OWNER_PASSWORD`, and enter your Riot ID. You get a connector
   URL, shown once.
3. Add that URL as a custom connector (MCP server) in Claude, ChatGPT, or any MCP client.
4. Optionally invite friends from `/setup`. Each friend accepts on a single-use `/claim` link and
   gets their own connector URL.

## Tools

All read-only. Tools marked "friend" accept `target_name`/`target_tag` to act on a friend who has
accepted an invite.

| Tool | Returns | Friend |
| --- | --- | --- |
| `get_profile` | Account profile and current/peak rank | yes |
| `get_recent_matches` | Recent competitive matches (max 10) | yes |
| `get_match_detail` | One match; `include_insight` adds KAST, trades, multi-kills, side splits, economy, clutches, party and lobby percentile | yes |
| `get_player_stats` | Pooled stats over recent matches: ACS/ADR/KDA/headshot distributions, agents, rank climb | yes |
| `get_rank_history` | Per-match RR/tier trajectory, windowed by `since_match_id` | yes |
| `compare_match` | Head-to-head stats against a named opponent in a shared match | — |
| `compare_rank` | Current rank against a named opponent found in a shared match | — |
| `search_match_history` | Search your own previously fetched matches (cache only) | — |

## How it works

- **Consent.** Only profiles in `consented_profiles` are ever looked up: the owner's own account,
  and friends who accepted an invite. A name/tag that hasn't consented is rejected the same way as
  one that doesn't exist. Other players appear only as participants in your own matches.
- **Auth.** Each connector URL carries a random key (`/mcp?key=…` or `Authorization: Bearer`).
  Only its SHA-256 is stored (`connections`); revoke it on `/setup`.
- **Cache.** `cached_matches` is keyed by `(operator_puuid, match_id)` and bounded to 100 rows
  per profile. It fails open: a database error never fails a tool call.
- **Errors.** Every tool returns `{ ok, data?, error? }` with `error.kind` of `rate` (includes
  `retryAfterMs`), `upstream`, `schema` or `input`. Messages never include HenrikDev response
  bodies or player data.

Code lives in `lib/` (`lib/tools/` has one module per tool), routes in `app/`, schema in
`supabase/migrations/`.

## Develop

```bash
pnpm install --frozen-lockfile
pnpm verify   # format, typecheck, test
```

Requires Node.js 24 and pnpm 12. Copy `.env.example` to `.env.local` for local runs.

## License

[MIT](LICENSE)
