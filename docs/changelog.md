# Changelog

All notable changes to Docuflow are documented here. Format: [Keep a Changelog](https://keepachangelog.com/).

---

## [Unreleased]

### Added
- **`context` tool: semantic and hybrid search modes** — the `context` tool now supports a `mode` parameter (`lexical`, `semantic`, `hybrid`). Semantic search uses local vector embeddings via `@xenova/transformers` (all-MiniLM-L6-v2) and `sqlite-vec` for cosine similarity retrieval. Hybrid mode combines FTS5 keyword results with vector results. Default remains `lexical` (backward-compatible). No cloud API key required — fully local-first.

### Changed
- `docuflow init` now runs `docuflow suggest` at the end — new users see domain-aware next steps immediately after setup

### Fixed
- **`context` hybrid fallback** — hybrid mode returns lexical results with a `warning` field when embeddings are unavailable, instead of discarding already-computed FTS5 results.
- **`context` old-database compatibility** — querying a v2.1.0 FTS5-only database with `semantic` or `hybrid` mode no longer crashes; falls back gracefully.
- **`context` MCP schema** — the `mode` parameter is now exposed in the MCP `inputSchema` so clients can discover and use it.

---

## [2.0.0] — 2026-05-20

**Package split.** `@doquflow/server` becomes a thin back-compat alias; the value pipe lives in two new packages: `@doquflow/core` (4 MCP tools, minimal) and `@doquflow/studio` (11 advanced tools + UI + REST API). `@doquflow/cli` is now a meta-package depending on both.

**Zero breakage for existing users.** `npm i -g @doquflow/cli` still gives the full surface. Every existing `.mcp.json` registration of `@doquflow/server` continues to work.

### Added
- `@doquflow/core` package — irreducible MCP server with 4 core tools (`query_wiki`, `ingest_source`, `wiki_search`, `read_module`), the extractor, types, filesystem helpers, and 49 unit tests
- `@doquflow/studio` package — 11 advanced MCP tools, React web UI, Express REST API; ships `docuflow-studio` binary registering all 15 tools
- `docuflow doctor` diagnostic command — installed packages, MCP registrations, workflow detection, recommendations, wiki health; supports `--json` and `--quiet`
- `release/v2.0.0.md` — full milestone narrative

### Changed
- `@doquflow/server` is now a 7-line shim re-exporting `@doquflow/studio` — package size dropped from ~188 KB → < 5 KB
- `@doquflow/cli` drops `@doquflow/server` dependency, depends directly on `@doquflow/core` + `@doquflow/studio`
- `packages/api` and `packages/ui` removed — content moved into `packages/studio/`
- Root build script topologically ordered: `core → studio → server → cli`
- `MIGRATION.md` extended with v2.0 package layout, install matrix, decision tree, deprecation timeline

---

## [1.7.0] — 2026-05-20

**Soft deprecation / core-vs-advanced surface split.** Zero command removal.

### Added
- `docuflow query "<question>"` core CLI command — wraps `query_wiki`; supports `--max-sources`, `--json`, `--no-cite`, `--save-as`, `--quiet`
- `docuflow ingest <file>` core CLI command — wraps `ingest_source`; supports `--all`, `--dry-run`, `--quiet`
- `MIGRATION.md` — philosophy-reset narrative and command mapping table

### Changed
- CLI help core/advanced split — `docuflow --help` shows 5 core commands; `docuflow advanced --help` shows 9 advanced commands; every old path still works

---

## [1.6.0] — 2026-05-20

**Philosophy Reset.** Returning to core: *intent in, value out, nothing in between.*

### Added
- `docuflow rewiki` migration command — re-ingests all sources with current extractor rules, backs up wiki, produces audit report
- 5-rule entity extractor (stop-list, no emoji/punct-only slugs, structural anchor, min token signal, context requirement)
- `.docuflow/schema.md` philosophy-reset schema — canonical wiki structure for the Code & Architecture domain

### Fixed
- `synthesiss/` typo bug — centralised `categoryDir()` helper replaces ad-hoc pluralisation
- npm chart commit noise — weekly cron instead of 6h, `stats:` commit prefix, SVG relocated to `docs/stats/`

---

## [1.5.2] — 2026-05-13

Internal maintenance release.

---

## [1.3.1] — 2026-05-09

### Fixed
- **Web UI navigation** — Removed duplicate nav items (Health/Sync appearing twice)
- **Web UI CSS tokens** — Added missing `--df-text-5` and `--df-bg-hover` variables
- **Web UI active state** — Added `.df-action`, `.df-action--active` and related CSS classes
- **Web UI Onboard icon** — Added `onboard` key to `ICON_MAP`

---

[Full changelog →](https://github.com/shaifulshabuj/docuflow-mcp/blob/main/CHANGELOG.md)
