/**
 * docuflow sync
 *
 * One-shot synchronisation — re-ingests all sources, rebuilds the index,
 * and runs a lint health check. Designed for CI/CD pipelines and git hooks.
 *
 * Usage:
 *   docuflow sync                        # sync all sources, rebuild index, lint
 *   docuflow sync --ai                   # also call Claude/Codex for changed code
 *   docuflow sync --since-commit HEAD~1  # only process files changed in last commit
 *   docuflow sync --source myfile.md     # sync a single source file
 *   docuflow sync --no-lint              # skip health check (faster for CI)
 *
 * Exit codes:
 *   0 — success, wiki is healthy (score ≥ 70)
 *   1 — wiki has issues (score < 70) — use to fail CI
 *   2 — fatal error (server tools not found, .docuflow missing)
 */

import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { execSync, spawnSync } from "node:child_process";
import os from "node:os";
import { detectBridge, AIBridge } from "./watch";

// ─── Colour helpers ────────────────────────────────────────────────────────────
const c = {
  green: (s: string) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s: string) => `\x1b[33m${s}\x1b[0m`,
  red: (s: string) => `\x1b[31m${s}\x1b[0m`,
  cyan: (s: string) => `\x1b[36m${s}\x1b[0m`,
  dim: (s: string) => `\x1b[2m${s}\x1b[0m`,
  bold: (s: string) => `\x1b[1m${s}\x1b[0m`,
};

// ─── Dynamic server tool loader ────────────────────────────────────────────────
function loadServerTool(toolFile: string): any {
  const candidates = [
    // v2.0 — 4 core tools live in @doquflow/core
    () => require(`@doquflow/core/dist/tools/${toolFile}`),
    () => require(path.resolve(__dirname, "../../../core/dist/tools", toolFile)),
    () => require(path.resolve(__dirname, "../../core/dist/tools", toolFile)),
    // v2.0 — 11 advanced tools live in @doquflow/studio
    () => require(`@doquflow/studio/dist/tools/${toolFile}`),
    () => require(path.resolve(__dirname, "../../../studio/dist/tools", toolFile)),
    () => require(path.resolve(__dirname, "../../studio/dist/tools", toolFile)),
  ];
  for (const attempt of candidates) {
    try { return attempt(); } catch {}
  }
  throw new Error(`Cannot load server tool "${toolFile}". Run "npm run build" first.`);
}

// ─── Git helpers ───────────────────────────────────────────────────────────────

/**
 * Get list of source files changed since a given git ref.
 * Returns paths relative to projectPath.
 */
function getGitChangedFiles(projectPath: string, sinceRef: string): string[] {
  try {
    const output = execSync(`git diff --name-only ${sinceRef} HEAD`, {
      cwd: projectPath,
      encoding: "utf8",
    }).trim();
    return output ? output.split("\n").filter(Boolean) : [];
  } catch {
    return [];
  }
}

/**
 * Get files staged in the current commit (for post-commit hook use).
 */
function getLastCommitFiles(projectPath: string): string[] {
  try {
    const output = execSync("git diff-tree --no-commit-id -r --name-only HEAD", {
      cwd: projectPath,
      encoding: "utf8",
    }).trim();
    return output ? output.split("\n").filter(Boolean) : [];
  } catch {
    return [];
  }
}

// ─── AI bridge for sync (uses watch.ts bridges) ───────────────────────────────

function buildSyncPrompt(projectPath: string, changedFiles: string[]): string {
  const fileList = changedFiles.length > 0
    ? changedFiles.slice(0, 10).map(f => `- ${f}`).join("\n")
    : "(full sync — no specific changed files)";
  return [
    `You are the DocuFlow wiki maintainer for: ${projectPath}`,
    ``,
    `Files recently committed/changed:`,
    fileList,
    ``,
    `Use docuflow MCP tools in order:`,
    `1. list_wiki({ project_path: "${projectPath}" }) — note page count`,
    `2. ingest_source for each .docuflow/sources/ file relevant to the changes`,
    `   (if unsure, ingest all source files)`,
    `3. update_index({ project_path: "${projectPath}" })`,
    `4. lint_wiki({ project_path: "${projectPath}", check_type: "all" })`,
    `5. Report: pages before/after, health score, high-severity issues.`,
    ``,
    `Be concise. Just execute and report.`,
  ].join("\n");
}

