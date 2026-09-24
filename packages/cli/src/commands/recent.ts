/**
 * docuflow recent
 *
 * Shows a dashboard of recent activity:
 *   - Recent git commits (last N days)
 *   - Recent wiki activity from .docuflow/log.md
 */

import fsp from "node:fs/promises";
import path from "node:path";
import { execSync } from "node:child_process";

export interface RecentOptions {
  days: number;        // default 7
  format: "table" | "md"; // default "table"
}

interface WikiEntry {
  date: string;
  operation: string;
  file: string;
}

// ── ANSI helpers ──────────────────────────────────────────────────────────────
const c = {
  dim:  (s: string) => `\x1b[2m${s}\x1b[0m`,
  bold: (s: string) => `\x1b[1m${s}\x1b[0m`,
  cyan: (s: string) => `\x1b[36m${s}\x1b[0m`,
};

function formatDateYMD(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// ── Git commits (recent, date-filtered) ──────────────────────────────────────
function recentCommits(days: number): string[] {
  try {
    const out = execSync(
      `git log --oneline --since="${days} days ago"`,
      { encoding: "utf8", stdio: ["pipe", "pipe", "ignore"] }
    );
    return out.trim().split("\n").filter(Boolean);
  } catch {
    return [];
  }
}

// ── Wiki log parsing ──────────────────────────────────────────────────────────
const headingRe = /^##\s+\[([^\]]+)\]\s+([^|]+?)(?:\s*\|\s*(.+))?$/;

async function parseWikiLog(logPath: string, since: Date): Promise<WikiEntry[]> {
  let content: string;
  try {
    content = await fsp.readFile(logPath, "utf8");
  } catch {
    return [];
  }

  const entries: WikiEntry[] = [];
  for (const line of content.split("\n")) {
    const m = headingRe.exec(line.trim());
    if (!m) {
      // Legacy pipe-delimited: timestamp | tool | target | delta
      const parts = line.split("|").map(p => p.trim());
      if (parts.length >= 3 && parts[0].includes("T")) {
        const d = new Date(parts[0]);
        if (!isNaN(d.getTime()) && d >= since) {
          entries.push({ date: formatDateYMD(d), operation: parts[1] ?? "", file: parts[2] ?? "" });
        }
      }
      continue;
    }
    const d = new Date(m[1]);
    if (isNaN(d.getTime()) || d < since) continue;
    entries.push({ date: formatDateYMD(d), operation: (m[2] ?? "").trim(), file: (m[3] ?? "").trim() });
  }
  return entries;
}

// ── Renderers ─────────────────────────────────────────────────────────────────
function renderTable(commits: string[], wikiEntries: WikiEntry[], days: number): void {
  const fromDate = formatDateYMD(new Date(Date.now() - days * 86400000));
  const toDate   = formatDateYMD(new Date());

  console.log("");
  console.log(c.bold(`DocuFlow — Recent Activity (${fromDate} → ${toDate})`));
  console.log("");

  console.log(c.bold(`Git Commits (last ${days} days)`));
  console.log("─".repeat(60));
  if (commits.length === 0) {
    console.log(c.dim("  No commits in this period."));
  } else {
    for (const line of commits) {
      const sha  = line.slice(0, 7);
      const msg  = line.slice(8);
      console.log(`  ${c.cyan(sha)}  ${msg}`);
    }
  }

  console.log("");
  console.log(c.bold(`Wiki Activity (last ${days} days)`));
  console.log("─".repeat(60));
  if (wikiEntries.length === 0) {
    console.log(c.dim("  No wiki activity in this period."));
  } else {
    for (const e of wikiEntries) {
      console.log(`  ${c.dim(e.date)}  ${e.operation}${e.file ? "  " + c.dim(e.file) : ""}`);
    }
  }
  console.log("");
}

function renderMarkdown(commits: string[], wikiEntries: WikiEntry[], days: number): void {
  const fromDate = formatDateYMD(new Date(Date.now() - days * 86400000));
  const toDate   = formatDateYMD(new Date());

  console.log(`# DocuFlow — Recent Activity (${fromDate} → ${toDate})`);
  console.log("");
  console.log(`## Git Commits (last ${days} days)`);
  console.log("");
  if (commits.length === 0) {
    console.log("_No commits in this period._");
  } else {
    for (const line of commits) {
      console.log(`- ${line}`);
    }
  }

  console.log("");
  console.log(`## Wiki Activity (last ${days} days)`);
  console.log("");
  if (wikiEntries.length === 0) {
    console.log("_No wiki activity in this period._");
  } else {
    console.log("| Date | Operation | File |");
    console.log("|------|-----------|------|");
    for (const e of wikiEntries) {
      console.log(`| ${e.date} | ${e.operation} | ${e.file} |`);
    }
  }
}

// ── Main entry point ──────────────────────────────────────────────────────────
export async function run(opts: RecentOptions = { days: 7, format: "table" }): Promise<void> {
  const days   = Math.max(1, isNaN(opts.days) ? 7 : opts.days);
  const format = opts.format ?? "table";

  const cwd     = process.cwd();
  const logPath = path.join(cwd, ".docuflow", "log.md");
  const since   = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const commits    = recentCommits(days);
  const wikiEntries = await parseWikiLog(logPath, since);

  if (format === "md") {
    renderMarkdown(commits, wikiEntries, days);
  } else {
    renderTable(commits, wikiEntries, days);
  }
}
