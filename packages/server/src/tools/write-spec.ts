import path from "node:path";
import { ensureDir, writeFileAtomic, readJsonIfExists } from "../filesystem";
import fsp from "node:fs/promises";
import { SpecIndex } from "../types";

// Per-project write lock: maps projectPath → promise chain so that concurrent
// calls to writeSpec on the same project are always serialised. This prevents
// the read-modify-write on index.json from racing when the agent issues several
// write_spec calls in parallel (e.g. writing one spec per module at once).
const indexLocks = new Map<string, Promise<void>>();

function withLock(key: string, fn: () => Promise<void>): Promise<void> {
  const prev = indexLocks.get(key) ?? Promise.resolve();
  const next = prev.then(fn).catch(() => {/* let caller surface error */});
  indexLocks.set(key, next);
  return next;
}

export async function writeSpec(input: { project_path: string; filename: string; content: string }) {
  const projectPath = path.resolve(input.project_path);
  const docuDir = path.join(projectPath, ".docuflow");
  const specsDir = path.join(docuDir, "specs");
  await ensureDir(specsDir);

  const cleanName = input.filename.replace(/\.md$/i, "");
  const targetFile = path.join(specsDir, `${cleanName}.md`);

  // Write the markdown file immediately — each spec file is independent so
  // parallel writes to different filenames are safe without locking.
  const bytes = await writeFileAtomic(targetFile, input.content);

  // Serialise index updates per project to avoid read-modify-write races.
  const indexPath = path.join(docuDir, "index.json");
  let indexUpdated = false;
  let writeError: string | undefined;

  await withLock(projectPath, async () => {
    try {
      const existing = (await readJsonIfExists<SpecIndex>(indexPath)) ?? { specs: [] };
      const now = new Date().toISOString();
      const idx = existing.specs.findIndex((s) => s.filename === `${cleanName}.md`);
      if (idx >= 0) existing.specs[idx].written_at = now;
      else existing.specs.push({ filename: `${cleanName}.md`, written_at: now });
      await fsp.writeFile(indexPath, JSON.stringify(existing, null, 2), "utf8");
      indexUpdated = true;
    } catch (e: any) {
      writeError = e?.message ?? String(e);
    }
  });

  if (writeError) {
    return { written_to: targetFile, bytes_written: bytes, index_updated: false, error: writeError };
  }
  return { written_to: targetFile, bytes_written: bytes, index_updated: indexUpdated };
}
