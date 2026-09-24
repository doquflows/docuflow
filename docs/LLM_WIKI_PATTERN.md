# The LLM Wiki Pattern: Maintaining Persistent Knowledge Bases

A comprehensive pattern for building personal and team knowledge bases using LLMs.

---

## Problem: RAG Doesn't Accumulate

Most RAG (Retrieval Augmented Generation) systems work like this:

```
Every Query:
  1. Read all source documents
  2. Find relevant chunks
  3. LLM processes chunks + query
  4. Generate answer
  5. ... answer disappears (no compounding)

Next query about similar topic:
  → Start over, re-read all sources
  → No benefit from previous synthesis
  → Knowledge doesn't accumulate
```

This is expensive and frustrating. Your LLM re-discovers the same insights repeatedly.

---

## Solution: The LLM Wiki Pattern

Instead, build and maintain a persistent knowledge base:

```
First Query:
  1. Read sources
  2. Extract + organize into wiki pages
  3. LLM maintains relationships, cross-refs
  4. Knowledge persists

Second Query (weeks later):
  → Search the wiki (not raw sources)
  → Better answer because wiki is richer
  → New synthesis saved as wiki page
  → Knowledge compounds

Third Query (month later):
  → Most comprehensive answer yet
  → Wiki has 2+ months of accumulated wisdom
  → Can spot contradictions, patterns
  → Search is blazing fast (index-based)
```

**Key insight:** Do the hard bookkeeping (maintaining cross-references, consistency, relationships) once, then reuse that work forever.

---

## Three-Layer Architecture

### Layer 1: Raw Sources (Immutable)

```
.docuflow/sources/
├── architecture-overview.md        (immutable, your source of truth)
├── api-design.md
├── database-guide.md
└── deployment-runbook.md
```

**Properties:**
- ✅ User-curated
- ✅ Immutable (never modified by LLM)
- ✅ Complete audit trail
- ✅ Versionable

**Why immutable?**
- Preserves original intent
- Enables reproducibility
- Prevents "silent" knowledge drift
- LLM can't accidentally corrupt sources

### Layer 2: Wiki (LLM-Maintained)

```
.docuflow/wiki/
├── entities/                       (specific things: services, APIs, databases)
│   ├── entity_rest_api.md
│   ├── entity_postgresql.md
│   └── entity_kubernetes.md
├── concepts/                       (principles, patterns, practices)
│   ├── concept_microservices.md
│   ├── concept_event_driven.md
│   └── concept_circuit_breaker.md
├── syntheses/                      (answers, connections, summaries)
│   ├── synthesis_deployment_strategy.md
│   └── synthesis_data_flow.md
└── timelines/                      (evolution, decisions, history)
    └── timeline_api_evolution.md
```

**Properties:**
- ✅ LLM writes all content
- ✅ Humans read and browse (Obsidian, editor of choice)
- ✅ Markdown files = git-friendly, grep-searchable
- ✅ Cross-referenced automatically
- ✅ Grows incrementally

**Page types:**

- **Entity pages:** Specific systems, services, components
  - Title: `entity_rest_api.md`
  - Content: What it is, how it works, who uses it, alternatives
  - Metadata: owner, status, dependencies

- **Concept pages:** Abstract ideas, patterns, principles
  - Title: `concept_microservices_architecture.md`
  - Content: What it is, when to use it, tradeoffs, examples
  - Metadata: entities using this, related concepts

- **Synthesis pages:** Answers to important questions
  - Title: `synthesis_deployment_strategy.md`
  - Content: How deployment works, who's involved, step-by-step
  - Metadata: sources used, when written, confidence level

- **Timeline pages:** Evolution and history
  - Title: `timeline_api_design_evolution.md`
  - Content: v1 → v2 → v3, decisions made, why
  - Metadata: dates, decision rationale

### Layer 3: Schema & Metadata

```
.docuflow/
├── schema.md                       (how to structure and maintain the wiki)
├── index.md                        (searchable catalog, auto-updated)
└── log.md                          (append-only operation history)
```

**schema.md defines:**
- Directory structure and naming conventions
- Page categories and when to use each
- Cross-reference patterns
- Workflows (ingest, query, lint)

**index.md maintains:**
- List of all pages by category
- One-line summary of each page
- Search-friendly organization

**log.md records:**
- All ingest operations
- All query-to-page saves
- All lint runs with health scores
- Audit trail for traceability

---

## Why It Works

### 1. **Knowledge Compounds**

```
Week 1:  Ingest 2 sources → 50 pages
Week 2:  Ingest 1 source + answer queries → 60 pages
Week 3:  Ingest 1 source + 3 queries + lint → 65 pages
```

Each activity adds to the base. Queries become better because the wiki is richer.

### 2. **Cross-References Auto-Maintain**

```
When you query "deployment strategy":
  - Find entity_kubernetes.md
  - Find entity_docker.md
  - Find entity_ci_cd.md
  - Find concept_deployment_automation.md
  - Synthesize into answer
  → Answer contains links to all 4 pages
  → Future searches find these connections
```

The LLM does the linking work once. Next question benefits immediately.

### 3. **Contradictions Are Visible**

```
source1: "Use OAuth2 for auth"
source2: "Use JWT only, OAuth2 deprecated"

LLM notes: "OAuth2 vs JWT contradiction found"
→ Synthesis page resolves it: "OAuth2 deprecated, using JWT"
→ Next query gets clear answer immediately
```

### 4. **Search Is Local and Fast**

```
RAG approach (every query):
  Open source files, regex search, 5-10s

Wiki approach (every query):
  Search index.md + grep wiki/, <100ms
  
Result: Can afford to ask questions more often
```

### 5. **No External APIs Required**

