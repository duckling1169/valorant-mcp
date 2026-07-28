# valorant-mcp

An always-available, private MCP server that gives its owner’s LLM client factual VALORANT account and match data through HenrikDev’s API.

## Quick start

The project targets Node.js 24.x and pnpm 10.x. M1 (securely hosted personal MCP) is complete and deployed; see [BACKLOG.md](BACKLOG.md) for the active milestone.

```sh
pnpm install
pnpm dev
```

## Verify

```sh
sh scripts/check-agent-docs.sh
```

## Normal use

An OAuth-authenticated owner asks an MCP client (e.g. Claude) for their VALORANT profile, recent competitive matches, or one selected match’s compact factual detail via `get_profile()`, `get_recent_matches({ limit? })`, and `get_match_detail({ match_id })`.

## Project documents

- [ARCHITECTURE.md](ARCHITECTURE.md): boundaries, data flow, and public contracts.
- [CONTRIBUTING.md](CONTRIBUTING.md): development and release workflow.
- [BACKLOG.md](BACKLOG.md): bounded near-term work.
- [ROADMAP.md](ROADMAP.md): optional longer-term direction.

## License

[MIT](LICENSE)
