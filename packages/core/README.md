# @doquflow/core

The irreducible value pipe. Four MCP tools plus the persistence substrate — extractor, filesystem helpers, and type definitions. Everything else in DocuFlow builds on this package.

## What's in here

- **4 MCP tools**: `ingest_source`, `query_wiki`, `wiki_search`, `read_module`
- **Extractor engine**: 6-rule entity extraction (stop-list, no-punctuation-slugs, structural anchors, min-token-signal, context requirement, section-heading suppression)
- **Filesystem helpers**: atomic writes, safe reads, directory traversal
- **Shared types**: `WikiPage`, `ModuleInfo`, and the full type surface

## Install

```bash
npm i -g @doquflow/core
```

Adds the `docuflow-core` binary (MCP server, 4 tools). For the full surface (11 additional tools, UI, REST API, daemons), use `@doquflow/studio` or `@doquflow/cli`.

## Library usage

```ts
import { ingestSource, queryWiki, wikiSearch, readModule } from "@doquflow/core/lib";
```

See [release/v2.0.0.md](../../release/v2.0.0.md) for the package-split context.
