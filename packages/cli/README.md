# @doquflow/cli

CLI for setting up Docuflow in your project. Registers the MCP server in Claude Desktop, scaffolds `.docuflow/`, generates `CLAUDE.md`, and gives domain-aware onboarding guidance.

## Install

```bash
npm install -g @doquflow/cli
```

Or use without installing:

```bash
npx @doquflow/cli init
```

## Commands

### `docuflow init`

One command to:
- Create `.docuflow/` directory structure (sources/, wiki/, specs/, schema.md, index.md, log.md)
- Register the `@doquflow/server` MCP server in your Claude Desktop config
- Generate `CLAUDE.md` at the project root so Claude auto-discovers all 15 tools

```bash
docuflow init
```

### `docuflow init --interactive`

Interactive domain-aware setup:
- Choose your domain: Code/Architecture, Research, Business, or Personal
- Enter project name and description
- Auto-generates a domain-specific schema template
- Creates a planning template (PLAN.md)
- Generates CLAUDE.md

```bash
docuflow init --interactive
# or: docuflow init -i
```

### `docuflow status`

Shows current Docuflow state:
- Package version
- MCP server registration status
- CLAUDE.md presence
- Wiki page counts by category (entities, concepts, syntheses, timelines)
- Source file count
- Last ingest date
- Smart hints

```bash
docuflow status
```

### `docuflow suggest`

Domain-aware first-steps guidance. Reads your domain from `.docuflow/schema.md`, counts existing wiki pages and sources, then prints 5 prioritised suggestions with reasons and ready-to-paste Claude prompt starters.

```bash
docuflow suggest
```

## How it works

After running `init`, open Claude Desktop (or any MCP-compatible agent) and start working:

```
Scan src/ with list_modules and write wiki pages for each major module.
```

Claude will call Docuflow's 15 MCP tools to read files, build a wiki, and answer questions about your codebase — persisting knowledge that compounds over time.

## Requirements

- Node.js 18+
- Claude Desktop, Cursor, Copilot, or any MCP-compatible agent

## License

MIT — [github.com/doquflows/docuflow](https://github.com/doquflows/docuflow)
