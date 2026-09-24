/**
 * Shared utilities for detecting multiple @doquflow/cli installations across
 * different npm global prefixes (nvm, hermes, fnm, homebrew, etc.).
 *
 * Used by:
 *  - prefix-check.ts  (startup warning, DEF-4)
 *  - commands/init.ts (repair cross-prefix MCP configs, DEF-12)
 */

import fs from "node:fs";
import path from "node:path";
import os from "node:os";

export interface InstallInfo {
  prefix: string;
  version: string;
  nodeBin: string;
  /** Path to the @doquflow/studio MCP entry JS, or null if not found */
  serverBin: string | null;
}

/**
 * Resolve the @doquflow/studio MCP entry for a given install prefix.
 * Tries the bundled location (inside cli's node_modules) then the hoisted location.
 */
export function resolveServerBinForPrefix(prefix: string): string | null {
  const bundled = path.join(
    prefix, "lib", "node_modules", "@doquflow", "cli",
    "node_modules", "@doquflow", "studio", "dist", "mcp", "index.js",
  );
  if (fs.existsSync(bundled)) return bundled;

  const hoisted = path.join(
    prefix, "lib", "node_modules", "@doquflow", "studio", "dist", "mcp", "index.js",
  );
  if (fs.existsSync(hoisted)) return hoisted;

  return null;
}

/**
 * Candidate prefix paths to scan on macOS / Linux.
 * Accepts an optional extra list (useful for tests via DOCUFLOW_EXTRA_PREFIXES).
 */
function candidatePrefixes(extras: string[] = []): string[] {
  const home = os.homedir();
  const candidates: string[] = [...extras];

  // nvm
  const nvmDir = path.join(home, ".nvm", "versions", "node");
  if (fs.existsSync(nvmDir)) {
    try {
      for (const ver of fs.readdirSync(nvmDir)) {
        candidates.push(path.join(nvmDir, ver));
      }
    } catch { /* ignore */ }
  }

  // hermes (Waymark / custom node manager)
  candidates.push(path.join(home, ".hermes", "node"));

  // fnm
  const fnmDir = path.join(home, ".fnm", "node-versions");
  if (fs.existsSync(fnmDir)) {
    try {
      for (const ver of fs.readdirSync(fnmDir)) {
        candidates.push(path.join(fnmDir, ver, "installation"));
      }
    } catch { /* ignore */ }
  }

  // volta
  candidates.push(path.join(home, ".volta", "tools", "image", "node"));

  // homebrew / system
  candidates.push("/opt/homebrew", "/usr/local", "/usr");

  // npm-global (manually configured)
  candidates.push(path.join(home, ".npm-global"));

  return candidates;
}

/**
 * Synchronously scan all known npm prefix locations and return every prefix
 * that has @doquflow/cli installed, sorted newest-first.
 */
export function findInstallsSync(extras: string[] = []): InstallInfo[] {
  const results: InstallInfo[] = [];
  const seen = new Set<string>();

  for (const prefix of candidatePrefixes(extras)) {
    const resolved = path.resolve(prefix);
    if (seen.has(resolved)) continue;
    seen.add(resolved);

    const pkgJson = path.join(resolved, "lib", "node_modules", "@doquflow", "cli", "package.json");
    if (!fs.existsSync(pkgJson)) continue;

    try {
      const pkg = JSON.parse(fs.readFileSync(pkgJson, "utf8")) as { version?: string };
      if (!pkg.version) continue;

      const nodeBin = path.join(resolved, "bin", "node");
      results.push({
        prefix: resolved,
        version: pkg.version,
        nodeBin: fs.existsSync(nodeBin) ? nodeBin : process.execPath,
        serverBin: resolveServerBinForPrefix(resolved),
      });
    } catch { /* corrupted install — skip */ }
  }

  results.sort((a, b) => semverCompare(b.version, a.version));
  return results;
}

/** Extract the npm prefix from an MCP entry path. */
export function getMcpEntryPrefix(entryPath: string): string | null {
  const m = entryPath.match(/^(.*?)\/lib\/node_modules\/@doquflow\//);
  return m ? path.resolve(m[1]) : null;
}

/** Read the @doquflow/cli version from an MCP entry path (traverses up to find package.json). */
export function getInstalledCliVersion(mcpEntryPath: string): string | null {
  const prefix = getMcpEntryPrefix(mcpEntryPath);
  if (!prefix) return null;
  const pkgJson = path.join(prefix, "lib", "node_modules", "@doquflow", "cli", "package.json");
  try {
    const pkg = JSON.parse(fs.readFileSync(pkgJson, "utf8")) as { version?: string };
    return pkg.version ?? null;
  } catch { return null; }
}

/** Returns true when version string a > b (semver numeric compare). */
export function semverGt(a: string, b: string): boolean {
  return semverCompare(a, b) > 0;
}

/** 3-part numeric semver comparison. Returns >0 if a>b, <0 if a<b, 0 if equal. */
export function semverCompare(a: string, b: string): number {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}
