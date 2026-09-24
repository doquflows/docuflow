# Docuflow Usage Examples

Real-world workflows with actual command outputs and next steps.

---

## Setup (First Time)

```bash
# Initialize Docuflow in your project
docuflow init

# You'll see:
✅ Created .docuflow/ directory structure
   - sources/        (put your markdown files here)
   - wiki/           (LLM will generate pages here)
   - specs/          (legacy code specs)
   - index.md        (searchable catalog)
   - log.md          (operation history)
   - schema.md       (configuration)

# Check status
docuflow status

# Output:
.docuflow/ directory: ✓ Found
Wiki pages: 0
Health score: N/A
Last lint: N/A
```

---

## Example 1: Ingest a Design Document

**Goal:** Add an architecture document to your knowledge base, automatically extract entities and concepts, and build wiki pages.

**Setup:**
```bash
# Place your document in sources/
cp my-architecture.md .docuflow/sources/

# You now have:
.docuflow/
├── sources/
│   └── my-architecture.md        (188 KB markdown)
├── wiki/                         (empty, will be populated)
└── index.md                      (empty, will be updated)
```

**LLM Command (Claude, Copilot, etc.):**
```
Use the ingest_source tool to process my-architecture.md.
Then call update_index to refresh the wiki catalog.
Finally, check the status and show me what was discovered.
```

**Tool Calls:**
```javascript
// Step 1: Parse source and create wiki pages
const ingestResult = await ingestSource({
  project_path: "/path/to/project",
  source_filename: "my-architecture.md"
});

console.log(ingestResult);
// {
//   source_id: "source_my-architecture",
//   summary: "Architecture overview covering API design, database schema, and deployment patterns",
//   pages_created: [
//     "entity_rest_api",
//     "entity_database_schema",
//     "entity_kubernetes_deployment",
//     "concept_microservices_pattern",
//     "concept_containerization",
//     ...
//   ],
//   pages_updated: [],
//   entities_discovered: [
//     "REST API", "Database Schema", "Kubernetes", "Docker", ...
//   ],
//   contradictions: []
// }

// Step 2: Update wiki index and log
const indexResult = await updateIndex({
  project_path: "/path/to/project"
});

console.log(indexResult);
// {
//   entries_indexed: 42,
//   log_appended: true,
//   index_file: ".docuflow/index.md"
// }

// Step 3: Check what exists
const wikiList = await listWiki({
  project_path: "/path/to/project"
});

console.log(wikiList);
// {
//   total_pages: 42,
//   by_category: {
//     entities: 28,
//     concepts: 10,
//     syntheses: 3,
//     timelines: 1
//   }
// }
```

**Result:**
Your `.docuflow/wiki/` now contains 42 pages:
- 28 entity pages (API, schema, patterns, etc.)
- 10 concept pages (architecture principles, patterns)
- 3 synthesis pages (summaries)
- 1 timeline page (evolution)

**Bonus:** View the generated index

```bash
cat .docuflow/index.md
```

Output:
```markdown
# Wiki Index

Generated: 2026-04-17T10:30:00.000Z

## Overview

Total pages: 42

## By Category

### Entity Pages (28)

- [`entity_rest_api`](./wiki/entities/entity_rest_api.md) — REST API design
- [`entity_database_schema`](./wiki/entities/entity_database_schema.md) — Relational schema
- [`entity_kubernetes_deployment`](./wiki/entities/entity_kubernetes_deployment.md) — K8s orchestration
...

### Concept Pages (10)

- [`concept_microservices_pattern`](./wiki/concepts/concept_microservices_pattern.md) — Microservices architecture pattern
- [`concept_containerization`](./wiki/concepts/concept_containerization.md) — Docker + container best practices
...
```

---

## Example 2: Query the Wiki

**Goal:** Ask a question and get an answer synthesized from existing wiki pages with citations.

**Setup:**
```bash
# You have a wiki with 42 pages (from Example 1)
.docuflow/wiki/          (42 pages indexed)
```

**LLM Command:**
```
I want to understand the deployment strategy. Use query_wiki to search
for relevant information and synthesize an answer with citations.
```

**Tool Calls:**
```javascript
// Query the wiki for deployment information
const queryResult = await queryWiki({
  project_path: "/path/to/project",
  question: "What is the deployment strategy?",
  max_sources: 5
});

console.log(queryResult);
// {
//   question: "What is the deployment strategy?",
//   answer: "# Deployment Strategy\n\n...",
//   source_pages: [
//     "entity_kubernetes_deployment",
//     "concept_containerization",
//     "entity_docker_registry",
//     "entity_ci_cd_pipeline",
//     "entity_monitoring_strategy"
//   ]
// }
```

