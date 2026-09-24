# Docuflow Feature Reference

Complete feature inventory for **Docuflow v1.3.0** — an MCP server with a live web interface that gives AI agents structured access to codebases and persistent LLM Wiki knowledge bases.

---

## Web UI (v1.3.0)

A Vite + React 18 interface for DocuFlow. Launch with `npm run start-api` + `npm run start-web`, then open `http://localhost:5173`.

| View | What it shows |
|------|--------------|
| **Ask** | AI-powered Q&A with wiki citations — type a question, watch DocuFlow search and synthesise an answer with source links |
| **Wiki** | Live page browser with category tree (Entities / Concepts / Syntheses / Timelines); click any page to read its real markdown content |
| **Graph** | Dependency visualiser — all wiki pages rendered as an interactive node graph with colour-coded node kinds |
| **Health** | Wiki quality dashboard — real-time health score (0–100), stale and orphan page counts, open issues with fix buttons |
| **Sync** | Daemon activity monitor — status (Listening/Paused), AI bridge detected, last run time, recent log timeline |
| **Onboard** | New project setup wizard — choose domain, name your project, get a ready-to-run init command |

**Key features**
- Auto-discovers all DocuFlow projects in `~/dev`, `~/code`, `~/projects`, `~/work`, `~/src`, `~/Desktop`
- Project picker in TopBar when multiple projects are found
- Live data for all views; graceful demo fallback when API server is offline
- TopBar status dot: green (API live) / grey (demo mode)
- `packages/ui/docuflow-playwright-test.mjs` — Playwright walkthrough script for recording UI walkthroughs

---

## HTTP API Bridge (v1.3.0)

Express server on port 48821. Imports MCP tool functions directly from `packages/server/src/tools/` — no subprocess overhead, sub-millisecond call latency.

| Endpoint | Description |
|----------|-------------|
| `GET /api/ping` | Health check — returns `{ ok: true }` |
| `GET /api/projects` | Scan `~/dev`, `~/code`, etc. — return all discovered DocuFlow projects with stats |
| `GET /api/project?path=…` | Stats for one project (name, health score, page count, entities, last ingest) |
| `GET /api/wiki?path=…` | List all wiki pages grouped by category with stale flag |
| `GET /api/wiki/:pageId?path=…` | Read one wiki page's full markdown content |
| `GET /api/health?path=…` | Full lint report — health score, stale pages, orphans, open issues |
| `GET /api/activity?path=…` | Recent activity parsed from `.docuflow/log.md` (last 10 operations) |
| `POST /api/ask` | Body: `{ path, question }` — runs `query_wiki`, returns synthesised answer with citations |
| `GET /api/search?path=…&q=…` | BM25 search across all wiki pages |

**Start commands**
```bash
npm run start-api    # API bridge on http://localhost:48821
npm run start-web    # Vite dev server on http://localhost:5173
```

---

## MCP Tools (15 total)

### Code Extraction

| Tool | Description |
|------|-------------|
| `read_module` | Reads a single source file and returns structured facts: language, classes, functions, dependencies, DB tables, REST endpoints, config/environment references, raw content (first 8 000 chars). Never fails on unknown file types. |
| `list_modules` | Recursively scans a directory. Returns the same structured facts per file (without raw content). Auto-skips `node_modules`, `dist`, `build`, `.git`, `vendor`, `obj`, `bin`, `.docuflow`, `*.min.js`, `*.map`, `*.lock`, and files over 300 KB. |
| `write_spec` | Writes agent-generated markdown to `.docuflow/specs/<filename>`. Updates a per-project index file. Atomic write with lock to prevent concurrent conflicts. |
| `read_specs` | Reads previously written specs. Optional `module_name` filter. Returns each spec with `stale: boolean` (true if written more than 30 days ago). |

### Wiki Pipeline

| Tool | Description |
|------|-------------|
| `ingest_source` | Reads a markdown source file from `.docuflow/sources/`, extracts named entities and concepts, creates or updates a wiki page per entity with surrounding paragraph context from the source document. |
| `update_index` | Scans all wiki pages, regenerates `.docuflow/index.md` (category-by-category listing), and appends a timestamped entry to `.docuflow/log.md`. |
| `list_wiki` | Lists wiki pages, optionally filtered by category. Returns total page count, per-category breakdown, per-page `stale: boolean` (>30 days since `updated_at`), and `stale_pages` aggregate count. |
| `wiki_search` | BM25-inspired relevance search across all wiki pages. Returns ranked results with relevance scores, category, and content snippets. Supports optional category filter and result limit. |
| `query_wiki` | Orchestrator: runs `wiki_search`, passes top results to `answer_synthesis`, returns the synthesised answer with source page citations. Main interface for question-answering. |
| `answer_synthesis` | Builds a structured markdown answer from a set of wiki pages and a question. Extracts key sentences, adds section headings, appends citations. |
| `save_answer_as_page` | Saves a synthesised answer as a new wiki page in the `syntheses` category. Accepts optional `source_page_ids` for cross-reference links. |

