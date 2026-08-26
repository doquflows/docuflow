# MCP Tools Reference

Docuflow exposes **16 MCP tools** accessible from any MCP-compatible agent (Claude, VS Code Copilot, Cursor).

All tools share a common pattern: `project_path` points to the root of the project containing the `.docuflow/` directory.

---

## Core tools (4) — `@doquflow/core`

### `read_module`

Read a single source file and extract structured facts.

```json
{ "path": "/path/to/file.ts" }
```

**Returns:** classes, functions, dependencies, database tables, API endpoints, config references.

**Supports:** TypeScript, JavaScript, Python, Go, Ruby, Rust, Java, C#, PHP, Kotlin, Swift, Angular, Vue, SQL, Shell, YAML, JSON.

---

### `ingest_source`

Parse a markdown source document, extract entities and concepts, create wiki pages with context paragraphs.

```json
{
  "project_path": "/path/to/project",
  "source_filename": "design-doc.md"
}
```

**Returns:** source ID, summary, pages created/updated, entities discovered.

The source file must already exist in `.docuflow/sources/`.

---

### `wiki_search`

BM25-inspired full-text search across all wiki pages.

```json
{
  "project_path": "/path/to/project",
  "query": "authentication JWT",
  "limit": 10,
  "category": "concepts"
}
```

**Returns:** ranked results with relevance scores and snippets.

| Parameter | Required | Description |
|-----------|----------|-------------|
| `project_path` | ✅ | Project root |
| `query` | ✅ | Search query |
| `limit` | ❌ | Max results (default: 10) |
| `category` | ❌ | Filter to `entities`, `concepts`, `timelines`, or `syntheses` |

---

### `query_wiki`

Main Q&A interface. Searches the wiki and synthesises a markdown answer.

```json
{
  "project_path": "/path/to/project",
  "question": "How does the authentication flow work?",
  "max_sources": 5
}
```

**Returns:** question, synthesised answer (markdown), source page citations.

---

## Advanced tools (12) — `@doquflow/studio`

### `list_modules`

Walk a directory recursively and extract facts from all source files.

```json
{
  "path": "/path/to/src",
  "extensions": [".ts", ".py"]
}
```

**Returns:** all modules with `stale: boolean` per spec.

---

### `write_spec`

Write a markdown spec file to `.docuflow/specs/`.

```json
{
  "project_path": "/path/to/project",
  "filename": "auth-spec.md",
  "content": "# Auth Design\n..."
}
```

**Returns:** filepath, bytes written, index updated.

---

### `read_specs`

Query written spec files.

```json
{
  "project_path": "/path/to/project",
  "module_name": "auth"
}
```

**Returns:** all matching specs with `stale: boolean` per entry.

---

### `update_index`

Scan wiki pages and regenerate `index.md`.

```json
{ "project_path": "/path/to/project" }
```

**Returns:** entries indexed, log entry appended.

---

### `list_wiki`

Query wiki structure by category with staleness detection.

```json
{
  "project_path": "/path/to/project",
  "category": "entities"
}
```

**Returns:** total pages, breakdown by category, `stale: boolean` per page, `stale_pages` count.

---

### `answer_synthesis`

Build a markdown answer from a set of selected wiki pages.

```json
{
  "pages": ["entities/auth-service.md", "concepts/jwt-pattern.md"],
  "question": "How does token refresh work?"
}
```

**Returns:** synthesised answer markdown with citations.

---

### `save_answer_as_page`

Save a synthesised answer as a new wiki page.

```json
{
  "project_path": "/path/to/project",
  "title": "Token Refresh Flow",
  "content": "## Overview\n...",
  "source_page_ids": ["entities/auth-service"]
}
```

**Returns:** page ID, filepath, `saved_at` timestamp.

---

### `lint_wiki`

Health checks: orphan pages, broken references, stale content, metadata gaps, contradictions.

```json
{
  "project_path": "/path/to/project",
  "check_type": "all"
}
```

**Returns:** issues array, metrics, health score (0–100), recommendations.

| `check_type` value | What it checks |
|-------------------|---------------|
| `all` (default) | Everything |
| `orphans` | Pages with no incoming links |
| `stale` | Pages older than 30 days with no updates |
| `broken_refs` | Internal links pointing to missing pages |
| `metadata` | Pages missing frontmatter fields |

---

### `get_schema_guidance`

Analyse current wiki state and recommend what pages should exist given your domain.

```json
{ "project_path": "/path/to/project" }
```

**Returns:** domain, existing pages, recommended pages with reasons.

---

### `preview_generation`

Show what a tool will do before running it — reads real wiki state.

```json
{
  "tool_name": "ingest_source",
  "project_path": "/path/to/project",
  "params": { "source_filename": "new-design.md" }
}
```

**Returns:** predicted actions, expected output, impact level (`low`/`medium`/`high`), files affected.

---

### `generate_dependency_graph`

Build an import and shared-resource graph for a project.

```json
{
  "project_path": "/path/to/project",
  "focus": "src/auth",
  "extensions": [".ts"]
}
```

**Returns:** `nodes`, `edges`, `shared_tables`, `shared_endpoints`, `most_connected` (top-10 by degree).

---

### `context`

Persistent local SQLite FTS5 index for term/concept location.

```json
{
  "directory": "/path/to/project",
  "operation": "query",
  "query": "authentication"
}
```

**Returns:** Index status message or rank-ordered search matches with preview snippets.

| Parameter | Required | Description |
|-----------|----------|-------------|
| `directory` | ✅ | The directory to index or query |
| `operation` | ❌ | The operation to perform: `index` or `query` (default: `query`) |
| `query` | ❌ | The search term or concept (required when operation is `query`) |

---

## Usage in agents

In Claude or other MCP-compatible agents, tools are auto-discovered via the registration in `.mcp.json` or Claude Desktop config. Reference them by name:

```
Use query_wiki to find how the authentication module works.
```

```
Run ingest_source on the file I just dropped in .docuflow/sources/new-spec.md
```

```
Call lint_wiki and tell me the health score.
```