**Output (Markdown Answer):**
```markdown
# Deployment Strategy

Our architecture uses a container-based deployment model orchestrated by Kubernetes.

**Containerization:** All services are built into Docker images and pushed to our private registry. Docker enables consistent environments across development, staging, and production.

**Orchestration:** Kubernetes manages container lifecycle, scaling, and networking. We use deployment manifests for declarative infrastructure as code, enabling version control and repeatability.

**CI/CD Pipeline:** Our automated pipeline builds → tests → pushes images → deploys to staging → runs smoke tests → promotes to production.

**Monitoring:** Prometheus scrapes metrics from all containers. Grafana dashboards provide real-time visibility. Alerts trigger on anomalies, enabling fast incident response.

---

## Sources

- [Kubernetes Deployment](./wiki/entities/entity_kubernetes_deployment.md)
- [Docker Containerization](./wiki/concepts/concept_containerization.md)
- [Docker Registry](./wiki/entities/entity_docker_registry.md)
- [CI/CD Pipeline](./wiki/entities/entity_ci_cd_pipeline.md)
- [Monitoring Strategy](./wiki/entities/entity_monitoring_strategy.md)
```

---

## Example 3: Save Answer as New Wiki Page

**Goal:** Your synthesis answer is so good, save it as a permanent wiki page so future queries benefit.

**Setup:**
```bash
# You have the answer from Example 2
# Now save it as a wiki page for future reference
```

**Tool Calls:**
```javascript
// Save the answer as a new wiki page
const saveResult = await saveAnswerAsPage({
  project_path: "/path/to/project",
  title: "Deployment Strategy Guide",
  content: "# Deployment Strategy\n\n[markdown from query result]",
  page_title: "Deployment Strategy Guide",
  category: "synthesis",
  source_page_ids: [
    "entity_kubernetes_deployment",
    "concept_containerization",
    "entity_docker_registry",
    "entity_ci_cd_pipeline",
    "entity_monitoring_strategy"
  ]
});

console.log(saveResult);
// {
//   page_id: "synthesis_deployment_strategy_guide",
//   file_path: ".docuflow/wiki/syntheses/synthesis_deployment_strategy_guide.md",
//   saved_at: "2026-04-17T10:35:00.000Z",
//   entry_added_to_log: true
// }
```

**Result:**
- New file created: `.docuflow/wiki/syntheses/synthesis_deployment_strategy_guide.md`
- New entry in `log.md`: 
  ```
  ## [2026-04-17T10:35:00.000Z] save_page | Deployment Strategy Guide
  - Page ID: synthesis_deployment_strategy_guide
  - Category: synthesis
  - Source pages: 5
  ```
- Next query about deployment will find this page (better answer!)

---

## Example 4: Lint Wiki for Quality Issues

**Goal:** Run a comprehensive health check on your wiki to identify problems.

**Setup:**
```bash
# You have a wiki with 150+ pages
.docuflow/wiki/          (150 pages)
```

**LLM Command:**
```
Run a full lint check on the wiki. Show me the health score,
any issues found, and recommendations for improvement.
```

**Tool Calls:**
```javascript
// Run comprehensive lint check
const lintResult = await lintWiki({
  project_path: "/path/to/project",
  check_type: "all"
});

console.log(lintResult);
// {
//   total_pages: 150,
//   issues_found: [
//     {
//       type: "orphan",
//       page_id: "entity_old_api_v1",
//       page_title: "Old API v1",
//       severity: "medium",
//       detail: "Page has no inbound links from other wiki pages",
//       suggestion: "Consider linking this page from related entity or concept pages, or remove if not needed."
//     },
//     {
//       type: "stale",
//       page_id: "entity_database_schema",
//       page_title: "Database Schema",
//       severity: "low",
//       detail: "Page last updated 45 days ago",
//       suggestion: "Consider reviewing and updating if new information is available."
//     },
//     {
//       type: "missing_ref",
//       page_id: "concept_microservices",
//       page_title: "Microservices Pattern",
//       severity: "high",
//       detail: "References non-existent page: entity_service_discovery",
//       suggestion: "Check if entity_service_discovery should be created or if the reference should be updated."
//     },
//     {
//       type: "metadata_gap",
//       page_id: "synthesis_deployment_guide",
//       page_title: "Deployment Strategy Guide",
//       severity: "low",
//       detail: "Page has no source references",
//       suggestion: "Add source document references to improve traceability."
//     }
//   ],
//   metrics: {
//     orphan_pages: 1,
//     contradictions: 0,
//     stale_pages: 3,
//     missing_refs: 1,
//     metadata_gaps: 8
//   },
//   recommendations: [
//     "1 orphan page found. Consider linking it or removing if outdated.",
//     "3 pages not updated in 30+ days. Review and refresh content.",
//     "1 broken reference found. Update or create missing page.",
//     "8 pages have metadata gaps. Add source references and timestamps."
//   ],
//   health_score: 87
// }
```

