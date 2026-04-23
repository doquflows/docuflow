# Changelog

## [0.4.0] - 2026-04-23

### Added

- **`generate_dependency_graph`** — 15th MCP tool. Scans a project and builds an import/shared-table/shared-endpoint graph. Returns `nodes`, `edges`, `shared_tables`, `shared_endpoints`, and `most_connected` (top 10 highest-risk files). Supports `focus` (neighbourhood filter) and `extensions` filter.
- **`docuflow suggest`** — New CLI command. Domain-aware first-steps guidance — auto-detects your domain (Code/Research/Business/Personal) from `.docuflow/schema.md`, prints 5 prioritised wiki page suggestions with reasons and ready-to-paste Claude prompts.
- **CLAUDE.md generation** — `docuflow init` and `docuflow init --interactive` now write `CLAUDE.md` at the project root. Contains all 15 tool descriptions, common workflows, and storage layout. Idempotent: safe to run multiple times.
- **Staleness detection** — `list_wiki` returns `stale: boolean` per page and `stale_pages` total count. `read_specs` returns `stale: boolean` per spec. Threshold: 30 days since last update.
- **Go extraction** — Struct/interface types, func declarations, import blocks, `os.Getenv`, gorilla/mux/gin/chi/echo HTTP routes, GORM table references.
- **Ruby/Rails extraction** — Class/module/def declarations, require, `ENV[]`, Rails route helpers (`get`, `post`, `resources`), ActiveRecord associations and explicit table names.
- **Enhanced `docuflow status`** — Now shows package version, CLAUDE.md presence, wiki page counts by category, source file count, last ingest date, and smart hints.
- **Richer ingest_source pages** — Entity and concept pages now include the surrounding paragraph from the source document instead of an empty "Introduced in" stub.
- **Dynamic preview_generation** — Previews now read actual wiki page count and source file size before producing estimates instead of using hardcoded strings.

### Fixed

- **lint_wiki path bug** — All health check functions were looking for pages at `wiki/pageId.md` (flat) instead of `wiki/entities/pageId.md` (subdirectory). Result: every lint check silently returned 0 issues. Now correctly resolves full file paths.
- **Category pluralization bug** — `"entities".replace("s","")` → `"entitie"` (not `"entity"`). Fixed in `list_wiki`, `wiki_search`, `update_index`, and `save_answer_as_page` using a lookup map.
- **save_answer_as_page links** — Related Pages linked to `../CATEGORY/pageId.md` with the literal string `"CATEGORY"`. Now resolves the actual directory name.
- **list_wiki filter bug** — Filtering by category `entity` was building path `wiki/entitys/`. Fixed with `SINGULAR_TO_PLURAL` map.
- **init-interactive.ts tip** — Misleading "open `.claude/instructions.md`" tip now correctly references `CLAUDE.md`.

### Changed

- Tool count: 14 → 15
- CLI commands: 2 → 3 (`suggest` added)


## [0.2.0] - 2026-04-16

### Added

#### LLM Wiki Pattern Implementation (Phases 1-5)
- Complete LLM Wiki architecture: persistent, incrementally-maintained knowledge bases
- 12 MCP tools for wiki management:
  - Ingest & Index: `ingest_source`, `update_index`, `list_wiki`
  - Query & Synthesis: `wiki_search`, `query_wiki`, `answer_synthesis`, `save_answer_as_page`
  - Maintenance: `lint_wiki` with health scoring, contradiction detection, orphan page detection
- Domain-specific wiki schemas (4 templates: Code, Research, Business, Personal)
- Real-world example: Docuflow's own 188-page wiki at 100% health score

#### User Experience Enhancement (Phase 6)
- **Copilot Auto-Discovery**: `.claude/instructions.md` (35 KB) teaches Claude about Docuflow
  - Claude reads at session start and auto-discovers when to use Docuflow
  - No longer requires explicit instruction to call Docuflow tools
  
- **Tool Transparency**: Two new guidance tools
  - `preview_generation` — Shows what tools will do before running (predicted actions, impact level, files affected)
  - `get_schema_guidance` — Recommends what documents should exist based on domain and wiki state
  
