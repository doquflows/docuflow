# Migrating to DocuFlow v1.7

> *"Every tool built to manage work eventually becomes work itself."*
> — [LinkedIn post on the Tracker's Paradox](https://www.linkedin.com/posts/shaifulshabuj_softwareengineering-productdevelopment-softwarearchitecture-ugcPost-7461730048954474496-ASZF)

## Why this is happening

By v1.5.2, DocuFlow had drifted into the very anti-pattern that post warns about. The repo had 11 CLI subcommands, 15 MCP tools, a watch daemon, an AI-bridge selector, a UI, and a REST API. The value-out promise — *intent in, value out* — was buried under operational scaffolding. v1.6.0 restored the signal by tightening the entity extractor (256 → 96 pages on the dogfood, 76 unit tests). v1.7 completes the surface reset: the core workflow is now front-and-centre, and everything else is clearly labelled Advanced.

The test every PR now answers in one sentence: *"Does this make the user's problem easier, not our system easier to build?"*

## What changed in v1.6 (quality pass)

Tightened the entity extractor with six rules (stop-list, no emoji/punct slugs, structural anchors, min token signal, context requirement, section-heading noise). Empirical result on this repo: 256 → 96 entity pages, 0 single-word generics remaining. Added 76 vitest unit tests. Zero surface changes — every command still worked.

## What changes in v1.7 (this milestone)

- **New core CLI commands**: `docuflow query "<question>"` and `docuflow ingest <file>` make the wiki's value-in and value-out pipes directly shell-accessible.
- **Help screen reorganised**: `docuflow --help` shows 5 core commands; `docuflow advanced --help` shows the 9 operational commands one level deeper.
- **Every existing command still works at its old path.** The `advanced` prefix is optional everywhere.

## Command mapping

| Old path | New preferred path | Still works as-is? |
|---|---|---|
| `docuflow init` | `docuflow init` | yes (core) |
| `docuflow status` | `docuflow status` | yes (core) |
| `docuflow rewiki` | `docuflow rewiki` | yes (core) |
| `docuflow watch` | `docuflow advanced watch` | yes, indefinitely |
| `docuflow sync` | `docuflow advanced sync` | yes |
| `docuflow ui` | `docuflow advanced ui` | yes |
| `docuflow start` | `docuflow advanced ui` (alias) | yes |
| `docuflow review` | `docuflow advanced review` | yes |
| `docuflow recent` | `docuflow advanced recent` | yes |
| `docuflow suggest` | `docuflow advanced suggest` | yes |
| `docuflow update` | `docuflow advanced update` | yes |
| `docuflow upgrade` | `docuflow advanced update` (alias) | yes |
| *(new)* | `docuflow query "<question>"` | new in v1.7 |
| *(new)* | `docuflow ingest <file>` | new in v1.7 |

**Every old command still works through v2.x.** The `advanced` prefix is a label, not a barrier.

## CLAUDE.md auto-generation

`docuflow init` now writes a CLAUDE.md that features the 4 core MCP tools (`query_wiki`, `ingest_source`, `wiki_search`, `read_module`) and demotes the other 11 to an "Advanced" section. The server still registers all 15 — the change is doc-only. Existing agents using `lint_wiki`, `save_answer_as_page`, etc. continue to work unchanged.

Re-running `docuflow init` on a project with an existing CLAUDE.md is now idempotent: the generator replaces only the content between `<!-- BEGIN DOCUFLOW -->` / `<!-- END DOCUFLOW -->` markers, leaving surrounding content untouched.

## What changed in v2.0 (package split — this milestone)

The single `@doquflow/server` package has been split into four focused packages. **Existing installs require no changes.**

| Package | Role | MCP tools |
|---------|------|-----------|
| `@doquflow/core` | Irreducible MCP server — 4 core tools | `query_wiki`, `ingest_source`, `wiki_search`, `read_module` |
| `@doquflow/studio` | 11 advanced tools + UI + REST API + MCP binary | `lint_wiki`, `list_wiki`, `write_spec`, `read_specs`, `save_answer_as_page`, `synthesize_answer`, `update_index`, `get_schema_guidance`, `preview_generation`, `generate_dependency_graph`, `list_modules` |
| `@doquflow/server` | Back-compat shim — re-exports studio | All 15 (via studio) |
| `@doquflow/cli` | Meta-package CLI — depends on core + studio | — |

### The bright line holds through v2.x

Every existing install command, CLI invocation, MCP registration, and `.mcp.json` entry continues to work without any user action:

```bash
# still works — server is now a thin shim of studio
npx @doquflow/server
npm install -g @doquflow/cli   # installs core + studio transitively
```

Existing `.mcp.json` files pointing at `@doquflow/server` continue to work. `docuflow init` now writes registrations pointing at the canonical `@doquflow/studio/dist/mcp/index.js` path.

### New in v2.0: `docuflow doctor`

```
docuflow doctor             # human-readable report
docuflow doctor --json      # machine-readable JSON
docuflow doctor --quiet     # recommendations only
```

Diagnoses installed packages, MCP server registrations (.mcp.json / Claude Desktop / VS Code / Copilot CLI), workflow status, and wiki health — with actionable 🔴/🟡/🟢 recommendations.

### Package mapping

```bash
# To use only the 4 core MCP tools (smallest install):
npm install -g @doquflow/core

# To use all 15 tools + UI + REST API:
npm install -g @doquflow/studio

# To use the full CLI (recommended — installs everything):
npm install -g @doquflow/cli
```

## What's coming in v3.0 (evidence-based pruning)

If studio features show real usage, they earned their keep. If not, they retire. No decisions will be made before there's evidence.

## Questions?

Open an issue on the repo. The umbrella tracking this whole reset is [#1](https://github.com/shaifulshabuj/docuflow-mcp/issues/1).
