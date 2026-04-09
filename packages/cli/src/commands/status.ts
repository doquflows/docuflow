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

export async function run(): Promise<void> {
  const configPath = getClaudeDesktopConfigPath();

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
  const specsDir = path.join(process.cwd(), ".docuflow", "specs");
  try {
    const entries = await fsp.readdir(specsDir);
    specCount = entries.filter(e => e.endsWith(".md")).length;
  } catch {
    // .docuflow/specs doesn't exist
  }

  console.log("Docuflow status");
  console.log("───────────────────────────────");
  console.log(`  MCP registered: ${registered ? "yes" : "no"}`);
  console.log(`  Specs written:  ${specCount}`);
  console.log(`  Config file:    ${configPath}`);
  if (!registered) {
    console.log("");
    console.log('  Run "docuflow init" to register.');
  }
}
