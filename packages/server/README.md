# @doquflow/server (DEPRECATED ALIAS)

This package was the original DocuFlow MCP server distribution.
In v2.0+ it is a thin alias that depends on `@doquflow/studio`.

## Why does this still exist?

Existing users have `@doquflow/server` registered in their `.mcp.json`
files. The DocuFlow project's commitment is **zero breakage** for
existing installs. This package will continue to install and run
identically through all v2.x releases.

## What you should install instead

- **Full surface** (UI, REST API, daemons, 15 MCP tools):
  `npm i -g @doquflow/studio`
- **Irreducible value pipe** (4 MCP tools, no daemon, no UI):
  `npm i -g @doquflow/core`
- **All-in-one CLI** (transitively pulls core + studio):
  `npm i -g @doquflow/cli`

## Migration

See [MIGRATION.md](../../MIGRATION.md) and [release/v2.0.0.md](../../release/v2.0.0.md).

Run `docuflow doctor` (v2.0+) for a personalized recommendation.

## Deprecation timeline

- v2.0 — alias maintained, no behavior change
- v2.x — alias maintained, no behavior change
- v3.0 — removal *considered* based on download stats. We will publish
  a clear deprecation notice at least one minor version before any
  removal.
