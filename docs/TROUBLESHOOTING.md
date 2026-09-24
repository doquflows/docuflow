# Troubleshooting Guide

Common issues and how to fix them.

## Problem: Docuflow isn't working

### "Command not found: docuflow"

**Cause**: Docuflow CLI not installed or not in PATH

**Fix**:
```bash
# Install locally
npm install @doquflow/cli

# Or install globally
npm install -g @doquflow/cli

# Verify
docuflow --version
```

### "MCP server not responding"

**Cause**: Claude Desktop config missing or incorrect

**Fix**:
1. Check config exists: `~/.config/Claude/claude_desktop_config.json` (Linux/Mac) or `AppData/Roaming/Claude/claude_desktop_config.json` (Windows)
2. Verify MCP server entry:
```json
{
  "mcpServers": {
    "docuflow": {
      "command": "node",
      "args": ["/path/to/docuflow/server/dist/index.js"]
    }
  }
}
```
3. Restart Claude Desktop

---

## Problem: Tools aren't creating wiki pages

### "Tool ran but no pages created"

**Cause**: Source file not found or path incorrect

**Fix**:
1. Verify `.docuflow/` structure exists:
   ```bash
   docuflow init
   ```
2. Check source path is correct:
   ```bash
   ls .docuflow/sources/
   ```
3. Run tool again with correct path

### "Files were created but in wrong location"

**Cause**: Tool bug with directory names containing spaces

**Status**: ✅ FIXED in Phase 6B
- write_spec now uses atomic writes
- Paths properly escaped
- Files verified on disk before success

**Fix**: Update Docuflow to latest version

---

## Problem: Wiki searches aren't working well

### "Query returns irrelevant results"

**Cause**: Index needs updating or search scope too broad

**Fix**:
1. Update index:
   ```
   Run: update_index({ project_path })
   ```
2. Try more specific query with domain keywords
3. Run `lint_wiki` to check wiki health

### "Search returns no results"

**Cause**: Wiki empty or pages don't have metadata

**Fix**:
1. Check wiki has pages:
   ```
   Run: list_wiki({ project_path })
   ```
2. If empty, ingest sources:
   ```
   Run: ingest_source({ project_path, source_filename })
   ```
3. Update index:
   ```
   Run: update_index({ project_path })
   ```

---

## Problem: Wiki quality is poor

### "lint_wiki reports high number of issues"

**Cause**: Normal for new wikis; grows healthy over time

**Fix**:
1. Check what types of issues (run with check_type):
   ```
   lint_wiki({ project_path, check_type: "orphans" })
   ```
2. Address high-priority issues:
   - Broken references (fix links)
   - Orphan pages (add links or delete)
   - Stale pages (refresh content)
3. Re-lint to track improvement

### "Many orphan pages detected"

**Cause**: Pages created but not linked from other pages

**Fix**:
1. List orphans:
   ```
   lint_wiki({ project_path, check_type: "orphans" })
   ```
2. For each orphan:
   - Either delete it (use `rm`)
   - Or create links from related pages
3. Run `update_index` to refresh links

### "Contradictions detected"

**Cause**: Sources say different things about same topic

**Fix**:
1. View contradiction reports:
   ```
   lint_wiki({ project_path, check_type: "contradictions" })
   ```
2. For each contradiction:
   - Research which source is authoritative
   - Add note to conflicting pages
   - Consider creating "Disagreement" or "Evolution" page explaining both views
3. Use `query_wiki` to research: "Why do sources disagree on X?"

---

## Problem: Performance is slow

### "Tools take long time to run"

**Cause**: Wiki has grown to 500+ pages; index search becoming slow

**Fix**:
1. Check wiki size:
   ```
   list_wiki({ project_path })
   ```
2. If > 500 pages:
   - Run `lint_wiki` to remove orphans (reduce size)
   - Consider archiving old sections
   - Phase 6D will include vector search option for large wikis

### "Ingest is taking very long"

**Cause**: Source file is very large

**Fix**:
1. Break into smaller files:
   - Split large markdown files
   - Split large code files
   - Ingest separately
2. Try again - should be faster

---

## Problem: Understanding the wiki

### "I don't know what documents I should create"

**Solution**: Use `get_schema_guidance` tool

