import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { run as runSuggest } from "./suggest";
import {
  findInstallsSync,
  getMcpEntryPrefix,
  getInstalledCliVersion,
  semverGt,
} from "../prefix-utils";

// ── Global project registry ───────────────────────────────────────────────────
// ~/.docuflow/projects.json  — written by `docuflow init` so the UI can always
// find all initialized projects regardless of where they live on disk.

const GLOBAL_REGISTRY = path.join(os.homedir(), ".docuflow", "projects.json");

export async function registerInGlobalRegistry(projectPath: string): Promise<void> {
  try {
    const dir = path.dirname(GLOBAL_REGISTRY);
    await fsp.mkdir(dir, { recursive: true });

    let registry: { version: number; projects: string[] } = { version: 1, projects: [] };
    try {
      const raw = await fsp.readFile(GLOBAL_REGISTRY, "utf8");
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed.projects)) registry = parsed;
    } catch { /* file doesn't exist yet */ }

    if (!registry.projects.includes(projectPath)) {
      registry.projects.push(projectPath);
      await fsp.writeFile(GLOBAL_REGISTRY, JSON.stringify(registry, null, 2) + "\n", "utf8");
    }
  } catch { /* non-fatal — registry is best-effort */ }
}


function getClaudeDesktopConfigPath(): string {
  const platform = process.platform;
  if (platform === "darwin") {
    return path.join(os.homedir(), "Library", "Application Support", "Claude", "claude_desktop_config.json");
  } else if (platform === "win32") {
    return path.join(os.homedir(), "AppData", "Roaming", "Claude", "claude_desktop_config.json");
  }
  return path.join(os.homedir(), ".config", "Claude", "claude_desktop_config.json");
}

function getVSCodeMcpConfigPath(): string {
  const platform = process.platform;
  if (platform === "darwin") {
    return path.join(os.homedir(), "Library", "Application Support", "Code", "User", "mcp.json");
  } else if (platform === "win32") {
    return path.join(os.homedir(), "AppData", "Roaming", "Code", "User", "mcp.json");
  }
  return path.join(os.homedir(), ".config", "Code", "User", "mcp.json");
}

function getCopilotCliMcpConfigPath(): string {
  return path.join(os.homedir(), ".copilot", "mcp-config.json");
}

function getCodexConfigPath(): string {
  return path.join(os.homedir(), ".codex", "config.toml");
}

function resolveServerBin(): string {
  // Use the exports map key — avoids ERR_PACKAGE_PATH_NOT_EXPORTED
  try {
    return require.resolve("@doquflow/studio/mcp");
  } catch {
    // Fallback 1: studio is a @doquflow sibling inside node_modules
    // __dirname = .../@doquflow/cli/dist/commands  →  ../../../../@doquflow/studio
    const sibling = path.resolve(
      __dirname, "..", "..", "..", "..", "@doquflow", "studio", "dist", "mcp", "index.js"
    );
    if (fs.existsSync(sibling)) return sibling;
    // Fallback 2: monorepo dev — packages/cli/dist/commands → packages/studio
    return path.resolve(__dirname, "..", "..", "..", "studio", "dist", "mcp", "index.js");
  }
}

async function copyTemplateFile(templateName: string, destPath: string): Promise<void> {
  try {
    // Try package-installed location first
    const templatePath = require.resolve(`@doquflow/cli/templates/${templateName}`);
    const content = await fsp.readFile(templatePath, "utf8");
    await fsp.writeFile(destPath, content, "utf8");
  } catch {
    try {
      // Fallback: monorepo sibling path (dev environment)
      const templatePath = path.resolve(__dirname, "..", "..", "templates", templateName);
      const content = await fsp.readFile(templatePath, "utf8");
      await fsp.writeFile(destPath, content, "utf8");
    } catch (err) {
      // If template not found, create a minimal version
      console.warn(`  ⚠ Could not find template for ${templateName}, creating minimal version`);
      if (templateName === "schema.md") {
        await fsp.writeFile(destPath, "# Docuflow Wiki Schema\n\n## Domain\n[Edit this file to customize your wiki]\n", "utf8");
      } else if (templateName === "index.md") {
        await fsp.writeFile(destPath, "# Wiki Index\n\nAuto-maintained catalog of pages.\n", "utf8");
      } else if (templateName === "log.md") {
        await fsp.writeFile(destPath, "# Operation Log\n\nRecord of wiki operations.\n", "utf8");
      }
    }
  }
}

