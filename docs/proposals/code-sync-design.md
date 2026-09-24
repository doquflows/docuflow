# Code-to-Wiki Sync Loop Design

## 1. Where the loop closes
**Decision:** Inside the `watch` orchestrator.

**Why:** The `watch` orchestrator provides a deterministic, system-level guarantee. By driving `detect_drift` and `regenerate_doc` directly in the event loop, doc updates become a mechanical constraint rather than a requested behavior.

**Cost of rejected option:** If we merely updated the AI bridge instructions (keeping docuflow passive), safety becomes something the agent must "remember" to do. Under token pressure or due to model non-determinism, agents skip steps. A dropped step breaks the sync loop.

## 2. What a "code fact" is
A "code fact" is an assertion derived from a source file that serves as a load-bearing truth. Based on the citation gate, generated wiki content must remain grounded by citing claims. Code files will be treated as the ground truth. When `regenerate_doc` updates a document, it will enforce that any new assertion maps to a resolvable `CLAIM[code:<path>#<identifier>]` (e.g., `CLAIM[code:src/server.ts#init]`), preventing the agent from inventing undocumented capabilities.

## 3. Where it is enforced
The loop is enforced in the `codeWatcher` event handler within `packages/cli/src/commands/watch.ts`. When code changes are detected, `watch.ts` will directly invoke the drift detection and regeneration pipeline instead of dispatching a prompt to an external AI bridge.

## 4. Trust Boundary (Curated vs Extracted)
**Decision:** Code-derived claims will use a distinct namespace: `EXTRACT[code:<path>#<id>]` instead of the human-curated `CLAIM[<id>]`. 

**Why:** `.docuflow/sources/` is immutable and user-curated. Code-derived claims are machine-extracted. If they share the `CLAIM` namespace, the citation gate cannot distinguish their provenance, making auto-extracted claims look as authoritative as curated philosophy. By using `EXTRACT`, the citation gate and human readers can immediately identify the claim as an automated code extraction with lower trust than a curated source document. 

## 5. Staleness (Commit-bound Truth)
**Decision:** Extracted code claims are bound to the file hash they were extracted from. The claim definition will include `source-hash: <sha256>`.

**Why:** A code-derived claim is only true for the exact state of the code it was extracted from. When the code changes again, the previously extracted claim is immediately stale. The sync loop will compare the `source-hash` in the extracted claim against the current file hash. If it mismatches, the claim is instantly invalidated and purged by the watcher, breaking any wiki citations to it. This forces the wiki page to be regenerated against the newly extracted claims, preventing the wiki from accumulating confidently-cited claims about code that no longer exists.
