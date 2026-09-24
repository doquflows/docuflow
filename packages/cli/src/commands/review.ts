/**
 * docuflow review
 *
 * Review git changes and surface deterministic findings plus actionable
 * improvements. Optional --ai mode appends Copilot analysis.
 */

import path from "node:path";
import { spawnSync } from "node:child_process";

const DIFF_CAP_BYTES = 200 * 1024;
const AI_DIFF_CAP_CHARS = 40_000;

const c = {
  green: (s: string) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s: string) => `\x1b[33m${s}\x1b[0m`,
  red: (s: string) => `\x1b[31m${s}\x1b[0m`,
  cyan: (s: string) => `\x1b[36m${s}\x1b[0m`,
  bold: (s: string) => `\x1b[1m${s}\x1b[0m`,
  dim: (s: string) => `\x1b[2m${s}\x1b[0m`,
};

export interface ReviewOptions {
  projectPath?: string;
  staged?: boolean;
  sinceCommit?: string;
  ai?: boolean;
  failOnCritical?: boolean;
  quiet?: boolean;
}

function runGit(projectPath: string, args: string[]): string {
  const result = spawnSync("git", args, { cwd: projectPath, encoding: "utf8" });
  if (result.status !== 0) {
    const stderr = (result.stderr ?? "").trim();
    const badRef = /bad revision|unknown revision|ambiguous argument/i.test(stderr);
    if (badRef) {
      throw new Error(`Invalid git ref: ${args.join(" ")}`);
    }
    throw new Error(stderr || `git ${args.join(" ")} failed`);
  }
  return (result.stdout ?? "").trim();
}

function runGitAllowStatuses(projectPath: string, args: string[], allowedStatuses: number[]): string {
  const result = spawnSync("git", args, { cwd: projectPath, encoding: "utf8" });
  if (result.status === null || !allowedStatuses.includes(result.status)) {
    const stderr = (result.stderr ?? "").trim();
    const badRef = /bad revision|unknown revision|ambiguous argument/i.test(stderr);
    if (badRef) {
      throw new Error(`Invalid git ref: ${args.join(" ")}`);
    }
    throw new Error(stderr || `git ${args.join(" ")} failed`);
  }
  return (result.stdout ?? "").trim();
}

function ensureGitRepo(projectPath: string): void {
  try {
    const out = runGit(projectPath, ["rev-parse", "--is-inside-work-tree"]);
    if (out !== "true") {
      throw new Error("not a git repository");
    }
  } catch {
    throw new Error(`No git repository detected at ${projectPath}`);
  }
}

function parsePorcelainPaths(porcelain: string): string[] {
  const out = new Set<string>();
  for (const line of porcelain.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const payload = line.replace(/^[ MARCUD?!]{1,2}\s+/, "").trim();
    if (!payload) continue;
    if (payload.includes(" -> ")) {
      const parts = payload.split(" -> ");
      out.add(parts[parts.length - 1].trim());
    } else {
      out.add(payload);
    }
  }
  return Array.from(out).sort((a, b) => a.localeCompare(b));
}

function capDiff(diffText: string): string {
  const bytes = Buffer.byteLength(diffText, "utf8");
  if (bytes <= DIFF_CAP_BYTES) return diffText;
  const truncated = Buffer.from(diffText, "utf8").subarray(0, DIFF_CAP_BYTES).toString("utf8");
  return `${truncated}\n\n[DOCUFLOW_DIFF_TRUNCATED: analyzed first ${DIFF_CAP_BYTES} bytes of ${bytes} bytes]\n`;
}

function pushUnique(arr: string[], item: string): void {
  if (!arr.includes(item)) arr.push(item);
}

export function getChangedFiles(projectPath: string, staged: boolean, sinceCommit?: string): string[] {
  if (sinceCommit) {
    const output = runGit(projectPath, ["diff", "--name-only", sinceCommit, "HEAD"]);
    return output ? output.split("\n").filter(Boolean) : [];
  }
  if (staged) {
    const output = runGit(projectPath, ["diff", "--name-only", "--cached"]);
    return output ? output.split("\n").filter(Boolean) : [];
  }
  return parsePorcelainPaths(runGit(projectPath, ["status", "--porcelain"]));
}

