# @doquflow/server

MCP server that lets AI agents read any codebase and build a persistent, incrementally-maintained knowledge base using the **LLM Wiki pattern**. 15 tools. Zero AI inside — the agent does all the thinking.

```
AI Agent (Claude, Copilot, Cursor)
       │ calls MCP tools
@doquflow/server          ← reads files, builds wiki, answers questions
       │ filesystem only
Any project on disk       ← any language, any structure
```

## Install

```bash
npx @doquflow/cli init
```

The CLI registers this server automatically. You do not need to install `@doquflow/server` directly.

## Tools (15 total)

### Code Extraction

| Tool | Input | Output |
|------|-------|--------|
| `read_module` | `{ path }` | Language, classes, functions, dependencies, DB tables, endpoints, config refs, raw content |
| `list_modules` | `{ path, extensions? }` | All modules in a directory tree (bulk extraction, no raw content) |
| `write_spec` | `{ project_path, filename, content }` | Writes markdown spec to `.docuflow/specs/` |
| `read_specs` | `{ project_path, module_name? }` | Reads existing specs; includes `stale: boolean` per spec |

### Wiki Pipeline

| Tool | What it does |
|------|-------------|
| `ingest_source` | Parse source doc → extract entities/concepts → create wiki pages with context |
| `update_index` | Regenerate `index.md` and append to `log.md` |
| `list_wiki` | List wiki pages by category; includes `stale: boolean` per page and `stale_pages` count |
| `wiki_search` | BM25-inspired relevance search across all wiki pages |
| `query_wiki` | Main interface: search + synthesize answer from wiki |
| `answer_synthesis` | Build structured markdown answer from selected pages |
| `save_answer_as_page` | Save synthesised answer back to wiki |

### Health & Guidance

| Tool | What it does |
|------|-------------|
| `lint_wiki` | Health checks: orphan pages, stale content, broken links, metadata gaps, contradictions. Returns 0-100 health score. |
| `get_schema_guidance` | Detect domain → recommend missing wiki pages |
| `preview_generation` | Show what a tool will do before running (reads real wiki state) |

### Dependency Analysis

| Tool | What it does |
|------|-------------|
| `generate_dependency_graph` | Build import/shared-table/shared-endpoint graph. Returns `nodes`, `edges`, `most_connected` top 10 (highest-risk files). |

## Languages supported

TypeScript, JavaScript, Python, Go (structs, funcs, gin/gorilla routes, GORM), Ruby/Rails (classes, ActiveRecord, Rails routes), Rust, Java, C#, PHP, Kotlin, Swift, SQL, Shell, YAML, JSON, and more.

Unknown file types return full raw content — never fails on unfamiliar files.

## Extraction engine

| Field | Detected from |
|-------|--------------|
| `classes` | `class`, `interface`, `struct`, `enum`, `record`, Go `type … struct/interface`, Ruby `module` |
| `functions` | Keyword-prefixed declarations, arrow functions, Go `func`, Ruby `def` |
| `dependencies` | `import`, `require()`, Go import blocks, Ruby require |
| `db_tables` | SQL `FROM/JOIN/INTO`, EF `DbSet<T>`, GORM `db.Table()`, ActiveRecord associations |
| `endpoints` | .NET attributes, Express/NestJS, gin/gorilla/chi routes, Rails route helpers |
| `config_refs` | `process.env`, `os.Getenv`, `ENV['KEY']`, `IConfiguration`, `appsettings` |

## Requirements

- Node.js 18+
- No API keys, no network calls, no AI dependencies

## License

MIT — [github.com/doquflows/docuflow](https://github.com/doquflows/docuflow)