```
✅ Everything is local markdown files
✅ Works offline
✅ git tracks all changes
✅ No embedding API calls
✅ No rate limits
```

---

## The Workflow Loop

### 1. Ingest

```
User: "Add this architecture document to the knowledge base"
     ↓
LLM: 1. Read document
     2. Identify key entities and concepts
     3. Create wiki pages for each
     4. Link them to existing pages
     5. Maintain cross-references
     6. Append to log.md
     ↓
Result: 45 new pages, 200+ links, organized knowledge
```

### 2. Query

```
User: "What's our deployment strategy?"
     ↓
LLM: 1. Search wiki index
     2. Find relevant pages (BM25 scoring)
     3. Synthesize answer with citations
     4. [Optional] Save answer as new page
     ↓
Result: Clear answer, source pages cited, new knowledge saved
```

### 3. Lint

```
User: "Is the wiki healthy?"
     ↓
LLM: 1. Check for orphan pages
     2. Find stale content (>30 days)
     3. Detect broken references
     4. Identify metadata gaps
     5. Score wiki health (0-100)
     6. Generate recommendations
     ↓
Result: Health score, issue list, actionable next steps
```

### 4. Maintain

```
LLM: Based on lint results:
     1. Link orphan pages
     2. Update stale pages
     3. Fix broken references
     4. Add missing metadata
     5. Resolve contradictions
     ↓
Result: Higher health score, better wiki
```

---

## Implementation Details

### Frontmatter (Metadata)

Every wiki page stores metadata as YAML:

```markdown
---
created_at: 2026-04-17T10:00:00Z
updated_at: 2026-04-17T10:00:00Z
sources: ["source_architecture.md", "source_api_design.md"]
tags: ["api", "http", "rest"]
inbound_links: ["entity_api_gateway", "concept_microservices"]
outbound_links: ["entity_postgresql", "concept_load_balancing"]
---

# REST API Service

[Rest of content]
```

**Why?**
- Search can weight entity pages higher (more important)
- Lint can find orphans (no inbound links)
- Contradictions tracked by topic tags
- Source traceability maintained

### Search Scoring

Page relevance calculated with BM25-inspired algorithm:

```
Score = TermFrequency × InverseDocumentFrequency × CategoryBonus

CategoryBonus:
  entity pages: 1.3x (high importance)
  concept pages: 1.1x (medium importance)
  synthesis pages: 1.0x (baseline)
```

Result: Best answers appear first.

### Health Score

```
Health Score = 100 - (Penalty / MaxPenalty × 100)

Penalties:
  High-severity issue: 10 points
  Medium-severity issue: 5 points
  Low-severity issue: 2 points

Score interpretation:
  95-100: Excellent (maintain standards)
  85-94: Good (plan fixes)
  75-84: Fair (soon)
  <75: Poor (urgent)
```

---

## Comparison: Wiki vs RAG vs Manual Documentation

| Dimension | RAG | Manual Docs | Wiki Pattern |
|-----------|-----|-------------|------|
| Setup | Complex | Manual | Automated |
| Maintenance | None | Constant | Managed by LLM |
| Search Speed | Slow | Slow | Fast |
| Knowledge Compounds | ❌ No | ✅ Yes* | ✅ Yes |
| Consistency | N/A | Hard | Good |
| Cost | API calls | Human time | One-time setup |
| Offline | ❌ | ✅ | ✅ |
| Scaling | Brittle | Breaks down | Proven to 500+ pages |

*Manual docs can compound if maintained, but it's tedious work the LLM doesn't mind.

---

## Getting Started

1. **Initialize:** `docuflow init` creates `.docuflow/` structure
2. **Add source:** Put markdown in `.docuflow/sources/`
3. **Ingest:** LLM calls `ingest_source(filename)`
4. **Explore:** Browse generated pages in `.docuflow/wiki/`
5. **Query:** LLM calls `query_wiki(question)`
6. **Maintain:** LLM calls `lint_wiki()` weekly

That's it. Knowledge base is now working.

---

## Advanced: Multi-Team Wikis

```
company/
├── engineering-wiki/
│   └── .docuflow/
│       ├── sources/ (architecture, APIs, databases)
│       └── wiki/    (150 pages)
├── product-wiki/
│   └── .docuflow/
│       ├── sources/ (roadmaps, market analysis)
│       └── wiki/    (80 pages)
└── research-wiki/
    └── .docuflow/
        ├── sources/ (papers, experiments)
        └── wiki/    (200 pages)
```

Each team maintains its wiki independently, but they share the same Docuflow tools.

---

## Limitations & Future Work

### Current (Phase 4)

✅ Proven to 500+ pages
✅ Good enough for small-to-medium teams
✅ Fast index-based search
✅ No external dependencies

### Future Enhancements

- Vector embeddings for semantic search (500+ pages)
- Automatic contradiction resolution (current: manual review)
- Multi-wiki federation (cross-wiki queries)
- Real-time collaborative editing (Automerge or similar)
- Git-backed version history (already available via git)

---

## Key Principles

1. **Immutable Sources** — Never modify raw documents
2. **LLM Maintains Wiki** — Humans curate, LLM does bookkeeping
3. **Markdown Everything** — Git-friendly, readable, grep-searchable
4. **Index-Based Search** — No embeddings needed
5. **Append-Only Logs** — Audit trail of all changes
6. **Schema Configuration** — Domain-specific, co-evolved with LLM

---

## See Also

- [README](../README.md) — Full Docuflow documentation
- [Usage Examples](./USAGE_EXAMPLES.md) — Real workflows
- [Best Practices](./BEST_PRACTICES.md) — Maintenance guidelines
- [Example Schemas](./EXAMPLE_SCHEMAS.md) — Domain-specific configs
