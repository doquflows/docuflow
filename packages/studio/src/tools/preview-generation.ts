import path from "node:path";
import fsp from "node:fs/promises";
import fs from "node:fs";

interface GenerationPreview {
  tool_name: string;
  tool_description: string;
  input_provided: Record<string, any>;
  predicted_actions: string[];
  predicted_outputs: Array<{
    type: string;
    description: string;
    example: string;
  }>;
  data_modified: boolean;
  files_affected: string[];
  estimated_impact: "low" | "medium" | "high";
  proceed_recommendation: string;
}

async function countWikiPages(wikiDir: string): Promise<number> {
  let total = 0;
  for (const cat of ["entities", "concepts", "timelines", "syntheses"]) {
    try {
      const files = await fsp.readdir(path.join(wikiDir, cat));
      total += files.filter((f) => f.endsWith(".md")).length;
    } catch {
      // directory may not exist
    }
  }
  return total;
}

async function getSourceFileSize(sourcesDir: string, filename: string): Promise<number> {
  try {
    const stat = await fsp.stat(path.join(sourcesDir, filename));
    return stat.size;
  } catch {
    return 0;
  }
}

function predictPageCount(fileSizeBytes: number): string {
  // Rough heuristic: ~1 wiki page per 800 bytes of source
  const low = Math.max(1, Math.floor(fileSizeBytes / 1200));
  const high = Math.max(2, Math.ceil(fileSizeBytes / 600));
  return `${low}–${high}`;
}

/**
 * preview_generation
 *
 * Shows what a tool will generate before it actually runs.
 * Removes black-box feeling by providing transparency.
 *
 * Input:
 * - tool_name: string (the tool you want to run)
 * - project_path: string
 * - params: Record<string, any> (the parameters you'd pass to the tool)
 *
 * Output:
 * - Predicted actions and outputs
 * - Files that will be affected
 * - Impact level (low/medium/high)
 * - Recommendation on whether to proceed
 */
