# Docuflow

**Lets AI agents read any codebase and write living specs that survive between sessions.**

## The problem

AI agents like Claude Code, Codex, and Copilot lose all context between sessions. Every time you start a new conversation, the agent has no memory of what a module does, what database tables it touches, or what will break if you change it. The team investigates from scratch every time.

## The solution

Docuflow is an MCP server that sits between your AI agent and your codebase. It reads files, extracts structured facts (classes, functions, endpoints, DB tables, dependencies), and lets agents write persistent markdown specs to `.docuflow/specs/` — a knowledge base that survives between sessions.

## Install

```bash
npx @doquflow/cli init
```

Or install globally:

```bash
npm install -g @doquflow/cli
docuflow init
```

This registers Docuflow in your Claude Desktop config and creates the `.docuflow/specs/` directory in your project.

## Tools

| Tool | What it does |
|------|-------------|
| `read_module` | Read one source file → extract classes, functions, dependencies, DB tables, endpoints, config refs + raw content (truncated 8 000 chars) |
| `list_modules` | Walk a project directory → bulk extraction for every non-binary file. Skips `node_modules`, `dist`, `.git`, etc. |
| `write_spec` | Write a markdown spec to `.docuflow/specs/<name>.md` and update the project index |
| `read_specs` | Read back saved specs; optionally filter by module name |

## Languages supported

TypeScript, JavaScript, Python, Go, Rust, Java, C#, PHP, Ruby, Kotlin, Swift, Angular, Vue, HTML, SQL, Shell, PowerShell, YAML, JSON, and more.

Unknown file types return `language: "unknown"` with full raw content — the server never fails on unfamiliar files.

## Requirements

- Node.js 18+
- Claude Desktop or any MCP-compatible agent

## No API keys. No network calls. No AI inside the server.

All intelligence stays in your agent. Docuflow is a pure filesystem tool — it reads files, runs regex, and writes markdown.

## License

MIT