export function buildClaudeMd(projectDir: string): string {
  return `<!-- BEGIN DOCUFLOW -->
# DocuFlow — AI Documentation Assistant

DocuFlow preserves decision context for AI agents. Intent in, value out.

## Core tools (use these first)

- **query_wiki({ project_path, question })** — Ask the wiki. Returns an answer with citations.
- **ingest_source({ project_path, source_filename })** — Fold a markdown source into the wiki.
- **wiki_search({ project_path, query })** — BM25 search across all pages.
- **read_module({ path })** — Read and extract facts from a single source file.

## CLI — Core Commands

\`\`\`
docuflow query "<question>"         # ask the wiki from the shell
docuflow ingest <source.md>         # add a source doc to the wiki
docuflow status                     # wiki health and counts
docuflow rewiki                     # re-ingest with current rules
docuflow init                       # initialise .docuflow/ in this project
\`\`\`

## Workflows

### Answer a question
\`\`\`
query_wiki({ project_path: ".", question: "How does authentication work?" })
\`\`\`

### Add new context
\`\`\`
# drop a markdown file in .docuflow/sources/
ingest_source({ project_path: ".", source_filename: "auth-design.md" })
\`\`\`

## Advanced tools

Use when the core tools don't cover the workflow. Each has more parameters and side effects.

- **list_modules** — Walk a directory tree and extract facts in bulk
- **list_wiki** — Inventory pages by category, with staleness flags
- **write_spec / read_specs** — Persistent agent-written specs
- **save_answer_as_page** — Promote a synthesised answer into the wiki
- **synthesize_answer** — Combine multiple pages into a markdown synthesis
- **update_index** — Rebuild \`.docuflow/index.md\`
- **lint_wiki** — Health checks: orphans, broken refs, stale content
- **get_schema_guidance** — Recommend what pages should exist
- **preview_generation** — Show what a tool will do before running
- **generate_dependency_graph** — Build the import/shared-table graph

## Storage Layout

\`\`\`
.docuflow/
├── specs/           Spec files written by write_spec
├── wiki/            LLM-generated wiki pages
│   ├── entities/    Named things (services, APIs, databases)
│   ├── concepts/    Design patterns, principles, integrations
│   ├── timelines/   Chronological pages
│   └── syntheses/   Cross-cutting synthesis pages
├── sources/         Raw input files for ingest_source
├── schema.md        Wiki configuration (edit to customise)
├── index.md         Auto-maintained catalog
└── log.md           Operation log
\`\`\`
<!-- END DOCUFLOW -->`;
}

