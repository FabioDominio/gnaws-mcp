# @gnaws/mcp

> *Let your AI agent see what's beneath your cloud.*

[![npm](https://img.shields.io/npm/v/@gnaws/mcp)](https://www.npmjs.com/package/@gnaws/mcp)
[![license](https://img.shields.io/badge/license-AGPL--3.0-blue)](LICENSE)
[![node](https://img.shields.io/node/v/@gnaws/mcp)](package.json)

MCP (Model Context Protocol) server for [@gnaws/core](https://www.npmjs.com/package/@gnaws/core) — expose AWS resource scanning, graph building, and unused resource detection as tools for AI agents.

## What is this?

An MCP server that gives AI agents (Claude, Kiro, Cursor, etc.) the ability to:

- **Scan** your AWS account and build a resource relationship graph
- **Load** previously dumped data for offline analysis
- **Detect** unused/orphaned resources (detached volumes, unassociated IPs, empty load balancers, etc.)
- **Export** the graph to GEXF (Gephi), JSON (sigma.js), or Markdown
- **Dump** raw resource data for later use

## Installation

```bash
npm install -g @gnaws/mcp
# or run without installing:
npx @gnaws/mcp
```

Requires Node.js >= 24.

## MCP Client Configuration

### Kiro

Add to `.kiro/settings/mcp.json`:

```json
{
  "mcpServers": {
    "gnaws": {
      "command": "npx",
      "args": ["@gnaws/mcp"]
    }
  }
}
```

### Claude Desktop

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "gnaws": {
      "command": "npx",
      "args": ["@gnaws/mcp"]
    }
  }
}
```

### VS Code (GitHub Copilot)

Add to `.vscode/mcp.json`:

```json
{
  "servers": {
    "gnaws": {
      "command": "npx",
      "args": ["@gnaws/mcp"]
    }
  }
}
```

### Cursor

Add to `.cursor/mcp.json` (project) or `~/.cursor/mcp.json` (global):

```json
{
  "mcpServers": {
    "gnaws": {
      "command": "npx",
      "args": ["@gnaws/mcp"]
    }
  }
}
```

## Available Tools

| Tool | Description | Requires |
|------|-------------|----------|
| `status` | Check server state (loaded? how many nodes/edges?) | — |
| `scan` | Scan AWS resources live with a profile | AWS credentials |
| `load` | Load from a dump directory (offline) | Dump path |
| `detect` | Find unused/orphaned resources | `scan` or `load` |
| `export` | Export graph to gexf/json/md | `scan` or `load` |
| `dump` | Save raw data for offline use | `scan` or `load` |
| `regions` | List enabled AWS regions | `scan` or `load` |

## Example Conversations

> **User:** Show me the unused resources in my AWS account  
> **Agent:** calls `scan` with profile → calls `detect` → presents findings

> **User:** Load the dump from ./data and export a graph  
> **Agent:** calls `load` with path → calls `export` with format "gexf"

> **User:** What's the state of the gnaws server?  
> **Agent:** calls `status` → reports no data loaded, suggests `scan` or `load`

## Features

- **Progress notifications** — long-running scans report progress to the agent
- **Error handling** — every tool returns structured errors with actionable guidance
- **Workflow guidance** — tool responses tell the agent what to call next
- **Offline mode** — load from dumps without AWS credentials
- **65+ AWS services** — EC2, Lambda, S3, RDS, ECS, EKS, DynamoDB, and many more

## Log Level

All logging goes to stderr (safe for MCP stdio transport). Control verbosity with:

```bash
LOG_LEVEL=debug npx @gnaws/mcp
```

Available levels: `debug`, `info`, `warn`, `error`, `silent` (default: `info`).

## Development

```bash
# Build
npm run build

# Dev mode (tsx with hot reload)
npm run dev

# Type-check
npm run typecheck

# Lint
npm run lint

# Test with MCP Inspector
npx @modelcontextprotocol/inspector npx @gnaws/mcp
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## Support

If GNAWS saves you money on your AWS bill, consider sponsoring the project.

[![Sponsor on GitHub](https://img.shields.io/badge/sponsor-GitHub-pink?logo=github)](https://github.com/sponsors/FabioDominio)
[![Sponsor on PayPal](https://img.shields.io/badge/sponsor-PayPal-blue?logo=paypal)](https://paypal.me/drdominiof)

## License

AGPL-3.0 — see [LICENSE](LICENSE).

---

*Not affiliated with or endorsed by Amazon Web Services.*
