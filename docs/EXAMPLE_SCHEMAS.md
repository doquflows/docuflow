# Docuflow Example Schemas

Domain-specific schema.md templates for different use cases.

---

## Schema 1: Code/Architecture Wiki

**Use case:** Building wikis for engineering teams documenting codebase architecture.

```markdown
# Architecture Wiki Schema

## Directory Structure

```
.docuflow/
├── sources/
│   ├── architecture-overview.md
│   ├── api-design.md
│   ├── database-design.md
│   ├── deployment-guide.md
│   └── deployment-decisions.md
├── wiki/
│   ├── entities/          (services, APIs, databases, tools)
│   ├── concepts/          (patterns, principles, practices)
│   ├── syntheses/         (design docs, architecture summaries)
│   └── timelines/         (history, evolution, decisions)
├── schema.md              (this file)
├── index.md               (auto-maintained catalog)
└── log.md                 (operation history)
```

## Page Categories

### Entities (LLM-generated from sources)

**What:** Specific, tangible things in your system.
**Examples:**
- REST API service
- PostgreSQL database
- Kubernetes cluster
- Docker registry
- CI/CD pipeline
- Load balancer
- Message queue (RabbitMQ, Kafka)
- Cache layer (Redis)
- Monitoring system (Prometheus, Grafana)

**Metadata:**
- `created_at`: When documented
- `updated_at`: Last update date
- `owner_team`: Responsible team
- `status`: active | deprecated | planned
- `references`: Who uses this
- `alternatives`: What else could be used

### Concepts (LLM-generated from sources)

**What:** Principles, patterns, and practices.
**Examples:**
- Microservices architecture
- Event-driven architecture
- Container orchestration
- API versioning strategy
- Database sharding
- Circuit breaker pattern
- Twelve-factor app principles
- Zero-trust security

**Metadata:**
- `principle`: Core idea
- `when_to_use`: Applicable scenarios
- `tradeoffs`: Pros and cons
- `examples`: Entities using this

### Syntheses (LLM-generated from queries)

**What:** Answers to important questions, connections across entities/concepts.
**Examples:**
- "How does our deployment pipeline work?"
- "Comparison: Monolith vs. Microservices in our context"
- "Data flow through the system"
- "Team responsibilities and code ownership"

**Metadata:**
- `question`: Original question answered
- `sources`: Pages synthesized from
- `last_updated`: When verified
- `confidence`: high | medium | low

### Timelines (LLM-generated as needed)

**What:** Evolution of decisions and systems over time.
**Examples:**
- "Evolution of API design (v1 → v2 → v3)"
- "Migration from monolith to microservices"
- "Database schema evolution"
- "Architecture decision log"

## Workflows

### Workflow 1: Ingest Architectural Document

```
1. Place .md file in sources/
2. LLM calls ingest_source(filename)
3. Entities extracted:
   - Each major system → entity page
   - Each design choice → concept page
   - Relationships documented in frontmatter
4. LLM calls update_index()
5. New pages appear in index.md with relationships
```

### Workflow 2: Answer Architecture Question

```
1. Engineer asks: "What's the data flow?"
2. LLM calls query_wiki(question)
3. Search finds relevant entity + concept pages
4. LLM synthesizes answer showing:
   - Key entities involved
   - Concepts applied
   - Data transformations
   - Alternative approaches
5. LLM calls save_answer_as_page()
6. Synthesis page appears in wiki for future reference
```

### Workflow 3: Lint Architecture Docs

```
1. LLM calls lint_wiki()
2. Checks for:
   - Orphan services (no integration docs)
   - Stale documentation (>30 days)
   - Broken references (missing pages)
   - Metadata gaps (missing owner, status)
3. Recommendations:
   - Document new service XYZ
   - Update deprecated API v1 page
   - Remove unused pattern reference
```

## Cross-Reference Patterns

Create links using this pattern:

```markdown
[Entity Name](./wiki/entities/entity_name.md) — Brief description
[Concept Name](./wiki/concepts/concept_name.md) — Brief description
[Synthesis Title](./wiki/syntheses/synthesis_title.md) — Brief description
```

Example entity page:

```markdown
# REST API Service

[Microservices Architecture Pattern](./wiki/concepts/concept_microservices_architecture.md)
component for handling [HTTP requests](./wiki/entities/entity_http_protocol.md).

## Integration

- Receives from: [API Gateway](./wiki/entities/entity_api_gateway.md)
- Communicates with: [PostgreSQL](./wiki/entities/entity_postgresql.md), [Redis Cache](./wiki/entities/entity_redis_cache.md)
- Forwards to: [Message Queue](./wiki/entities/entity_message_queue.md)

## Related Concepts

- [REST API Design](./wiki/concepts/concept_rest_api_design.md)
- [Circuit Breaker Pattern](./wiki/concepts/concept_circuit_breaker_pattern.md)
- [Error Handling Best Practices](./wiki/concepts/concept_error_handling.md)
```

---

## Schema 2: Research/Academic Wiki

**Use case:** Documenting research papers, experiments, and findings.

```markdown
# Research Wiki Schema

## Page Categories

### Papers

**What:** Published research and references.
**Metadata:**
- authors, year, venue
- doi, url
- keywords
- pages that cite this

