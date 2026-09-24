/**
 * docuflow doctor
 *
 * Diagnostic command that reports installed DocuFlow packages, MCP server
 * registrations, detected workflow, and actionable recommendations.
 *
 * Usage:
 *   docuflow doctor            # human-readable report
 *   docuflow doctor --json     # machine-readable JSON
 *   docuflow doctor --quiet    # recommendations only
 */

import fs   from "node:fs";
import fsp  from "node:fs/promises";
import path from "node:path";
import os   from "node:os";

export interface DoctorOptions {
  json?:  boolean;
  quiet?: boolean;
}

// ── Package version resolution ────────────────────────────────────────────────

function resolvePackageVersion(pkgName: string): string | null {
  const candidates = [
    () => require.resolve(`${pkgName}/package.json`),
    () => path.resolve(__dirname, "../../../", pkgName.replace("@doquflow/", ""), "package.json"),
    () => path.resolve(__dirname, "../../",   pkgName.replace("@doquflow/", ""), "package.json"),
  ];
  for (const c of candidates) {
    try {
      const pkgPath = c();
      const raw = fs.readFileSync(pkgPath, "utf8");
      return (JSON.parse(raw) as { version: string }).version;
    } catch { /* try next */ }
  }
  return null;
}

interface PackageInfo { name: string; version: string | null }

function getInstalledPackages(): PackageInfo[] {
  const packages = ["@doquflow/cli", "@doquflow/core", "@doquflow/studio", "@doquflow/server"];
  return packages.map(name => ({ name, version: resolvePackageVersion(name) }));
}

// ── MCP server registration detection ────────────────────────────────────────

interface McpRegistration {
  source: string;
  registered: boolean;
  command?: string;
  args?: string[];
}

function getClaudeDesktopConfigPath(): string {
  const p = process.platform;
  if (p === "darwin") return path.join(os.homedir(), "Library", "Application Support", "Claude", "claude_desktop_config.json");
  if (p === "win32")  return path.join(os.homedir(), "AppData", "Roaming", "Claude", "claude_desktop_config.json");
  return path.join(os.homedir(), ".config", "Claude", "claude_desktop_config.json");
}

function getMcpRegistrations(projectPath: string): McpRegistration[] {
  const results: McpRegistration[] = [];

  // Project-level .mcp.json
  const projectMcp = path.join(projectPath, ".mcp.json");
  try {
    const cfg = JSON.parse(fs.readFileSync(projectMcp, "utf8")) as { mcpServers?: Record<string, { command?: string; args?: string[] }> };
    const entry = cfg.mcpServers?.docuflow;
    results.push({ source: ".mcp.json", registered: !!entry, command: entry?.command, args: entry?.args });
  } catch {
    results.push({ source: ".mcp.json", registered: false });
  }

  // Claude Desktop
  try {
    const cfg = JSON.parse(fs.readFileSync(getClaudeDesktopConfigPath(), "utf8")) as { mcpServers?: Record<string, { command?: string; args?: string[] }> };
    const entry = cfg.mcpServers?.docuflow;
    results.push({ source: "Claude Desktop", registered: !!entry, command: entry?.command, args: entry?.args });
  } catch {
    results.push({ source: "Claude Desktop", registered: false });
  }

  // VS Code user MCP
  const vscodePath = process.platform === "darwin"
    ? path.join(os.homedir(), "Library", "Application Support", "Code", "User", "mcp.json")
    : process.platform === "win32"
      ? path.join(os.homedir(), "AppData", "Roaming", "Code", "User", "mcp.json")
      : path.join(os.homedir(), ".config", "Code", "User", "mcp.json");
  try {
    const cfg = JSON.parse(fs.readFileSync(vscodePath, "utf8")) as { servers?: Record<string, { command?: string; args?: string[] }> };
    const entry = cfg.servers?.docuflow;
    results.push({ source: "VS Code (user)", registered: !!entry, command: entry?.command, args: entry?.args });
  } catch {
    results.push({ source: "VS Code (user)", registered: false });
  }

  // Copilot CLI
  const copilotPath = path.join(os.homedir(), ".copilot", "mcp-config.json");
  try {
    const cfg = JSON.parse(fs.readFileSync(copilotPath, "utf8")) as { mcpServers?: Record<string, { command?: string; args?: string[] }> };
    const entry = cfg.mcpServers?.docuflow;
    results.push({ source: "Copilot CLI", registered: !!entry, command: entry?.command, args: entry?.args });
  } catch {
    results.push({ source: "Copilot CLI", registered: false });
  }

  return results;
}

// ── Workflow detection ────────────────────────────────────────────────────────

