/**
 * docuflow watch stop     — stop the running watch daemon for this project
 * docuflow watch status   — show whether the daemon is running + details
 * docuflow watch restart  — stop the current daemon then start a new one
 *
 * All three commands use the PID file at .docuflow/watch.pid written when
 * the daemon starts. The PID file contains: pid, started_at, bridge, options.
 *
 * stop    → SIGTERM → wait up to 5s → SIGKILL if still alive → remove PID file
 * status  → check PID alive, show uptime/bridge/project
 * restart → stop + re-spawn `docuflow watch` with same options
 */

import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import {
  getPidFilePath,
  readPidFile,
  removePidFile,
  isProcessAlive,
  WatchPidData,
  FailoverRecord,
} from "./watch";

// ─── Colour helpers ─────────────────────────────────────────────────────────
const c = {
  green:  (s: string) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s: string) => `\x1b[33m${s}\x1b[0m`,
  red:    (s: string) => `\x1b[31m${s}\x1b[0m`,
  cyan:   (s: string) => `\x1b[36m${s}\x1b[0m`,
  dim:    (s: string) => `\x1b[2m${s}\x1b[0m`,
  bold:   (s: string) => `\x1b[1m${s}\x1b[0m`,
};

// ─── Uptime formatter ────────────────────────────────────────────────────────

