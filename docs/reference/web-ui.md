# Web UI

The Docuflow web interface provides a live browser view of your wiki. It ships pre-built inside the npm package — no build step required.

## Starting the UI

```bash
docuflow ui              # start on http://localhost:48821
docuflow start           # alias
docuflow ui --port 3000  # custom port
docuflow ui --no-open    # don't auto-open browser
```

The server exposes both the API and the React SPA on a single port:

- `http://localhost:48821/api/*` — REST API routes
- `http://localhost:48821/*` — React SPA (client-side routing)

## Six views

### Ask

AI-powered Q&A interface. Type a question, get a synthesised answer with wiki source citations. Powered by the `query_wiki` MCP tool.

### Wiki

Live page browser with a category tree (Entities / Concepts / Timelines / Syntheses). Click any page to read the full content rendered as markdown.

### Graph

Interactive dependency graph built by `generate_dependency_graph`. Nodes are modules/services; edges are imports or shared resources. Zoom, pan, and click to explore. Force-directed layout with D3.

### Health

Wiki health dashboard powered by `lint_wiki`. Shows the 0–100 health score, orphan pages, stale content, broken references, and metadata gaps.

### Sync

Trigger a one-shot wiki sync from the browser. Shows the sync log in real time.

### Onboard

Guided first-run walkthrough. Explains the `.docuflow/` structure, shows how to add sources, and links to `docuflow suggest` output.

## API routes

The REST API is used by the UI and can also be called directly:

| Method | Route | Description |
|--------|-------|-------------|
| `GET` | `/api/ping` | Health check — returns `{"ok": true}` |
| `GET` | `/api/projects` | Auto-discover projects with `.docuflow/` |
| `GET` | `/api/project?path=…` | Project info and wiki stats |
| `GET` | `/api/wiki?path=…` | List all wiki pages |
| `GET` | `/api/wiki/:pageId?path=…` | Read a single wiki page |
| `GET` | `/api/health?path=…` | Run lint_wiki checks |
| `GET` | `/api/activity?path=…` | Recent wiki operations from `log.md` |
| `POST` | `/api/ask?path=…` | Ask a question (wraps query_wiki) |
| `GET` | `/api/search?path=…&q=…` | Search the wiki |
| `GET` | `/api/graph?path=…` | Generate dependency graph |

## Custom port

```bash
DOCUFLOW_PORT=3000 docuflow ui
```

!!! note
    The built-in React UI is compiled with `http://localhost:48821` hardcoded as the API base. Setting a custom port via `DOCUFLOW_PORT` affects the server; the SPA still sends requests to port 48821. Use the default port unless rebuilding the UI from source.

## Project auto-discovery

The UI scans common locations for `.docuflow/` directories:

- Current directory
- `~/Projects/`
- `~/dev/`
- `~/code/`
- `~/workspace/`

Switch between projects using the project selector dropdown in the top navigation bar.