interface WorkflowInfo {
  hasDocuflow:   boolean;
  hasSources:    boolean;
  hasSpecs:      boolean;
  hasQueryUsage: boolean;
  watchRunning:  boolean;
}

function detectWorkflow(projectPath: string): WorkflowInfo {
  const docuDir = path.join(projectPath, ".docuflow");
  const hasDocuflow = fs.existsSync(docuDir);

  let hasSources   = false;
  let hasSpecs     = false;
  let hasQueryUsage = false;
  let watchRunning = false;

  if (hasDocuflow) {
    try { hasSources = fs.readdirSync(path.join(docuDir, "sources")).some(f => f.endsWith(".md")); } catch { /* */ }
    try { hasSpecs   = fs.readdirSync(path.join(docuDir, "specs")).some(f => f.endsWith(".md")); } catch { /* */ }
    try {
      const log = fs.readFileSync(path.join(docuDir, "log.md"), "utf8");
      hasQueryUsage = /query-wiki|queryWiki/i.test(log);
    } catch { /* */ }

    // Check watch daemon PID file
    const pidFile = path.join(docuDir, "watch.pid.json");
    try {
      const data = JSON.parse(fs.readFileSync(pidFile, "utf8")) as { pid: number };
      try { process.kill(data.pid, 0); watchRunning = true; } catch { /* not running */ }
    } catch { /* no pid file */ }
  }

  return { hasDocuflow, hasSources, hasSpecs, hasQueryUsage, watchRunning };
}

// ── Health summary ────────────────────────────────────────────────────────────

interface HealthSummary {
  totalPages:  number;
  byCategory:  Record<string, number>;
  lastUpdate:  string;
  healthScore: number | null;
}

function getHealthSummary(projectPath: string): HealthSummary {
  const docuDir = path.join(projectPath, ".docuflow");
  const byCategory: Record<string, number> = { entities: 0, concepts: 0, timelines: 0, syntheses: 0 };

  for (const cat of Object.keys(byCategory)) {
    try {
      const files = fs.readdirSync(path.join(docuDir, "wiki", cat));
      byCategory[cat] = files.filter(f => f.endsWith(".md")).length;
    } catch { /* dir may not exist */ }
  }

  const totalPages = Object.values(byCategory).reduce((a, b) => a + b, 0);

  let lastUpdate = "never";
  try {
    const log = fs.readFileSync(path.join(docuDir, "log.md"), "utf8");
    const match = log.match(/\[(\d{4}-\d{2}-\d{2}[^\]]*)\]/);
    if (match) {
      const d = new Date(match[1]);
      if (!isNaN(d.getTime())) {
        const diffH = Math.floor((Date.now() - d.getTime()) / 3_600_000);
        lastUpdate = diffH < 1 ? "just now" : diffH < 24 ? `${diffH}h ago` : `${Math.floor(diffH / 24)}d ago`;
      }
    }
  } catch { /* */ }

  return { totalPages, byCategory, lastUpdate, healthScore: null };
}

// ── Recommendations ───────────────────────────────────────────────────────────

interface Recommendation { severity: "error" | "warn" | "info"; message: string; action: string }

function buildRecommendations(
  packages:       PackageInfo[],
  registrations:  McpRegistration[],
  workflow:       WorkflowInfo,
  health:         HealthSummary,
): Recommendation[] {
  const recs: Recommendation[] = [];

  const pkgMap = Object.fromEntries(packages.map(p => [p.name, p.version]));

  // Core/Studio installed?
  if (!pkgMap["@doquflow/core"] && !pkgMap["@doquflow/studio"]) {
    if (pkgMap["@doquflow/cli"]) {
      // CLI installs core+studio transitively — this just means they weren't directly required
    } else {
      recs.push({ severity: "error", message: "No DocuFlow packages detected", action: 'Run: npm i -g @doquflow/cli' });
    }
  }

  // Suggest minimal install if only using query/ingest
  const hasCli    = !!pkgMap["@doquflow/cli"];
  const hasCore   = !!pkgMap["@doquflow/core"];
  const hasStudio = !!pkgMap["@doquflow/studio"];
  if (hasCli && !workflow.watchRunning && !workflow.hasQueryUsage && hasCore && !hasStudio) {
    recs.push({ severity: "info", message: "You only use core tools (query/ingest)", action: "Consider: npm i -g @doquflow/core for a smaller install" });
  }

  // Not initialised
  if (!workflow.hasDocuflow) {
    recs.push({ severity: "error", message: ".docuflow/ not found in this directory", action: "Run: docuflow init" });
    return recs; // no point checking further
  }

  // No MCP registration anywhere
  const anyRegistered = registrations.some(r => r.registered);
  if (!anyRegistered) {
    recs.push({ severity: "error", message: "DocuFlow is not registered with any MCP host", action: "Run: docuflow init (re-run is safe)" });
  }

  // No sources
  if (!workflow.hasSources) {
    recs.push({ severity: "warn", message: "No source documents in .docuflow/sources/", action: "Drop a markdown file there, then run: docuflow ingest" });
  }

  // Empty wiki
  if (health.totalPages === 0 && workflow.hasSources) {
    recs.push({ severity: "warn", message: "Wiki is empty but sources exist", action: "Run: docuflow rewiki" });
  }

  // Old @doquflow/server pointing at dist/index.js instead of dist/mcp/index.js
  for (const reg of registrations.filter(r => r.registered)) {
    const argStr = reg.args?.join(" ") ?? "";
    if (argStr.includes("@doquflow/server") && argStr.includes("dist/index.js")) {
      recs.push({ severity: "info", message: `${reg.source}: MCP registration uses old server path`, action: "Run: docuflow init to refresh to @doquflow/studio/dist/mcp/index.js" });
    }
  }

  if (recs.length === 0) {
    recs.push({ severity: "info", message: "Everything looks good", action: "No action needed" });
  }

  return recs;
}

