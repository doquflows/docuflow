# Docuflow Changelog

## [2.2.0] - 2026-06-19

### Added
- **`context` tool: semantic and hybrid search modes** — the `context` tool now supports a `mode` parameter (`lexical`, `semantic`, `hybrid`). Semantic search uses local vector embeddings via `@xenova/transformers` (all-MiniLM-L6-v2) and `sqlite-vec` for cosine similarity retrieval. Hybrid mode combines FTS5 keyword results with vector results. Default remains `lexical` (backward-compatible). No cloud API key required — fully local-first.

### Fixed
- **`context` hybrid fallback** — hybrid mode now returns lexical results with a `warning` field when the embeddings model is unavailable, instead of discarding already-computed FTS5 results.
- **`context` old-database compatibility** — querying a database created by v2.1.0 (FTS5-only, no vector tables) with `semantic` or `hybrid` mode no longer crashes. Semantic mode returns a clear error; hybrid mode falls back to lexical results with a warning.
- **`context` MCP schema** — the `mode` parameter is now exposed in the MCP `inputSchema` so clients can discover and use it.

## [2.1.0] - 2026-06-18

### Added
- **`context` Context-as-a-Service tool**: A new tool registering under `@doquflow/studio` featuring persistent local SQLite FTS5 indexing with `index` and `query` operations. Relies on the new `better-sqlite3` dependency.

## [2.0.5] - 2026-06-11

### Fixed
- **DEF-13 [HIGH]** `prefix-check.ts` only warned in one direction — when another prefix held a *newer* version. Running the newer binary (e.g. hermes 2.0.5) while an older install (e.g. nvm 2.0.2) shadowed it in PATH produced no warning, so `docuflow` silently executed the wrong binary. Fixed by adding a second warning direction: if the first `docuflow` in PATH resolves to a different, older binary, a stderr warning names the shadowing install and gives the `npm uninstall` fix command. The warning matrix is now symmetric — whichever binary the user actually runs, they see the relevant message. New helper `pathResolvedBin()` in `prefix-check.ts` (overridable via `DOCUFLOW_PATH_OVERRIDE_BIN` for tests).

### Test
- Extended `scripts/verify-packed.sh` section 5 from 2 cases to 4: 5a (direction-1 negative — no spurious warning when current is newest and PATH is clean), 5b (direction-1 positive — newer version elsewhere fires upgrade warning), 5c (direction-2 positive — older shadowing binary in PATH fires remove-shadow warning), 5d (direction-2 negative — no warning when PATH resolves to active binary). `DOCUFLOW_PATH_OVERRIDE_BIN` export added after step 3 to suppress direction-2 noise during section-4 per-project checks.

### Chore
- All four packages bumped to 2.0.5 in lockstep.

## [2.0.4] - 2026-06-11

### Fixed
- **DEF-4 regression [HIGH]** npm 7+ silently suppresses lifecycle script output, so the `postinstall-check.js` warning introduced in v2.0.3 never reached users. Moved the prefix-mismatch detection into the CLI itself: on every startup (`docuflow <any-command>`), if a newer `@doquflow/cli` exists in a different npm prefix (e.g. nvm vs hermes), a one-line warning is printed to stderr with the fix command. The check is cached for 24 h in `~/.docuflow/.prefix-check.json` so it adds no perceptible startup cost. Postinstall script kept as secondary hint. New files: `packages/cli/src/prefix-utils.ts` (cross-prefix install scanner), `packages/cli/src/prefix-check.ts` (cached startup check).
- **DEF-12 [HIGH]** `docuflow init --repair` reported ✓ OK even when the registered MCP entry had a cross-prefix mismatch (node binary from prefix A, MCP entry JS from prefix B) or was pointing at an older installed version. Repair now additionally detects: (1) node binary prefix ≠ MCP entry path prefix, (2) registered code version < newest found install. When either condition is true the entry is rewritten to the newest self-consistent installation. Also extends repair coverage to the per-project `.mcp.json` in the current working directory (previously only global configs were touched).

### Added
- `scripts/verify-packed.sh` dual-prefix detection tests (section 5): simulate an older install in a fake extra prefix and verify the startup warning fires/suppresses correctly. Uses `DOCUFLOW_CHECK_NOW=1` to bypass the TTY guard and `DOCUFLOW_EXTRA_PREFIXES` to inject the fake prefix.

