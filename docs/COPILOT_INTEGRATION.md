# Copilot Integration Guide

This document explains how Copilot (Claude) discovers and uses Docuflow tools automatically.

## How Discovery Works

When Copilot loads your project, it:

1. **Reads `.claude/instructions.md`** (this file in the .claude folder)
2. **Learns about Docuflow** — what it does, when it's useful
3. **Understands the 10 available tools** — how to invoke them
4. **Recognizes opportunity patterns** — when to suggest using it

Once Copilot understands Docuflow, it will:
- ✅ Automatically suggest creating a wiki when appropriate
- ✅ Use docuflow tools without being explicitly told
- ✅ Maintain wiki knowledge across conversations
- ✅ Help you build and query your knowledge base

## What Copilot Learns from instructions.md

### 1. What Docuflow Is
A system for building **knowledge bases that compound over time** instead of being recreated on every query.

**Key insight**: RAG (traditional retrieval-augmented generation) re-derives knowledge from scratch on every query. Docuflow's wiki persists and grows, so knowledge builds up.

### 2. The Three-Layer Architecture
- **Layer 1**: Raw sources (immutable documents you curate)
- **Layer 2**: Wiki layer (LLM-maintained markdown files)
- **Layer 3**: Schema + index + log (configuration and navigation)

### 3. When Docuflow Is Valuable
- Understanding large codebases
- Researching complex topics
- Long-running analysis that spans multiple sessions
- Building institutional knowledge
- Creating documentation that evolves

### 4. The 10 Available Tools
Organized into 4 groups:
- **Legacy**: read_module, list_modules, write_spec, read_specs
- **Ingest**: ingest_source, update_index, list_wiki
- **Query**: wiki_search, query_wiki, answer_synthesis
- **Maintenance**: lint_wiki, save_answer_as_page

### 5. Standard Workflows
Three main patterns:
1. **Build wiki** — ingest_source → query_wiki → lint_wiki
2. **Understand codebase** — ingest sources → query structure → save overviews
3. **Research synthesis** — ingest papers → query findings → synthesize

### 6. Automatic Usage Patterns
Copilot should use Docuflow when you:
- Ask to "analyze this codebase" or "create documentation"
- Ask to "research" a topic
- Ask follow-up questions (uses existing wiki)
- Ask to "save this insight" (files as new page)
- Ask to "verify accuracy" (runs lint check)

## Where .claude/instructions.md Lives

```
your-project/
├── .claude/
│   ├── instructions.md          ← Copilot reads this
│   └── launch.json              ← Debug config
├── .docuflow/
│   ├── schema.md
│   ├── index.md
│   ├── log.md
│   ├── sources/
│   └── wiki/
├── README.md
└── ... (your project files)
```

## What Copilot Won't Do (by design)

Copilot deliberately does NOT:
- ❌ Use Docuflow for one-off questions (overhead not worth it)
- ❌ Use Docuflow without asking if you want it
- ❌ Use Docuflow on simple documentation (traditional RAG is fine)
- ❌ Assume you want a wiki (asks first)

**Copilot is conservative** — it suggests Docuflow when appropriate but respects your choice.

## Workflow Examples

### Example 1: User says "Analyze this codebase"

**Copilot thinks:**
- ✓ This is a large codebase project
- ✓ User wants to understand it
- ✓ Likely follow-up questions coming
- ✓ Good fit for Docuflow

**Copilot does:**
1. Suggests: "This looks like a good fit for a wiki. Want me to set one up?"
2. If yes → runs ingest_source() on key files
3. → runs query_wiki() to understand structure
4. → saves findings with save_answer_as_page()
5. → user can query wiki later with persistent knowledge

### Example 2: User asks "What is this class doing?"

**Copilot thinks:**
- ✗ One-off question, simple file
- ✗ No indication of persistence needed
- ✗ Overkill for Docuflow

**Copilot does:**
- Traditional analysis (no wiki involved)

### Example 3: User says "Earlier you said X, tell me more"