/**
 * Run Copilot CLI — directly calls DocuFlow MCP tools.
 * Returns the assistant's text response or null.
 */
function runCopilotSync(prompt: string): string | null {
  const result = spawnSync(
    "copilot",
    ["--prompt", prompt, "--allow-all-tools", "--allow-all-paths", "--no-ask-user", "--output-format", "json"],
    { encoding: "utf8", timeout: 180_000 }
  );
  if (result.error || result.status !== 0) return null;
  let lastMessage: string | null = null;
  for (const line of (result.stdout ?? "").split("\n")) {
    try {
      const obj = JSON.parse(line.trim());
      if (obj.type === "assistant.message" && obj.data?.content) lastMessage = obj.data.content;
    } catch {}
  }
  return lastMessage;
}

/**
 * Run Claude CLI — directly calls DocuFlow MCP tools.
 * Pass allowDangerousPermissions=true (via --allow-dangerous-permissions CLI flag)
 * to skip interactive permission prompts for non-interactive use.
 * Without it Claude CLI may prompt for tool access and time out in a daemon context.
 * Injects docuflow MCP config explicitly via --mcp-config.
 */
function runClaudeSync(prompt: string, projectPath: string, allowDangerousPermissions = false): string | null {
  // Build the MCP config pointing to the local server binary
  let serverBin: string;
  try {
    serverBin = require.resolve("@doquflow/studio/dist/mcp/index.js");
  } catch {
    serverBin = path.resolve(__dirname, "../../studio/dist/mcp/index.js");
  }
  const mcpConfig = JSON.stringify({
    mcpServers: {
      docuflow: { type: "stdio", command: process.execPath, args: [serverBin] }
    }
  });

  const env: Record<string, string> = { ...process.env as any };
  const claudeArgs = ["--print", "--mcp-config", mcpConfig];
  if (allowDangerousPermissions) {
    claudeArgs.splice(1, 0, "--dangerously-skip-permissions");
  }

  const result = spawnSync(
    "claude",
    claudeArgs,
    { input: prompt, encoding: "utf8", timeout: 180_000, env }
  );

  const stdout = result.stdout?.trim() ?? "";
  // Filter out Claude auth errors
  if (!stdout || stdout.includes("Invalid API key") || stdout.includes("authentication")) return null;
  return stdout || null;
}

/**
 * Fallback for codex/api: generate markdown doc from changed files, then ingest.
 */
