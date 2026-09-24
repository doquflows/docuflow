# Docuflow Best Practices

Guidelines for maintaining high-quality wikis that compound knowledge over time.

---

## Source Curation

### 1. Choose High-Quality Sources

**Good sources:**
- ✅ Authoritative architecture documents
- ✅ Well-written technical RFCs
- ✅ Clear API documentation
- ✅ Design reviews and decisions
- ✅ Deployment and operations guides
- ✅ Team onboarding materials

**Avoid:**
- ❌ Outdated/superseded documents
- ❌ Internal emails and Slack threads (hard to parse)
- ❌ Binary files (images, PDFs)
- ❌ Version control logs or raw diffs
- ❌ Auto-generated documentation (usually low quality)

### 2. Clean Up Before Ingesting

```markdown
BEFORE (messy):
---
# API Design v2.1 (DEPRECATED - SEE v3.0)
random notes here
- endpoint /users get (poorly described)
- endpoint /posts post (undocumented)

AFTER (clean):
---
# API Design v3.0

## REST Endpoints

### Users

- **GET /users** — List all users
- **POST /users** — Create new user
- **GET /users/{id}** — Get user by ID

### Posts

- **GET /posts** — List all posts
- **POST /posts** — Create new post
```

### 3. Document Source Metadata

Add YAML frontmatter to source documents:

```markdown
---
title: Architecture Overview
date: 2026-04-01
version: 2.1
status: current
related_sources:
  - deployment-guide.md
  - team-processes.md
author: engineering-team
---

# Architecture Overview
...
```

---

## Wiki Maintenance

### 1. Run Lint Regularly

**Weekly schedule:**
```bash
Monday morning:
  - run lint_wiki
  - fix any high-severity issues
  - update any stale pages

Wednesday (optional):
  - run lint again
  - fix medium-severity issues

Friday:
  - health check
  - document recommendations
```

**Monthly full audit:**
- Review all orphan pages
- Check for contradictions
- Update metadata where gaps exist
- Archive obsolete content

### 2. Set Health Score Targets

| Score | Action |
|-------|--------|
| 95+ | ✅ Excellent — maintain standards |
| 85-94 | 🟡 Good — plan fixes next sprint |
| 75-84 | 🟠 Fair — address high-severity soon |
| <75 | 🔴 Poor — urgent maintenance needed |

### 3. Handle Orphan Pages

**Orphan page decision tree:**

```
Is this page:
├─ Recently created?
│  └─ Let it be, often links appear naturally
├─ Outdated / superseded?
│  └─ Archive or remove
├─ Still relevant?
│  ├─ High priority?
│  │  └─ Add references from related pages
│  └─ Nice-to-have?
│     └─ Consider archiving
```

**Example fix:**
```markdown
# Current Entity Page

[existing content]

## Related Concepts

- [Orphan Concept A](./orphan_concept_a.md) — For advanced use cases
- [Orphan Concept B](./orphan_concept_b.md) — Historical context
```

---

## Query Patterns

### 1. Effective Questions

**Good:**
- ✅ "What is our authentication strategy?"
- ✅ "How do we deploy to production?"
- ✅ "Which services integrate with the billing system?"

**Vague:**
- ❌ "Tell me about the system"
- ❌ "What's important?"
- ❌ "Explain everything"

**Why:** Specific questions find more relevant pages, generate more useful synthesis answers.

### 2. Save Valuable Syntheses

**Save if:**
- ✅ Answer synthesizes 5+ pages well
- ✅ Question likely to be asked again
- ✅ Answer provides new insights (not just rehashing)
- ✅ Answer connects previously unlinked concepts

**Skip if:**
- ❌ Simple lookup (already in one page)
- ❌ Too specific/narrow to reuse
- ❌ Tentative/provisional answer

### 3. Update Source Pages, Not Just Syntheses

When information changes:
1. Update the source entity page directly
2. Update related synthesis pages
3. Re-run lint to catch orphans from old info
4. Log the change in log.md

```markdown
## [2026-04-17T14:00:00.000Z] update | Updated API authentication

- Page: entity_api_authentication
- Change: OAuth2 now supported, removed password grants
- Related pages updated: synthesis_security_overview, concept_oauth2
```

---

## Schema Configuration

### 1. Tailor Schema.md for Your Domain

**Example: Research Team**
```yaml
categories:
  - name: papers
    description: Peer-reviewed publications
  - name: experiments
    description: Experimental designs and results
  - name: findings
    description: Key conclusions and insights

link_patterns:
  - "cites": "paper_a cites paper_b"
  - "extends": "experiment_b extends experiment_a"
  - "contradicts": "finding_x contradicts finding_y"
```

**Example: Business Team**
```yaml
categories:
  - name: products
    description: Product offerings and specs
  - name: markets
    description: Target markets and customer segments
  - name: competitors
    description: Competitive landscape

link_patterns:
  - "targets": "product_x targets market_y"
  - "competes_with": "product_a competes_with competitor_b"
```

### 2. Update Schema as Patterns Emerge

- First 50 pages: schema will be rough
- Pages 50-150: refine categories based on what you're finding
- Pages 150+: schema is stable, only add new rare cases

---

## Knowledge Compounding

### 1. Link Aggressively

**Weak:**
```markdown
Kubernetes is a container orchestration platform.
```

**Strong:**
```markdown
[Kubernetes](./entity_kubernetes.md) is a [container orchestration](./concept_container_orchestration.md) 
platform that manages [Docker containers](./entity_docker.md) and handles 
[service scaling](./concept_scaling.md), [networking](./entity_networking.md), 
and [storage](./entity_storage.md).
```

