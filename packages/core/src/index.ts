#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

import { readModule } from "./tools/read-module";
import { ingestSource } from "./tools/ingest-source";
import { wikiSearch } from "./tools/wiki-search";
import { queryWiki } from "./tools/query-wiki";
import { detectDrift } from "./tools/detect-drift";
import { queryProject } from "./tools/query_project";
import { regenerateDoc } from "./tools/regenerate-doc";

const server = new Server(
  { name: "docuflow-core", version: "2.0.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "read_module",
      description:
        "Read a single source file, detect its language, and extract classes, functions, dependencies, DB tables, endpoints, and config references. Returns raw content truncated at 8000 chars.",
      inputSchema: {
        type: "object",
        properties: {
          path: { type: "string", description: "Absolute or relative path to the source file." },
        },
        required: ["path"],
      },
    },
    {
      name: "ingest_source",
      description:
        "Ingest a markdown source document from .docuflow/sources/ and generate wiki pages (entities, concepts) with cross-references. Returns pages created and entities discovered.",
      inputSchema: {
        type: "object",
        properties: {
          project_path: { type: "string", description: "Root of the project." },
          source_filename: {
            type: "string",
            description: "Filename in .docuflow/sources/ to ingest (e.g., 'overview.md').",
          },
        },
        required: ["project_path", "source_filename"],
      },
    },
    {
      name: "wiki_search",
      description:
        "Search the wiki for pages matching a query using relevance scoring. Returns ranked results with preview snippets and matched terms. BM25-inspired ranking weights entity pages higher.",
      inputSchema: {
        type: "object",
        properties: {
          project_path: { type: "string", description: "Root of the project." },
          query: { type: "string", description: "Search query (e.g., 'MCP protocol design')." },
          limit: { type: "number", description: "Optional: max results to return (default: 10)." },
          category: {
            type: "string",
            enum: ["entity", "concept", "timeline", "synthesis"],
            description: "Optional: filter to a specific category.",
          },
        },
        required: ["project_path", "query"],
      },
    },
    {
      name: "query_wiki",
      description:
        "Ask a question against the wiki. Automatically searches for relevant pages, synthesizes an answer, and returns source pages with confidence score. One-stop tool for querying accumulated knowledge.",
      inputSchema: {
        type: "object",
        properties: {
          project_path: { type: "string", description: "Root of the project." },
          question: { type: "string", description: "The question to ask (e.g., 'How does the MCP protocol work?')." },
          max_sources: { type: "number", description: "Optional: max source pages to use in synthesis (default: 5)." },
        },
        required: ["project_path", "question"],
      },
    },
    {
      name: "detect_drift",
      description: "Compare a documentation page against its source code files to identify discrepancies, stale facts, or contradictions.",
      inputSchema: {
        type: "object",
        properties: {
          project_path: { type: "string", description: "Root of the project." },
          doc_path: { type: "string", description: "Path to the documentation page (e.g. .docuflow/sources/...)" },
          source_paths: { 
            type: "array", 
            items: { type: "string" },
            description: "List of source code paths to compare against." 
          },
        },
        required: ["project_path", "doc_path", "source_paths"],
      },
    },
    {
      name: "query_project",
      description:
        "Ask a question against both the wiki and the source code. Synthesizes an answer with specific citations from both docs and code files.",
      inputSchema: {
        type: "object",
        properties: {
          project_path: { type: "string", description: "Root of the project." },
          question: { type: "string", description: "The question to ask." },
          max_sources: { type: "number", description: "Optional: max source pages/files to use." },
        },
        required: ["project_path", "question"],
      },
    },
    {
      name: "regenerate_doc",
      description:
        "Rewrite a stale document so that its facts perfectly match the provided source code, while preserving original structure.",
      inputSchema: {
        type: "object",
        properties: {
          project_path: { type: "string", description: "Root of the project." },
          doc_path: { type: "string", description: "Path to the document to regenerate (e.g., docs/tables/users_table.md)." },
          code_paths: {
            type: "array",
            items: { type: "string" },
            description: "Paths to the source files that represent the truth (e.g., ['src/auth/user.ts']).",
          },
        },
        required: ["project_path", "doc_path", "code_paths"],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  try {
    let result: unknown;
    if (name === "read_module") {
      result = await readModule(args as { path: string });
    } else if (name === "ingest_source") {
      result = await ingestSource(args as { project_path: string; source_filename: string });
    } else if (name === "wiki_search") {
      result = await wikiSearch(args as { project_path: string; query: string; limit?: number; category?: "entity" | "concept" | "timeline" | "synthesis" });
    } else if (name === "query_wiki") {
      result = await queryWiki(args as { project_path: string; question: string; max_sources?: number });
    } else if (name === "detect_drift") {
      result = await detectDrift(args as { project_path: string; doc_path: string; source_paths: string[] });
    } else if (name === "query_project") {
      result = await queryProject(args as { project_path: string; question: string; max_sources?: number });
    } else if (name === "regenerate_doc") {
      result = await regenerateDoc(args as { project_path: string; doc_path: string; code_paths: string[] });
    } else {
      result = { error: `Unknown tool: ${name}` };
    }
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  } catch (e: any) {
    return { content: [{ type: "text", text: JSON.stringify({ error: e?.message ?? String(e) }) }] };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((e) => {
  process.stderr.write(`DocuFlow core MCP fatal error: ${e?.message ?? e}\n`);
  process.exit(1);
});
