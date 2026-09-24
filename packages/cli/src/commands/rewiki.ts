/**
 * docuflow rewiki
 *
 * Re-ingests all sources with the current extractor rules, migrates any
 * synthesiss/ typo (defense-in-depth), backs up the existing wiki, and
 * produces an audit report of removed / preserved pages.
 *
 * Usage:
 *   docuflow rewiki                  # full migration with backup
 *   docuflow rewiki --dry-run        # preview what would change, no writes
 *   docuflow rewiki --no-backup      # skip backup (faster, irreversible)
 *   docuflow rewiki --quiet          # suppress progress output
 *
 * Exit codes:
 *   0 — success
 *   2 — fatal error (.docuflow missing, server tools not found)
 */

import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";

// ─── Colour helpers ────────────────────────────────────────────────────────────
const c = {
  green:  (s: string) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s: string) => `\x1b[33m${s}\x1b[0m`,
  red:    (s: string) => `\x1b[31m${s}\x1b[0m`,
  cyan:   (s: string) => `\x1b[36m${s}\x1b[0m`,
  dim:    (s: string) => `\x1b[2m${s}\x1b[0m`,
  bold:   (s: string) => `\x1b[1m${s}\x1b[0m`,
};

// ─── Dynamic server tool loader (mirrors sync.ts pattern) ─────────────────────
function loadServerTool(toolFile: string): any {
  const candidates = [
    () => require(`@doquflow/core/dist/tools/${toolFile}`),
    () => require(path.resolve(__dirname, "../../../core/dist/tools", toolFile)),
    () => require(path.resolve(__dirname, "../../core/dist/tools", toolFile)),
    () => require(`@doquflow/studio/dist/tools/${toolFile}`),
    () => require(path.resolve(__dirname, "../../../studio/dist/tools", toolFile)),
    () => require(path.resolve(__dirname, "../../studio/dist/tools", toolFile)),
  ];
  for (const attempt of candidates) {
    try { return attempt(); } catch {}
  }
  throw new Error(`Cannot load server tool "${toolFile}". Run "npm run build" first.`);
}

// ─── Wiki page scanner ─────────────────────────────────────────────────────────

interface PageInfo {
  filePath: string;   // absolute
  pageId: string;     // filename without .md
  category: string;   // subdirectory name (entities, concepts, syntheses, timelines)
  tags: string[];     // parsed from frontmatter
  isUserSaved: boolean; // true if query_result tag present
}

function parseTags(content: string): string[] {
  const m = content.match(/^tags:\s*(\[.*?\])/m);
  if (!m) return [];
  try { return JSON.parse(m[1]!); } catch { return []; }
}

async function scanWiki(wikiDir: string): Promise<PageInfo[]> {
  const pages: PageInfo[] = [];
  if (!fs.existsSync(wikiDir)) return pages;

  const subdirs = await fsp.readdir(wikiDir).catch(() => [] as string[]);
  for (const subdir of subdirs) {
    const subdirPath = path.join(wikiDir, subdir);
    const stat = await fsp.stat(subdirPath).catch(() => null);
    if (!stat?.isDirectory()) continue;

    const files = await fsp.readdir(subdirPath).catch(() => [] as string[]);
    for (const file of files) {
      if (!file.endsWith(".md")) continue;
      const filePath = path.join(subdirPath, file);
      const content = await fsp.readFile(filePath, "utf8").catch(() => "");
      const tags = parseTags(content);
      pages.push({
        filePath,
        pageId: file.replace(/\.md$/, ""),
        category: subdir,
        tags,
        isUserSaved: tags.includes("query_result"),
      });
    }
  }
  return pages;
}

// ─── Recursive copy ────────────────────────────────────────────────────────────
async function copyDir(src: string, dest: string): Promise<void> {
  await fsp.mkdir(dest, { recursive: true });
  const entries = await fsp.readdir(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath  = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      await copyDir(srcPath, destPath);
    } else {
      await fsp.copyFile(srcPath, destPath);
    }
  }
}

// ─── Count pages by category ───────────────────────────────────────────────────
function countByCategory(pages: PageInfo[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const p of pages) {
    counts[p.category] = (counts[p.category] ?? 0) + 1;
  }
  return counts;
}

// ─── Command options & entrypoint ─────────────────────────────────────────────

export interface RewikiOptions {
  dryRun?:   boolean;
  noBackup?: boolean;
  quiet?:    boolean;
}