async function generateAndIngest(
  projectPath: string,
  changedFiles: string[],
  bridge: string,
  info: (msg: string) => void
): Promise<void> {
  const fileList = changedFiles.map(f => `- ${f}`).join("\n");
  const prompt = [
    `You are maintaining documentation for a software project.`,
    `These files changed:\n${fileList}`,
    ``,
    `Write a concise markdown document (200-500 words) capturing what changed.`,
    `Markdown only. Start with # heading. No preamble.`,
  ].join("\n");

  let docContent: string | null = null;
  if (bridge === "codex") {
    const r = spawnSync("codex", [prompt], { encoding: "utf8", timeout: 90_000 });
    docContent = r.status === 0 ? r.stdout?.trim() ?? null : null;
  } else if (bridge === "api" && process.env.ANTHROPIC_API_KEY) {
    const https = require("https");
    const body = JSON.stringify({ model: "claude-3-5-haiku-20241022", max_tokens: 1024, messages: [{ role: "user", content: prompt }] });
    docContent = await new Promise((resolve) => {
      const req = https.request({ hostname: "api.anthropic.com", path: "/v1/messages", method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": process.env.ANTHROPIC_API_KEY!, "anthropic-version": "2023-06-01", "Content-Length": Buffer.byteLength(body) } },
        (res: any) => { let d = ""; res.on("data", (ch: Buffer) => d += ch); res.on("end", () => { try { resolve(JSON.parse(d)?.content?.[0]?.text ?? null); } catch { resolve(null); } }); });
      req.on("error", () => resolve(null)); req.setTimeout(90_000, () => { req.destroy(); resolve(null); }); req.write(body); req.end();
    });
  }

  if (!docContent) { info("  ⚠  AI returned no content — skipping AI doc generation"); return; }

  const sourcesDir = path.join(projectPath, ".docuflow", "sources");
  await fsp.mkdir(sourcesDir, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const autoFilename = `auto_sync_${timestamp}.md`;
  await fsp.writeFile(path.join(sourcesDir, autoFilename), docContent, "utf8");
  info(`  ✅ AI doc saved → ${autoFilename}`);
}

// ─── Sync logic ────────────────────────────────────────────────────────────────

export interface SyncOptions {
  projectPath?: string;
  ai?: boolean;
  forceCopilot?: boolean;    // force @github/copilot CLI
  forceClaude?: boolean;     // force Claude Code CLI
  forceCodex?: boolean;      // force Codex CLI
  sinceCommit?: string;
  sourceFile?: string;
  noLint?: boolean;
  failOnScore?: number;
  quiet?: boolean;
  allowDangerousPermissions?: boolean;  // pass --dangerously-skip-permissions to Claude CLI
}

export async function run(options: SyncOptions = {}): Promise<void> {
  const projectPath = path.resolve(options.projectPath ?? process.cwd());
  const docuDir = path.join(projectPath, ".docuflow");
  const sourcesDir = path.join(docuDir, "sources");
  const quiet = options.quiet ?? false;
  const failThreshold = options.failOnScore ?? 70;

  function info(msg: string) {
    if (!quiet) console.log(msg);
  }

  if (!fs.existsSync(docuDir)) {
    console.error(c.red(`  ✗ .docuflow/ not found at ${projectPath}`));
    console.error(`    Run "docuflow init" first.`);
    process.exit(2);
  }

  info(c.bold("\n  🔄 DocuFlow Sync\n"));
  const startTime = Date.now();
  let skipManualSync = false;  // set true when Copilot/Claude handle everything

  // ── Step 1: Determine which source files to process ─────────────────────────
  let sourceFilesToProcess: string[] = [];

  if (options.sourceFile) {
    // Single file mode
    sourceFilesToProcess = [options.sourceFile];
    info(`  📄 Single file mode: ${c.cyan(options.sourceFile)}`);
  } else {
    // Scan all .md files in sources/
    try {
      const all = await fsp.readdir(sourcesDir);
      sourceFilesToProcess = all.filter((f) => f.endsWith(".md"));
    } catch {
      info(c.yellow(`  ⚠  No sources/ directory found — nothing to ingest`));
      sourceFilesToProcess = [];
    }
    info(`  📚 Found ${sourceFilesToProcess.length} source file(s) to ingest`);
  }

  // ── Step 2: AI-powered sync for code changes ─────────────────────────────
  if (options.ai) {
    const codeExts = /\.(ts|tsx|js|jsx|mjs|py|go|rb|java|cs|php|rs|kt|swift)$/;
    const changedCodeFiles = options.sinceCommit
      ? getGitChangedFiles(projectPath, options.sinceCommit).filter(f => !f.startsWith(".docuflow") && codeExts.test(f))
      : getLastCommitFiles(projectPath).filter(f => !f.startsWith(".docuflow") && codeExts.test(f));

    const bridge = detectBridge({ useAI: true, forceCopilot: options.forceCopilot, forceClaude: options.forceClaude, forceCodex: options.forceCodex });
    const sinceLabel = options.sinceCommit ?? "last commit";

    if (changedCodeFiles.length > 0) {
      info(`\n  🤖 ${changedCodeFiles.length} code file(s) changed (${sinceLabel})`);
      for (const f of changedCodeFiles.slice(0, 5)) info(c.dim(`     ${f}`));

      if (bridge === "copilot") {
        info(`  ⚡ Copilot will directly call DocuFlow MCP tools (ingest + index + lint)...`);
        const prompt = buildSyncPrompt(projectPath, changedCodeFiles);
        const result = runCopilotSync(prompt);
        if (result) {
          info(c.green(`  ✅ Copilot completed wiki sync via MCP tools`));
          info(c.dim(`     ${result.replace(/\n/g, "\n     ")}`));
          // Copilot handled everything — skip manual steps below
          skipManualSync = true;
        } else {
          info(c.yellow(`  ⚠  Copilot returned no result — continuing with direct sync`));
        }
      } else if (bridge === "claude") {
        info(`  ⚡ Claude will directly call DocuFlow MCP tools (ingest + index + lint)...`);
        const prompt = buildSyncPrompt(projectPath, changedCodeFiles);
        const result = runClaudeSync(prompt, projectPath, options.allowDangerousPermissions);
        if (result) {
          info(c.green(`  ✅ Claude completed wiki sync via MCP tools`));
          info(c.dim(`     ${result.replace(/\n/g, "\n     ")}`));
          skipManualSync = true;
        } else {
          info(c.yellow(`  ⚠  Claude returned no result — continuing with direct sync`));
        }
      } else if (bridge !== "none") {
        // codex or api: generate doc → add to sources
        await generateAndIngest(projectPath, changedCodeFiles, bridge, info);
        const sourcesAgain = await fsp.readdir(sourcesDir).catch(() => [] as string[]);
        sourceFilesToProcess = sourcesAgain.filter(f => f.endsWith(".md"));
      }
    } else {
      info(c.dim(`  No code files changed since ${sinceLabel}`));
    }
  }

  // ── Step 3: Ingest + Step 4: Rebuild (skip if Copilot/Claude handled via MCP) ──
  let totalPagesCreated = 0;
  let ingestErrors = 0;

  if (!skipManualSync) {
    const { ingestSource } = loadServerTool("ingest-source");
    const { updateIndex }  = loadServerTool("update-index");

    if (sourceFilesToProcess.length > 0) {
      info(`\n  📥 Ingesting sources...`);
    }
    for (const filename of sourceFilesToProcess) {
      try {
        const result = await ingestSource({ project_path: projectPath, source_filename: filename });
        const created = result.pages_created?.length ?? 0;
        totalPagesCreated += created;
        info(`     ${created > 0 ? c.green("✓") : c.yellow("~")} ${filename} → ${created} page(s)`);
      } catch (e: any) {
        info(c.red(`     ✗ ${filename}: ${e.message}`));
        ingestErrors++;
      }
    }
    info(`\n  📋 Rebuilding index...`);
    const indexResult = await updateIndex({ project_path: projectPath });
    info(c.green(`  ✅ Index rebuilt — ${indexResult.entries_indexed} entries`));
  } else {
    info(c.dim(`  ℹ️  Ingest/index handled by Copilot/Claude via MCP tools directly`));
  }

  // ── Step 5: Lint ─────────────────────────────────────────────────────────────
  let healthScore = 100;

  if (!options.noLint) {
    info(`\n  🔍 Running wiki health check...`);
    const { lintWiki } = loadServerTool("lint-wiki");
    const lintResult = await lintWiki({ project_path: projectPath, check_type: "all" });

    healthScore = lintResult.health_score ?? 100;
    const scoreLabel =
      healthScore >= 90
        ? c.green(`${healthScore}/100`)
        : healthScore >= 70
        ? c.yellow(`${healthScore}/100`)
        : c.red(`${healthScore}/100`);

    info(`  📊 Wiki health: ${scoreLabel}`);

    if (lintResult.issues_found?.length > 0) {
      const high = lintResult.issues_found.filter((i: any) => i.severity === "high").length;
      const med  = lintResult.issues_found.filter((i: any) => i.severity === "medium").length;
      const low  = lintResult.issues_found.filter((i: any) => i.severity === "low").length;
      info(`     🔴 High: ${high}  🟡 Medium: ${med}  🟢 Low: ${low}`);
    }

    for (const rec of lintResult.recommendations?.slice(0, 3) ?? []) {
      info(c.dim(`     → ${rec}`));
    }
  }

  // ── Summary ──────────────────────────────────────────────────────────────────
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  info(`\n  ─────────────────────────────────────────────`);
  info(`  Sources processed:  ${sourceFilesToProcess.length}`);
  info(`  Pages created:      ${totalPagesCreated}`);
  info(`  Ingest errors:      ${ingestErrors > 0 ? c.red(String(ingestErrors)) : "0"}`);
  if (!options.noLint) {
    info(`  Health score:       ${healthScore}/100`);
  }
  info(`  Duration:           ${elapsed}s`);
  info(`  ─────────────────────────────────────────────\n`);

  // Exit with code 1 if health is below threshold (useful for CI)
  if (!options.noLint && healthScore < failThreshold) {
    process.exit(1);
  }
  if (ingestErrors > 0) {
    process.exit(1);
  }
}