- **Comprehensive Documentation** (110+ KB)
  - `TROUBLESHOOTING.md` — Problem-solving guide (command not found, MCP issues, wiki quality, performance, data safety)
  - `WHEN_TO_USE.md` — Decision framework with matrix, cost-benefit analysis, domain-specific guidance
  - `COPILOT_INTEGRATION.md` — LLM agent integration reference
  - `USAGE_EXAMPLES.md` — 6 real-world workflows
  - `BEST_PRACTICES.md` — Maintenance guidelines
  - `EXAMPLE_SCHEMAS.md` — 4 domain-specific templates
  - `LLM_WIKI_PATTERN.md` — Deep dive on pattern philosophy
  
- **Interactive Initialization**
  - `docuflow init --interactive` — Domain-aware setup (Code/Research/Business/Personal)
  - Guided prompts for project info
  - Auto-generated domain-specific schema
  - Planning template with first sources and questions
  - Next steps guidance

### Changed

- Updated all 12 MCP tools to support domain-specific schemas
- Enhanced README with Phase 6 info, 14 tools, and getting started guide
- Updated monorepo documentation with new tool locations

### Fixed

**Resolved All Pre-LLM-Wiki Testing Concerns**:
1. ✅ Claude doesn't auto-discover Docuflow → `.claude/instructions.md`
2. ✅ Tool execution feels like a "black box" → `preview_generation` tool
3. ✅ No guidance on document planning → `get_schema_guidance` + decision frameworks
4. ✅ Poor onboarding → Interactive init with domain templates
5. ✅ No troubleshooting → `TROUBLESHOOTING.md` guide
6. ✅ Unclear decision-making → `WHEN_TO_USE.md` matrix
7. ✅ No transparency in tool behavior → Preview tool + clear predictions

### Quality Metrics

- ✅ **127+ tests passing** (100% pass rate across all 6 phases)
- ✅ **0 breaking changes** (100% backward compatible)
- ✅ **14 MCP tools** (4 legacy + 10 new LLM Wiki tools)
- ✅ **Build clean** (0 errors, 0 warnings)
- ✅ **Real-world validation** (Docuflow's own 188-page wiki)

### Migration & Breaking Changes

**None.** This release is fully backward compatible with 0.1.x.

All legacy tools (`read_module`, `list_modules`, `write_spec`, `read_specs`) continue to work unchanged.

### Documentation

- **New User Guide**: Start with `docs/WHEN_TO_USE.md` to decide if Docuflow is right for you
- **Getting Started**: Run `docuflow init --interactive` for domain-aware setup
- **For Claude Users**: LLM agents auto-discover Docuflow via `.claude/instructions.md`
- **Troubleshooting**: See `docs/TROUBLESHOOTING.md` for common issues and solutions
- **Examples**: See `docs/USAGE_EXAMPLES.md` for real-world workflows

---

All notable changes to Docuflow are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com)
Versioning follows [Semantic Versioning](https://semver.org)

---

## [0.1.1] — 2026-04-09

### Added
- Package README files on npmjs.com for both `@doquflow/server` and `@doquflow/cli`

---

## [0.1.0] — 2026-04-09

### First public release

#### Core MCP Tools
- `read_module` — Read one source file, extract classes, functions, dependencies,
  DB tables, endpoints, config refs, raw content (truncated 8 000 chars)
- `list_modules` — Walk a project directory, bulk-extract all non-binary files,
  return structured facts per file (no raw content for performance)
- `write_spec` — Write a markdown spec to `.docuflow/specs/<name>.md`,
  update the per-project index. Serialised per project to prevent race conditions.
- `read_specs` — Read saved specs back; optionally filter by module name

#### Language Support
TypeScript, JavaScript, Python, Go, Rust, Java, C#, PHP, Ruby, Kotlin, Swift,
Angular, Vue, HTML, SQL, Shell, PowerShell, YAML, JSON, and more.

#### Extraction Engine
Regex-based extraction for classes, interfaces, functions, dependencies,
database tables (SQL + Entity Framework), REST endpoints (.NET, Express, NestJS),
and config/environment references.

#### Developer Experience
- `npx @doquflow/cli init` — registers Docuflow MCP in Claude Desktop config
- `npx @doquflow/cli status` — shows spec count and registration state
- Zero AI calls inside the server — all intelligence stays in the agent
- No API keys, no network calls, no AI dependencies
