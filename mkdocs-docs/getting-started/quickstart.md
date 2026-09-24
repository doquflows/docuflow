# Quickstart

Get Docuflow running in your project in 5 minutes.

## Step 1 — Install

```bash
npm install -g @doquflow/cli
```

## Step 2 — Initialise your project

Run this from your project root:

```bash
cd /your/project
docuflow init
```

This creates:

- **`.docuflow/`** — Wiki directory (sources, wiki pages, index, log, schema)
- **`CLAUDE.md`** — Auto-generated agent discovery file (tells Claude, Copilot, Cursor which tools are available)
- **`.docuflow/schema.md`** — Domain configuration template

After init, you'll see domain-aware next steps from `docuflow suggest` automatically.

!!! tip "Interactive setup"
    Run `docuflow init --interactive` for a guided setup that configures your domain (Code/Research/Business/Personal) with tailored schema and prompts.

## Step 3 — Add your first source

Drop a document into `.docuflow/sources/`:

```bash
cp /path/to/your/design-doc.md .docuflow/sources/

# Or write one directly
cat > .docuflow/sources/overview.md << 'EOF'
# My Project Overview

This is a TypeScript REST API with PostgreSQL...
EOF
```

## Step 4 — Ingest into the wiki

```bash
docuflow ingest overview.md
```

Docuflow reads the source, extracts entities and concepts, creates wiki pages with context paragraphs, and updates the index.

To ingest all sources at once:

```bash
docuflow ingest --all
```

## Step 5 — Ask questions

```bash
docuflow query "How does authentication work?"
```

Returns a synthesised answer with citations from your wiki pages. The more sources you've ingested, the better the answer.

---

## What's next

Your AI agent can now discover Docuflow automatically via `CLAUDE.md`. In Claude, Copilot, or Cursor, you can start asking:

> "Use Docuflow to search the wiki for authentication patterns."

> "Ingest the new design document and tell me what changed."

Check wiki health anytime:

```bash
docuflow status     # quick overview
docuflow doctor     # full diagnostic
```

Open the web interface:

```bash
docuflow ui         # opens http://localhost:48821
```

[CLI Reference →](../reference/cli.md){ .md-button }
[MCP Tools →](../reference/mcp-tools.md){ .md-button }
