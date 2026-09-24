import fsp from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import fs from "node:fs";

function getClaudeDesktopConfigPath(): string {
  const platform = process.platform;
  if (platform === "darwin") {
    return path.join(os.homedir(), "Library", "Application Support", "Claude", "claude_desktop_config.json");
  } else if (platform === "win32") {
    return path.join(os.homedir(), "AppData", "Roaming", "Claude", "claude_desktop_config.json");
  }
  return path.join(os.homedir(), ".config", "Claude", "claude_desktop_config.json");
}

async function readLastIngestDate(docuDir: string): Promise<string> {
  try {
    const log = await fsp.readFile(path.join(docuDir, "log.md"), "utf8");
    const match = log.match(/\[(\d{4}-\d{2}-\d{2}[^\]]*)\]\s+ingest/);
    return match ? match[1] : "never";
  } catch {
    return "never";
  }
}

async function countWikiPages(docuDir: string): Promise<Record<string, number>> {
  const counts: Record<string, number> = { entities: 0, concepts: 0, timelines: 0, syntheses: 0 };
  for (const cat of Object.keys(counts)) {
    try {
      const files = await fsp.readdir(path.join(docuDir, "wiki", cat));
      counts[cat] = files.filter((f) => f.endsWith(".md")).length;
    } catch {
      // Directory may not exist
    }
  }
  return counts;
}

export async function run(): Promise<void> {
  const configPath = getClaudeDesktopConfigPath();
  const projectDir = process.cwd();
  const docuDir = path.join(projectDir, ".docuflow");

  // Check MCP registration
  let registered = false;
  try {
    const raw = await fsp.readFile(configPath, "utf8");
    const config = JSON.parse(raw);
    registered = Boolean(config?.mcpServers?.docuflow);
  } catch {
    // Config doesn't exist
  }

  // Count spec files
  let specCount = 0;
  try {
    const entries = await fsp.readdir(path.join(docuDir, "specs"));
    specCount = entries.filter((e) => e.endsWith(".md")).length;
  } catch {
    // .docuflow/specs doesn't exist
  }

  // Count sources
  let sourceCount = 0;
  try {
    const entries = await fsp.readdir(path.join(docuDir, "sources"));
    sourceCount = entries.filter((e) => e.endsWith(".md") || e.endsWith(".txt")).length;
  } catch {
    // .docuflow/sources doesn't exist
  }

  // Check for CLAUDE.md
  const claudeMdExists = fs.existsSync(path.join(projectDir, "CLAUDE.md"));

  // Count wiki pages per category
  const wikiCounts = await countWikiPages(docuDir);
  const totalWikiPages = Object.values(wikiCounts).reduce((a, b) => a + b, 0);

  // Last ingest date
  const lastIngest = await readLastIngestDate(docuDir);

  // Get CLI version from package.json
  let version = "unknown";
  try {
    const pkgPath = require.resolve("@doquflow/cli/package.json");
    const pkg = JSON.parse(await fsp.readFile(pkgPath, "utf8"));
    version = pkg.version;
  } catch {
    try {
      const pkgPath = path.resolve(__dirname, "..", "..", "package.json");
      const pkg = JSON.parse(await fsp.readFile(pkgPath, "utf8"));
      version = pkg.version;
    } catch {
      // Can't resolve version
    }
  }

  console.log("\nDocuflow status");
  console.log("───────────────────────────────────────────");
  console.log(`  Version:          ${version}`);
  console.log(`  MCP registered:   ${registered ? "✓ yes" : "✗ no"}`);
  console.log(`  CLAUDE.md:        ${claudeMdExists ? "✓ present" : "✗ missing"}`);
  console.log(`  Config file:      ${configPath}`);
  console.log("");
  console.log("  Specs written:    " + specCount);
  console.log("  Sources:          " + sourceCount);
  console.log("  Last ingest:      " + lastIngest);
  console.log("");
  console.log("  Wiki pages:       " + totalWikiPages + " total");
  if (totalWikiPages > 0) {
    console.log(`    entities:       ${wikiCounts.entities}`);
    console.log(`    concepts:       ${wikiCounts.concepts}`);
    console.log(`    syntheses:      ${wikiCounts.syntheses}`);
    console.log(`    timelines:      ${wikiCounts.timelines}`);
  }
  console.log("───────────────────────────────────────────");

  if (!registered) {
    console.log('\n  ⚠  Run "docuflow init" to register MCP server.');
  }
  if (!claudeMdExists) {
    console.log('\n  ⚠  Run "docuflow init" to generate CLAUDE.md.');
  }
  if (totalWikiPages === 0 && sourceCount === 0) {
    console.log('\n  💡 Run "docuflow suggest" to see what to document first.');
  }
  console.log();
}