### Health & Guidance

| Tool | Description |
|------|-------------|
| `lint_wiki` | Full health audit of the wiki. Checks for: orphan pages (no inbound links), stale pages (>30 days old), broken internal links, metadata gaps (missing frontmatter fields), and contradictory statements between pages. Returns issues array, per-check metrics, and a 0-100 health score. |
| `get_schema_guidance` | Reads `.docuflow/schema.md` to detect domain (Code/Research/Business/Personal). Compares existing wiki pages against domain-recommended page list. Returns missing pages with reasons. |
| `preview_generation` | Shows what a tool will do before you run it. Reads actual wiki state (page count, source file size) to produce accurate predictions. Returns predicted actions, output format, impact level (none/low/medium/high), and affected files. |

### Dependency Analysis

| Tool | Description |
|------|-------------|
| `generate_dependency_graph` | Scans a project with `list_modules`, then builds a graph showing: import edges (which files import which), shared-table edges (files that touch the same DB table), and shared-endpoint edges. Returns `nodes`, `edges`, `shared_tables`, `shared_endpoints`, and `most_connected` (top 10 highest-risk files). Optional `focus` param for 1-hop neighbourhood filter. Optional `extensions` filter. |

---

## CLI Commands (8 total)

| Command | Description |
|---------|-------------|
| `docuflow init` | Creates `.docuflow/` directory structure (sources/, wiki/, specs/), writes default `schema.md`, registers the MCP server in Claude Desktop config (or prints manual instructions), and generates `CLAUDE.md` at the project root. |
| `docuflow init --interactive` / `init -i` | Guided interactive setup: prompts for domain (Code/Research/Business/Personal), project name, description. Generates domain-specific schema, planning template (`PLAN.md`), and `CLAUDE.md`. |
| `docuflow status` | Shows: Docuflow version, MCP registration status, `CLAUDE.md` present/missing, wiki page counts by category (entities/concepts/syntheses/timelines), source file count, last ingest date from `log.md`, and smart hints (e.g., suggests `docuflow suggest` if wiki is empty). |
| `docuflow suggest` | Domain-aware first-steps guidance. Reads `.docuflow/schema.md` for domain detection, counts existing wiki pages and sources. Prints 5 prioritised starting-point suggestions with reasons and ready-to-paste Claude prompt starters. |
| `docuflow watch [stop\|status\|restart]` | Background auto-sync daemon. Watches `.docuflow/sources/` for new files (ingests in <1s) and project code files (debounced AI doc generation). Lifecycle: `watch stop`, `watch status`, `watch restart`. |
| `docuflow sync [--ai] [--source file] [--no-lint] [--quiet]` | One-shot sync for CI/CD and git hooks. Re-ingests all sources, rebuilds index, runs health check. `--ai` uses the best available AI bridge (Copilot → Claude Code → Codex). |
| `docuflow review [--staged] [--since-commit REF] [--ai] [--fail-on-critical]` | Reviews current git changes and prints deterministic findings (`critical`, `warnings`, `improvements`). `--ai` appends Copilot review output; `--fail-on-critical` exits with code 1 when critical issues exist. |
| `docuflow ui` / `docuflow start` | Starts an all-in-one Express server (port 48821) with React web UI + HTTP API bridge. Auto-discovers DocuFlow projects in common dev directories. Opens browser automatically (suppress with `--no-open`). Custom port via `--port`. |

---

## Language Support (Extraction Engine)

The `extractor.ts` engine is regex-based and language-agnostic. It recognises patterns in any text file and never fails on unknown types.

