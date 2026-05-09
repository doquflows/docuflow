# Changelog

## [Unreleased]

## [1.3.0] - 2026-05-09

### Added
- **`docuflow review`** — Review current git changes with deterministic findings and optional Copilot analysis
  - Analyzes staged, working tree, or commit range changes
  - Detects: hardcoded secrets, SQL destructive ops, debug statements, TODO markers, type weakening
  - `--ai` augments review with Copilot analysis when available
  - `--fail-on-critical` exits with code 1 when critical findings exist
  - Scopes: `--staged` (staged only), `--since-commit <ref>` (commit range), default (all changes)

### Fixed
- DevLoop reviewer agent contract now enforces canonical first-line verdict format (`Verdict: APPROVED / NEEDS_WORK / REJECTED`)

## [1.2.1] - 2026-05-07

### Added
- (Add your changes here)

### Changed
- (Add your changes here)

### Fixed
- (Add your changes here)


## [1.2.0] - 2026-05-07

### Added
- (Add your changes here)

### Changed
- (Add your changes here)

### Fixed
- (Add your changes here)


## [1.1.2] - 2026-05-07

### Added
- (Add your changes here)

### Changed
- (Add your changes here)

### Fixed
- (Add your changes here)


## [1.1.1] - 2026-05-07

### Added
- (Add your changes here)

### Changed
- (Add your changes here)

### Fixed
- (Add your changes here)


## [1.1.0] - 2026-05-07

### Added
- **`docuflow ui`** — New CLI command: starts an all-in-one Express server (port 48821) with React web interface + HTTP API
  - Auto-discovers DocuFlow projects in common dev directories
  - Opens browser automatically; `--no-open` and `--port` flags supported
- **`docuflow start`** — Alias for `docuflow ui`
- **Web UI bundled in npm package** — `ui-dist/` shipped inside `@doquflow/cli`; no separate install needed

### Changed
- Root build order updated: `server → ui → cli → api`

### Fixed
- `.gitignore` now correctly tracks `.claude/commands/` skill files


## [1.0.0] - 2026-05-07

### Added
- Web UI package (`packages/ui/`): Vite + React 18 interface with 6 views (Ask, Wiki, Graph, Health, Sync, Onboard)
- API bridge package (`packages/api/`): Express HTTP bridge for local development


## [Unreleased] — v0.6.0

### Added
- **Web UI** — Vite + React 18 interface for DocuFlow
  - 6 views: Ask (AI-powered Q&A with citations), Wiki (live page browser), Graph (dependency visualiser), Health (quality dashboard), Sync (activity monitor), Onboard (new project setup)
  - All views wired to live API data; graceful demo fallback when API offline
  - Project picker when multiple DocuFlow projects are detected
- **HTTP API bridge** (`packages/api`) — Express server on port 48821
  - Endpoints: `/api/projects`, `/api/wiki`, `/api/wiki/:pageId`, `/api/health`, `/api/activity`, `/api/ask`, `/api/search`
  - Auto-discovers DocuFlow projects in `~/dev`, `~/code`, `~/projects`, `~/work`, `~/src`, `~/Desktop`
  - Imports MCP tool functions directly — no subprocess overhead
- **Quick start scripts**: `npm run start-api` + `npm run start-web` to launch the full UI stack
- **`docuflow review`** — New git-change review command with deterministic findings and actionable improvements
  - Supports `--staged` and `--since-commit <ref>` scope selection
  - `--ai` appends non-fatal Copilot review output when available
  - `--fail-on-critical` exits with code 1 only when critical findings exist


## [0.5.6] - 2026-05-07

### Changed
- Added `docuflow design/` to `.gitignore` — keeps AI design scratch files out of version control


## [0.5.5] - 2026-05-07

### Changed
- Removed `.github/workflows/docuflow-sync.yml` — GitHub Actions wiki sync retired; local `docuflow sync --ai` + post-commit hook is the canonical workflow


## [0.5.4] - 2026-05-01

### Changed
- Documentation update: expanded README and setup guide for the v0.5.3 local-sync feature


## [0.5.3] - 2026-05-01

### Added
- **`docuflow sync --ai`** — One-shot wiki sync (AI-powered locally)
  - Auto-detects best AI bridge (Copilot → Claude Code → Codex)
  - `--copilot`, `--claude`, `--codex` flags to force bridge
  - `--since-commit REF` for incremental sync
  - `--fail-on-score N` to fail if health < threshold
  - `--quiet` mode for scripting/CI integration
- **Local-first development** — Git post-commit hook auto-syncs on every commit
  - No GitHub Actions workflow overhead
  - No API key management needed
  - Instant local feedback on wiki health
- **Comprehensive setup guide** — `LOCAL_SYNC_SETUP.md` with workflows and troubleshooting

### Changed
- **CLI now prioritizes local AI bridges** for faster, more reliable sync
  - Copilot CLI (MCP direct calling) preferred
  - Claude Code and Codex supported
  - ANTHROPIC_API_KEY fallback for API-based sync

### Fixed
- Watch daemon graceful recovery on AI bridge timeouts
- Proper handling of no-code-changes commits


## [0.5.2] - 2026-05-01

### Added
- Enhanced secrets detection in pre-release check — scans git history for leaked API keys and npm tokens


## [0.5.1] - 2026-05-01

### Added
- `allowDangerousPermissions` flag for Claude CLI bridge — enables non-interactive MCP tool calling in Claude Code sessions


## [0.5.0] - 2026-05-01

### Added

