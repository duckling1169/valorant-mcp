# Project instructions

## Commands

- Setup: `Node.js 24.x and pnpm 10.x are required; implementation has not started`
- Fast check: `sh scripts/check-agent-docs.sh`
- Full check: `sh scripts/check-agent-docs.sh`
- Build: `N/A — implementation has not started`

## Non-inferable rules

- HenrikDev is the sole VALORANT data provider. Use its current official documentation/OpenAPI; legacy repository documentation is comparison material only.
- Use TypeScript on Node.js 24.x with pnpm; do not rely on the locally installed Node.js 25 runtime for deployment compatibility.
- TypeScript runs in strict mode. Do not use `any`, `as unknown as`, or unchecked assertion casts; validate untrusted API and request data at boundaries instead.
- Do not implement, expose, or cache player-data flows whose consent scope or deployment approval is unresolved (M0 resolved for the operator's own data and matches, see ARCHITECTURE.md Decisions 2026-07-28; M3 multi-user access is its own unresolved gate).
- Keep MCP responses factual and token-efficient. Never add public lookup, prefetching, scraping, population-level analytics, or cross-player profile drill-down without explicit approved scope.
- Treat API keys, OAuth credentials, player identities, and match data as sensitive. Never commit or expose them.

## Completion requirements

- Follow the shared workflow and escalation rules in `CONTRIBUTING.md`.
- Run the relevant checks above and report anything not run.
- Report observable behavior changed, validation results, and unresolved risks.
- Update an existing durable document only when the change makes it materially false. Do not create status logs or completed-work ledgers; Git history is the record.

## Read on demand

- `README.md`: purpose, setup, and normal use.
- `ARCHITECTURE.md`: before changing boundaries, contracts, or cross-component behavior.
- `CONTRIBUTING.md`: before non-trivial implementation or integration work; canonical shared contribution workflow.
- `BACKLOG.md`: when planning or resuming work, not for every task.
- `ROADMAP.md`: only when a task depends on longer-term direction.