// ── Output formatters ─────────────────────────────────────────────────────────

function icon(severity: "error" | "warn" | "info"): string {
  return severity === "error" ? "🔴" : severity === "warn" ? "🟡" : "🟢";
}

function printHuman(
  packages:      PackageInfo[],
  registrations: McpRegistration[],
  workflow:      WorkflowInfo,
  health:        HealthSummary,
  recs:          Recommendation[],
  quiet:         boolean,
): void {
  if (!quiet) {
    // 1. Installed packages
    console.log("\n── 1. Installed packages ────────────────────────────────");
    for (const pkg of packages) {
      const mark = pkg.version ? "✓" : "✗";
      const ver  = pkg.version ?? "not found";
      console.log(`  ${mark}  ${pkg.name.padEnd(22)} ${ver}`);
    }

    // 2. MCP registrations
    console.log("\n── 2. MCP server registrations ──────────────────────────");
    for (const reg of registrations) {
      const mark = reg.registered ? "✓" : "·";
      const detail = reg.registered && reg.command
        ? `  ${reg.command} ${(reg.args ?? []).slice(-1)[0] ?? ""}`
        : "";
      console.log(`  ${mark}  ${reg.source.padEnd(18)}${reg.registered ? "registered" : "not registered"}${detail}`);
    }

    // 3. Workflow detection
    console.log("\n── 3. Workflow detection ─────────────────────────────────");
    console.log(`  ${workflow.hasDocuflow   ? "✓" : "✗"}  .docuflow/ initialised`);
    console.log(`  ${workflow.hasSources    ? "✓" : "·"}  source documents present`);
    console.log(`  ${workflow.hasSpecs      ? "✓" : "·"}  specs written`);
    console.log(`  ${workflow.hasQueryUsage ? "✓" : "·"}  query_wiki usage in logs`);
    console.log(`  ${workflow.watchRunning  ? "✓" : "·"}  watch daemon running`);

    // 4. Health summary
    console.log("\n── 5. Wiki health summary ───────────────────────────────");
    console.log(`  Pages total:    ${health.totalPages}`);
    if (health.totalPages > 0) {
      for (const [cat, n] of Object.entries(health.byCategory)) {
        if (n > 0) console.log(`    ${cat.padEnd(14)} ${n}`);
      }
    }
    console.log(`  Last updated:   ${health.lastUpdate}`);
    console.log("");
  }

  // 4. Recommendations (always shown)
  if (!quiet) console.log("── 4. Recommendations ───────────────────────────────────");
  for (const rec of recs) {
    console.log(`  ${icon(rec.severity)}  ${rec.message}`);
    console.log(`     → ${rec.action}`);
  }
  console.log("");
}

// ── Entry point ───────────────────────────────────────────────────────────────

export async function run(opts: DoctorOptions = {}): Promise<void> {
  const projectPath = process.cwd();

  const packages      = getInstalledPackages();
  const registrations = getMcpRegistrations(projectPath);
  const workflow      = detectWorkflow(projectPath);
  const health        = getHealthSummary(projectPath);
  const recs          = buildRecommendations(packages, registrations, workflow, health);

  if (opts.json) {
    console.log(JSON.stringify({ packages, registrations, workflow, health, recommendations: recs }, null, 2));
    return;
  }

  printHuman(packages, registrations, workflow, health, recs, opts.quiet ?? false);
}
