# Installation

Docuflow is distributed as an npm package. The CLI meta-package (`@doquflow/cli`) installs everything you need.

## Requirements

- **Node.js** 18 or later
- An MCP-compatible AI agent: [Claude Desktop](https://claude.ai/download), [VS Code + GitHub Copilot](https://marketplace.visualstudio.com/items?itemName=GitHub.copilot), or [Cursor](https://cursor.sh)

## Install options

=== "Global install (recommended)"

    ```bash
    npm install -g @doquflow/cli
    ```

    Installs the `docuflow` command globally. Run it from any project directory.

    ```bash
    docuflow --version   # verify install
    docuflow --help      # see all commands
    ```

=== "npx (no install)"

    ```bash
    npx @doquflow/cli init
    ```

    Runs the latest version without a permanent install. Best for one-off initialisation.

=== "Project-local (CI/CD)"

    ```bash
    npm install --save-dev @doquflow/cli
    ```

    Then call via `npx docuflow` or add to your `package.json` scripts:

    ```json
    {
      "scripts": {
        "docuflow:sync": "docuflow sync --ai"
      }
    }
    ```

## Package breakdown

Docuflow v2.0 is split into focused packages:

| Package | npm | Description |
|---------|-----|-------------|
| `@doquflow/cli` | [![npm](https://img.shields.io/npm/v/@doquflow/cli?style=flat-square)](https://www.npmjs.com/package/@doquflow/cli) | CLI meta-package — install this for everything |
| `@doquflow/core` | [![npm](https://img.shields.io/npm/v/@doquflow/core?style=flat-square)](https://www.npmjs.com/package/@doquflow/core) | 4 core MCP tools: `query_wiki`, `ingest_source`, `wiki_search`, `read_module` |
| `@doquflow/studio` | [![npm](https://img.shields.io/npm/v/@doquflow/studio?style=flat-square)](https://www.npmjs.com/package/@doquflow/studio) | 11 advanced tools + Web UI + REST API |
| `@doquflow/server` | [![npm](https://img.shields.io/npm/v/@doquflow/server?style=flat-square)](https://www.npmjs.com/package/@doquflow/server) | Back-compat alias for `@doquflow/studio` (existing registrations keep working) |

!!! tip "Existing users"
    If you have `@doquflow/server` registered in `.mcp.json`, it keeps working without modification. The v2.0 server package re-exports studio transparently.

## Migrating from v1.x

See [MIGRATION.md](https://github.com/shaifulshabuj/docuflow-mcp/blob/main/MIGRATION.md) for the full upgrade guide.

**Short version:** `npm install -g @doquflow/cli` — no config changes needed.

## Verify installation

```bash
docuflow doctor
```

This runs a full diagnostic: installed package versions, MCP registration status, wiki health, and recommendations.