export function getDiffText(projectPath: string, staged: boolean, sinceCommit?: string): string {
  if (sinceCommit) {
    return capDiff(runGit(projectPath, ["diff", sinceCommit, "HEAD"]));
  }
  if (staged) {
    return capDiff(runGit(projectPath, ["diff", "--cached"]));
  }

  const untracked = runGit(projectPath, ["ls-files", "--others", "--exclude-standard"])
    .split("\n")
    .map(line => line.trim())
    .filter(Boolean);

  const untrackedPatches: string[] = [];
  for (const file of untracked) {
    const patch = runGitAllowStatuses(projectPath, ["diff", "--no-index", "--", "/dev/null", file], [0, 1]);
    if (patch) {
      untrackedPatches.push(patch);
    }
  }

  const stagedDiff = runGit(projectPath, ["diff", "--cached"]);
  const workingDiff = runGit(projectPath, ["diff"]);
  const joined = [
    "=== STAGED DIFF ===",
    stagedDiff,
    "",
    "=== WORKING TREE DIFF ===",
    workingDiff,
    "",
    "=== UNTRACKED FILE DIFF ===",
    untrackedPatches.join("\n"),
  ].join("\n");
  return capDiff(joined);
}

export function buildDeterministicReview(changedFiles: string[], diffText: string): {
  summary: string[];
  critical: string[];
  warnings: string[];
  improvements: string[];
} {
  const summary: string[] = [];
  const critical: string[] = [];
  const warnings: string[] = [];
  const improvements: string[] = [];

  summary.push(`Changed files: ${changedFiles.length}`);
  for (const f of changedFiles.slice(0, 10)) {
    summary.push(f);
  }
  if (changedFiles.length > 10) {
    summary.push(`...and ${changedFiles.length - 10} more`);
  }

  const truncated = diffText.includes("[DOCUFLOW_DIFF_TRUNCATED:");
  if (truncated) {
    warnings.push("Large diff detected; review is partial due to diff size cap.");
    improvements.push("Run focused reviews per file or per commit range for full coverage.");
  }

  const addedLines = diffText
    .split("\n")
    .filter(line => line.startsWith("+") && !line.startsWith("+++"))
    .map(line => line.slice(1));

  if (changedFiles.length > 0 && addedLines.length === 0) {
    summary.push("Textual diff is empty (likely binary/rename-only changes).");
    improvements.push("Manually review binary assets and metadata changes before commit.");
    return { summary, critical, warnings, improvements };
  }

  const addedText = addedLines.join("\n");

  if (/(AKIA[0-9A-Z]{16}|ghp_[A-Za-z0-9]{30,}|sk-[A-Za-z0-9]{20,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----)/.test(addedText)) {
    critical.push("Potential secret/key material detected in added lines.");
    improvements.push("Remove credentials from code and load secrets via environment variables.");
  }

  if (/(password|token|secret)\s*[:=]\s*["'][^"']{4,}["']/i.test(addedText)) {
    critical.push("Hardcoded credential-like value detected.");
  }

  if (/\b(eval|new Function)\s*\(/.test(addedText)) {
    critical.push("Dynamic code execution (`eval`/`new Function`) detected.");
    improvements.push("Replace dynamic execution with explicit parsing or whitelisted dispatch.");
  }

  if (/\bchild_process\.(exec|execSync)\s*\(/.test(addedText)) {
    warnings.push("Shell execution added via child_process.exec/execSync.");
    improvements.push("Prefer spawn/spawnSync with argument arrays and explicit input validation.");
  }

  if (/\bTODO\b|\bFIXME\b|\bHACK\b/.test(addedText)) {
    warnings.push("TODO/FIXME/HACK markers found in added code.");
    improvements.push("Resolve or ticket these markers before merge to avoid hidden follow-up work.");
  }

  if (/console\.log\s*\(/.test(addedText)) {
    warnings.push("console.log statements found in added lines.");
    improvements.push("Use structured logger patterns or remove debug logging before merge.");
  }

  if (/\bas any\b|:\s*any\b/.test(addedText)) {
    warnings.push("Type safety weakened with `any` usage.");
    improvements.push("Tighten types with explicit interfaces or narrow unions.");
  }

  if (/@ts-ignore/.test(addedText)) {
    warnings.push("@ts-ignore found in added lines.");
    improvements.push("Replace @ts-ignore with proper typing or guarded runtime checks.");
  }

  if (/catch\s*(\([^)]*\))?\s*\{\s*\}/.test(addedText)) {
    warnings.push("Empty catch block detected.");
    improvements.push("Handle caught errors explicitly and emit actionable context.");
  }

  const longLines = addedLines.filter(line => line.length > 160).length;
  if (longLines > 0) {
    warnings.push(`${longLines} long added line(s) (>160 chars) may hurt readability.`);
  }

  const hasTestFile = changedFiles.some(f => /(^|\/)(test|tests|__tests__)\/|\.test\.[a-z]+$|\.spec\.[a-z]+$/i.test(f));
  if (!hasTestFile) {
    improvements.push("Consider adding or updating tests for changed behavior.");
  }

  if (critical.length === 0 && warnings.length === 0) {
    summary.push("No deterministic critical/warning findings detected.");
    improvements.push("Quick manual pass for architecture consistency and naming is still recommended.");
  }

  return { summary, critical, warnings, improvements };
}

function buildCopilotPrompt(projectPath: string, changedFiles: string[], diffText: string): string {
  const diffForPrompt = diffText.slice(0, AI_DIFF_CAP_CHARS);
  return [
    `Review these git changes for project: ${projectPath}`,
    ``,
    `Changed files:`,
    changedFiles.slice(0, 40).map(f => `- ${f}`).join("\n") || "(none)",
    ``,
    `Diff:`,
    diffForPrompt || "(no textual diff)",
    ``,
    `Return concise markdown with sections:`,
    `1) Critical issues`,
    `2) Warnings`,
    `3) Concrete improvements`,
    `Focus on correctness, security, and maintainability.`,
  ].join("\n");
}

export function runCopilotReview(prompt: string): string | null {
  const result = spawnSync(
    "copilot",
    [
      "--prompt", prompt,
      "--allow-all-tools",
      "--allow-all-paths",
      "--no-ask-user",
      "--output-format", "json"
    ],
    { encoding: "utf8", timeout: 180_000 }
  );
  if (result.error || result.status !== 0) return null;

  let lastMessage: string | null = null;
  for (const line of (result.stdout ?? "").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const obj = JSON.parse(trimmed);
      if (obj.type === "assistant.message" && obj.data?.content) {
        lastMessage = obj.data.content;
      }
    } catch {
      // ignore malformed json lines
    }
  }
  return lastMessage;
}

function printSection(title: string, lines: string[], quiet: boolean): void {
  const label = quiet ? title : c.bold(title);
  console.log(`\n${label}`);
  if (lines.length === 0) {
    console.log("  - none");
    return;
  }
  for (const line of lines) {
    console.log(`  - ${line}`);
  }
}

export async function run(options: ReviewOptions = {}): Promise<void> {
  const projectPath = path.resolve(options.projectPath ?? process.cwd());
  const staged = !!options.staged;
  const sinceCommit = options.sinceCommit;
  const quiet = !!options.quiet;
  const failOnCritical = !!options.failOnCritical;
  const ai = !!options.ai;

  try {
    ensureGitRepo(projectPath);
  } catch (error) {
    console.error(c.red(`✗ ${(error as Error).message}`));
    process.exit(2);
  }

  let changedFiles: string[] = [];
  let diffText = "";
  try {
    changedFiles = getChangedFiles(projectPath, staged, sinceCommit);
    diffText = getDiffText(projectPath, staged, sinceCommit);
  } catch (error) {
    const message = (error as Error).message;
    if (message.startsWith("Invalid git ref:")) {
      console.error(c.red(`✗ Invalid --since-commit ref: ${sinceCommit}`));
      process.exit(2);
    }
    console.error(c.red(`✗ ${message}`));
    process.exit(2);
  }

  if (changedFiles.length === 0) {
    console.log(quiet ? "nothing to review" : c.cyan("Nothing to review: no changed files in selected scope."));
    return;
  }

  const modeLabel = sinceCommit
    ? `since ${sinceCommit}`
    : staged
    ? "staged changes"
    : "working tree (staged + unstaged)";

  if (!quiet) {
    console.log(c.bold("\n🔍 DocuFlow Review\n"));
    console.log(`Scope: ${c.cyan(modeLabel)}`);
  }

  const deterministic = buildDeterministicReview(changedFiles, diffText);
  printSection("Summary", deterministic.summary, quiet);
  printSection("Critical", deterministic.critical, quiet);
  printSection("Warnings", deterministic.warnings, quiet);
  printSection("Improvements", deterministic.improvements, quiet);

  if (ai) {
    const prompt = buildCopilotPrompt(projectPath, changedFiles, diffText);
    const aiResult = runCopilotReview(prompt);
    if (aiResult) {
      const aiLabel = quiet ? "AI Review (Copilot)" : c.bold("\nAI Review (Copilot)");
      console.log(`\n${aiLabel}`);
      console.log(aiResult);
    } else {
      deterministic.improvements.push("Copilot AI review unavailable; using deterministic review only");
    }
  }

  if (failOnCritical && deterministic.critical.length > 0) {
    process.exit(1);
  }
}
