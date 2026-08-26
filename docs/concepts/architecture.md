# Architecture

Docuflow v2.0 is a 4-package npm monorepo. Only `@doquflow/cli` is needed for most users — it transitively installs everything.

## Package structure

```
@doquflow/cli (meta CLI)
    ├── @doquflow/core      ← 4 core MCP tools, minimal surface
    └── @doquflow/studio    ← 11 advanced tools + Web UI + REST API
            └── @doquflow/core (peer)

@doquflow/server            ← back-compat alias → re-exports studio
```

### `@doquflow/core`

The irreducible kernel. 4 MCP tools, the extractor engine, filesystem helpers, and 49 unit tests.

**Tools:** `query_wiki`, `ingest_source`, `wiki_search`, `read_module`

Use this package if you want minimal footprint in a server environment without the Web UI.

### `@doquflow/studio`

11 advanced MCP tools + React Web UI + Express REST API. Registers all 15 tools (4 from core + 11 own) via the `docuflow-studio` binary.

**Additional tools:** `list_modules`, `write_spec`, `read_specs`, `update_index`, `list_wiki`, `answer_synthesis`, `save_answer_as_page`, `lint_wiki`, `get_schema_guidance`, `preview_generation`, `generate_dependency_graph`

### `@doquflow/server`

A 7-line shim that re-exports `@doquflow/studio`. Exists so existing `.mcp.json` registrations keep working without modification.

### `@doquflow/cli`

The CLI meta-package. Provides the `docuflow` binary and depends on both `@doquflow/core` and `@doquflow/studio`.

## `.docuflow/` directory

All wiki data lives in the `.docuflow/` directory within each project:

```
.docuflow/
├── sources/        Raw input documents (immutable — LLM reads, never writes)
│   └── design.md
├── wiki/           LLM-generated markdown pages
│   ├── entities/   Named things (services, APIs, databases, classes)
│   ├── concepts/   Design patterns, integrations, workflows
│   ├── timelines/  Chronological pages
│   └── syntheses/  Cross-cutting synthesis pages
├── specs/          Agent-written persistent specs (via write_spec)
├── schema.md       Domain configuration (edit to customise)
├── index.md        Auto-maintained searchable catalog
└── log.md          Append-only operation audit trail
```

!!! info ".docuflow/ is gitignored by default"
    `docuflow init` adds `.docuflow/` to `.gitignore`. The wiki is project-local and grows over time — it's not intended for version control. Add it if your team wants shared wiki history.

## Web server (port 48821)

`docuflow ui` starts a single Express server that serves both the API and the React SPA:

```
http://localhost:48821/api/*   → Express route handlers (15 tool endpoints)
http://localhost:48821/*       → React SPA (built into the package, no build step)
```

Port override: set `DOCUFLOW_PORT` environment variable.

## MCP registration

`docuflow init` registers the MCP server in:

| Agent | Registration file |
|-------|-----------------|
| Claude Desktop | `~/Library/Application Support/Claude/claude_desktop_config.json` |
| VS Code Copilot | `.mcp.json` in project root |
| Cursor | `.cursor/mcp.json` |

The registered binary is `docuflow-studio` (from `@doquflow/studio`), which exposes all 15 tools over stdio transport.

## Extractor engine

The universal extractor (`packages/core/src/extractor.ts`) uses regex-based rules to extract structured information from source files. Supports:

- TypeScript, JavaScript, JSX/TSX
- Python
- Go
- Ruby / Rails
- Rust
- Java, Kotlin
- C#
- PHP
- Swift
- Angular, Vue
- HTML
- SQL
- Shell, PowerShell
- YAML, JSON