Example frontmatter:
```yaml
---
created_at: 2026-04-01
updated_at: 2026-04-01
type: paper
authors: [Smith, J., Doe, M.]
year: 2024
venue: Nature Machine Intelligence
doi: 10.1038/s42256-024-xxxxx
keywords: [deep learning, attention mechanisms, transformer]
citedby: [finding_attention_mechanisms, experiment_transformer_variants]
---
```

### Experiments

**What:** Experimental designs and execution results.
**Metadata:**
- hypothesis
- methodology
- dataset_size
- results_summary
- status: active | completed | failed | pending
- related_papers

### Findings

**What:** Key conclusions, insights, and recommendations.
**Metadata:**
- finding_type: conclusion | insight | recommendation | open_question
- supported_by: [list of papers and experiments]
- contradicts: [conflicting findings]
- next_steps

## Cross-Reference Patterns

```markdown
[Paper Title](./wiki/papers/paper_title.md) **cites** [Related Work](./wiki/papers/related_work.md)
[Experiment Name](./wiki/experiments/experiment_name.md) **tests** [Hypothesis](./wiki/findings/hypothesis.md)
[Finding A](./wiki/findings/finding_a.md) **contradicts** [Finding B](./wiki/findings/finding_b.md)
[Experiment B](./wiki/experiments/experiment_b.md) **extends** [Experiment A](./wiki/experiments/experiment_a.md)
```

---

## Schema 3: Business/Team Wiki

**Use case:** Documenting products, markets, customers, and competitive landscape.

```markdown
# Business Wiki Schema

## Page Categories

### Products

**What:** Product offerings, features, pricing.
**Metadata:**
- product_status: launching | active | mature | declining | sunset
- target_market
- key_features
- revenue_impact
- team_owner
- launch_date

### Markets

**What:** Market segments, customer personas, opportunities.
**Metadata:**
- market_size_estimate
- growth_rate
- key_competitors
- our_positioning
- target_customers

### Competitors

**What:** Competitive landscape analysis.
**Metadata:**
- competitor_name
- products_they_offer
- our_advantages
- our_disadvantages
- pricing_comparison

### Customers

**What:** Customer profiles, use cases, feedback.
**Metadata:**
- customer_type: enterprise | mid-market | startup | individual
- industry
- use_case
- satisfaction_score
- churn_risk

## Cross-Reference Patterns

```markdown
[Product X](./wiki/products/product_x.md) **targets** [Market Y](./wiki/markets/market_y.md)
[Product A](./wiki/products/product_a.md) **competes_with** [Competitor B](./wiki/competitors/competitor_b.md)
[Customer C](./wiki/customers/customer_c.md) **uses** [Product D](./wiki/products/product_d.md)
[Market X](./wiki/markets/market_x.md) **includes** [Customer Y](./wiki/customers/customer_y.md)
```

---

## Schema 4: Personal Knowledge Base

**Use case:** Individual researchers or knowledge workers building personal wikis.

```markdown
# Personal Knowledge Base Schema

## Page Categories

### Topics

**What:** Areas of interest and expertise.
Examples: Machine Learning, Product Design, Writing, Philosophy

### Resources

**What:** Books, courses, tools, articles you've consumed.

### Insights

**What:** Ideas, takeaways, connections you've made.

### Projects

**What:** Active projects and experiments.

### People

**What:** Researchers, mentors, collaborators to follow.

## Cross-Reference Patterns

```markdown
[Topic A](./wiki/topics/topic_a.md) **relates_to** [Topic B](./wiki/topics/topic_b.md)
[Insight X](./wiki/insights/insight_x.md) **from** [Resource Y](./wiki/resources/resource_y.md)
[Resource A](./wiki/resources/resource_a.md) **teaches** [Topic B](./wiki/topics/topic_b.md)
[Project C](./wiki/projects/project_c.md) **uses** [Topic D](./wiki/topics/topic_d.md)
```

---

## Customization Tips

### 1. Copy a schema above as starting point

```bash
# Customize for your domain
cp EXAMPLE_SCHEMAS.md .docuflow/schema.md
# Edit categories, metadata, patterns to fit your needs
```

### 2. Evolve schema as you learn

- Start with provided schema
- After 50 pages, review what's working
- Adjust categories if natural groupings emerge
- Document your customizations in schema.md

### 3. Keep schema simple

**Bad schema (too prescriptive):**
```yaml
categories:
  - microservices_entity_with_grpc_support_and_async_messaging
  - synchronous_rest_concept_pattern
  - deprecated_legacy_entity_to_archive
```

**Good schema (clear and flexible):**
```yaml
categories:
  - name: entities
    description: Systems and components
  - name: concepts
    description: Patterns and principles
  - name: syntheses
    description: Answers and summaries
```

---

## Migration Between Schemas

If you outgrow your schema:

```bash
# Option 1: Add new categories
# Update schema.md with new categories
# Start creating pages in new categories
# Lint will show what needs updating

# Option 2: Archive and restart
# cp -r .docuflow .docuflow-old-schema
# rm .docuflow/wiki/*
# Update schema.md
# Manually migrate important pages
```

---

## See Also

- [Usage Examples](./USAGE_EXAMPLES.md) — Real workflows
- [Best Practices](./BEST_PRACTICES.md) — Maintenance guidelines
- [LLM Wiki Pattern](./LLM_WIKI_PATTERN.md) — Conceptual deep dive