**`docuflow watch` — Auto-sync daemon**
- Background daemon that watches for changes and syncs the wiki automatically
- Source file watcher: drop a `.md` into `.docuflow/sources/` and it's ingested in <1 second
- Code file watcher: detects changes to `.ts`, `.py`, `.go`, `.rb`, `.java`, `.cs` etc. and triggers AI-powered documentation
- Scheduled lint: runs `lint_wiki` every N hours (default: 24h) and reports health score
- `--lint-interval N`, `--code-ext ts,py` flags
- `--ai` flag enables the AI bridge (auto-detects best available)
- `--copilot`, `--claude`, `--codex` flags to force a specific AI bridge

**`docuflow watch stop/status/restart` — Daemon lifecycle**
- `watch stop` — gracefully stop the running daemon (SIGTERM → 5s wait → SIGKILL if needed)
- `watch status` — see if daemon is running: shows `● running`, PID, uptime, bridge, started time
- `watch restart` — stop + restart with identical options automatically
- Auto-cleans stale PID files if the process died unexpectedly

**`docuflow sync` — One-shot sync for CI/CD and git hooks**
- Re-ingest all sources, rebuild index, run health check — in one command
- `--source <file>` — sync a single file
- `--no-lint` — skip health check (faster)
- `--fail-on-score N` — exit 1 if health score < N (CI quality gate, default: 70)
- `--quiet` — suppress output for clean CI logs
- `--since-commit <REF>` — only process code that changed since a git ref
- `--ai` — AI-powered sync: detects changed code and auto-documents it

**AI bridge — 4 supported AI engines**

| Priority | Bridge | How it syncs |
|----------|--------|--------------|
| 1 | `@github/copilot` CLI | **Directly calls DocuFlow MCP tools** (ingest, index, lint) ⚡ |
| 2 | `claude` CLI (Claude Code) | **Directly calls DocuFlow MCP tools** ⚡ |
| 3 | `codex` CLI (OpenAI Codex) | Generates doc text → saves to sources/ → ingests |
| 4 | `ANTHROPIC_API_KEY` | Same as codex via direct HTTPS API |

**Git hook auto-installation**
- `docuflow init` now installs `.git/hooks/post-commit` automatically
- After every `git commit`, the wiki syncs in the background (never delays your git workflow)
- Uses the best available AI bridge automatically

### Fixed

- Double-fire on macOS `fs.watch` — debounce prevents duplicate ingestion
- `setInterval` 32-bit overflow for large lint intervals
- Claude CLI bridge now passes `--dangerously-skip-permissions` for non-interactive MCP tool use


## [0.4.4] - 2026-04-23

### Added
- `docuflow init` now registers DocuFlow in **OpenAI Codex CLI** (`~/.codex/config.toml`)
- `docuflow init` now generates **AGENTS.md** at the project root (Codex equivalent of CLAUDE.md)


## [0.4.3] - 2026-04-23

### Added
- `docuflow init` now registers DocuFlow in **GitHub Copilot CLI** (`~/.copilot/mcp-config.json`)
- `docuflow init` now writes **`.vscode/mcp.json`** for whole-team Copilot setup without individual `init` runs
- `docuflow init` now registers in **VS Code user MCP config** (`~/Library/Application Support/Code/User/mcp.json`)


## [0.4.2] - 2026-04-23

### Added
- `docuflow --version` / `-v` flag to print the installed version
- Improved bare `docuflow` help output with version header and structured sections


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
- **Dynamic preview_generation** — Previews now read actual wiki page count and source file size before producing estimates.

### Fixed

- **lint_wiki path bug** — All health check functions were looking for pages at `wiki/pageId.md` (flat) instead of `wiki/entities/pageId.md` (subdirectory). Result: every lint check silently returned 0 issues. Now correctly resolves full file paths.
- **Category pluralization bug** — `"entities".replace("s","")` → `"entitie"` (not `"entity"`). Fixed in `list_wiki`, `wiki_search`, `update_index`, and `save_answer_as_page` using a lookup map.
- **save_answer_as_page links** — Related Pages linked to `../CATEGORY/pageId.md` with the literal string `"CATEGORY"`. Now resolves the actual directory name.
- **list_wiki filter bug** — Filtering by category `entity` was building path `wiki/entitys/`. Fixed with `SINGULAR_TO_PLURAL` map.

### Changed

- Tool count: 14 → 15
- CLI commands: 2 → 3 (`suggest` added)


## [0.2.0] - 2026-04-16

### Added

**LLM Wiki Pattern** — persistent, incrementally-maintained knowledge bases
- 12 MCP tools: `ingest_source`, `update_index`, `list_wiki`, `wiki_search`, `query_wiki`, `answer_synthesis`, `save_answer_as_page`, `lint_wiki`, `get_schema_guidance`, `preview_generation`
- Domain-specific wiki schemas (Code / Research / Business / Personal)
- `docuflow init --interactive` — guided domain-aware setup

### Fixed

- All 7 pre-LLM-wiki testing concerns resolved (auto-discovery, transparency, onboarding, troubleshooting, decision guidance)


## [0.1.0] - 2026-04-09

### First public release

- `read_module`, `list_modules`, `write_spec`, `read_specs` — 4 core MCP tools
- `docuflow init`, `docuflow status` — 2 CLI commands
- Universal regex extraction engine (TypeScript, JavaScript, Python, Go, Rust, Java, C#, PHP, Ruby, Kotlin, Swift, and more)
- `npx @doquflow/cli init` — registers Docuflow in Claude Desktop, VS Code Copilot, Copilot CLI


---

All notable changes to Docuflow are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com).
Versioning follows [Semantic Versioning](https://semver.org).
