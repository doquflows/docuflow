# Docuflow

**Persistent knowledge bases for AI agents — built once, compounding forever.**

[![npm version](https://img.shields.io/npm/v/@doquflow/cli?label=version&style=flat-square&color=6366f1)](https://www.npmjs.com/package/@doquflow/cli)
[![npm downloads](https://img.shields.io/npm/dm/@doquflow/cli?label=downloads&style=flat-square&color=10b981)](https://www.npmjs.com/package/@doquflow/cli)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue?style=flat-square)](https://github.com/shaifulshabuj/docuflow-mcp/blob/main/LICENSE)

---

## The problem AI agents face

Every new conversation, your AI agent starts from zero. It re-reads files, re-discovers patterns, re-learns your codebase. Hours of context disappear the moment the session ends. Even RAG re-extracts knowledge on every query — there's no accumulation, no memory, no compounding value.

## The solution: LLM Wiki pattern

Docuflow implements the **LLM Wiki pattern** — a three-layer architecture where knowledge compounds over time:

```
You add a source document
        ↓
Docuflow reads it once → extracts entities, concepts, relationships
        ↓
Updates the wiki → cross-references, integrates, tracks contradictions
        ↓
Next query: search the richer wiki (not raw source again)
        ↓
Answer gets better as wiki grows — knowledge compounds
```

The LLM does the bookkeeping **once**. That work reuses forever.

## Quick install

=== "npm (global)"
    ```bash
    npm install -g @doquflow/cli
    docuflow init
    ```

=== "npx (no install)"
    ```bash
    npx @doquflow/cli init
    ```

---

## What you get

<div class="feature-grid">

<div class="feature-card">
<h3>🧠 15 MCP Tools</h3>
Code extraction, wiki management, health checks, dependency graphs — all accessible from any MCP-compatible agent (Claude, Copilot, Cursor).
</div>

<div class="feature-card">
<h3>💻 8 CLI Commands</h3>
<code>docuflow init</code>, <code>ingest</code>, <code>query</code>, <code>status</code>, <code>rewiki</code>, <code>suggest</code>, <code>ui</code>, <code>doctor</code> — and more via <code>docuflow advanced --help</code>.
</div>

<div class="feature-card">
<h3>🌐 Web UI</h3>
Live browser interface with 6 views: Ask, Wiki, Graph, Health, Sync, Onboard. No build step — ships inside the npm package.
</div>

<div class="feature-card">
<h3>📦 4 Packages</h3>
<code>@doquflow/core</code> (4 core tools), <code>@doquflow/studio</code> (11 advanced tools + UI), <code>@doquflow/server</code> (back-compat alias), <code>@doquflow/cli</code> (meta CLI).
</div>

<div class="feature-card">
<h3>🔍 Universal Extractor</h3>
Understands TypeScript, JavaScript, Python, Go, Ruby, Rust, Java, C#, PHP, Kotlin, Swift, Angular, Vue, SQL, Shell, and more.
</div>

<div class="feature-card">
<h3>🔐 Waymark Integration</h3>
Optional security policy enforcement. AI operates only within allowed paths and commands, with full audit trail and human approval for sensitive operations.
</div>

</div>

## Philosophy

> *Knowledge should accumulate, not evaporate.*

Docuflow is built on the belief that AI-assisted development should get better over time, not start fresh every session. Every source you ingest makes every future question more accurate. Every question answered makes future answers richer.

[Get Started →](getting-started/installation.md){ .md-button .md-button--primary }
[LLM Wiki Pattern →](concepts/llm-wiki-pattern.md){ .md-button }
