# valorant-mcp

An always-available, private MCP server that gives its owner’s LLM client factual VALORANT account and match data through HenrikDev’s API.

## Quick start

The project targets Node.js 24.x and pnpm 10.x. M0 policy research is resolved (see ARCHITECTURE.md's Decisions log); M1 implementation is starting, but no server code exists yet.

```sh
# No executable setup or run command yet.
```

## Verify

```sh
sh scripts/check-agent-docs.sh
```

## Normal use

The first product milestone will let an OAuth-authenticated owner ask an MCP client for an approved VALORANT profile, recent competitive matches, and one selected match’s compact factual detail. See [BACKLOG.md](BACKLOG.md) for M1's current scope.

## Project documents

- [ARCHITECTURE.md](ARCHITECTURE.md): boundaries, data flow, and public contracts.
- [CONTRIBUTING.md](CONTRIBUTING.md): development and release workflow.
- [BACKLOG.md](BACKLOG.md): bounded near-term work.
- [ROADMAP.md](ROADMAP.md): optional longer-term direction.

## License

[MIT](LICENSE)
