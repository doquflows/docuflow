/**
 * docuflow query
 *
 * Calls query_wiki and renders the answer with citations.
 *
 * Usage:
 *   docuflow query "<question>"
 *   docuflow query "<question>" --max-sources 5
 *   docuflow query "<question>" --json
 *   docuflow query "<question>" --no-cite
 *   docuflow query "<question>" --save-as "<title>"
 *   docuflow query "<question>" --quiet
 *
 * Exit codes:
 *   0 — answer produced
 *   2 — fatal (.docuflow missing, server tool not found)
 *   3 — query produced no matching sources
 */

import fs from "node:fs";
import path from "node:path";

// ─── Colour helpers ────────────────────────────────────────────────────────────
const c = {
  green:  (s: string) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s: string) => `\x1b[33m${s}\x1b[0m`,
  red:    (s: string) => `\x1b[31m${s}\x1b[0m`,
  cyan:   (s: string) => `\x1b[36m${s}\x1b[0m`,
  dim:    (s: string) => `\x1b[2m${s}\x1b[0m`,
  bold:   (s: string) => `\x1b[1m${s}\x1b[0m`,
};

// ─── Dynamic server tool loader (mirrors rewiki.ts pattern) ───────────────────
function loadServerTool(toolFile: string): any {
  const candidates = [
    () => require(`@doquflow/core/dist/tools/${toolFile}`),
    () => require(path.resolve(__dirname, "../../../core/dist/tools", toolFile)),
    () => require(path.resolve(__dirname, "../../core/dist/tools", toolFile)),
    () => require(`@doquflow/studio/dist/tools/${toolFile}`),
    () => require(path.resolve(__dirname, "../../../studio/dist/tools", toolFile)),
    () => require(path.resolve(__dirname, "../../studio/dist/tools", toolFile)),
  ];
  for (const attempt of candidates) {
    try { return attempt(); } catch {}
  }
  throw new Error(`Cannot load server tool "${toolFile}". Run "npm run build" first.`);
}

// ─── Command options & entrypoint ─────────────────────────────────────────────

export interface QueryOptions {
  question: string;
  maxSources?: number;
  json?: boolean;
  noCite?: boolean;
  saveAs?: string;
  quiet?: boolean;
}

export async function run(options: QueryOptions): Promise<void> {
  const { question, maxSources = 5, json = false, noCite = false, saveAs, quiet = false } = options;

  const projectPath = path.resolve(process.cwd());
  const docuDir     = path.join(projectPath, ".docuflow");

  function info(msg: string) { if (!quiet) console.log(msg); }

  // ── Validate question ───────────────────────────────────────────────────────
  if (!question || question.trim() === "") {
    console.error(c.red("  ✗ Question is required."));
    console.error(`    Usage: docuflow query "<question>"`);
    process.exit(2);
  }

  // ── Pre-flight ──────────────────────────────────────────────────────────────
  if (!fs.existsSync(docuDir)) {
    console.error(c.red(`  ✗ .docuflow/ not found at ${projectPath}`));
    console.error(`    Run "docuflow init" first.`);
    process.exit(2);
  }

  // ── Load tools ──────────────────────────────────────────────────────────────
  let queryWiki: Function;
  let saveAnswerAsPage: Function | undefined;
  try {
    ({ queryWiki } = loadServerTool("query-wiki"));
    if (saveAs) {
      ({ saveAnswerAsPage } = loadServerTool("save-answer-as-page"));
    }
  } catch (e: any) {
    console.error(c.red(`  ✗ ${e.message}`));
    process.exit(2);
  }

  // ── Execute query ───────────────────────────────────────────────────────────
  info(c.dim(`  Searching wiki for: "${question}"`));

  let result: any;
  try {
    result = await queryWiki({ project_path: projectPath, question, max_sources: maxSources });
  } catch (e: any) {
    console.error(c.red(`  ✗ Query failed: ${e.message}`));
    process.exit(2);
  }

  if (result.error) {
    console.error(c.red(`  ✗ ${result.error}`));
    process.exit(2);
  }

  // ── No sources found ────────────────────────────────────────────────────────
  if (!result.source_pages || result.source_pages.length === 0) {
    if (!json) {
      console.error(c.yellow("  No matching sources found in the wiki."));
      console.error(`  Try running "docuflow rewiki" to rebuild the wiki first.`);
    }
    process.exit(3);
  }

  // ── Output ──────────────────────────────────────────────────────────────────
  if (json) {
    console.log(JSON.stringify({
      question:     result.question,
      answer:       result.answer,
      source_pages: result.source_pages,
      search_results: result.search_results,
      confidence:   result.confidence,
    }, null, 2));
  } else if (noCite) {
    console.log(result.answer);
  } else {
    console.log(result.answer);
    console.log("");
    console.log(c.bold("## Sources"));
    for (const page of result.source_pages) {
      console.log(`  - ${page.title} ${c.dim("(" + page.page_id + ")")}`);
    }
  }

  // ── Save ────────────────────────────────────────────────────────────────────
  if (saveAs && saveAnswerAsPage) {
    try {
      const saved = await saveAnswerAsPage({
        project_path:    projectPath,
        question,
        answer:          result.answer,
        page_title:      saveAs,
        source_page_ids: (result.source_pages ?? []).map((p: any) => p.page_id),
      });
      process.stderr.write(`page-id: ${saved?.page_id ?? saveAs}\n`);
    } catch (e: any) {
      process.stderr.write(c.red(`Warning: could not save page: ${e.message}\n`));
    }
  }
}