**Copilot thinks:**
- ✓ Follow-up question on earlier analysis
- ✓ Wiki exists for this project
- ✓ Should search existing wiki first

**Copilot does:**
1. Runs query_wiki() to search existing knowledge
2. Returns answer with citations to wiki pages
3. Builds on prior understanding (not re-analyzed)

## Setting Up Your Project

To enable Copilot integration:

1. **Initialize Docuflow** (if not already done):
   ```bash
   docuflow init
   ```

2. **Add instructions.md** (already done if you're reading this):
   - File: `.claude/instructions.md`
   - Contains: When/how to use Docuflow
   - Copilot reads this automatically

3. **Optional: Customize schema.md**:
   - File: `.docuflow/schema.md`
   - Defines: What pages to create, cross-ref patterns, domain conventions
   - Use templates from docs/EXAMPLE_SCHEMAS.md

4. **Test with Copilot**:
   - Open project in Copilot/Claude Code
   - Ask: "Analyze this project and create documentation"
   - Watch it automatically use Docuflow tools

## Troubleshooting

### "Copilot isn't using Docuflow"

**Check**:
1. ✓ `.claude/instructions.md` exists and is readable
2. ✓ Project has `.docuflow/` directory structure
3. ✓ MCP server is configured in Claude Desktop config
4. ✓ Try asking explicitly: "Set up a wiki for this project"

### "Copilot uses Docuflow but it's not working"

**Debug**:
1. Check logs: `.docuflow/log.md` shows operation history
2. Lint the wiki: "Check wiki health" → runs lint_wiki()
3. Search wiki: "Search the wiki for X" → runs query_wiki()
4. Check error messages in `.docuflow/specs/`

### "I want to disable Docuflow for this project"

**Option 1**: Remove `.claude/instructions.md`
- Copilot won't know about Docuflow anymore

**Option 2**: Delete `.docuflow/`
- Removes wiki structure
- Start fresh next time

**Option 3**: Tell Copilot
- "Don't use Docuflow for this project"
- Copilot will respect your preference (in that conversation)

## Advanced: Customizing Copilot Behavior

You can customize `.claude/instructions.md` to:
- Add domain-specific guidance (e.g., "always use this schema")
- Add example prompts for your team
- Define wiki categories specific to your project
- Add troubleshooting for your use case

**Common customizations**:

```markdown
# My Project's Docuflow Setup

We use a Research wiki for our analysis work.

## Project-Specific Guidance
- Always use "research_paper" schema
- Lint weekly to catch stale findings
- Archive old research quarterly

## Our Workflows
[Add examples specific to your project]

## Team Guidelines
[Add team-specific conventions]
```

## FAQ

**Q: Can I use Docuflow without Copilot?**
A: Yes! Use the MCP tools directly via CLI or integrate into other LLM agents.

**Q: What if I have multiple projects?**
A: Each project has its own `.claude/instructions.md` and `.docuflow/` — they're independent.

**Q: Can Copilot help me migrate an existing wiki?**
A: Yes! Ask "Import these documents into Docuflow" — Copilot can run ingest_source() on existing files.

**Q: How do I ensure consistency across team members?**
A: Define it in `.docuflow/schema.md` and `.claude/instructions.md` — commit both to git.

**Q: What if instructions.md is outdated?**
A: Update it! Copilot reads it fresh each session. Changes take effect immediately.

## Summary

### How Copilot Discovers Docuflow
1. Reads `.claude/instructions.md` at session start
2. Learns 10 tools, workflows, and usage patterns
3. Suggests Docuflow when it recognizes opportunity
4. Invokes tools automatically without explicit prompting

### Your Role
1. Create/customize `.claude/instructions.md`
2. Initialize wiki structure with `docuflow init`
3. Ask Copilot to build wikis for your projects
4. Copilot maintains wiki knowledge over time

### Result
- Knowledge compounds instead of being recreated
- Follow-up questions are faster (search existing wiki)
- Contradictions caught automatically
- Documentation evolves with your understanding

**Copilot becomes your AI partner for building persistent, searchable knowledge bases.**
