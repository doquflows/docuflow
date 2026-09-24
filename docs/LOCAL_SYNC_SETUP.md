# Local DocuFlow Wiki Sync Guide

This project is configured for **local wiki synchronization** using DocuFlow CLI with Copilot. No GitHub Actions CI/CD or API keys required.

## Prerequisites

- **Copilot CLI** v1.0.40+ installed (`copilot --version`)
- **DocuFlow CLI** installed globally (`npm install -g @doquflow/cli@latest`)
- **Node.js** 20+ and npm

## Quick Start

### One-Shot Sync (Manual)

Manually sync the wiki whenever you want:

```bash
# Auto-detect best AI bridge (tries Copilot, Claude, Codex)
docuflow sync --ai

# Force Copilot specifically
docuflow sync --ai --copilot

# Quiet mode (minimal output, suitable for scripts)
docuflow sync --ai --quiet

# Skip health check (faster)
docuflow sync --ai --no-lint

# Fail if health score < 80
docuflow sync --ai --fail-on-score 80
```

### Continuous Sync (Watch Daemon)

Start an auto-sync daemon that monitors code changes:

```bash
# Start watching (with Copilot AI bridge)
docuflow watch --ai --copilot

# Start with custom lint interval (every 6 hours instead of 24h)
docuflow watch --ai --copilot --lint-interval 6

# Watch only specific extensions
docuflow watch --ai --copilot --code-ext ts,js,py

# Start in background and get shell back
docuflow watch --ai --copilot > /tmp/docuflow.log 2>&1 &
```

### Watch Daemon Management

```bash
# Check daemon status
docuflow watch status

# Stop the daemon
docuflow watch stop

# Restart with same options
docuflow watch restart
```

## How It Works

### One-Shot Sync Flow

```
docuflow sync --ai
  ↓
1. Detects changed files since last commit (if any)
2. Loads source docs from .docuflow/sources/
3. Runs Copilot to analyze changes → generates/updates wiki pages
4. Ingests source files into wiki
5. Rebuilds .docuflow/index.md
6. Runs health check (orphan pages, broken links, stale content)
7. Reports health score (0-100)
```

### Watch Daemon Flow

```
docuflow watch --ai --copilot
  ↓
1. Watches .docuflow/sources/ for file changes
2. Watches project code (*.ts, *.js, *.py, *.go, *.java, *.cs, etc.)
3. On change: Calls Copilot → updates wiki via MCP tools
4. Rebuilds index after each change
5. Runs lint check every 24h (configurable)
6. Stores PID in .docuflow/watch.pid
```

## AI Bridge Priority (with `--ai`)

The CLI auto-detects your available AI tool in this order:

1. **Copilot CLI** (`@github/copilot`) — ⚡ Direct MCP tool calling
2. **Claude Code CLI** — ⚡ Direct MCP tool calling  
3. **Codex CLI** — Generates doc text, then ingests
4. **ANTHROPIC_API_KEY env** — Fallback API-based sync

You can force a specific bridge with:
- `--copilot` — Force Copilot
- `--claude` — Force Claude Code
- `--codex` — Force Codex

## Example Workflows

### Developer: Manual sync after changes

```bash
# Edit some code
# Then manually sync the wiki
docuflow sync --ai

# Review wiki changes
git diff .docuflow/wiki/

# Commit if happy
git add .docuflow/ && git commit -m "docs: update wiki"
```

### CI Integration: Post-commit hook

Add to `.git/hooks/post-commit`:

```bash
#!/bin/bash
docuflow sync --ai --quiet
```

Make it executable:
```bash
chmod +x .git/hooks/post-commit
```

### Developer: Always-on background daemon

In your shell startup (`.bashrc`, `.zshrc`, etc.):

```bash
# Start watch daemon if not already running
if ! docuflow watch status > /dev/null 2>&1; then
  docuflow watch --ai --copilot --lint-interval 6 > /tmp/docuflow.log 2>&1 &
fi
```

Then kill it when done:
```bash
docuflow watch stop
```

## Configuration

### Wiki Schema

Edit `.docuflow/schema.md` to customize:
- Wiki page categories (entity, concept, timeline, synthesis)
- Page templates
- Naming conventions

### Watch Exclusions

By default, watch ignores:
- `.docuflow/**` — Don't re-ingest wiki
- `node_modules/**` — Dependencies
- `dist/**`, `build/**` — Build outputs
- Files larger than 300KB

## Troubleshooting

### "Copilot CLI not found"

Make sure Copilot is installed:
```bash
copilot version
```

If not installed, install from [GitHub Copilot CLI](https://github.com/github/copilot.js).

### Watch daemon not picking up changes

Check if it's running:
```bash
docuflow watch status
```

Restart it:
```bash
docuflow watch restart
```

Check the log:
```bash
tail -f /tmp/docuflow.log
```

### Health score dropping

Run the health check:
```bash
docuflow sync --ai --quiet  # Shows health score
```

Common issues:
- **Orphan pages**: Link unused pages or remove them
- **Broken references**: Fix wiki cross-links
- **Stale content**: Update pages that haven't changed in 30+ days

## What Gets Synced

### Source Files (→ Wiki)
- `.docuflow/sources/*.md` — Auto-ingested into wiki

### Code Files (→ MCP Analysis)
- `**/*.ts`, `**/*.js` — TypeScript/JavaScript
- `**/*.py` — Python
- `**/*.go` — Go
- `**/*.java` — Java
- `**/*.cs` — C#
- `**/*.rb` — Ruby
- And many more...

### Output (← Generated)
- `.docuflow/wiki/` — Generated wiki pages
- `.docuflow/index.md` — Auto-maintained catalog
- `.docuflow/log.md` — Operation log

## Best Practices

1. **Commit wiki changes** — Keep `.docuflow/` in git
2. **Run sync before PRs** — Ensure docs are up-to-date
3. **Use watch daemon locally** — Real-time feedback on doc quality
4. **Review health score** — Aim for 80+ (out of 100)
5. **Link pages** — Reduce orphan page warnings

## CI/CD Change

The `docuflow-sync.yml` GitHub Actions workflow has been disabled to move wiki sync entirely local. This eliminates:
- ❌ CI/CD overhead
- ❌ API key management
- ❌ Workflow trigger delays

All wiki updates now happen on your machine with `docuflow sync --ai` or `docuflow watch --ai`.

---

**Version**: 0.5.3  
**Last Updated**: 2026-05-01  
**Bridge**: Copilot CLI 1.0.40+
