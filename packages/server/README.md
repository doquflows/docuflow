# @doquflow/server

MCP server that lets AI agents read any codebase and write persistent specs. Zero AI inside — the agent does all the thinking.

```
AI Agent (Claude Code)
       │ calls MCP tools
@doquflow/server          ← reads files, extracts, writes markdown
       │ filesystem only
Any project on disk       ← any language, any structure
```

## Install

```bash
npx @doquflow/cli init
```

The CLI registers this server automatically in your Claude Desktop config. You do not need to install `@doquflow/server` directly.

## Tools

| Tool | Input | Output |
|------|-------|--------|
| `read_module` | `{ path }` | Classes, functions, deps, endpoints, tables, config refs, raw content |
| `list_modules` | `{ path, extensions? }` | All modules in a directory tree |
| `write_spec` | `{ project_path, filename, content }` | Writes a markdown spec to `.docuflow/specs/` |
| `read_specs` | `{ project_path, module_name? }` | Reads existing specs from `.docuflow/specs/` |

## Extraction engine

Universal regex patterns applied to any file:

| Field | Detected from |
|-------|--------------|
| `classes` | `class`, `interface`, `struct`, `enum`, `record` |
| `functions` | Keyword-prefixed declarations + arrow functions |
| `dependencies` | `import`, `require()`, decorators, `new ClassName()` |
| `db_tables` | SQL `FROM/JOIN/INTO`, EF `DbSet<T>`, `[Table("…")]`, `_db.TableName` |
| `endpoints` | .NET attributes, `app.MapGet()`, Express router, NestJS, Angular routes |
| `config_refs` | `IConfiguration`, `appsettings`, `ConnectionStrings:*`, `process.env.*` |

## Requirements

- Node.js 18+
- No API keys, no network calls, no AI dependencies

## License

MIT — [github.com/doquflows/docuflow](https://github.com/doquflows/docuflow)
