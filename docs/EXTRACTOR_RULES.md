# Entity Extractor Rules

DocuFlow's entity extractor applies 5 rules to every candidate before creating a wiki page.
Candidates come from two sources: markdown headings (`##`, `###`, `####`) and **bold text**.

## Rules (applied in order)

### Rule 1 — Stop-list rejection

The candidate's normalized form (lower-cased, non-alphanumeric stripped) must not appear in
the stop-list defined in `extractor-stoplist.ts`.

The stop-list covers:
- Generic quantifiers: `any`, `all`, `some`, `each`, `every`, `none`, `both`, ...
- Conjunctions / prepositions / filler: `the`, `and`, `or`, `for`, `with`, `from`, ...
- Modal / auxiliary verbs: `can`, `will`, `should`, `must`, `may`, ...
- Boolean / status tokens: `true`, `false`, `yes`, `no`, `ok`, `done`, `todo`
- Vague action words: `add`, `remove`, `update`, `fix`, `get`, `set`, ...
- Generic noun noise: `type`, `item`, `list`, `value`, `option`, `example`, `result`, ...

### Rule 2 — No emoji-only or punctuation-only slugs

The candidate name has emoji stripped then is converted to a slug (`[^a-z0-9] → _`).
If the result is empty or matches `/^[_-]+$/`, the candidate is rejected.

This catches entries like `🚀` or `---`.

### Rule 3 — Structural anchor (bold text only)

**Bold text candidates only** — the surrounding context (the line(s) containing the candidate)
must contain ≥ 4 words when leading bullet markers are stripped.

A bare bullet like `- **SomeThing**` with no prose is rejected.

Heading candidates always pass this rule (their structural position is the anchor).

### Rule 4 — Minimum token signal (bold text only)

**Bold text candidates only** — the name must satisfy at least one of:
- ≥ 2 words (`Entity Extractor`)
- 1 word with a non-sentence-start capital (`WikiCategory`, `ingestSource`)
- 1 word with a code-like separator: `_`, `-`, `()`, `::`, `.`

Heading candidates are exempt — their structural position grants authority regardless
of word count or capitalization.

### Rule 5 — Context requirement (bold text only)

**Bold text candidates only** — the surrounding context must contain at least 1 sentence
of ≥ 6 words (split on `.`, `!`, `?`).

A bold term floating in a short line with no prose gets rejected.

Heading candidates are exempt.

## Examples

| Candidate | Source | Verdict | Reason |
|-----------|--------|---------|--------|
| `WikiCategory` | heading | ✅ PASS | structural heading, not in stop-list |
| `ingest_source` | heading | ✅ PASS | has `_` separator |
| `LLM Wiki Pattern` | heading | ✅ PASS | multi-word |
| `DocuFlow` | bold | ✅ PASS | internal cap, long prose context |
| `true` | heading | ❌ FAIL | stop-list term |
| `any` | heading | ❌ FAIL | stop-list term |
| `🚀` | heading | ❌ FAIL | empty slug after emoji strip |
| `server` | bold | ❌ FAIL | single generic word, no code separator |
| `FooBar` | bold | ❌ FAIL (bare bullet) | bold in bare bullet, context word count < 4 |

## Implementation

- Stop-list: `packages/server/src/extractor-stoplist.ts`
- Rules: `packages/server/src/extractor-rules.ts` — `passesEntityRules(candidate)`
- Wired in: `packages/server/src/tools/ingest-source.ts` — `extractFromMarkdown()`
- Tests: `packages/server/src/__tests__/extractor-rules.test.ts` (27 cases)
