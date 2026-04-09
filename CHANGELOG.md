# Changelog

All notable changes to Docuflow are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com)
Versioning follows [Semantic Versioning](https://semver.org)

---

## [0.1.0] — 2026-04-09

### First public release

#### Core MCP Tools
- `read_module` — Read one source file, extract classes, functions, dependencies,
  DB tables, endpoints, config refs, raw content (truncated 8 000 chars)
- `list_modules` — Walk a project directory, bulk-extract all non-binary files,
  return structured facts per file (no raw content for performance)
- `write_spec` — Write a markdown spec to `.docuflow/specs/<name>.md`,
  update the per-project index. Serialised per project to prevent race conditions.
- `read_specs` — Read saved specs back; optionally filter by module name

#### Language Support
TypeScript, JavaScript, Python, Go, Rust, Java, C#, PHP, Ruby, Kotlin, Swift,
Angular, Vue, HTML, SQL, Shell, PowerShell, YAML, JSON, and more.

#### Extraction Engine
Regex-based extraction for classes, interfaces, functions, dependencies,
database tables (SQL + Entity Framework), REST endpoints (.NET, Express, NestJS),
and config/environment references.

#### Developer Experience
- `npx @doquflow/cli init` — registers Docuflow MCP in Claude Desktop config
- `npx @doquflow/cli status` — shows spec count and registration state
- Zero AI calls inside the server — all intelligence stays in the agent
- No API keys, no network calls, no AI dependencies