function formatUptime(startedAt: string): string {
  const ms = Date.now() - new Date(startedAt).getTime();
  const secs  = Math.floor(ms / 1000);
  const mins  = Math.floor(secs / 60);
  const hours = Math.floor(mins / 60);
  const days  = Math.floor(hours / 24);

  if (days > 0)  return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${mins % 60}m`;
  if (mins > 0)  return `${mins}m ${secs % 60}s`;
  return `${secs}s`;
}

// ─── stop ────────────────────────────────────────────────────────────────────

export async function runStop(projectPath: string): Promise<void> {
  projectPath = path.resolve(projectPath);
  const data = await readPidFile(projectPath);

  if (!data) {
    console.log(c.yellow("  ⚠  No watch.pid file found — daemon may not be running."));
    console.log(c.dim(`     (looked in ${getPidFilePath(projectPath)})`));
    process.exit(0);
  }

  if (!isProcessAlive(data.pid)) {
    console.log(c.yellow(`  ⚠  PID ${data.pid} is no longer alive (stale PID file).`));
    await removePidFile(projectPath);
    console.log(c.dim("     Stale PID file removed."));
    process.exit(0);
  }

  console.log(`\n  🛑 Stopping DocuFlow watch daemon`);
  console.log(`     PID:     ${data.pid}`);
  console.log(`     Bridge:  ${data.bridge}`);
  console.log(`     Uptime:  ${formatUptime(data.started_at)}`);
  console.log();

  // Send SIGTERM — gives daemon chance to clean up gracefully
  try {
    process.kill(data.pid, "SIGTERM");
  } catch (e: any) {
    console.error(c.red(`  ✗ Failed to send SIGTERM: ${e.message}`));
    process.exit(1);
  }

  // Wait up to 5s for the process to exit, then SIGKILL
  const deadline = Date.now() + 5000;
  while (isProcessAlive(data.pid)) {
    if (Date.now() > deadline) {
      console.log(c.yellow("  ⚠  Still alive after 5s — sending SIGKILL..."));
      try { process.kill(data.pid, "SIGKILL"); } catch {}
      await new Promise(r => setTimeout(r, 500));
      break;
    }
    await new Promise(r => setTimeout(r, 200));
  }

  // Clean up PID file if daemon didn't remove it itself
  await removePidFile(projectPath);

  if (!isProcessAlive(data.pid)) {
    console.log(c.green("  ✅ Watch daemon stopped successfully."));
  } else {
    console.log(c.yellow("  ⚠  Process may still be running — check manually."));
  }
  console.log();
}

// ─── status ──────────────────────────────────────────────────────────────────

export async function runStatus(projectPath: string): Promise<void> {
  projectPath = path.resolve(projectPath);
  const data = await readPidFile(projectPath);

  console.log(`\n  📡 DocuFlow Watch Status`);
  console.log("  ─────────────────────────────────────────────────");

  if (!data) {
    console.log(`  State:    ${c.dim("stopped")} (no watch.pid file)`);
    console.log(`  Project:  ${projectPath}`);
    console.log();
    console.log(c.dim(`  Run "docuflow watch" to start the daemon.`));
    console.log();
    process.exit(0);
  }

  const alive = isProcessAlive(data.pid);

  if (!alive) {
    console.log(`  State:    ${c.yellow("stopped")} (stale PID file — process died unexpectedly)`);
    console.log(`  Last PID: ${data.pid}`);
    console.log(`  Started:  ${new Date(data.started_at).toLocaleString()}`);
    console.log(`  Bridge:   ${data.bridge}`);
    console.log();
    console.log(c.dim(`  Run "docuflow watch" to restart.`));
    // Clean up stale PID file
    await removePidFile(projectPath);
    console.log(c.dim(`  (Stale PID file cleaned up)`));
    console.log();
    process.exit(1); // non-zero: daemon is not healthy
  }

  const bridgeIcon =
    data.bridge === "copilot" || data.bridge === "claude" ? "⚡" :
    data.bridge === "codex" || data.bridge === "api"      ? "🔤" : "📁";

  const bridgeLabel =
    data.bridge === "none"    ? c.dim("sources-only (no AI)") :
    data.bridge === "copilot" ? c.green("copilot — direct MCP ⚡") :
    data.bridge === "claude"  ? c.green("claude  — direct MCP ⚡") :
    data.bridge === "codex"   ? c.yellow("codex   — doc-gen mode") :
    data.bridge === "api"     ? c.yellow("api     — doc-gen mode") : data.bridge;

  console.log(`  State:    ${c.green("● running")}`);
  console.log(`  PID:      ${data.pid}`);
  console.log(`  Uptime:   ${formatUptime(data.started_at)}`);
  console.log(`  Started:  ${new Date(data.started_at).toLocaleString()}`);
  console.log(`  Bridge:   ${bridgeLabel}`);

  // Active bridge — only shown when it differs from startup bridge (failover occurred)
  const activeBridge = data.active_bridge ?? data.bridge;
  if (activeBridge !== data.bridge) {
    const activeBridgeLabel =
      activeBridge === "none"    ? c.dim("sources-only (no AI)") :
      activeBridge === "copilot" ? c.green("copilot — direct MCP ⚡") :
      activeBridge === "claude"  ? c.green("claude  — direct MCP ⚡") :
      activeBridge === "codex"   ? c.yellow("codex   — doc-gen mode") :
      activeBridge === "api"     ? c.yellow("api     — doc-gen mode") : activeBridge;
    console.log(`  Active bridge: ${activeBridgeLabel} ${c.yellow("(failed over)")}`);
  }

  // Failover stats
  const failover: FailoverRecord = data.failover ?? { count: 0, last_at: null, from: null, to: null, reason: null };
  if (failover.count > 0) {
    const lastAt = failover.last_at
      ? new Date(failover.last_at).toLocaleTimeString()
      : "unknown";
    console.log(`  Failovers:     ${c.yellow(String(failover.count))} total`);
    console.log(`  Last failover: ${lastAt} — ${failover.from} → ${failover.to}`);
    if (failover.reason) {
      console.log(`  Reason:        ${c.dim(failover.reason)}`);
    }
  } else {
    console.log(`  Failovers:     ${c.dim("none")}`);
  }

  console.log(`  Project:  ${data.project_path}`);

  if (data.options.lintIntervalHours) {
    console.log(`  Lint:     every ${data.options.lintIntervalHours}h`);
  }
  if (data.options.codeExtensions?.length) {
    console.log(`  Exts:     ${data.options.codeExtensions.join(", ")}`);
  }

  console.log();
  console.log(c.dim(`  Run "docuflow watch stop"    to stop the daemon.`));
  console.log(c.dim(`  Run "docuflow watch restart" to restart with same options.`));
  console.log();
}

// ─── restart ─────────────────────────────────────────────────────────────────

export async function runRestart(projectPath: string): Promise<void> {
  projectPath = path.resolve(projectPath);
  const data = await readPidFile(projectPath);

  console.log(`\n  🔄 Restarting DocuFlow watch daemon\n`);

  // Capture current options before stopping
  const opts: WatchPidData["options"] = data?.options ?? {
    ai: false,
    forceCopilot: false,
    forceClaude: false,
    forceCodex: false,
    lintIntervalHours: 24,
  };

  // Stop existing daemon if running
  if (data && isProcessAlive(data.pid)) {
    console.log(`  Stopping PID ${data.pid} (bridge: ${data.bridge}, uptime: ${formatUptime(data.started_at)})...`);
    try { process.kill(data.pid, "SIGTERM"); } catch {}
    const deadline = Date.now() + 5000;
    while (isProcessAlive(data.pid) && Date.now() < deadline) {
      await new Promise(r => setTimeout(r, 200));
    }
    if (isProcessAlive(data.pid)) {
      try { process.kill(data.pid, "SIGKILL"); } catch {}
    }
    await removePidFile(projectPath);
    console.log(c.green("  ✅ Previous daemon stopped."));
  } else {
    console.log(c.dim("  No running daemon found — starting fresh."));
    if (data) await removePidFile(projectPath);
  }

  // Build args for new daemon
  const cliArgs = ["watch"];
  if (opts.ai)           cliArgs.push("--ai");
  if (opts.forceCopilot) cliArgs.push("--copilot");
  if (opts.forceClaude)  cliArgs.push("--claude");
  if (opts.forceCodex)   cliArgs.push("--codex");
  if (opts.lintIntervalHours !== 24) {
    cliArgs.push("--lint-interval", String(opts.lintIntervalHours));
  }
  if (opts.codeExtensions?.length) {
    cliArgs.push("--code-ext", opts.codeExtensions.join(","));
  }

  // Resolve CLI entry point
  const cliBin = require.resolve("./index") 
    .replace(/\.ts$/, ".js")
    .replace("/src/", "/dist/");

  console.log(`\n  Spawning: node ${path.basename(cliBin)} ${cliArgs.join(" ")}`);

  const child = spawn(process.execPath, [cliBin, ...cliArgs], {
    cwd: projectPath,
    detached: true,
    stdio: "inherit",
  });
  child.unref(); // let parent exit, child runs independently

  console.log(c.green(`\n  ✅ New watch daemon spawned (PID will appear above).`));
  console.log(c.dim(`  Run "docuflow watch status" to confirm.`));
  console.log();

  // Give it a moment to write the PID file, then show status
  await new Promise(r => setTimeout(r, 1500));
  await runStatus(projectPath);
}