**How**:
1. Run: `get_schema_guidance({ project_path })`
2. Tool will show:
   - Domain (auto-detected)
   - Recommended pages for your domain
   - Pages you already have
   - Actionable next steps

### "I'm getting lost in the wiki"

**Solution**: Use `list_wiki` and `query_wiki`

**How**:
1. Explore structure:
   ```
   list_wiki({ project_path })
   ```
2. Search for what you're looking for:
   ```
   query_wiki({ project_path, question: "What is...?" })
   ```
3. Follow cross-references in search results

---

## Problem: Copilot isn't using docuflow

### "Claude doesn't know about docuflow"

**Cause**: `.claude/instructions.md` missing or not readable

**Fix**:
1. Check file exists:
   ```bash
   ls -la .claude/instructions.md
   ```
2. If not, run:
   ```bash
   docuflow init
   ```
3. Restart Claude/Copilot session

### "Claude uses docuflow but wrong context"

**Cause**: schema.md doesn't match domain or is outdated

**Fix**:
1. Review `.docuflow/schema.md`
2. Update to match your domain
3. Use templates from `docs/EXAMPLE_SCHEMAS.md`
4. Provide feedback to Claude about what it should do

---

## Problem: Data loss or corruption

### "Wiki pages mysteriously changed"

**Cause**: Concurrent tool runs causing race condition

**Status**: ✅ FIXED in Phase 1-2
- Atomic writes prevent partial files
- Per-project locks prevent races
- Index updates are serialized

**Fix**: This shouldn't happen; report if it does

### "Index.md is corrupted or unreadable"

**Cause**: Tool interrupted while writing

**Fix**:
1. Backup corrupt file:
   ```bash
   cp .docuflow/index.md .docuflow/index.md.backup
   ```
2. Regenerate from wiki:
   ```
   Run: update_index({ project_path })
   ```
3. Verify restored:
   ```
   list_wiki({ project_path })
   ```

---

## Advanced Troubleshooting

### Check the operation log

Everything Docuflow does is recorded in `.docuflow/log.md`:
```bash
tail -20 .docuflow/log.md
```

This shows:
- When operations ran
- What sources were ingested
- What queries were made
- When lint checks ran

### View tool schemas

See what parameters each tool accepts:
- Ask Claude: "What are docuflow's tools?"
- Or read: `docs/USAGE_EXAMPLES.md`

### Run tools manually

From Node.js:
```javascript
import { ingestSource } from "@doquflow/server/dist/tools/ingest-source.js";
const result = await ingestSource({
  project_path: "/path/to/project",
  source_filename: "README.md"
});
console.log(result);
```

### Check system requirements

- Node.js 18+
- 50MB free disk space (for small wikis)
- Depends on wiki size (100+ pages = 100MB+)

---

## Getting Help

1. **Check this guide** — Most issues covered here
2. **Read operation log** — `.docuflow/log.md` shows what happened
3. **Run diagnostic** — `lint_wiki` to health-check wiki
4. **Ask Claude** — "What's wrong with my wiki?" or "How do I...?"
5. **Report bug** — If you find actual bug, report with:
   - Steps to reproduce
   - Output of `lint_wiki`
   - Relevant log entries from log.md

---

## FAQ

**Q: Can I delete wiki pages manually?**
A: Yes, but run `update_index` afterward to update links

**Q: What if I want to reset my wiki?**
A: Delete `.docuflow/wiki/` directory and re-ingest sources

**Q: Can I have multiple wikis in same project?**
A: Not recommended; only one `.docuflow/` supported

**Q: How often should I run lint_wiki?**
A: Weekly or after major ingests

**Q: What happens if I edit pages manually?**
A: That's OK but lint will flag inconsistencies

**Q: Is my data safe?**
A: Yes - git tracks all changes, automatic backups with .backup files

---

## Quick Fixes

| Issue | Quick Fix |
|-------|----------|
| No pages created | Run `update_index()` |
| Search not working | Ingest more sources |
| Too many orphans | Run `lint_wiki()` |
| Stale data | Run `lint_wiki()` |
| Confused about structure | Run `list_wiki()` |
| Don't know what to create | Run `get_schema_guidance()` |
| Want to preview first | Run `preview_generation()` |

