# Project instructions

See `README.md` for purpose and architecture.

## Commands

- Setup: Node.js 24 and pnpm 12; `pnpm install --frozen-lockfile`
- Check: `pnpm verify` (format, typecheck, test); `pnpm build` before deploying

## Rules

- HenrikDev is the only data provider. Use its current official documentation.
- Never look up, cache or target a player without a `consented_profiles` row. Don't add public
  lookup, prefetching, scraping or population-level analytics.
- Keep tool responses factual and compact. Label approximations (`approximate: true`).
- Connector keys, API keys, player identities and match data are sensitive: never log or commit
  them, and never put HenrikDev response bodies or player data in error messages.
- Strict TypeScript: no `any` or unchecked casts; validate external data with zod at boundaries.
- Schema changes go in a new file under `supabase/migrations/`.
