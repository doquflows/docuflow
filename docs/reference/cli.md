# CLI Reference

The `docuflow` CLI provides two surfaces:

- **Core commands** — shown in `docuflow --help`
- **Advanced commands** — shown in `docuflow advanced --help`

Every advanced command is also reachable without the `advanced` prefix (e.g. `docuflow watch` works the same as `docuflow advanced watch`).

---

## Core commands

### `docuflow init`

Initialise Docuflow in the current project directory.

```bash
docuflow init [--interactive] [--yes]
```

| Flag | Description |
|------|-------------|
| `--interactive`, `-i` | Guided domain setup (Code / Research / Business / Personal) |
| `--yes`, `-y` | Non-interactive mode — accept all defaults |

**What it creates:**

- `.docuflow/` directory with `sources/`, `wiki/`, `specs/`, `schema.md`, `index.md`, `log.md`
- `CLAUDE.md` — auto-generated agent discovery file
- `.mcp.json` — MCP server registration for VS Code Copilot and Cursor
- Updates Claude Desktop config and `.gitignore`

After init, runs `docuflow suggest` to show domain-aware next steps.

---

### `docuflow ingest`

Ingest source documents into the wiki.

```bash
docuflow ingest <filename>    # ingest a single file from .docuflow/sources/
docuflow ingest --all         # ingest all files in .docuflow/sources/
docuflow ingest --dry-run     # preview what would be ingested
docuflow ingest --quiet       # suppress progress output
```

| Flag | Description |
|------|-------------|
| `--all` | Ingest every file in `.docuflow/sources/` |
| `--dry-run` | Preview actions without making changes |
| `--quiet` | Suppress progress output |

---

### `docuflow query`

Ask your wiki a question and get a synthesised answer with citations.

```bash
docuflow query "How does authentication work?"
docuflow query "What changed in v2?" --max-sources 8
docuflow query "List all API endpoints" --json
docuflow query "Explain caching strategy" --save-as caching-summary.md
```

| Flag | Description |
|------|-------------|
| `--max-sources N` | Maximum wiki pages to include in synthesis (default: 5) |
| `--json` | Output raw JSON instead of formatted markdown |
| `--no-cite` | Omit source citations from output |
| `--save-as <file>` | Save the answer as a new wiki page |
| `--quiet` | Suppress progress spinner |

---

### `docuflow status`

Show wiki health and counts.

```bash
docuflow status
```

Outputs: total pages, pages by category, health score, last sync time, MCP registration status.

---

### `docuflow rewiki`

Re-ingest all sources with the current extractor rules. Use after upgrading Docuflow or changing `schema.md`.

```bash
docuflow rewiki           # backs up wiki, re-ingests all, produces audit report
docuflow rewiki --dry-run # preview what would change
```

---

### `docuflow suggest`

Show domain-aware next steps based on your wiki state.

```bash
docuflow suggest
```

Returns 5 actionable suggestions with copy-paste Claude prompts tailored to your project domain.

---

## Advanced commands

Access with `docuflow advanced --help` or call directly (the `advanced` prefix is optional):

### `docuflow ui` / `docuflow start`

Launch the web interface.

```bash
docuflow ui              # starts on http://localhost:48821
docuflow ui --port 3000  # custom port
docuflow ui --no-open    # don't auto-open browser
```

### `docuflow watch`

Background auto-sync daemon — watches `.docuflow/sources/` for changes.

```bash
docuflow watch           # start daemon
docuflow watch --ai      # AI-assisted synthesis on sync
docuflow watch stop      # stop daemon
docuflow watch status    # check daemon status
docuflow watch restart   # restart daemon
```

### `docuflow sync`

One-shot sync — ingest any new or changed sources. Good for CI/CD.

```bash
docuflow sync            # sync new sources only
docuflow sync --ai       # AI-assisted synthesis
```

### `docuflow review`

Review uncommitted changes against the wiki.

```bash
docuflow review          # review staged + unstaged changes
docuflow review --staged  # staged files only
docuflow review --since-commit abc1234  # since a specific commit
docuflow review --fail-on-critical      # exit 1 if critical findings
docuflow review --ai                    # AI-powered review
```

### `docuflow recent`

Show recent activity dashboard — git commits and wiki operations.

```bash
docuflow recent          # last 7 days
docuflow recent --days 14
docuflow recent --format md   # markdown output
```

### `docuflow doctor`

Full diagnostic report.

```bash
docuflow doctor          # full report
docuflow doctor --json   # machine-readable output
docuflow doctor --quiet  # summary only
```

### `docuflow update`

Upgrade Docuflow packages to the latest version.

```bash
docuflow update          # check and upgrade
docuflow update --check  # check for updates only
docuflow update --force  # upgrade even if already up to date
```

---

## Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DOCUFLOW_PORT` | `48821` | Web UI server port |
| `OPENAI_API_KEY` | — | Required for `--ai` flags |
| `ANTHROPIC_API_KEY` | — | Alternative for `--ai` flags |

---

## Exit codes

| Code | Meaning |
|------|---------|
| `0` | Success |
| `1` | General error |
| `2` | Invalid arguments |
| `3` | Wiki not initialised (run `docuflow init`) |
