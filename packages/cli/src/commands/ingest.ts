import fs from "node:fs";
import path from "node:path";

const c = {
  green:  (s: string) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s: string) => `\x1b[33m${s}\x1b[0m`,
  red:    (s: string) => `\x1b[31m${s}\x1b[0m`,
  cyan:   (s: string) => `\x1b[36m${s}\x1b[0m`,
  dim:    (s: string) => `\x1b[2m${s}\x1b[0m`,
  bold:   (s: string) => `\x1b[1m${s}\x1b[0m`,
};

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

export interface IngestOptions {
  sourceFile?: string;
  all?: boolean;
  dryRun?: boolean;
  quiet?: boolean;
}

export async function run(options: IngestOptions): Promise<void> {
  const { sourceFile, all = false, dryRun = false, quiet = false } = options;
  const projectPath = path.resolve(process.cwd());
  const docuDir     = path.join(projectPath, ".docuflow");
  const sourcesDir  = path.join(docuDir, "sources");

  function info(msg: string) { if (!quiet) process.stdout.write(msg + "\n"); }

  if (!all && !sourceFile) {
    console.error(c.red("  ✗ Provide a source filename or pass --all."));
    console.error(`    Usage: docuflow ingest <source.md>`);
    console.error(`           docuflow ingest --all`);
    process.exit(2);
  }

  if (!fs.existsSync(docuDir)) {
    console.error(c.red(`  ✗ .docuflow/ not found at ${projectPath}`));
    console.error(`    Run "docuflow init" first.`);
    process.exit(2);
  }

  if (dryRun) {
    info(c.yellow("  dry-run not supported for ingest_source; use `docuflow rewiki --dry-run` for a full simulation"));
    process.exit(0);
  }

  let ingestSource: Function;
  try {
    ({ ingestSource } = loadServerTool("ingest-source"));
  } catch (e: any) {
    console.error(c.red(`  ✗ ${e.message}`));
    process.exit(2);
  }

  // Collect files to ingest
  let files: string[];
  if (all) {
    if (!fs.existsSync(sourcesDir)) {
      console.error(c.yellow("  No .docuflow/sources/ directory found — nothing to ingest."));
      process.exit(0);
    }
    files = fs.readdirSync(sourcesDir).filter(f => f.endsWith(".md"));
    if (files.length === 0) {
      info(c.yellow("  No source files found in .docuflow/sources/"));
      process.exit(0);
    }
  } else {
    // Single file — verify it exists
    const filename = sourceFile!;
    const fullPath = path.join(sourcesDir, filename);
    if (!fs.existsSync(fullPath)) {
      console.error(c.red(`  ✗ Source file not found: .docuflow/sources/${filename}`));
      process.exit(3);
    }
    files = [filename];
  }

  info(c.bold(`DocuFlow ingest`));
  info(`  Project : ${projectPath}`);
  info(`  Files   : ${files.length}`);
  info("");

  let totalCreated = 0;
  let totalUpdated = 0;
  let errored = 0;

  for (const filename of files) {
    info(c.dim(`  Ingesting ${filename}…`));
    try {
      const result = await ingestSource({ project_path: projectPath, source_filename: filename });
      totalCreated += result.pages_created?.length ?? 0;
      totalUpdated += result.pages_updated?.length ?? 0;
      info(
        `  ${c.green("✓")} ${filename}` +
        `  ${c.dim(`+${result.pages_created?.length ?? 0} created, ~${result.pages_updated?.length ?? 0} updated`)}`
      );
    } catch (e: any) {
      errored++;
      console.error(c.red(`  ✗ ${filename}: ${e.message}`));
    }
  }

  info("");
  if (errored === 0) {
    info(
      c.green("  ✓ Done.") +
      `  Pages created: ${totalCreated}  updated: ${totalUpdated}`
    );
  } else {
    info(
      c.yellow(`  Done with ${errored} error(s).`) +
      `  Pages created: ${totalCreated}  updated: ${totalUpdated}`
    );
    process.exit(2);
  }
}