### Chore
- All four packages bumped to 2.0.4 in lockstep.

## [2.0.3] - 2026-06-11

### Fixed
- **DEF-11 [CRIT]** `docuflow ui` crashed on startup with `MODULE_NOT_FOUND` for `query-wiki.js` and `wiki-search.js` — `ui.ts:loadTool` hardcoded `@doquflow/studio` with no fallback, but those tools live in `@doquflow/core`. Fixed by giving `loadTool` the same core-first fallback chain already used in `query.ts:loadServerTool` (core → relative-core → studio → relative-studio). DEF-1's 2.0.2 exports-map fix opened studio's tool paths correctly but couldn't help tools that were never in studio.
- **DEF-11 [CRIT]** `@doquflow/core` exports map now exposes `"./dist/tools/*"` so `require('@doquflow/core/dist/tools/<name>')` resolves without `ERR_PACKAGE_PATH_NOT_EXPORTED` in Node's strict exports enforcement.
- **DEF-4 follow-up** Plain `npm install -g @doquflow/cli` is beyond docuflow's control when the user's `npm config get prefix` points to a different Node installation than the one active in PATH (e.g. `.hermes` vs nvm). `docuflow update` already targets the correct prefix via `process.execPath`. Added `scripts/postinstall-check.js` (wired as `npm postinstall` lifecycle) that warns immediately after a prefix-mismatch install with a one-line fix command.

### Added
- `scripts/verify-packed.sh` — packed-install regression gate (CRITICAL VERIFICATION RULE). Builds all packages, packs them with `npm pack`, installs the tarballs into an isolated temp prefix (no monorepo symlinks), then hits `/api/ping`, `/api/ask` (query-wiki), `/api/search` (wiki-search), and `/api/wiki` (list-wiki) against waymark, teststop, and devloop. Must pass before every publish. DEF-11 escaped because the workspace build resolves `@doquflow/core` via symlink, masking the missing exports entry — this script reproduces the exact failure mode.

### Chore
- All four packages bumped to 2.0.3 in lockstep.

## [2.0.2] - 2026-06-11

### Fixed
- **DEF-1 [CRIT]** `docuflow ui` no longer crashes with `ERR_PACKAGE_PATH_NOT_EXPORTED` — added `"./dist/tools/*": "./dist/tools/*.js"` to `@doquflow/studio` exports map so the tool loader in `ui.ts` can reach individual tool modules.
- **DEF-2 [CRIT]** `docuflow init` now writes a valid MCP server path into Claude Desktop / VS Code configs — `resolveServerBin()` uses `require.resolve("@doquflow/studio/mcp")` (exports-map key) as the primary, with correct node_modules-relative fallbacks. Old fallback pointed to a pre-package-split path that no longer exists.
- **DEF-3 [HIGH]** `docuflow update --dry-run` now correctly does nothing — flag was not wired from `index.ts` into `update.ts` in v2.0.1.
- **DEF-4 [HIGH]** `docuflow update` installs to the prefix of the running node binary (`process.execPath`-derived) instead of defaulting to whatever `npm -g` resolves (which could be `.hermes` or an nvm shim prefix).
- **DEF-5 [MED]** `templates/` directory is now included in the npm `files` list for `@doquflow/cli` — fresh `docuflow init` now copies the full `schema.md`, `index.md`, `log.md` templates instead of minimal stubs.
- **DEF-6 [MED]** `docuflow ingest` page-count display was always 0 — `IngestResult.pages_created/pages_updated` are `string[]`; now correctly uses `.length`.
- **DEF-7 [MED]** `docuflow init` no longer writes the absolute project path into `CLAUDE.md` / `AGENTS.md` example snippets — uses `"."` instead, preventing machine-specific paths from polluting generated docs.
- **DEF-8 [LOW]** MCP handshake version now reads from `package.json` at startup instead of the hardcoded `"2.0.0"` string.

### Added
- `docuflow init --repair`: detect and rewrite broken MCP server paths in existing Claude Desktop / VS Code / Copilot CLI configs without re-running full init. Useful after upgrading from v2.0.0/2.0.1 where DEF-2 left invalid paths.

