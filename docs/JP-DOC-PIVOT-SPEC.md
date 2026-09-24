# Docuflow: JP-DOC-PIVOT-SPEC

## 1. Scenario-Anchored Solution Map

*   **Scenario 1: Multilingual teams + legacy Japanese design docs (incl. Excel).**
    *   **Current State:** Teams struggle with untranslated legacy docs and Excel files containing domain-specific Japanese.
    *   **Docuflow Mechanism:** Ingest exported legacy docs (e.g., CSV dumps from Excel) into the `.docuflow/sources/` layer. We leverage the existing `context` tool's new `hybrid` search mode. Because `context` now embeds text via `sqlite-vec` and `@xenova/transformers` (`all-MiniLM-L6-v2`), we can ingest translated representations or employ a multilingual model in the pipeline.
    *   *Mechanism Details:* We parse legacy docs into Markdown, place them in `sources/`, and run `ingest_source`. The `context` tool indexes these documents.
    *   *What exists today:* `context` tool with `hybrid` search, local FTS5, and embeddings.
    *   *What's new:* A pre-ingestion pipeline for Excel to Markdown conversion, and either utilizing an LLM at ingestion to translate Japanese to English before storing in the Wiki layer (`.docuflow/wiki/`), or using a multilingual embedding model instead of `all-MiniLM-L6-v2` for the `context` vector map.

*   **Scenario 2: Creators/developers gone.**
    *   **Current State:** Lost tribal knowledge makes interpreting remaining code and docs difficult.
    *   **Docuflow Mechanism:** Q&A over org docs. By using `query_wiki`, which orchestrates `wiki_search` (BM25) and `synthesize_answer`, developers can ask questions like "Why was this component built this way?" and receive answers synthesized directly from historical design documents that were ingested. The `context` tool acts as a semantic fallback for concept matching even when exact terms aren't known.
    *   *What exists today:* `query_wiki`, `wiki_search`, and `answer_synthesis`.
    *   *What's new:* No new core MCP tools needed; just specific prompt/schema tuning (`schema.md`) focused on architectural archaeology.

*   **Scenario 3: Slow, human-centric customer explanations.**
    *   **Current State:** Walking customers through the software requires manual, time-consuming human effort.
    *   **Docuflow Mechanism:** Code ↔ Doc drift detection and automatic explainer generation. Using `list_modules` and `read_module` to extract real-time project facts, `docuflow` can compare implementation to the `.docuflow/wiki/` specifications using `lint_wiki`. We can then use `query_wiki` as an automated product explainer, capable of synthesizing tailored, up-to-date responses for customers based on current code truths.
    *   *What exists today:* `list_modules`, `read_module`, `lint_wiki`.
    *   *What's new:* A specialized "Customer Q&A" workflow or UI view that restricts synthesis to a "Customer-Safe" category in the LLM Wiki.

*   **Scenario 4: Hard-to-version customer manuals.**
    *   **Current State:** Keeping manuals in sync with software releases is painful.
    *   **Docuflow Mechanism:** Generate versioned customer manuals directly from the LLM Wiki. At release time, a CI/CD job can use `query_wiki` to synthesize comprehensive manuals from the `wiki/` layer, versioned alongside the code.
    *   *What exists today:* `query_wiki` and `synthesize_answer`.
    *   *What's new:* A batch synthesis script (or a new MCP tool `generate_manual`) that aggregates multiple synthesis queries into a single exportable artifact (e.g., PDF or standalone Markdown).

## 2. MVP Cut

**Goal:** The smallest slice applicable to ONE real scenario within a few weeks.
**Focus:** Scenario 1 & 2 (Legacy Japanese Docs + Lost Knowledge).

**In Scope for MVP:**
- Export 2-3 key legacy Japanese design documents (including an Excel sheet converted to CSV/Markdown) to `.docuflow/sources/`.
- Translate these documents into English manually or via a basic script before ingestion.
- Run `docuflow ingest` to generate the `.docuflow/wiki/` pages.
- Utilize the existing `query_wiki` and `context` tools to answer questions about the system from an English speaker's perspective.

**OUT of Scope for MVP:**
- Automated Excel file parsing (users must provide Markdown or CSV).
- Real-time or fully automated JP↔EN translation within the MCP server.
- Switching out `@xenova/transformers` (`all-MiniLM-L6-v2`) for a new multilingual embedding model.
- Customer-facing manual generation.

## 3. "USED" Definition

**Definition:** The owner (shaiful) successfully relies on Docuflow to understand an undocumented or legacy subsystem without asking the original author or a Japanese-speaking colleague.
**Concrete Metric:**
- 5 real workplace legacy documents are ingested.
- The owner performs at least 3 queries via the AI agent (e.g., Claude) using the `query_wiki` or `context` tools to retrieve specific design constraints or decisions.
- The retrieved information directly enables the completion of a real engineering task (e.g., a bug fix or feature addition) on that subsystem.
**Timeframe:** Within 3 weeks from the start of implementation.

## 4. RESOLVED Forks (by shaiful, 2026-07-16)

*   **(a) Internal workplace tool vs. eventual public product:**
    *   **Decision: Strictly an internal workplace tool.** The MVP can rely on manual conversions/scripts.
*   **(b) Japanese-first vs. bilingual-first design:**
    *   **Decision: Bilingual-first.** Pays translation cost upfront at ingestion for maximum accessibility.
*   **(c) On-premises / local-model inference vs. cloud APIs:**
    *   **Decision: Fully local on-prem inference only.** Guarantees zero data leakage but sacrifices some reasoning/speed.
*   **(d) G2 Validation:**
    *   **Decision: GO.** Explicit approval granted to proceed with real documents under strict confidentiality.

## 5. Risks + Open Questions

- **Confidentiality Boundary:** This spec must not contain any real workplace documents, names, or code snippets. All testing of the MVP must occur securely within the owner's local, approved environment.
- **Embedding Language Mismatch:** The current `context` tool uses `all-MiniLM-L6-v2`, which is primarily trained on English. If Japanese text is embedded directly, semantic matching will be poor. Does the org have an approved local translation service, or must we swap the local embedding model?
- **LLM Context Window:** Legacy documents can be massive. Can the local or approved API models handle the context required for high-quality ingestion and synthesis without hallucinating?
