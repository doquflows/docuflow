#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

// 4 core tools from @doquflow/core
import { readModule, ingestSource, wikiSearch, queryWiki, synthesizeAnswer, detectDrift } from "@doquflow/core/lib";

// 11 advanced tools (local)
import { listModules } from "../tools/list-modules";
import { writeSpec } from "../tools/write-spec";
import { readSpecs } from "../tools/read-specs";
import { updateIndex } from "../tools/update-index";
import { listWiki } from "../tools/list-wiki";
import { saveAnswerAsPage } from "../tools/save-answer-as-page";
import { lintWiki } from "../tools/lint-wiki";
import { getSchemataGuidance } from "../tools/get-schema-guidance";
import { previewGeneration } from "../tools/preview-generation";
import { generateDependencyGraph } from "../tools/generate-dependency-graph";
import { getContext } from "../tools/context";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { version: serverVersion } = require("../../package.json") as { version: string };

const server = new Server(
  { name: "docuflow", version: serverVersion },
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
      name: "list_modules",
      description:
        "Walk a project directory and return extracted facts for every non-binary file. Skips node_modules, dist, build, .git, vendor, obj, bin, .docuflow, *.min.js, *.map, *.lock, and files >300KB. Raw content is omitted for bulk results.",
      inputSchema: {
        type: "object",
        properties: {
          path: { type: "string", description: "Root directory to scan." },
          extensions: {
            type: "array",
            items: { type: "string" },
            description: "Optional extension filter e.g. [\".cs\",\".ts\"]. If omitted all non-binary files are included.",
          },
        },
        required: ["path"],
      },
    },
    {
      name: "write_spec",
      description:
        "Write a markdown spec file to <project_path>/.docuflow/specs/<filename>.md and update the index. The agent provides the full markdown content.",
      inputSchema: {
        type: "object",
        properties: {
          project_path: { type: "string", description: "Root of the project (where .docuflow/ will be created)." },
          filename: { type: "string", description: "Name for the spec file, without extension." },
          content: { type: "string", description: "Full markdown content to write." },
        },
        required: ["project_path", "filename", "content"],
      },
    },
    {
      name: "read_specs",
      description:
        "Read previously written specs from <project_path>/.docuflow/specs/. Optionally filter by module name.",
      inputSchema: {
        type: "object",
        properties: {
          project_path: { type: "string", description: "Root of the project." },
          module_name: {
            type: "string",
            description: "Optional: name of a specific spec to retrieve (with or without .md).",
          },
        },
        required: ["project_path"],
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
      name: "update_index",
      description:
        "Scan all wiki pages in .docuflow/wiki/ and regenerate .docuflow/index.md organized by category. Appends operation to log.md.",
      inputSchema: {
        type: "object",
        properties: {
          project_path: { type: "string", description: "Root of the project." },
        },
        required: ["project_path"],
      },
    },
    {
      name: "list_wiki",
      description:
        "List all wiki pages in .docuflow/wiki/, optionally filtered by category. Returns metadata (title, created_at, sources, tags, stale) and page counts by category. Pages not updated in 30+ days are flagged stale:true.",
      inputSchema: {
        type: "object",
        properties: {
          project_path: { type: "string", description: "Root of the project." },
          category: {
            type: "string",
            enum: ["entity", "concept", "timeline", "synthesis"],
            description: "Optional: filter to a specific category.",
          },
        },
        required: ["project_path"],
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
          limit: {
            type: "number",
            description: "Optional: max results to return (default: 10).",
          },
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
      name: "synthesize_answer",
      description:
        "Generate a synthesis answer from multiple wiki pages. Extracts relevant sentences, key concepts, and builds a markdown answer with citations.",
      inputSchema: {
        type: "object",
        properties: {
          project_path: { type: "string", description: "Root of the project." },
          query: { type: "string", description: "The question being answered." },
          source_page_ids: {
            type: "array",
            items: { type: "string" },
            description: "List of wiki page IDs to synthesize from.",
          },
        },
        required: ["project_path", "query", "source_page_ids"],
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
          max_sources: {
            type: "number",
            description: "Optional: max source pages to use in synthesis (default: 5).",
          },
        },
        required: ["project_path", "question"],
      },
    },
    {
      name: "save_answer_as_page",
      description:
        "Save a generated answer as a new wiki page. Allows query results to compound back into the knowledge base, growing the wiki with new synthesis pages. Automatically adds frontmatter and updates log.md.",
      inputSchema: {
        type: "object",
        properties: {
          project_path: { type: "string", description: "Root of the project." },
          question: { type: "string", description: "The original question that was answered." },
          answer: { type: "string", description: "The markdown answer text to save." },
          page_title: { type: "string", description: "Title for the new page (e.g., 'How MCP Protocol Works')." },
          category: {
            type: "string",
            enum: ["synthesis", "entity", "concept", "timeline"],
            description: "Optional: wiki category for the page (default: synthesis).",
          },
          source_page_ids: {
            type: "array",
            items: { type: "string" },
            description: "Optional: list of source wiki page IDs used to generate this answer.",
          },
        },
        required: ["project_path", "question", "answer", "page_title"],
      },
    },
    {
      name: "lint_wiki",
      description:
        "Health check wiki for quality issues: orphan pages, broken references, stale content, metadata gaps, and contradictions. Returns issues found, metrics, health score, and recommendations.",
      inputSchema: {
        type: "object",
        properties: {
          project_path: { type: "string", description: "Root of the project." },
          check_type: {
            type: "string",
            enum: ["all", "orphans", "contradictions", "stale", "metadata"],
            description: "Optional: type of check to run (default: all).",
          },
        },
        required: ["project_path"],
      },
    },
    {
      name: "get_schema_guidance",
      description:
        "Analyze what documents should exist based on project schema and current wiki. Removes decision fatigue by suggesting what to create next.",
      inputSchema: {
        type: "object",
        properties: {
          project_path: { type: "string", description: "Root of the project." },
          domain: {
            type: "string",
            description: "Optional: domain hint (Code/Architecture, Research, Business, Personal). Auto-detected if not provided.",
          },
        },
        required: ["project_path"],
      },
    },
    {
      name: "preview_generation",
      description:
        "Preview what a tool will generate before running it. Removes black-box feeling by showing predicted actions, outputs, and impact.",
      inputSchema: {
        type: "object",
        properties: {
          tool_name: { type: "string", description: "Name of the tool to preview (e.g., ingest_source, query_wiki)." },
          project_path: { type: "string", description: "Root of the project." },
          params: { type: "object", description: "Parameters you would pass to that tool." },
        },
        required: ["tool_name", "project_path", "params"],
      },
    },
    {
      name: "generate_dependency_graph",
      description:
        "Scan a project and build a dependency graph showing how modules import each other, which DB tables are shared, and which files are most connected. Returns nodes, edges, shared tables, and the top 10 most-connected modules. Use this to understand coupling and identify risky files to change.",
      inputSchema: {
        type: "object",
        properties: {
          project_path: { type: "string", description: "Root directory of the project to analyse." },
          extensions: {
            type: "array",
            items: { type: "string" },
            description: "Optional extension filter e.g. [\".ts\",\".go\"]. If omitted, all non-binary files are scanned.",
          },
          focus: {
            type: "string",
            description: "Optional: filter graph to neighbours of a specific file or module name (partial match, e.g. 'user-service').",
          },
        },
        required: ["project_path"],
      },
    },
    {
      name: "context",
      description:
        "Context-as-a-Service tool. Persistent local SQLite index using FTS5 (lexical) and sqlite-vec (semantic) search. Use 'index' operation first, then 'query'. Supports lexical, semantic, and hybrid query modes.",
      inputSchema: {
        type: "object",
        properties: {
          operation: { type: "string", enum: ["index", "query"], description: "The operation to perform (default: query)." },
          directory: { type: "string", description: "Directory to index and search." },
          query: { type: "string", description: "The term or concept to search for (required for query)." },
          mode: { type: "string", enum: ["lexical", "semantic", "hybrid"], description: "Search mode (default: lexical). 'semantic' uses vector embeddings, 'hybrid' combines both." },
        },
        required: ["directory"],
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
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  try {
    let result: unknown;
    if (name === "read_module") {
      result = await readModule(args as { path: string });
    } else if (name === "list_modules") {
      result = await listModules(args as { path: string; extensions?: string[] });
    } else if (name === "write_spec") {
      result = await writeSpec(args as { project_path: string; filename: string; content: string });
    } else if (name === "read_specs") {
      result = await readSpecs(args as { project_path: string; module_name?: string });
    } else if (name === "ingest_source") {
      result = await ingestSource(args as { project_path: string; source_filename: string });
    } else if (name === "update_index") {
      result = await updateIndex(args as { project_path: string });
    } else if (name === "list_wiki") {
      result = await listWiki(args as { project_path: string; category?: "entity" | "concept" | "timeline" | "synthesis" });
    } else if (name === "wiki_search") {
      result = await wikiSearch(args as { project_path: string; query: string; limit?: number; category?: "entity" | "concept" | "timeline" | "synthesis" });
    } else if (name === "synthesize_answer") {
      result = await synthesizeAnswer(args as { project_path: string; query: string; source_page_ids: string[] });
    } else if (name === "query_wiki") {
      result = await queryWiki(args as { project_path: string; question: string; max_sources?: number });
    } else if (name === "save_answer_as_page") {
      result = await saveAnswerAsPage(args as { project_path: string; question: string; answer: string; page_title: string; category?: "synthesis" | "entity" | "concept" | "timeline"; source_page_ids?: string[] });
    } else if (name === "lint_wiki") {
      result = await lintWiki(args as { project_path: string; check_type?: "all" | "orphans" | "contradictions" | "stale" | "metadata" });
    } else if (name === "get_schema_guidance") {
      result = await getSchemataGuidance(args as { project_path: string; domain?: string });
    } else if (name === "preview_generation") {
      result = await previewGeneration(args as { tool_name: string; project_path: string; params: Record<string, any> });
    } else if (name === "generate_dependency_graph") {
      result = await generateDependencyGraph(args as { project_path: string; extensions?: string[]; focus?: string });
    } else if (name === "context") {
      result = await getContext(args as { operation?: "index" | "query"; directory: string; query?: string; mode?: "semantic" | "lexical" | "hybrid" });
    } else if (name === "detect_drift") {
      result = await detectDrift(args as { project_path: string; doc_path: string; source_paths: string[] });
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
  process.stderr.write(`DocuFlow MCP fatal error: ${e?.message ?? e}\n`);
  process.exit(1);
});
