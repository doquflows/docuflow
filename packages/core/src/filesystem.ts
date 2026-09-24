import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";

const SKIP_DIRS = new Set([
  "node_modules",
  "vendor",
  ".git",
  ".svn",
  ".hg",
  "dist",
  "build",
  "bin",
  "obj",
  ".docuflow",
  ".next",
  ".nuxt",
  "out",
  "target",
  ".venv",
  "venv",
  "__pycache__",
]);

const SKIP_FILE_PATTERNS: RegExp[] = [
  /\.min\.js$/i,
  /\.min\.css$/i,
  /\.map$/i,
  /\.lock$/i,
  /package-lock\.json$/i,
];

const MAX_FILE_BYTES = 300 * 1024;

export interface WalkResult {
  path: string;
  size: number;
}

export interface SkipEntry {
  path: string;
  reason: string;
}

export async function walk(root: string): Promise<{ files: WalkResult[]; skipped: SkipEntry[] }> {
  const files: WalkResult[] = [];
  const skipped: SkipEntry[] = [];
  const absRoot = path.resolve(root);

  async function recurse(dir: string): Promise<void> {
    let entries: fs.Dirent[];
    try {
      entries = await fsp.readdir(dir, { withFileTypes: true });
    } catch (e: any) {
      skipped.push({ path: dir, reason: `readdir failed: ${e.message}` });
      return;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name)) continue;
        await recurse(full);
      } else if (entry.isFile()) {
        if (SKIP_FILE_PATTERNS.some((re) => re.test(entry.name))) {
          skipped.push({ path: full, reason: "skipped by pattern" });
          continue;
        }
        let stat: fs.Stats;
        try {
          stat = await fsp.stat(full);
        } catch (e: any) {
          skipped.push({ path: full, reason: `stat failed: ${e.message}` });
          continue;
        }
        if (stat.size > MAX_FILE_BYTES) {
          skipped.push({ path: full, reason: `file >300KB (${stat.size} bytes)` });
          continue;
        }
        files.push({ path: full, size: stat.size });
      }
    }
  }

  try {
    const stat = await fsp.stat(absRoot);
    if (!stat.isDirectory()) {
      skipped.push({ path: absRoot, reason: "not a directory" });
      return { files, skipped };
    }
  } catch (e: any) {
    skipped.push({ path: absRoot, reason: `root stat failed: ${e.message}` });
    return { files, skipped };
  }

  await recurse(absRoot);
  return { files, skipped };
}

export function isBinary(buf: Buffer): boolean {
  const len = Math.min(buf.length, 512);
  for (let i = 0; i < len; i++) {
    if (buf[i] === 0) return true;
  }
  return false;
}

export interface SafeRead {
  content?: string;
  size: number;
  binary?: boolean;
  error?: string;
}

export async function safeReadFile(filePath: string): Promise<SafeRead> {
  try {
    const buf = await fsp.readFile(filePath);
    if (isBinary(buf)) {
      return { size: buf.length, binary: true };
    }
    return { content: buf.toString("utf8"), size: buf.length };
  } catch (e: any) {
    return { size: 0, error: e.message };
  }
}

export async function ensureDir(dir: string): Promise<void> {
  await fsp.mkdir(dir, { recursive: true });
}

export async function writeFileAtomic(filePath: string, content: string): Promise<number> {
  await ensureDir(path.dirname(filePath));
  await fsp.writeFile(filePath, content, "utf8");
  return Buffer.byteLength(content, "utf8");
}

export async function readJsonIfExists<T>(filePath: string): Promise<T | null> {
  try {
    const txt = await fsp.readFile(filePath, "utf8");
    return JSON.parse(txt) as T;
  } catch {
    return null;
  }
}
