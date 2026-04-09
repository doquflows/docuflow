import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import os from "node:os";

function getClaudeDesktopConfigPath(): string {
  const platform = process.platform;
  if (platform === "darwin") {
    return path.join(os.homedir(), "Library", "Application Support", "Claude", "claude_desktop_config.json");
  } else if (platform === "win32") {
    return path.join(os.homedir(), "AppData", "Roaming", "Claude", "claude_desktop_config.json");
  }
  return path.join(os.homedir(), ".config", "Claude", "claude_desktop_config.json");
}

function resolveServerBin(): string {
  // Try npm-installed package first
  try {
    return require.resolve("@doquflow/server/dist/index.js");
  } catch {
    // Fallback: monorepo sibling path (dev environment)
    return path.resolve(__dirname, "..", "..", "server", "dist", "index.js");
  }
}

export async function run(): Promise<void> {
  const configPath = getClaudeDesktopConfigPath();
  const serverBin = resolveServerBin();
  const nodeBin = process.execPath;

  // Read or initialise Claude Desktop config
  let config: Record<string, any> = {};
  try {
    const raw = await fsp.readFile(configPath, "utf8");
    config = JSON.parse(raw);
  } catch {
    // File doesn't exist yet — that's fine, we'll create it
  }

  if (!config.mcpServers) config.mcpServers = {};
  config.mcpServers.docuflow = { command: nodeBin, args: [serverBin] };

  await fsp.mkdir(path.dirname(configPath), { recursive: true });
  await fsp.writeFile(configPath, JSON.stringify(config, null, 2) + "\n", "utf8");

  // Create .docuflow/specs/ in cwd
  const specsDir = path.join(process.cwd(), ".docuflow", "specs");
  await fsp.mkdir(specsDir, { recursive: true });

  // Add .docuflow/ to .gitignore if present and not already listed
  const gitignorePath = path.join(process.cwd(), ".gitignore");
  if (fs.existsSync(gitignorePath)) {
    const gitignore = await fsp.readFile(gitignorePath, "utf8");
    if (!gitignore.includes(".docuflow/") && !gitignore.includes(".docuflow")) {
      await fsp.appendFile(gitignorePath, "\n# Docuflow\n.docuflow/\n");
    }
  }

  console.log("Docuflow initialised successfully.");
  console.log("");
  console.log(`  MCP key:     mcpServers.docuflow`);
  console.log(`  Config file: ${configPath}`);
  console.log(`  Specs dir:   ${specsDir}`);
  console.log("");
  console.log("Restart Claude Desktop to activate.");
}
