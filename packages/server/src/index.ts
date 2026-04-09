#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

import { readModule } from "./tools/read-module";
import { listModules } from "./tools/list-modules";
import { writeSpec } from "./tools/write-spec";
import { readSpecs } from "./tools/read-specs";

const server = new Server(
  { name: "docuflow", version: "0.1.0" },
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