export async function previewGeneration(input: {
  tool_name: string;
  project_path: string;
  params: Record<string, any>;
}): Promise<GenerationPreview> {
  const projectPath = path.resolve(input.project_path);
  const docuDir = path.join(projectPath, ".docuflow");
  const wikiDir = path.join(docuDir, "wiki");
  const sourcesDir = path.join(docuDir, "sources");
  const toolName = input.tool_name;
  const params = input.params;

  // Read real wiki state upfront
  const existingPageCount = await countWikiPages(wikiDir);

  if (toolName === "ingest_source") {
    const filename: string = params.source_filename ?? "";
    const fileSize = await getSourceFileSize(sourcesDir, filename);
    const predictedNew = predictPageCount(fileSize);
    const sizeLabel = fileSize > 0 ? `${Math.round(fileSize / 1024)}KB` : "unknown size";

    return {
      tool_name: "ingest_source",
      tool_description: "Process a new source and integrate it into the wiki",
      input_provided: params,
      predicted_actions: [
        `✓ Read ${filename} (${sizeLabel})`,
        "✓ Extract entities and concepts from markdown",
        "✓ Generate wiki pages (one per entity/concept found)",
        "✓ Create cross-references between pages",
        "✓ Update index.md with new entries",
        "✓ Append entry to log.md",
      ],
      predicted_outputs: [
        {
          type: "Wiki Pages",
          description: `Estimated ${predictedNew} new pages (wiki currently has ${existingPageCount})`,
          example: "entities/ServiceName.md, concepts/Pattern.md, syntheses/source_name.md",
        },
        {
          type: "Index Update",
          description: "index.md gets new page entries with metadata",
          example: "index.md entry with source, date, page count",
        },
        {
          type: "Log Entry",
          description: "log.md records this ingest",
          example: `[${new Date().toISOString().slice(0, 10)}] ingest | ${filename} → N pages created`,
        },
      ],
      data_modified: true,
      files_affected: [
        ".docuflow/wiki/entities/*.md",
        ".docuflow/wiki/concepts/*.md",
        ".docuflow/wiki/syntheses/*.md",
        ".docuflow/index.md",
        ".docuflow/log.md",
      ],
      estimated_impact: "high",
      proceed_recommendation:
        "✓ Safe to proceed. Source will be integrated and wiki will grow. This is expected behavior.",
    };
  }

  if (toolName === "query_wiki") {
    return {
      tool_name: "query_wiki",
      tool_description: "Search and synthesize answers from the wiki",
      input_provided: params,
      predicted_actions: [
        "✓ Search index.md for relevant pages",
        "✓ Read matching wiki pages",
        "✓ Synthesize answer with citations",
        "✓ Return answer with source pages",
      ],
      predicted_outputs: [
        {
          type: "Answer",
          description: `Synthesized answer from up to ${existingPageCount} wiki pages`,
          example: "The system uses MCP protocol to communicate with tools...",
        },
        {
          type: "Source Pages",
          description: "Wiki pages used to create the answer",
          example: "concepts/MCP_Protocol.md, entities/Server.md",
        },
        {
          type: "Confidence",
          description: "How well the question was answered (0-100)",
          example: existingPageCount > 10 ? "85 (good coverage)" : "50 (sparse wiki — add more sources)",
        },
      ],
      data_modified: false,
      files_affected: [],
      estimated_impact: "low",
      proceed_recommendation:
        existingPageCount === 0
          ? "⚠ Wiki is empty — ingest sources first for useful answers."
          : "✓ Safe to proceed. This is a read-only operation. No wiki data will be changed.",
    };
  }

  if (toolName === "lint_wiki") {
    return {
      tool_name: "lint_wiki",
      tool_description: "Health check the wiki for issues",
      input_provided: params,
      predicted_actions: [
        "✓ Scan for orphan pages (no incoming links)",
        "✓ Find stale pages (30+ days old)",
        "✓ Check for broken cross-references",
        "✓ Detect contradictions in content",
        "✓ Look for metadata gaps",
        "✓ Calculate overall health score",
      ],
      predicted_outputs: [
        {
          type: "Issues",
          description: `Scanning ${existingPageCount} wiki pages for problems`,
          example: "N orphan pages, N stale (>30 days), N broken references",
        },
        {
          type: "Health Score",
          description: "Overall wiki health (0-100)",
          example: existingPageCount > 0 ? "Score will vary — run to find out" : "N/A (no pages yet)",
        },
        {
          type: "Recommendations",
          description: "Actionable suggestions to improve wiki",
          example: "Delete orphans, update stale pages, add missing cross-refs",
        },
      ],
      data_modified: false,
      files_affected: [],
      estimated_impact: "low",
      proceed_recommendation:
        existingPageCount === 0
          ? "⚠ Wiki is empty — nothing to lint yet. Ingest sources first."
          : "✓ Safe to proceed. This is a read-only diagnostic. It will report issues but not fix them.",
    };
  }

  if (toolName === "save_answer_as_page") {
    return {
      tool_name: "save_answer_as_page",
      tool_description: "Save an answer as a new wiki page (enables knowledge compounding)",
      input_provided: params,
      predicted_actions: [
        "✓ Format the answer as markdown with frontmatter",
        "✓ Place in appropriate category (synthesis or concept)",
        "✓ Update index.md with new page",
        "✓ Add log entry",
      ],
      predicted_outputs: [
        {
          type: "New Wiki Page",
          description: `New markdown file — wiki will have ${existingPageCount + 1} pages`,
          example: ".docuflow/wiki/syntheses/query_result_<date>.md",
        },
        {
          type: "Metadata",
          description: "YAML frontmatter with creation date, tags, sources",
          example: `created_at: ${new Date().toISOString().slice(0, 10)}, tags: [synthesis]`,
        },
      ],
      data_modified: true,
      files_affected: [
        ".docuflow/wiki/syntheses/*.md or concepts/*.md",
        ".docuflow/index.md",
        ".docuflow/log.md",
      ],
      estimated_impact: "medium",
      proceed_recommendation:
        "✓ This compounds knowledge in your wiki! Proceed to file interesting discoveries.",
    };
  }

  // Unknown tool fallback
  return {
    tool_name: toolName,
    tool_description: "Unknown tool",
    input_provided: params,
    predicted_actions: ["❌ Tool not found"],
    predicted_outputs: [],
    data_modified: false,
    files_affected: [],
    estimated_impact: "low",
    proceed_recommendation:
      "❌ Unknown tool. Check tool name and try again.",
  };
}