### Chore
- `Dockerfile.dev` + `scripts/dev-container.sh`: Node 22 isolated dev container, modeled on teststop's setup (2026-06-11 security mandate).

## [2.0.1] - 2026-06-10

### Changed
- feat: `docuflow init` now runs `suggest` at the end — new users see domain-aware next steps and copy-paste Claude prompts immediately after setup, without needing to discover `docuflow suggest` separately

## [2.0.0] - 2026-05-20

**Package split.** Third milestone of the philosophy reset. `@doquflow/server` becomes a thin back-compat alias; the value pipe lives in new packages `@doquflow/core` (4 MCP tools, minimal) and `@doquflow/studio` (11 advanced tools + UI + REST API). `@doquflow/cli` is now a meta-package depending on both. See [release/v2.0.0.md](release/v2.0.0.md) for the full narrative.

### Added
- feat: `@doquflow/core` package (#28) — irreducible MCP server with the 4 core tools (`query_wiki`, `ingest_source`, `wiki_search`, `read_module`), the extractor, types, filesystem helpers, and 49 unit tests
- feat: `@doquflow/studio` package (#29) — 11 advanced MCP tools, React web UI, Express REST API; depends on `@doquflow/core`; ships `docuflow-studio` binary registering all 15 tools
- feat: `docuflow doctor` diagnostic command (#32) — reports installed packages, MCP registrations, workflow detection, recommendations, and wiki health; supports `--json` and `--quiet`
- docs: `release/v2.0.0.md` — full milestone narrative

### Changed
- refactor: `@doquflow/server` is now a 7-line shim re-exporting `@doquflow/studio` (#30) — existing `.mcp.json` registrations keep working, 15 tools still served, package size dropped from ~188 KB → < 5 KB
- refactor: `@doquflow/cli` meta-package (#31) — drops `@doquflow/server` dependency, depends directly on `@doquflow/core` + `@doquflow/studio`; `loadServerTool` fallback chain trimmed; `resolveServerBin()` now targets studio's MCP binary
- chore: `packages/api` and `packages/ui` removed (content moved into `packages/studio/src/api/` and `packages/studio/src/ui/` in #29)
- chore: root build script topologically ordered: `core → studio → server → cli`
- docs: `MIGRATION.md` extended with the v2.0 package layout, install matrix, decision tree, and deprecation timeline

### Bright line
Zero breakage for existing users. `npm i -g @doquflow/cli` still gives the full surface (transitively pulls `@doquflow/core` + `@doquflow/studio`). Every existing `.mcp.json` registration of `@doquflow/server` continues to work without modification. Every CLI command works at its old path.

## [1.7.0] - 2026-05-20

**Soft deprecation / core-vs-advanced surface split.** Second milestone of the philosophy reset. Zero command removal — every existing top-level path keeps working. See [release/v1.7.0.md](release/v1.7.0.md) for the full narrative.

### Added
- feat: `docuflow query "<question>"` core CLI command (#12) — direct value-out pipe, wraps `query_wiki` MCP tool; supports `--max-sources`, `--json`, `--no-cite`, `--save-as`, `--quiet`
- feat: `docuflow ingest <file>` core CLI command (#13) — direct value-in pipe, wraps `ingest_source` MCP tool; supports `--all`, `--dry-run`, `--quiet`
- feat: `MIGRATION.md` (#16) — philosophy-reset narrative + command mapping table; quotes the Tracker's Paradox LinkedIn post

### Changed
- refactor: CLI help core/advanced split (#14) — `docuflow --help` shows 5 core commands (init/ingest/query/status/rewiki); `docuflow advanced --help` shows 9 advanced commands (watch/sync/ui/start/review/recent/suggest/update); every old top-level path still works, the `advanced` prefix is optional
- docs: CLAUDE.md auto-generation now features 4 core MCP tools (`query_wiki`, `ingest_source`, `wiki_search`, `read_module`) with the 11 advanced tools demoted to a second section (#15); BEGIN/END markers added for idempotent re-runs

### Bright line
Zero command removal through v2.x. Every existing `docuflow watch`, `docuflow sync --ai`, `docuflow ui`, etc. keeps working exactly as before. The new `advanced` prefix is *optional* everywhere.

## [1.6.0] - 2026-05-20

**Philosophy Reset.** DocuFlow is returning to its core: *intent in, value out, nothing in between.* See [release/v1.6.0.md](release/v1.6.0.md) for the full narrative.

### Added
- feat: `docuflow rewiki` migration command (#4) — re-ingests all sources with current extractor rules, backs up wiki, migrates synthesiss/ typo, produces audit report
- feat: 5-rule entity extractor + Rule 6 for structural noise (#3) — stop-list, no emoji/punct-only slugs, structural anchor, min token signal, context requirement, plus rejection of numbered list items, file references, question-form headings, preposition-led phrases, layer/phase markers, sentence-form captures, emoji-led decoration, "the X" descriptives, and date metadata
- feat: `.docuflow/schema.md` philosophy-reset schema (#5) — canonical wiki structure for the Code & Architecture domain; CI guard fails the build if the placeholder template remains

### Fixed
- fix: `synthesiss/` typo bug (#2) — centralised `categoryDir()` helper replaces ad-hoc `category + "s"` pluralisation in `ingest-source.ts` and `save-answer-as-page.ts`
- fix: npm-chart commit noise (#6) — weekly cron (Mon 09:00 UTC) instead of every 6h, `stats:` prefix instead of `chore:`, SVG relocated to `docs/stats/`

### Proof run on this repo
- Entity pages: **256 → 96** (62.5% reduction)
- Total wiki pages: 283 → 123 (57% reduction)
- Unit tests: 76 passing (extractor rules + categoryDir + rewiki)

## [1.5.2] - 2026-05-13


## [1.5.1] - 2026-05-09


## [1.5.0] - 2026-05-09


## [1.4.0] - 2026-05-09


## [1.3.1] - 2026-05-09

### Fixed
- **Web UI navigation** — Removed duplicate nav items (Health/Sync appearing twice) caused by two separate `<nav>` blocks in Rail component; replaced with unified `RAIL_GROUPS` structure
- **Web UI CSS tokens** — Added missing `--df-text-5` and `--df-bg-hover` CSS variables that caused invisible hover/active states
- **Web UI active state** — Added `.df-action`, `.df-action--active`, and related component CSS classes; navigation items now show correct indigo left-bar indicator
- **Web UI Onboard icon** — Added `onboard` key to `ICON_MAP` (was missing, showing `●` fallback instead of help icon)
- **Web UI Settings version** — Fixed `v__APP_VERSION__` literal displaying instead of real version by adding Vite `define` injection in `vite.config.ts`
- **Web UI Settings port** — Replaced hardcoded `48821` with dynamic `window.location.port` so Settings shows actual server port
- **CLI dep pinning** — Changed `@doquflow/server` dependency in CLI `package.json` from `^1.3.0` to exact `1.3.0`

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
## [1.2.0] - 2026-05-07
## [1.1.2] - 2026-05-07
## [1.1.1] - 2026-05-07

## [1.1.0] - 2026-05-07

### Added
- **`docuflow ui`** — New CLI command that starts an all-in-one Express server (port 48821) bundling the React web interface + HTTP API bridge
- **`docuflow start`** — Alias for `docuflow ui`
- **Web UI bundled into `@doquflow/cli` npm package** — `ui-dist/` directory included in published package; no separate install needed

## [1.0.0] - 2026-05-07

### Added
- `packages/ui/` — Vite + React 18 web interface (6 views: Ask, Wiki, Graph, Health, Sync, Onboard)
- `packages/api/` — Express HTTP bridge on port 48821 for development

## [0.5.6] - 2026-05-07
## [0.5.5] - 2026-05-07
## [0.5.4] - 2026-05-01
## [0.5.3] - 2026-05-01
## [0.5.2] - 2026-05-01
## [0.5.1] - 2026-05-01
## [0.5.0] - 2026-05-01
## [0.4.4] - 2026-04-23
## [0.4.3] - 2026-04-23
## [0.4.2] - 2026-04-23
## [0.4.1] - 2026-04-23
## [0.4.0] - 2026-04-23
## [0.2.0] - 2026-04-16
## [v1.0] - 2026-04-09
## [v0.1.0] - 2026-04-09
