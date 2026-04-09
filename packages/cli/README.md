# @doquflow/cli

CLI for setting up Docuflow in your project. Registers the MCP server in Claude Desktop and scaffolds `.docuflow/specs/`.

## Usage

```bash
npx @doquflow/cli init
```

That's it. One command to:
- Register the `@doquflow/server` MCP server in your Claude Desktop config
- Create `.docuflow/specs/` in your current project
- Add `.docuflow/` to `.gitignore`

```bash
npx @doquflow/cli status
```

Shows how many specs are written and whether the MCP server is registered.

## How it works

After running `init`, open Claude Desktop and ask it to document your codebase:

```
Read the modules in src/ and write specs for each one.
```

Claude will call the Docuflow MCP tools to read your files and write living markdown specs to `.docuflow/specs/`. No API keys, no uploads, no AI inside the server.

## Requirements

- Node.js 18+
- Claude Desktop

## License

MIT — [github.com/doquflows/docuflow](https://github.com/doquflows/docuflow)