**Interpretation:**
```
Health Score: 87/100 (Good)
- Excellent starting point
- Address high-severity items (missing ref)
- Then low-severity metadata gaps
- Orphan page decision: link or remove
```

**Next Steps from LLM:**
```
✓ Create entity_service_discovery page
✓ Link entity_old_api_v1 from current API page or remove
✓ Update database_schema page with latest info
✓ Add source references to synthesis pages
✓ Re-run lint to verify improvements
```

---

## Example 5: Run Specific Lint Checks

**Goal:** Focus on specific issue types instead of everything at once.

**Tool Calls:**
```javascript
// Check only for orphan pages
const orphanResult = await lintWiki({
  project_path: "/path/to/project",
  check_type: "orphans"
});

console.log(`Found ${orphanResult.issues_found.length} orphan pages`);

// Check only for stale content
const staleResult = await lintWiki({
  project_path: "/path/to/project",
  check_type: "stale"
});

console.log(`Found ${staleResult.issues_found.length} stale pages (>30 days)`);

// Check only for broken links
const missingResult = await lintWiki({
  project_path: "/path/to/project",
  check_type: "metadata"
});

console.log(`Found ${missingResult.metrics.missing_refs} broken references`);
```

---

## Example 6: Full Knowledge Base Workflow

**Complete journey from empty to 100+ pages:**

```bash
# Day 1: Initialize and add first source
docuflow init
cp architecture.md .docuflow/sources/

# LLM: "Ingest the architecture document"
→ ingest_source() → 45 pages created
→ update_index() → index.md populated

# Day 2: Add more sources as you learn
cp database-design.md .docuflow/sources/
cp deployment-guide.md .docuflow/sources/
cp team-processes.md .docuflow/sources/

# LLM: "Process all new sources and update the wiki"
→ Loop: ingest_source() for each file → 120 pages total
→ update_index() → index.md updated

# Day 3: Start using the wiki
# LLM: "What's our database strategy?"
→ query_wiki() → search 120 pages → synthesize answer
→ save_answer_as_page() → new page added

# Week 1: Maintenance
# LLM: "Run a health check on the wiki"
→ lint_wiki() → 125 pages, 92% health score
→ Address 3 orphan pages, 2 broken references
→ Re-lint: 92% → 96% health score

# Month 1: Knowledge compounds
# 150+ pages, 98% health score
# Queries are faster and more comprehensive
# New team members onboard faster
# Institutional knowledge is persistent
```

---

## Tips for Best Results

1. **Consistent Formatting:** Keep source documents in clean markdown with clear headers
2. **Run Lint Regularly:** Weekly health checks keep quality high
3. **Save Good Answers:** Synthesis pages compound knowledge
4. **Link Aggressively:** More cross-references = better search
5. **Update Stale Pages:** Review pages >30 days old
6. **Source Everything:** Document where facts come from

---

## Troubleshooting

**Issue:** Query results are vague

**Solution:**
- Check `lint_wiki` — may have metadata gaps
- Add more sources to enrich wiki
- Save good synthesis pages for next time

**Issue:** Lint shows many orphan pages

**Solution:**
- Review each orphan — are they really unused?
- Link relevant orphans from concept/entity pages
- Remove truly obsolete pages

**Issue:** Build slowing down with 500+ pages

**Solution:**
- Current search scales to ~500 pages fine
- Consider splitting into multiple projects
- Archive old/completed wikis

---

## See Also

- [Best Practices](./BEST_PRACTICES.md) — Maintaining wikis long-term
- [Example Schemas](./EXAMPLE_SCHEMAS.md) — Domain-specific configurations
- [LLM Wiki Pattern](./LLM_WIKI_PATTERN.md) — Deep dive on the concept
