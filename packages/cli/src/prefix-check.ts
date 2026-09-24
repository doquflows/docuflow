/**
 * DEF-4 / DEF-13: On CLI startup, warn (once per day) about cross-prefix mismatches
 * in either direction so the warning always reaches the actor who can act.
 *
 * npm 7+ suppresses postinstall stdout/stderr, so a postinstall-script warning
 * can never reach the user. This module moves the check into the CLI itself.
 *
 * Two warning directions:
 *   Direction 1 — running OLD while NEWER exists elsewhere:
 *     Another prefix has a higher version → user should upgrade.
 *     Fix: npm install -g @doquflow/cli@latest
 *
 *   Direction 2 — running NEW while OLDER shadows PATH (DEF-13):
 *     The first `docuflow` in PATH resolves to a different, older binary →
 *     typing `docuflow` silently uses the wrong version.
 *     Fix: npm uninstall -g @doquflow/cli (in the older prefix's node context)
 *
 * The result is cached to ~/.docuflow/.prefix-check.json for 24 h.
 * DOCUFLOW_CHECK_NOW=1   — bypass the TTY guard (tests, manual runs).
 * DOCUFLOW_PATH_OVERRIDE_BIN — override the PATH-resolved binary path (tests).
 * DOCUFLOW_EXTRA_PREFIXES   — inject extra prefixes into the install scan (tests).
 */

import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { findInstallsSync, semverGt, getMcpEntryPrefix } from "./prefix-utils";

const CACHE_FILE = path.join(os.homedir(), ".docuflow", ".prefix-check.json");
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

interface PrefixCache {
  checkedAt: number;
  currentVersion: string;
  warn: boolean;
  warnMsg?: string;
}

/** Derive the install prefix from the currently-running CLI entry point. */
function currentCliPrefix(): string | null {
  return getMcpEntryPrefix(process.argv[1] ?? "");
}

/**
 * Find the first `docuflow` executable visible in PATH.
 * Returns null when none is found or on any error.
 *
 * DOCUFLOW_PATH_OVERRIDE_BIN replaces the PATH scan entirely (test escape hatch).
 */
function pathResolvedBin(): string | null {
  if (process.env.DOCUFLOW_PATH_OVERRIDE_BIN) {
    return process.env.DOCUFLOW_PATH_OVERRIDE_BIN;
  }
  const dirs = (process.env.PATH ?? "").split(path.delimiter);
  for (const dir of dirs) {
    if (!dir) continue;
    const candidate = path.join(dir, "docuflow");
    try {
      fs.accessSync(candidate, fs.constants.X_OK);
      return fs.realpathSync(candidate);
    } catch { /* not in this dir */ }
  }
  return null;
}

/**
 * Run the dual-prefix check if the cache is stale or missing.
 * Never throws — startup must never be blocked.
 *
 * Warning matrix (both directions checked; first match wins):
 *   D1: another prefix has NEWER version  → "upgrade" message
 *   D2: PATH resolves to OLDER binary      → "remove shadow" message
 *
 * @param currentVersion  The version string from the running CLI's package.json
 */
export function runPrefixCheckIfStale(currentVersion: string): void {
  // Skip in non-interactive contexts (CI, pipes) — warning would be noise.
  // DOCUFLOW_CHECK_NOW=1 bypasses this for tests and explicit manual runs.
  if (!process.stdout.isTTY && !process.env.DOCUFLOW_CHECK_NOW) return;

  try {
    // Read cache — if fresh and version matches, replay the stored warning (or skip)
    if (fs.existsSync(CACHE_FILE)) {
      const cache = JSON.parse(fs.readFileSync(CACHE_FILE, "utf8")) as PrefixCache;
      if (
        cache.currentVersion === currentVersion &&
        Date.now() - cache.checkedAt < CACHE_TTL_MS
      ) {
        if (cache.warn && cache.warnMsg) process.stderr.write(cache.warnMsg + "\n");
        return;
      }
    }

    // Determine which prefix the active binary came from
    const myPrefix = currentCliPrefix() ?? path.dirname(path.dirname(process.execPath));

    // Accept extra prefixes from env var so tests can inject fake installs
    const extras = process.env.DOCUFLOW_EXTRA_PREFIXES
      ? process.env.DOCUFLOW_EXTRA_PREFIXES.split(path.delimiter)
      : [];

    const allInstalls = findInstallsSync(extras);
    let warnMsg: string | undefined;

    // Direction 1: another prefix holds a NEWER version → user is running stale
    for (const install of allInstalls) {
      if (path.resolve(install.prefix) === path.resolve(myPrefix)) continue;
      if (semverGt(install.version, currentVersion)) {
        const shortPrefix = install.prefix.replace(os.homedir(), "~");
        warnMsg =
          `⚠️  docuflow ${install.version} is installed at ${shortPrefix}` +
          ` but you are running ${currentVersion}.` +
          `  Fix: npm install -g @doquflow/cli@latest`;
        break;
      }
    }

    // Direction 2 (DEF-13): an OLDER install at a PATH-earlier prefix shadows this binary.
    // "Shadow" = what the user types as `docuflow` resolves to a different, older binary.
    if (!warnMsg) {
      const myBin = path.resolve(path.join(myPrefix, "bin", "docuflow"));
      const pathBin = pathResolvedBin();
      if (pathBin && path.resolve(pathBin) !== myBin) {
        // Derive shadowing install's prefix: binary lives at <prefix>/bin/docuflow
        const shadowPrefix = path.dirname(path.dirname(path.resolve(pathBin)));
        const shadowInstall = allInstalls.find(
          i => path.resolve(i.prefix) === path.resolve(shadowPrefix),
        );
        if (shadowInstall && semverGt(currentVersion, shadowInstall.version)) {
          const shortShadow = shadowInstall.prefix.replace(os.homedir(), "~");
          warnMsg =
            `⚠️  docuflow ${shadowInstall.version} at ${shortShadow}` +
            ` shadows this install (${currentVersion}) in your PATH.` +
            `  Fix: npm uninstall -g @doquflow/cli  (run from the ${shortShadow} node context)`;
        }
      }
    }

    // Persist cache
    try {
      fs.mkdirSync(path.dirname(CACHE_FILE), { recursive: true });
      const cache: PrefixCache = {
        checkedAt: Date.now(),
        currentVersion,
        warn: !!warnMsg,
        warnMsg,
      };
      fs.writeFileSync(CACHE_FILE, JSON.stringify(cache), "utf8");
    } catch { /* non-fatal */ }

    if (warnMsg) process.stderr.write(warnMsg + "\n");
  } catch { /* never block startup */ }
}