async function writeClaudeMd(projectDir: string): Promise<void> {
  const claudeMdPath = path.join(projectDir, "CLAUDE.md");
  const newSection = buildClaudeMd(projectDir);

  if (fs.existsSync(claudeMdPath)) {
    const existing = await fsp.readFile(claudeMdPath, "utf8");
    if (existing.includes("<!-- BEGIN DOCUFLOW -->") && existing.includes("<!-- END DOCUFLOW -->")) {
      // Marker-based replacement — idempotent re-runs preserve surrounding content
      const replaced = existing.replace(
        /<!-- BEGIN DOCUFLOW -->[\s\S]*?<!-- END DOCUFLOW -->/,
        newSection.trimEnd(),
      );
      await fsp.writeFile(claudeMdPath, replaced, "utf8");
    } else if (existing.includes("DocuFlow")) {
      // Old format without markers — replace old DocuFlow section, add markers this time
      const withoutDocuflow = existing.replace(/\n?# DocuFlow[\s\S]*/, "").trimEnd();
      await fsp.writeFile(claudeMdPath, withoutDocuflow + "\n\n" + newSection, "utf8");
    } else {
      // No DocuFlow section yet — append
      await fsp.appendFile(claudeMdPath, "\n\n" + newSection, "utf8");
    }
  } else {
    await fsp.writeFile(claudeMdPath, newSection, "utf8");
  }
}

export function buildAgentsMd(projectDir: string): string {
  return `# DocuFlow — AI Documentation Assistant

DocuFlow is an MCP server that provides structured access to this codebase and maintains a living wiki.
It is registered via \`.codex/config.toml\` and available as MCP tools in every Codex session.

## Available MCP Tools

### Codebase Scanner
- **read_module** — Analyse a single file: language, classes, functions, dependencies, DB tables, endpoints, config refs, raw content.
  - \`read_module({ path: "src/UserService.cs" })\`
- **list_modules** — Walk a directory, extract facts for every file. One call to understand the whole project.
  - \`list_modules({ path: "." })\`
- **write_spec** — Save a markdown spec to \`.docuflow/specs/<name>.md\`.
  - \`write_spec({ project_path: ".", filename: "UserService", content: "..." })\`
- **read_specs** — Read saved specs, optionally filtered by name.
  - \`read_specs({ project_path: "." })\`

### Wiki Pipeline
- **ingest_source** — Ingest a markdown file from \`.docuflow/sources/\` into the wiki (entities, concepts).
- **update_index** — Rebuild \`.docuflow/index.md\` from all wiki pages.
- **list_wiki** — List all wiki pages by category (entity/concept/timeline/synthesis).
- **wiki_search** — BM25 search across all wiki pages.
- **query_wiki** — Q&A: searches wiki, synthesises an answer, returns citations.
  - \`query_wiki({ project_path: ".", question: "How does auth work?" })\`
- **synthesize_answer** — Generate a markdown synthesis from a list of page IDs.
- **save_answer_as_page** — Persist a synthesis as a wiki page.

### Health & Guidance
- **lint_wiki** — Health check: orphan pages, broken refs, stale content. Returns a 0–100 health score.
- **get_schema_guidance** — Recommend what wiki pages should exist based on schema + current state.
- **preview_generation** — Preview what a tool will generate before running it.

## Common Workflows

Start here — understand the codebase:
\`\`\`
list_modules({ path: "." })
→ write_spec for important modules
\`\`\`

Answer a question:
\`\`\`
query_wiki({ project_path: ".", question: "..." })
\`\`\`

Maintain wiki health:
\`\`\`
lint_wiki({ project_path: "." })
\`\`\`

## Storage Layout

\`\`\`
.docuflow/
├── specs/        Code specs written by write_spec
├── wiki/         LLM-generated wiki pages
│   ├── entities/
│   ├── concepts/
│   ├── timelines/
│   └── syntheses/
├── sources/      Raw markdown docs to ingest
├── schema.md     Wiki configuration (edit to customise)
├── index.md      Auto-maintained catalog
└── log.md        Operation log
\`\`\`
`;
}

async function writeAgentsMd(projectDir: string): Promise<void> {
  const agentsMdPath = path.join(projectDir, "AGENTS.md");
  const newSection = buildAgentsMd(projectDir);

  if (fs.existsSync(agentsMdPath)) {
    const existing = await fsp.readFile(agentsMdPath, "utf8");
    if (existing.includes("DocuFlow")) {
      // Replace existing DocuFlow section
      const withoutDocuflow = existing.replace(/\n?# DocuFlow[\s\S]*/, "").trimEnd();
      await fsp.writeFile(agentsMdPath, withoutDocuflow + "\n\n" + newSection, "utf8");
    } else {
      // Append to existing AGENTS.md
      await fsp.appendFile(agentsMdPath, "\n\n" + newSection, "utf8");
    }
  } else {
    await fsp.writeFile(agentsMdPath, newSection, "utf8");
  }
}

export interface RepairResult {
  repaired: string[];
  already_ok: string[];
  skipped: string[];
}

/** Entry structure shared by all MCP config formats we handle. */
interface McpEntry {
  command?: string;
  args?: unknown[];
}

/**
 * Detect and repair MCP server registrations in global and per-project configs.
 *
 * DEF-12: Beyond checking that the registered file exists, also detect:
 *   1. Cross-prefix mismatch — node binary prefix ≠ MCP entry path prefix
 *   2. Stale version     — registered code is older than the newest installed
 *
 * Covers: Claude Desktop global, VS Code global, Copilot CLI global,
 *         and .mcp.json in the current working directory (per-project).
 */
export async function repairMcpConfigs(): Promise<RepairResult> {
  // Find the best (newest, self-consistent) installation to target
  const allInstalls = findInstallsSync();
  const bestInstall = allInstalls[0]; // sorted newest-first by findInstallsSync

  // Fall back to the running process if no external installs found
  const targetNodeBin  = bestInstall?.nodeBin  ?? process.execPath;
  const targetServerBin = bestInstall?.serverBin ?? resolveServerBin();
  const targetVersion  = bestInstall?.version  ?? "unknown";

  const repaired:   string[] = [];
  const already_ok: string[] = [];
  const skipped:    string[] = [];

  /**
   * Determine whether an existing entry needs repair.
   * Returns a reason string if repair is needed, undefined if it is clean.
   */
  function repairReason(entry: McpEntry): string | undefined {
    const recorded = Array.isArray(entry.args) ? (entry.args[0] as string | undefined) : undefined;

    // 1. Missing / deleted file
    if (!recorded || !fs.existsSync(recorded)) {
      return `missing file (${recorded ?? "no args[0]"})`;
    }

    // 2. Cross-prefix mismatch: node binary prefix ≠ MCP entry path prefix
    const registeredNodeBin = entry.command;
    if (registeredNodeBin) {
      const nodeBinPrefix  = path.dirname(path.dirname(registeredNodeBin));
      const mcpEntryPrefix = getMcpEntryPrefix(recorded);
      if (
        mcpEntryPrefix &&
        path.resolve(nodeBinPrefix) !== path.resolve(mcpEntryPrefix)
      ) {
        return `cross-prefix (node: ${nodeBinPrefix} ≠ entry: ${mcpEntryPrefix})`;
      }
    }

    // 3. Stale version: registered install is older than newest found
    const registeredVersion = getInstalledCliVersion(recorded);
    if (registeredVersion && semverGt(targetVersion, registeredVersion)) {
      return `stale version (${registeredVersion} → ${targetVersion})`;
    }

    return undefined; // clean
  }

  async function checkAndRepairJson(
    configPath: string,
    label: string,
    getEntry: (cfg: Record<string, unknown>) => McpEntry | undefined,
    writeEntry: (cfg: Record<string, unknown>) => void,
  ): Promise<void> {
    try {
      const raw = await fsp.readFile(configPath, "utf8");
      const cfg = JSON.parse(raw) as Record<string, unknown>;
      const entry = getEntry(cfg);
      if (!entry) { skipped.push(`${label} — no docuflow entry`); return; }

      const reason = repairReason(entry);
      if (!reason) { already_ok.push(label); return; }

      writeEntry(cfg);
      await fsp.writeFile(configPath, JSON.stringify(cfg, null, 2) + "\n", "utf8");
      repaired.push(`${label} (${reason} → ${targetServerBin})`);
    } catch { skipped.push(`${label} — not found or unreadable`); }
  }

  // ── Global: Claude Desktop ──────────────────────────────────────────────────
  await checkAndRepairJson(
    getClaudeDesktopConfigPath(),
    "Claude Desktop",
    (cfg) => ((cfg.mcpServers as Record<string, unknown> | undefined)?.docuflow as McpEntry | undefined),
    (cfg) => {
      if (!cfg.mcpServers) cfg.mcpServers = {};
      (cfg.mcpServers as Record<string, unknown>).docuflow = {
        command: targetNodeBin,
        args: [targetServerBin],
      };
    },
  );

  // ── Global: VS Code user MCP ───────────────────────────────────────────────
  await checkAndRepairJson(
    getVSCodeMcpConfigPath(),
    "VS Code",
    (cfg) => ((cfg.servers as Record<string, unknown> | undefined)?.docuflow as McpEntry | undefined),
    (cfg) => {
      if (!cfg.servers) cfg.servers = {};
      (cfg.servers as Record<string, unknown>).docuflow = {
        command: targetNodeBin,
        args: [targetServerBin],
        type: "stdio",
      };
    },
  );

  // ── Global: Copilot CLI ────────────────────────────────────────────────────
  await checkAndRepairJson(
    getCopilotCliMcpConfigPath(),
    "Copilot CLI",
    (cfg) => ((cfg.mcpServers as Record<string, unknown> | undefined)?.docuflow as McpEntry | undefined),
    (cfg) => {
      if (!cfg.mcpServers) cfg.mcpServers = {};
      (cfg.mcpServers as Record<string, unknown>).docuflow = {
        type: "local",
        command: targetNodeBin,
        args: [targetServerBin],
        tools: ["*"],
      };
    },
  );

  // ── Per-project: .mcp.json in current working directory ───────────────────
  const localMcpPath = path.join(process.cwd(), ".mcp.json");
  await checkAndRepairJson(
    localMcpPath,
    ".mcp.json (project)",
    (cfg) => {
      const servers = (cfg.mcpServers ?? cfg.servers) as Record<string, unknown> | undefined;
      return servers?.docuflow as McpEntry | undefined;
    },
    (cfg) => {
      // Preserve whichever key the file already uses (mcpServers vs servers)
      const key = cfg.mcpServers !== undefined ? "mcpServers" : "servers";
      if (!cfg[key]) cfg[key] = {};
      (cfg[key] as Record<string, unknown>).docuflow = {
        type: "stdio",
        command: targetNodeBin,
        args: [targetServerBin],
      };
    },
  );

  return { repaired, already_ok, skipped };
}

export interface InitResult {
  ok: boolean;
  path: string;
  details: string[];
}

/**
 * Core init logic — creates the .docuflow/ structure, registers MCP configs,
 * writes CLAUDE.md/AGENTS.md, installs git hook, and registers in global registry.
 *
 * Accepts the target projectDir explicitly so it can be called from both the CLI
 * (which uses process.cwd()) and the API (/api/init which receives the path from
 * the request body).
 */
export async function runInit(projectDir: string): Promise<InitResult> {
  const details: string[] = [];

  const configPath = getClaudeDesktopConfigPath();
  const vscodeConfigPath = getVSCodeMcpConfigPath();
  const copilotCliConfigPath = getCopilotCliMcpConfigPath();
  const codexConfigPath = getCodexConfigPath();
  const serverBin = resolveServerBin();
  const nodeBin = process.execPath;

  // Register in Claude Desktop config
  try {
    let config: Record<string, unknown> = {};
    try {
      const raw = await fsp.readFile(configPath, "utf8");
      config = JSON.parse(raw) as Record<string, unknown>;
    } catch { /* File doesn't exist yet — that's fine */ }
    if (!config.mcpServers) config.mcpServers = {};
    (config.mcpServers as Record<string, unknown>).docuflow = { command: nodeBin, args: [serverBin] };
    await fsp.mkdir(path.dirname(configPath), { recursive: true });
    await fsp.writeFile(configPath, JSON.stringify(config, null, 2) + "\n", "utf8");
    details.push("Claude Desktop MCP registered");
  } catch { details.push("Claude Desktop — skipped (not installed)"); }

  // Register in VS Code (GitHub Copilot) user MCP config
  let vscodeRegistered = false;
  try {
    let vscodeConfig: Record<string, unknown> = {};
    try {
      const raw = await fsp.readFile(vscodeConfigPath, "utf8");
      vscodeConfig = JSON.parse(raw) as Record<string, unknown>;
    } catch { /* File may not exist */ }
    if (!vscodeConfig.servers) vscodeConfig.servers = {};
    (vscodeConfig.servers as Record<string, unknown>).docuflow = { command: nodeBin, args: [serverBin], type: "stdio" };
    await fsp.mkdir(path.dirname(vscodeConfigPath), { recursive: true });
    await fsp.writeFile(vscodeConfigPath, JSON.stringify(vscodeConfig, null, 2) + "\n", "utf8");
    vscodeRegistered = true;
    details.push("VS Code Copilot MCP registered");
  } catch { /* VS Code not installed — skip */ }

  // Register in GitHub Copilot CLI MCP config (~/.copilot/mcp-config.json)
  let copilotCliRegistered = false;
  try {
    let copilotCliConfig: Record<string, unknown> = {};
    try {
      const raw = await fsp.readFile(copilotCliConfigPath, "utf8");
      copilotCliConfig = JSON.parse(raw) as Record<string, unknown>;
    } catch { /* File may not exist yet */ }
    if (!copilotCliConfig.mcpServers) copilotCliConfig.mcpServers = {};
    (copilotCliConfig.mcpServers as Record<string, unknown>).docuflow = { type: "local", command: nodeBin, args: [serverBin], tools: ["*"] };
    await fsp.mkdir(path.dirname(copilotCliConfigPath), { recursive: true });
    await fsp.writeFile(copilotCliConfigPath, JSON.stringify(copilotCliConfig, null, 2) + "\n", "utf8");
    copilotCliRegistered = true;
    details.push("Copilot CLI MCP registered");
  } catch { /* Copilot CLI not installed — skip */ }

  // Register in OpenAI Codex CLI (~/.codex/config.toml in TOML format)
  let codexCliRegistered = false;
  try {
    await fsp.mkdir(path.dirname(codexConfigPath), { recursive: true });
    let tomlContent = "";
    try { tomlContent = await fsp.readFile(codexConfigPath, "utf8"); } catch { /* new file */ }
    if (!tomlContent.includes("[mcp_servers.docuflow]")) {
      const entry = `\n[mcp_servers.docuflow]\ncommand = "${nodeBin}"\nargs = [${JSON.stringify(serverBin)}]\n`;
      await fsp.writeFile(codexConfigPath, tomlContent + entry, "utf8");
    }
    codexCliRegistered = true;
    details.push("Codex CLI MCP registered");
  } catch { /* Codex CLI not installed — skip */ }

  // Suppress unused-variable warnings when variables are only used in console.log branches
  void vscodeRegistered;
  void copilotCliRegistered;
  void codexCliRegistered;

  // Create .docuflow/ directory structure
  const docuflowDir = path.join(projectDir, ".docuflow");
  const specsDir    = path.join(docuflowDir, "specs");
  const wikiDir     = path.join(docuflowDir, "wiki");
  const sourcesDir  = path.join(docuflowDir, "sources");

  await fsp.mkdir(specsDir,                           { recursive: true });
  await fsp.mkdir(path.join(wikiDir, "entities"),     { recursive: true });
  await fsp.mkdir(path.join(wikiDir, "concepts"),     { recursive: true });
  await fsp.mkdir(path.join(wikiDir, "timelines"),    { recursive: true });
  await fsp.mkdir(path.join(wikiDir, "syntheses"),    { recursive: true });
  await fsp.mkdir(sourcesDir,                         { recursive: true });
  details.push("Created .docuflow/ directory structure");

  // Copy or create template files
  await copyTemplateFile("schema.md", path.join(docuflowDir, "schema.md"));
  await copyTemplateFile("index.md",  path.join(docuflowDir, "index.md"));
  await copyTemplateFile("log.md",    path.join(docuflowDir, "log.md"));
  details.push("Wrote schema.md, index.md, log.md");

  // Generate CLAUDE.md
  await writeClaudeMd(projectDir);
  details.push("Wrote CLAUDE.md");

  // Generate AGENTS.md
  await writeAgentsMd(projectDir);
  details.push("Wrote AGENTS.md");

  // Write .vscode/mcp.json for project-level workspace MCP config
  try {
    const vscodeDirPath        = path.join(projectDir, ".vscode");
    const vscodeWorkspaceMcpPath = path.join(vscodeDirPath, "mcp.json");
    let workspaceMcpConfig: Record<string, unknown> = {};
    try {
      const raw = await fsp.readFile(vscodeWorkspaceMcpPath, "utf8");
      workspaceMcpConfig = JSON.parse(raw) as Record<string, unknown>;
    } catch { /* File doesn't exist yet */ }
    if (!workspaceMcpConfig.servers) workspaceMcpConfig.servers = {};
    (workspaceMcpConfig.servers as Record<string, unknown>).docuflow = {
      command: "npx",
      args: ["-y", "-p", "@doquflow/server", "docuflow-server"],
      type: "stdio",
    };
    await fsp.mkdir(vscodeDirPath, { recursive: true });
    await fsp.writeFile(vscodeWorkspaceMcpPath, JSON.stringify(workspaceMcpConfig, null, 2) + "\n", "utf8");
    details.push("Wrote .vscode/mcp.json");
  } catch { /* non-fatal */ }

  // Add .docuflow/ to .gitignore if present and not already listed
  try {
    const gitignorePath = path.join(projectDir, ".gitignore");
    if (fs.existsSync(gitignorePath)) {
      const gitignore = await fsp.readFile(gitignorePath, "utf8");
      if (!gitignore.includes(".docuflow/") && !gitignore.includes(".docuflow")) {
        await fsp.appendFile(gitignorePath, "\n# Docuflow\n.docuflow/\n");
        details.push("Added .docuflow/ to .gitignore");
      }
    }
  } catch { /* non-fatal */ }

  // Install git post-commit hook
  await installGitHook(projectDir);
  details.push("Installed git post-commit hook");

  // Register in global project registry
  await registerInGlobalRegistry(projectDir);
  details.push("Registered in global project registry (~/.docuflow/projects.json)");

  return { ok: true, path: projectDir, details };
}

export async function runRepair(): Promise<void> {
  console.log("DocuFlow — repairing MCP config paths…");
  console.log("");
  const result = await repairMcpConfigs();
  for (const r of result.repaired)   console.log(`  ✓ Repaired: ${r}`);
  for (const r of result.already_ok) console.log(`  ✓ OK:       ${r}`);
  for (const r of result.skipped)    console.log(`  - Skipped:  ${r}`);
  if (result.repaired.length === 0 && result.already_ok.length === 0) {
    console.log("  (no docuflow MCP entries found in any config)");
  }
  console.log("");
  if (result.repaired.length > 0) {
    console.log("Restart Claude Desktop / reload VS Code to pick up the corrected paths.");
  }
}

export async function run(opts: { repair?: boolean } = {}): Promise<void> {
  if (opts.repair) { return runRepair(); }
  const result = await runInit(process.cwd());

  const docuflowDir = path.join(result.path, ".docuflow");

  console.log("✓ DocuFlow initialised successfully.");
  console.log("");
  console.log("📁 Structure created:");
  console.log(`  ${docuflowDir}/`);
  console.log(`  ├── specs/              (code specs written by the agent)`);
  console.log(`  ├── wiki/               (LLM-generated wiki pages)`);
  console.log(`  │   ├── entities/`);
  console.log(`  │   ├── concepts/`);
  console.log(`  │   ├── timelines/`);
  console.log(`  │   └── syntheses/`);
  console.log(`  ├── sources/            (raw markdown documents to ingest)`);
  console.log(`  ├── schema.md           (wiki configuration)`);
  console.log(`  ├── index.md            (auto-maintained catalog)`);
  console.log(`  └── log.md              (operation log)`);
  console.log("");
  console.log("📝 Steps completed:");
  for (const line of result.details) {
    console.log(`  ✓ ${line}`);
  }
  console.log("");
  console.log("📖 Next steps:");
  console.log("  1. Edit .docuflow/schema.md to customize your wiki domain");
  console.log("  2. Add markdown docs to .docuflow/sources/ then ingest them");
  console.log("  3. Restart Claude Desktop / reload VS Code / restart Copilot CLI");
  console.log("");
  console.log("⚡ Auto-sync options:");
  console.log("  docuflow watch           # background daemon (watches for file changes)");
  console.log("  docuflow watch --ai      # + Claude/Codex documents code changes automatically");
  console.log("  docuflow sync            # one-shot sync (good for CI/CD)");
  console.log("  docuflow sync --ai       # + AI generates docs from last git commit");
  console.log("");
  console.log("  A git post-commit hook was installed at .git/hooks/post-commit");
  console.log("  It runs \"docuflow sync --ai --quiet\" after every commit automatically.");
  console.log("");
  console.log("─────────────────────────────────────────────────────");
  await runSuggest();
}

/**
 * Install a git post-commit hook that runs `docuflow sync` automatically.
 * Idempotent — does not overwrite a hook that already has DocuFlow content.
 */
async function installGitHook(projectDir: string): Promise<void> {
  const gitDir = path.join(projectDir, ".git");
  if (!fs.existsSync(gitDir)) return; // not a git repo

  const hooksDir = path.join(gitDir, "hooks");
  await fsp.mkdir(hooksDir, { recursive: true });

  const hookPath = path.join(hooksDir, "post-commit");
  const hookMarker = "# docuflow-auto-sync";

  // Don't overwrite if already installed
  if (fs.existsSync(hookPath)) {
    const existing = await fsp.readFile(hookPath, "utf8");
    if (existing.includes(hookMarker)) return;
    // Append to existing hook
    const appendContent = [
      "",
      hookMarker,
      `# Auto-generated by docuflow init — runs wiki sync after every commit`,
      `# Requires Claude CLI, Codex CLI, or ANTHROPIC_API_KEY for AI-powered doc generation`,
      `# Remove the lines below to disable auto-sync`,
      `if command -v docuflow &> /dev/null; then`,
      `  docuflow sync --ai --quiet &`,
      `fi`,
    ].join("\n");
    await fsp.appendFile(hookPath, appendContent + "\n");
    return;
  }

  // Create new hook file
  const hookContent = [
    `#!/bin/sh`,
    hookMarker,
    `# Auto-generated by docuflow init`,
    `# Syncs the DocuFlow wiki after every commit using Claude / Codex / Anthropic API`,
    `# AI bridge priority: Claude CLI > Codex CLI > ANTHROPIC_API_KEY`,
    `# Run in background (&) so it never delays your git workflow`,
    `if command -v docuflow &> /dev/null; then`,
    `  docuflow sync --ai --quiet &`,
    `fi`,
  ].join("\n");

  await fsp.writeFile(hookPath, hookContent + "\n", "utf8");
  // Make executable
  fs.chmodSync(hookPath, 0o755);
}
