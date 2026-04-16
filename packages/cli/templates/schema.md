# Docuflow Wiki Schema

This file defines the structure and conventions for your LLM Wiki. Customize it for your domain.

## Wiki Metadata

- **Domain**: [e.g., Code Architecture, Research, Personal Knowledge, Team KB]
- **Created**: [YYYY-MM-DD]
- **Maintainer**: [Your name or team]
- **Purpose**: [Brief description of what this wiki tracks]

## Directory Structure

```
.docuflow/
├── schema.md          # This file (configuration)
├── index.md           # Auto-maintained catalog of all pages
├── log.md             # Append-only operation log
├── sources/           # Immutable raw source documents
│   ├── source-1.md
│   ├── source-2.pdf
│   └── ...
└── wiki/              # LLM-generated wiki pages
    ├── entities/      # People, projects, systems, concepts
    ├── concepts/      # Ideas, patterns, methodologies
    ├── timelines/     # Chronological records
    ├── syntheses/     # Analyses, comparisons, summaries
    └── index.md       # Quick reference
```

## Page Categories

Define what types of pages live in your wiki:

### 1. Entities
Pages about specific things: people, projects, systems, places, organizations.
- **Naming**: `entity_name.md` (e.g., `user_authentication_system.md`)
- **Frontmatter**: created_at, updated_at, sources, tags, inbound_links, outbound_links
- **Typical sections**: Overview, Key characteristics, Related entities, Timeline

### 2. Concepts
Pages about ideas, patterns, methodologies, theories.
- **Naming**: `concept_name.md` (e.g., `domain_driven_design.md`)
- **Frontmatter**: created_at, updated_at, sources, tags, inbound_links, outbound_links
- **Typical sections**: Definition, Historical context, Applications, Related concepts

### 3. Timelines
Chronological records of events, changes, milestones.
- **Naming**: `timeline_subject.md` (e.g., `timeline_project_x.md`)
- **Frontmatter**: created_at, updated_at, sources, tags
- **Format**: Chronological list with dates and descriptions

### 4. Syntheses
Analyses, comparisons, reviews of information from multiple sources.
- **Naming**: `synthesis_topic.md` (e.g., `synthesis_database_comparison.md`)
- **Frontmatter**: created_at, updated_at, sources, tags, inbound_links, outbound_links
- **Typical sections**: Thesis, Evidence, Comparisons, Conclusions

## Linking Conventions

- **Internal wiki links**: `[[entity_name]]` or `[[concept_name]]`
- **Source references**: `[Source: source_id]` or `[See: source_id#section]`
- **Cross-references**: Maintain automatically in frontmatter

## Tagging Conventions

Use consistent tags for categorization:
- Domain-specific: [e.g., frontend, backend, database, security]
- Status tags: [new, verified, deprecated, needs-review]
- Priority: [high, medium, low]
- Example: `tags: [backend, verified, medium]`

## Ingest Workflow

When adding a new source:

1. **Read** the source and extract key information
2. **Create/Update** entity, concept, and synthesis pages
3. **Link** references: update inbound/outbound links in frontmatter
4. **Check** for contradictions with existing pages
5. **Update** index.md with new pages
6. **Append** to log.md: `## [YYYY-MM-DD] ingest | Source title → X pages created, Y updated`

**Guidance for LLM**:
- Favor updating existing pages over creating new ones (unless genuinely new)
- Update cross-references in related pages
- Note if new info contradicts existing claims (add to page)
- Keep summaries concise (aim for 200-500 words per entity page)

## Query Workflow

When answering a question:

1. **Search** index.md for relevant pages
2. **Read** related wiki pages
3. **Synthesize** an answer with citations
4. **Optionally save** as new synthesis page if valuable
5. **Update** index and log

**Guidance for LLM**:
- Cite which wiki pages informed the answer
- If the answer would be valuable to keep, create a synthesis page
- Note any conflicts between sources in the answer

## Lint Workflow

Periodically check wiki health:

1. **Find orphans**: Pages with no inbound links
2. **Find gaps**: Mentioned entities lacking their own page
3. **Find contradictions**: Claims that conflict across pages
4. **Find stale**: Info newer sources have superseded
5. **Suggest**: New pages needed, sources to investigate

**Guidance for LLM**:
- Run lint after every 5-10 ingests
- Flag contradictions for human review
- Suggest new sources based on gaps found

## Index File Format

`index.md` is auto-maintained and organized by category:

```markdown
# Wiki Index

**Generated**: [YYYY-MM-DD HH:MM]
**Total pages**: X | **Orphans**: Y | **Cross-refs**: Z

## Entities (Y pages)
- [[entity_name]](wiki/entities/entity_name.md) — One-line summary

## Concepts (Y pages)
- [[concept_name]](wiki/concepts/concept_name.md) — One-line summary

...
```

## Log File Format

`log.md` is append-only and parseable:

```markdown
# Operation Log

## [2026-04-01] ingest | API Design Guide
- Created: entity_rest_api, synthesis_api_patterns
- Updated: concept_scalability, entity_microservices
- Time: 15 min

## [2026-04-02] query | How do we handle authentication?
- Referenced: entity_user_auth, entity_oauth2
- Created: synthesis_auth_approaches
- Time: 8 min

## [2026-04-05] lint | Health check
- Issues: 3 orphans, 2 contradictions
- Recommendations: Create page for JWT pattern, reconcile caching docs
- Time: 12 min

...
```

Parseable format: `## [YYYY-MM-DD] operation | details`

## Maintenance Schedule

- **Weekly**: Review new log entries, watch for contradictions
- **Bi-weekly**: Run lint, address orphans and gaps
- **Monthly**: Refresh index, archive outdated pages
- **Quarterly**: Full wiki review, schema adjustments

## Domain-Specific Customizations

### For Code Architecture Wikis:
- Add category: "patterns" (design patterns, architectures)
- Add category: "decisions" (ADRs, technical decisions)
- Use tags: [backend, frontend, database, devops, security]

### For Research Wikis:
- Add category: "papers" (literature reviews, paper summaries)
- Add category: "methodologies" (research methods, approaches)
- Use tags: [empirical, theoretical, validated, pending-review]

### For Business Wikis:
- Add category: "processes" (workflows, procedures)
- Add category: "decisions" (strategic decisions, meetings)
- Use tags: [strategic, tactical, urgent, evergreen]

### For Personal Wikis:
- Add category: "goals" (personal objectives, projects)
- Add category: "reflections" (journal entries, learnings)
- Use tags: [health, career, learning, personal, goal]

---

## Questions to Guide Development

- What new entity types do we need to track?
- Are there synthesis pages that would be valuable?
- Which pages have the most inbound links (hub pages)?
- What contradictions should we prioritize resolving?
- Are there important concepts we're missing pages for?