export async function run(options: RewikiOptions = {}): Promise<void> {
  const projectPath = path.resolve(process.cwd());
  const docuDir     = path.join(projectPath, ".docuflow");
  const sourcesDir  = path.join(docuDir, "sources");
  const wikiDir     = path.join(docuDir, "wiki");
  const dryRun      = options.dryRun ?? false;
  const quiet       = options.quiet  ?? false;

  function info(msg: string) { if (!quiet) console.log(msg); }

  // ── Step 1: Pre-flight ──────────────────────────────────────────────────────
  info(c.bold(`\n  🔄 DocuFlow Rewiki${dryRun ? c.yellow(" (dry-run)") : ""}\n`));

  if (!fs.existsSync(docuDir)) {
    console.error(c.red(`  ✗ .docuflow/ not found at ${projectPath}`));
    console.error(`    Run "docuflow init" first.`);
    process.exit(2);
  }

  if (!fs.existsSync(sourcesDir)) {
    console.error(c.red(`  ✗ .docuflow/sources/ not found`));
    console.error(`    Nothing to re-ingest.`);
    process.exit(2);
  }

  // Count sources
  const sourceFiles = (await fsp.readdir(sourcesDir).catch(() => [] as string[]))
    .filter(f => f.endsWith(".md"));
  info(`  📚 Sources: ${sourceFiles.length} file(s)`);

  // Scan current wiki
  const pagesBefore = await scanWiki(wikiDir);
  const countsBefore = countByCategory(pagesBefore);
  info(`  📖 Wiki pages before:`);
  for (const [cat, n] of Object.entries(countsBefore)) {
    info(`     ${cat}: ${n}`);
  }
  if (pagesBefore.length === 0) {
    info(c.yellow(`     (none)`));
  }

  const userSavedPages = pagesBefore.filter(p => p.isUserSaved);
  info(`  👤 User-saved synthesis pages: ${userSavedPages.length} (will be preserved)`);

  if (dryRun) {
    info(c.yellow(`\n  ℹ️  Dry-run mode — no files will be written.\n`));
  }

  // ── Step 2: Backup ──────────────────────────────────────────────────────────
  let backupPath = "skipped";

  if (!options.noBackup && !dryRun) {
    const isoStamp = new Date().toISOString().replace(/[:.]/g, "-");
    backupPath = path.join(docuDir, `wiki.backup-${isoStamp}`);
    info(`\n  💾 Backing up wiki → ${c.cyan(path.relative(projectPath, backupPath))}`);
    if (fs.existsSync(wikiDir)) {
      await copyDir(wikiDir, backupPath);
      info(c.green(`  ✅ Backup complete`));
    } else {
      info(c.yellow(`  ⚠  wiki/ does not exist — skipping backup`));
      backupPath = "skipped (wiki/ missing)";
    }
  } else if (options.noBackup) {
    info(`\n  ⚠  Backup skipped (--no-backup)`);
  }

  // ── Step 3: Migrate synthesiss/ typo (defense-in-depth) ────────────────────
  const synthesissDir = path.join(wikiDir, "synthesiss");
  const synthesesDir  = path.join(wikiDir, "syntheses");
  const migratedFiles: string[] = [];

  if (!dryRun && fs.existsSync(synthesissDir)) {
    info(`\n  🔧 Migrating synthesiss/ → syntheses/ (typo fix)`);
    await fsp.mkdir(synthesesDir, { recursive: true });
    const files = await fsp.readdir(synthesissDir).catch(() => [] as string[]);
    for (const f of files) {
      const src  = path.join(synthesissDir, f);
      const dest = path.join(synthesesDir, f);
      await fsp.rename(src, dest);
      migratedFiles.push(f);
      info(c.dim(`     → ${f}`));
    }
    await fsp.rmdir(synthesissDir).catch(() => {});
    info(c.green(`  ✅ Migrated ${migratedFiles.length} file(s), removed synthesiss/`));
  } else if (dryRun && fs.existsSync(synthesissDir)) {
    const files = await fsp.readdir(synthesissDir).catch(() => [] as string[]);
    info(`\n  🔧 [dry-run] Would migrate ${files.length} file(s) from synthesiss/ → syntheses/`);
    migratedFiles.push(...files);
  }

  // ── Step 4: Clear auto-generated pages & re-ingest ─────────────────────────
  const pagesAfterIds = new Set<string>();
  let ingestErrors = 0;
  const rejectedPages: Array<{ pageId: string; category: string }> = [];

  if (!dryRun) {
    // Delete auto-generated pages (not user-saved) before re-ingesting
    // so old noise pages are removed even if no new equivalent is created
    info(`\n  🗑  Clearing auto-generated wiki pages...`);
    let cleared = 0;
    for (const page of pagesBefore) {
      if (!page.isUserSaved) {
        await fsp.unlink(page.filePath).catch(() => {});
        cleared++;
      }
    }
    info(`     Cleared ${cleared} auto-generated page(s) (${userSavedPages.length} user-saved preserved)`);

    // Load server tools
    let ingestSource: Function;
    let updateIndex: Function;
    try {
      ({ ingestSource } = loadServerTool("ingest-source"));
      ({ updateIndex }  = loadServerTool("update-index"));
    } catch (e: any) {
      console.error(c.red(`  ✗ ${e.message}`));
      process.exit(2);
    }

    // Re-ingest all sources
    info(`\n  📥 Re-ingesting ${sourceFiles.length} source file(s)...`);
    for (const filename of sourceFiles) {
      try {
        const result = await ingestSource({ project_path: projectPath, source_filename: filename });
        const created: string[] = result.pages_created ?? [];
        for (const id of created) pagesAfterIds.add(id);
        info(`     ${c.green("✓")} ${filename} → ${created.length} page(s)`);
      } catch (e: any) {
        info(c.red(`     ✗ ${filename}: ${e.message}`));
        ingestErrors++;
      }
    }

    // ── Step 5: Update index ────────────────────────────────────────────────
    info(`\n  📋 Rebuilding index...`);
    const indexResult = await updateIndex({ project_path: projectPath });
    info(c.green(`  ✅ Index rebuilt — ${indexResult.entries_indexed ?? "?"} entries`));

  } else {
    // Dry-run: simulate what would happen
    info(`\n  📥 [dry-run] Would re-ingest ${sourceFiles.length} source file(s)`);
    let { ingestSource } = (() => {
      try { return loadServerTool("ingest-source"); } catch { return { ingestSource: null }; }
    })();

    if (ingestSource) {
      for (const filename of sourceFiles) {
        try {
          const result = await ingestSource({ project_path: projectPath, source_filename: filename });
          for (const id of (result.pages_created ?? [])) pagesAfterIds.add(id);
          info(`     ${c.dim("~")} ${filename} → ${(result.pages_created ?? []).length} page(s) (dry-run)`);
        } catch {}
      }
    }
  }

  // ── Pages removed = before - after - user-saved ───────────────────────────
  for (const page of pagesBefore) {
    if (!page.isUserSaved && !pagesAfterIds.has(page.pageId)) {
      rejectedPages.push({ pageId: page.pageId, category: page.category });
    }
  }

  // ── Step 6: Write report ────────────────────────────────────────────────────
  const reportPath = path.join(docuDir, "rewiki-report.md");
  const pagesAfter = dryRun ? pagesBefore : await scanWiki(wikiDir);
  const countsAfter = countByCategory(pagesAfter);
  const now = new Date().toISOString();

  const reportLines: string[] = [
    `# DocuFlow Rewiki Report`,
    ``,
    `**Timestamp:** ${now}`,
    `**Dry-run:** ${dryRun}`,
    `**Backup path:** ${backupPath}`,
    ``,
    `## Pages Before`,
    ``,
    ...Object.entries(countsBefore).map(([cat, n]) => `- ${cat}: ${n}`),
    `- **Total:** ${pagesBefore.length}`,
    ``,
    `## Pages After`,
    ``,
    ...Object.entries(countsAfter).map(([cat, n]) => `- ${cat}: ${n}`),
    `- **Total:** ${pagesAfter.length}`,
    ``,
    `## Removed Pages (${rejectedPages.length})`,
    ``,
    rejectedPages.length > 0
      ? rejectedPages.map(p => `- \`${p.pageId}\` (${p.category})`).join("\n")
      : "None.",
    ``,
    `## Preserved User-Saved Pages (${userSavedPages.length})`,
    ``,
    userSavedPages.length > 0
      ? userSavedPages.map(p => `- \`${p.pageId}\``).join("\n")
      : "None.",
    ``,
  ];

  if (migratedFiles.length > 0) {
    reportLines.push(
      `## synthesiss/ Migrations (${migratedFiles.length})`,
      ``,
      ...migratedFiles.map(f => `- ${f}`),
      ``,
    );
  }

  const reportContent = reportLines.join("\n");

  if (!dryRun) {
    await fsp.writeFile(reportPath, reportContent, "utf8");
    info(`\n  📄 Report written → ${c.cyan(path.relative(projectPath, reportPath))}`);

    // ── Step 7: Append to log.md ──────────────────────────────────────────────
    const logPath = path.join(docuDir, "log.md");
    const logEntry = `\n## [${now.split("T")[0]}] rewiki | removed ${rejectedPages.length}, kept ${pagesAfter.length - userSavedPages.length}, preserved ${userSavedPages.length} user pages\n`;
    try {
      await fsp.appendFile(logPath, logEntry, "utf8");
    } catch {}
  } else {
    info(`\n  📄 [dry-run] Report would be written to ${c.cyan(path.relative(projectPath, reportPath))}`);
  }

  // ── Summary ─────────────────────────────────────────────────────────────────
  info(`\n  ─────────────────────────────────────────────`);
  info(`  Sources re-ingested:  ${dryRun ? "(dry-run)" : sourceFiles.length}`);
  info(`  Pages before:         ${pagesBefore.length}`);
  info(`  Pages after:          ${dryRun ? "(dry-run)" : pagesAfter.length}`);
  info(`  Removed:              ${rejectedPages.length}`);
  info(`  Preserved (user):     ${userSavedPages.length}`);
  if (migratedFiles.length > 0) {
    info(`  synthesiss/ migrated: ${migratedFiles.length}`);
  }
  if (ingestErrors > 0) {
    info(`  Ingest errors:        ${c.red(String(ingestErrors))}`);
  }
  info(`  ─────────────────────────────────────────────\n`);

  if (ingestErrors > 0) process.exit(1);
}