| Language | Classes / Types | Functions | Dependencies | Endpoints | DB Tables | Config Refs |
|----------|-----------------|-----------|--------------|-----------|-----------|-------------|
| **TypeScript / JavaScript** | `class`, `interface` | `function`, `=>`, `async` | `import`, `require` | Express, NestJS, Angular routes | `FROM`, `JOIN`, EF DbSet | `process.env` |
| **Python** | `class` | `def`, `async def` | `import`, `from…import` | FastAPI, Flask `@app.route` | `FROM`, `execute()` | `os.environ`, `os.getenv` |
| **Go** | `type … struct`, `type … interface` | `func FuncName(`, `func (recv) Method(` | `import "pkg"` blocks | gorilla/mux, gin, chi, echo, stdlib `HandleFunc` | GORM `db.Table()` | `os.Getenv`, `os.LookupEnv` |
| **Ruby / Rails** | `class`, `module` | `def`, `def self.` | `require`, `require_relative` | `get '/path'`, `post '/path'`, `resources :name` | `has_many`, `belongs_to`, `self.table_name =` | `ENV['KEY']`, `ENV["KEY"]` |
| **C# / .NET** | `class`, `interface`, `struct`, `enum`, `record` | Method declarations | `using` | `[HttpGet]`, `[HttpPost]`, `app.MapGet()`, `MapControllerRoute` | EF `DbSet<T>`, `[Table("name")]`, `_db.EntityName` | `IConfiguration`, `appsettings`, `ConnectionStrings:` |
| **Java** | `class`, `interface`, `enum` | Method declarations | `import` | Spring `@GetMapping`, `@PostMapping`, `@RequestMapping` | JPA `@Table`, `@Entity` | `@Value`, `System.getenv` |
| **PHP** | `class`, `interface`, `trait` | `function`, `fn` | `use`, `require`, `include` | Laravel `Route::get`, `Route::post` | `FROM`, `query()`, Eloquent | `$_ENV`, `getenv()` |
| **SQL** | — | — | — | — | `CREATE TABLE`, `FROM`, `JOIN`, `INSERT INTO` | — |
| **Rust, Kotlin, Swift, Shell, PowerShell, YAML, JSON, HTML, Vue, Angular** | Partial (class/type patterns) | Partial | Partial | Partial | Partial | Partial |
| **Unknown files** | — | — | — | — | — | Returns full raw content (no failure) |

---

## Storage Layout

```
<project-root>/
├── CLAUDE.md                     ← Auto-generated by docuflow init
│                                    Contains: all 15 tool descriptions, workflows, paths
│
└── .docuflow/
    ├── schema.md                 ← Domain config (Code/Research/Business/Personal)
    ├── index.md                  ← Auto-maintained catalog of all wiki pages
    ├── log.md                    ← Append-only operation audit trail
    ├── PLAN.md                   ← Planning template (interactive init only)
    │
    ├── sources/                  ← Raw documents (immutable)
    │   └── my-doc.md
    │
    ├── wiki/                     ← LLM-maintained knowledge
    │   ├── entities/             ← Named things: services, models, people, systems
    │   ├── concepts/             ← Ideas, patterns, principles
    │   ├── timelines/            ← Events and sequences
    │   └── syntheses/            ← Saved answers + synthesised insights
    │
    └── specs/                    ← Agent-written code/architecture specs
        ├── index.json            ← Spec index (title, written_at per spec)
        └── my-spec.md
```

---

## Architecture Highlights

### Zero External Dependencies

The MCP server has **one runtime dependency**: `@modelcontextprotocol/sdk`. Everything else uses Node.js stdlib.

- No API keys
- No network calls
- No AI models inside the server (intelligence stays in the agent)
- No database — everything is markdown files

### Stateless Server

The server holds no state between calls. Every tool call receives all context it needs via parameters. This means:
- Safe to restart at any time
- Multiple projects supported simultaneously
- No memory leaks

### Stdio Transport

Runs as a subprocess over stdio. Compatible with Claude Desktop, Cursor, Copilot, and any MCP-compliant client.

### Staleness Detection

Both `list_wiki` and `read_specs` compare `updated_at` / `written_at` against the current date. Pages/specs older than 30 days are flagged with `stale: true`. This lets agents automatically identify what needs reviewing after code changes.

### Dependency Graph

`generate_dependency_graph` reuses `listModules()` internally (no code duplication) and builds three edge types:
- **import**: file A imports file B (import string is substring of file B's path)
- **shared_table**: files A and B both access the same DB table
- **shared_endpoint**: files A and B both define the same HTTP endpoint

The `most_connected` field returns the top 10 nodes by total edge count — these are the highest-risk files to modify.

---

## What Docuflow Does NOT Do

- ❌ No AI calls inside the MCP server (agents provide the intelligence)
- ❌ No SVN/Git history analysis
- ❌ No Word/Excel document ingestion (markdown sources only)
- ❌ No real-time collaboration (single-user filesystem tool)
