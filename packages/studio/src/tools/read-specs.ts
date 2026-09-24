import path from "node:path";
import fsp from "node:fs/promises";
import { readJsonIfExists } from "@doquflow/core/lib";
import { SpecIndex } from "@doquflow/core/lib";

const STALE_DAYS = 30;

export async function readSpecs(input: { project_path: string; module_name?: string }) {
  const projectPath = path.resolve(input.project_path);
  const docuDir = path.join(projectPath, ".docuflow");
  const indexPath = path.join(docuDir, "index.json");

  const index = await readJsonIfExists<SpecIndex>(indexPath);
  if (!index || index.specs.length === 0) {
    return { specs_found: 0, specs: [] };
  }

  let entries = index.specs;
  if (input.module_name) {
    const needle = input.module_name.replace(/\.md$/i, "").toLowerCase();
    entries = entries.filter((s) => s.filename.replace(/\.md$/i, "").toLowerCase() === needle);
  }

  const now = Date.now();
  const specs = [];
  for (const entry of entries) {
    const filePath = path.join(docuDir, "specs", entry.filename);
    try {
      const content = await fsp.readFile(filePath, "utf8");
      const writtenMs = entry.written_at ? new Date(entry.written_at).getTime() : NaN;
      const stale = !isNaN(writtenMs) && (now - writtenMs) > STALE_DAYS * 86_400_000;
      specs.push({ filename: entry.filename, written_at: entry.written_at, stale, content });
    } catch {
      // spec entry exists in index but file missing — skip silently
    }
  }

  return { specs_found: specs.length, specs };
}
