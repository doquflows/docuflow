import path from "node:path";
import { walk, safeReadFile, SkipEntry } from "../filesystem";
import { extensionToLanguage } from "../language-map";
import { extract } from "../extractor";
import { ListResult, ModuleInfo } from "../types";

export async function listModules(input: { path: string; extensions?: string[] }): Promise<ListResult> {
  const projectPath = path.resolve(input.path);
  const exts = input.extensions?.map((e) => (e.startsWith(".") ? e.toLowerCase() : "." + e.toLowerCase()));
  const { files, skipped } = await walk(projectPath);
  const allSkipped: SkipEntry[] = [...skipped];
  const modules: ModuleInfo[] = [];
  const langs = new Set<string>();

  for (const f of files) {
    if (exts && !exts.includes(path.extname(f.path).toLowerCase())) {
      allSkipped.push({ path: f.path, reason: "extension filter" });
      continue;
    }
    const read = await safeReadFile(f.path);
    if (read.error) {
      allSkipped.push({ path: f.path, reason: `read failed: ${read.error}` });
      continue;
    }
    if (read.binary) {
      allSkipped.push({ path: f.path, reason: "binary" });
      continue;
    }
    const language = extensionToLanguage(f.path);
    langs.add(language);
    const facts = extract(read.content ?? "");
    modules.push({
      path: path.relative(projectPath, f.path) || f.path,
      language,
      size_bytes: read.size,
      ...facts,
    });
  }

  return {
    scanned_at: new Date().toISOString(),
    project_path: projectPath,
    total_files: modules.length,
    skipped_files: allSkipped,
    languages_found: Array.from(langs).sort(),
    modules,
  };
}