Why: More cross-references = better search results next time.

### 2. Reuse Synthesis Pages

```
Month 1:
  Q: "How does deployment work?"
  → Query, synthesize, save as synthesis_deployment_guide

Month 3:
  Q: "What's the production release process?"
  → Query finds synthesis_deployment_guide
  → Better answer, synthesis refined
  → Even better knowledge base
```

### 3. Document Decisions, Not Just Facts

```markdown
# API Rate Limiting

## Decision

We chose token bucket algorithm over leaky bucket.

## Rationale

- [concept_token_bucket_algorithm](./concept_token_bucket_algorithm.md) is simpler to understand
- Team has previous experience with it
- [entity_redis](./entity_redis.md) has built-in support
- Accepted alternative: [concept_leaky_bucket](./concept_leaky_bucket.md) (more fair, harder to implement)

## Implementation

See [entity_api_gateway](./entity_api_gateway.md) for code details.
```

Why: Future decisions are faster when rationale is documented.

---

## Anti-Patterns to Avoid

### ❌ Anti-Pattern 1: Duplicate Content

**Problem:**
```
Two pages covering the same thing:
- entity_ci_cd_pipeline.md
- entity_continuous_integration.md
```

**Fix:**
- Merge into one authoritative page
- Create redirect from old page
- Log the consolidation

### ❌ Anti-Pattern 2: Outdated Synthesis Pages

**Problem:**
```
Synthesis page from 3 months ago still references
deprecated authentication method.
```

**Fix:**
- Lint catches this (stale pages)
- Update synthesis to reflect current architecture
- Update source pages if they changed

### ❌ Anti-Pattern 3: Broken Links

**Problem:**
```markdown
See [entity_service_discovery](./entity_service_discovery.md) 
for details.  ← Page doesn't exist
```

**Fix:**
- Lint catches this (missing references)
- Either create the page or update the link

### ❌ Anti-Pattern 4: Metadata Gaps

**Problem:**
```
Pages created months ago with no source references,
can't trace back where facts come from.
```

**Fix:**
- Run lint with metadata check
- Add sources to all pages
- Future pages: require metadata from start

---

## Team Workflows

### For Growing Teams

```
Phase 1 (1-5 people):
- One person maintains wiki
- Update after meetings
- Lint weekly

Phase 2 (5-20 people):
- Wiki is shared responsibility
- Anyone can edit synthesis pages
- Lint runs automatically (CI)
- Monthly health check meeting

Phase 3 (20+ people):
- Wiki is authoritative reference
- Multiple domain owners
- Lint prevents regressions
- Wiki referenced in onboarding
```

### For Remote/Async Teams

1. **Make wiki discoverable:**
   - Link from team handbook
   - Mention in Slack auto-reply
   - Reference in meeting notes

2. **Make wiki searchable:**
   - Lint index.md regularly
   - Search results should be fast
   - Category structure clear

3. **Make updates visible:**
   - Log all changes in log.md
   - Weekly digest of what changed
   - Changelog in team channel

---

## Performance Tips

### For 100-500 Pages

✅ Works great out of the box
- Index-based search is fast
- No special tuning needed
- Lint runs in <1 second

### For 500+ Pages

⚠️ Starting to show limits

**Optimize:**
1. Split into multiple projects by domain
2. Archive completed/historical wikis
3. Run lint on subset (check_type specific)
4. Consider adding full-text search tool

---

## Migration and Archive

### Archiving Old Wikis

```bash
# Mark wiki as archived
cp -r .docuflow .docuflow-archive-2026-q1/
cd .docuflow-archive-2026-q1/
git log --oneline | head -1 > ARCHIVE_DATE.txt

# Remove from active project
rm -rf .docuflow/wiki
rm .docuflow/index.md
```

### Migrating Between Projects

```bash
# Backup source project
cp -r project-a/.docuflow project-a/.docuflow-backup

# Copy to new location
cp -r project-a/.docuflow project-b/.docuflow

# Verify
cd project-b
docuflow status
lint_wiki()  # Check health
```

---

## Troubleshooting

### "Lint score dropped after ingest"

**Normal behavior:**
- New pages may have metadata gaps
- Unlinked pages appear as orphans temporarily
- Address these gradually

**Fix:**
```bash
# Run link pass to connect new pages
# Run lint --check_type metadata to fix gaps
# Re-run lint to verify improvements
```

### "Search results are irrelevant"

**Diagnose:**
- Run lint_wiki()
- Check for many orphan pages
- Verify cross-reference links exist

**Fix:**
- Link new pages from existing concepts
- Improve query specificity
- Run lint and address gaps

### "Wiki becoming hard to navigate"

**Symptoms:**
- Can't find pages
- Too many orphans
- Contradictions between pages

**Fix:**
- Run full lint
- Archive or consolidate old pages
- Add cross-references
- Update index categories

---

## Success Metrics

Track these to measure wiki health:

| Metric | Target | How to Measure |
|--------|--------|----------------|
| Health Score | 85%+ | `lint_wiki().health_score` |
| Orphan Pages | <10% | `lint_wiki().metrics.orphan_pages` |
| Stale Pages | <20% | `lint_wiki().metrics.stale_pages` |
| Broken Refs | 0 | `lint_wiki().metrics.missing_refs` |
| Metadata Quality | 95%+ | `lint_wiki().metrics.metadata_gaps` |

---

## See Also

- [Usage Examples](./USAGE_EXAMPLES.md) — Real workflows
- [Example Schemas](./EXAMPLE_SCHEMAS.md) — Domain configurations
- [LLM Wiki Pattern](./LLM_WIKI_PATTERN.md) — Theory and concepts
