# valorant-mcp

An always-available, private MCP server that gives its owner’s LLM client factual VALORANT account and match data through HenrikDev’s API.

- OAuth 2.1-authenticated, multi-user MCP server (Streamable HTTP)
- Invite-based consent model — no player is ever looked up without explicit consent
- Per-user-scoped Postgres cache, fail-open by design
- Strict TypeScript, zod-validated boundaries, 100+ tests

## Quick start

The project targets Node.js 24.x and pnpm 10.x. See [ARCHITECTURE.md](ARCHITECTURE.md) for its current design.

```sh
pnpm install
pnpm dev
```

## Verify

```sh
sh scripts/check-agent-docs.sh
```

## Normal use

Any OAuth-authenticated, consented user can request VALORANT data through the MCP endpoint. Most tools can target a consented friend's profile; see [ARCHITECTURE.md](ARCHITECTURE.md) for scope and tool details.

## Onboarding a new user

Access is invite-only. To invite someone, call the admin endpoint with their Riot ID (name#tag):

```sh
curl -X POST https://valorant-mcp.vercel.app/api/admin/invite \
  -H "Authorization: Bearer <ADMIN_API_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"name": "friend", "tag": "1234"}'
```

This resolves the Riot ID via HenrikDev, adds them to `consented_profiles`, and mints a one-time invite code. Send the returned `claim_url` to the invitee. They sign in via Supabase email OTP or magic link, and their email becomes their `mcp_users` row. Their MCP client endpoint is `https://valorant-mcp.vercel.app/api/mcp`. Keep `ADMIN_API_KEY` in Vercel's Preview/Production env vars or the owner's local `.env`; never commit or share it.

### Email OTP setup

The login page supports entering a one-time code in the same browser that started OAuth. In the Supabase dashboard, change the **Magic Link** email template to use `{{ .Token }}` instead of `{{ .ConfirmationURL }}`; Supabase sends a link when the template contains `{{ .ConfirmationURL }}`. The existing callback still supports magic links opened in the browser that initiated sign-in; entering the code avoids cross-browser PKCE failures.

## License

[MIT](LICENSE)
