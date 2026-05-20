# @doquflow/studio

The advanced surface. 11 MCP tools, React web UI, Express REST API, and sync orchestration. Depends on `@doquflow/core` for the 4 fundamental tools — its MCP server registers all 15 by composing core + advanced.

## Install

```bash
npm i -g @doquflow/studio
```

Adds the `docuflow-studio` binary (MCP server, 15 tools). For just the 4 core tools, use `@doquflow/core`.

## Library usage

```ts
import { listModules, listWiki, lintWiki } from "@doquflow/studio/lib";
```

See [release/v2.0.0.md](../../release/v2.0.0.md) for the package-split context.
