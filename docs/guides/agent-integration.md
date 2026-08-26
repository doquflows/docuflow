# Agent Integration

Docuflow integrates with all major MCP-compatible AI agents. `docuflow init` handles registration automatically.

## Claude Desktop

`docuflow init` adds an entry to `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or the equivalent on Windows/Linux.

**Manual registration** (if needed):

```json
{
  "mcpServers": {
    "docuflow": {
      "command": "docuflow-studio",
      "args": [],
      "env": {}
    }
  }
}
```

Restart Claude Desktop after editing the config.

**Using Docuflow in Claude:**

`docuflow init` generates a `CLAUDE.md` file at your project root. Claude reads this automatically and knows which tools to use and when. You can also prompt directly:

```
Use query_wiki to find how authentication works in this project.
```

```
Run ingest_source on .docuflow/sources/new-design.md and summarise what you learned.
```

```
Check wiki health with lint_wiki and tell me what needs attention.
```

---

## VS Code + GitHub Copilot

`docuflow init` creates `.mcp.json` in your project root:

```json
{
  "servers": {
    "docuflow": {
      "type": "stdio",
      "command": "docuflow-studio",
      "args": []
    }
  }
}
```

Copilot CLI reads this automatically in the project directory. Tools are available with the `docuflow-` prefix:

```
docuflow-query_wiki, docuflow-ingest_source, docuflow-wiki_search, ...
```

---

## Cursor

`docuflow init` creates `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "docuflow": {
      "command": "docuflow-studio",
      "args": []
    }
  }
}
```

In Cursor's AI chat, reference tools by name or describe what you want:

```
Search the Docuflow wiki for the caching strategy.
```

---

## Checking registration

```bash
docuflow doctor
```

The doctor command reports:

- Installed package versions
- Which agents have Docuflow registered
- Whether `docuflow-studio` binary is resolvable
- Wiki health for any discovered projects

---

## Using the MCP tools

Once registered, you interact with Docuflow naturally in your AI agent. Common patterns:

### Before coding

```
Before I write this feature, check the wiki with query_wiki: "What are the existing patterns for database access?"
```

### After adding a document

```
I just dropped architecture-notes.md in .docuflow/sources/. Ingest it and tell me what new entities were discovered.
```

### Checking health

```
Run lint_wiki on this project and summarise any issues above severity medium.
```

### Getting suggestions

```
What does get_schema_guidance recommend for this project?
```

---

## Waymark security integration (optional)

[Waymark](https://github.com/shaifulshabuj/waymark) is a security policy enforcement layer for MCP-based AI agents. When Waymark is configured alongside Docuflow:

- File and shell operations go through Waymark for policy enforcement
- Sensitive paths (`.env`, secrets) are blocked automatically
- Dangerous commands (`rm -rf`, `sudo`) are blocked
- Sensitive operations require human approval via the Waymark dashboard
- Full audit trail of every AI action

See the [Waymark documentation](https://github.com/shaifulshabuj/waymark) for setup.
