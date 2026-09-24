import path from "node:path";
import fsp from "node:fs/promises";
import { safeReadFile } from "@doquflow/core/lib";

const PLURAL_TO_SINGULAR: Record<string, string> = {
  entities: "entity",
  concepts: "concept",
  timelines: "timeline",
  syntheses: "synthesis",
};

const SINGULAR_TO_PLURAL: Record<string, string> = {
  entity: "entities",
  concept: "concepts",
  timeline: "timelines",
  synthesis: "syntheses",
};

const STALE_DAYS = 30;

interface WikiPageMetadata {
  id: string;
  title: string;
  category: string;
  path: string;
  created_at: string;
  updated_at: string;
  sources: string[];
  tags: string[];
  stale: boolean;
  outbound_links: string[];
  inbound_links: string[];
  degree: number;
}

function unquote(s: string): string {
  const t = s.trim();
  if (t.length >= 2) {
    const first = t[0];
    const last = t[t.length - 1];
    if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
      return t.slice(1, -1);
    }
  }
  return t;
}

/**
 * Parse YAML-ish frontmatter from markdown.
 *
 * Supports:
 *   - Inline JSON/flow:  key: ["a", "b"]   or   key: {x: 1}
 *   - Block-style list:  key:\n  - "a"\n  - "b"
 *   - Scalar:            key: value (values may contain ':' — split on FIRST ':' only)
 */
function parseFrontmatter(content: string): Record<string, any> {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};

  const lines = match[1].split("\n");
  const result: Record<string, any> = {};

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();
    if (!trimmed) { i++; continue; }

    // Block-list continuation handled inside the key branch below; top-level
    // dashes without a preceding key are ignored.
    if (trimmed.startsWith("- ")) { i++; continue; }

    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) { i++; continue; }

    const key = line.slice(0, colonIdx).trim();
    const rawValue = line.slice(colonIdx + 1).trim();

    if (rawValue === "") {
      // Possibly a block-style list on subsequent lines: "  - value"
      const items: string[] = [];
      let j = i + 1;
      while (j < lines.length) {
        const next = lines[j];
        if (!next.trim()) { j++; continue; }
        // A block-list item must be indented and start with "- ".
        const m = next.match(/^(\s+)-\s+(.*)$/);
        if (!m) break;
        items.push(unquote(m[2]));
        j++;
      }
      if (items.length > 0) {
        result[key] = items;
      } else {
        result[key] = "";
      }
      i = j;
      continue;
    }

    if (rawValue.startsWith("[") || rawValue.startsWith("{")) {
      try {
        result[key] = JSON.parse(rawValue);
      } catch {
        result[key] = rawValue;
      }
    } else {
      result[key] = unquote(rawValue);
    }
    i++;
  }

  return result;
}

function toStringArray(v: any): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === "string");
}

/**
 * Extract title from markdown
 */
function extractTitle(content: string): string {
  const match = content.match(/^#\s+(.+?)$/m);
  return match ? match[1].trim() : "Untitled";
}

export async function listWiki(input: {
  project_path: string;
  category?: "entity" | "concept" | "timeline" | "synthesis";
}): Promise<{
  total_pages: number;
  stale_pages: number;
  pages: WikiPageMetadata[];
  categories: Record<string, number>;
  error?: string;
}> {
  try {
    const projectPath = path.resolve(input.project_path);
    const docuDir = path.join(projectPath, ".docuflow");
    const wikiDir = path.join(docuDir, "wiki");

    const pages: WikiPageMetadata[] = [];
    const categories: Record<string, number> = {};
    const now = Date.now();

    // Build list of categories to scan — always use correct plural directory names
    let categoriesToScan = ["entities", "concepts", "timelines", "syntheses"];
    if (input.category) {
      const pluralDir = SINGULAR_TO_PLURAL[input.category] ?? `${input.category}s`;
      categoriesToScan = [pluralDir];
    }

    // Scan each category
    for (const categoryDir of categoriesToScan) {
      const fullCategoryPath = path.join(wikiDir, categoryDir);
      const category = PLURAL_TO_SINGULAR[categoryDir] ?? categoryDir;

      try {
        const files = await fsp.readdir(fullCategoryPath);
        let categoryCount = 0;

        for (const file of files) {
          if (!file.endsWith(".md")) continue;

          const filePath = path.join(fullCategoryPath, file);
          const read = await safeReadFile(filePath);

          if (read.error || read.binary || !read.content) continue;

          const fm = parseFrontmatter(read.content);
          const title = extractTitle(read.content);
          const pageId = file.replace(".md", "");

          const updatedAt = fm.updated_at ?? new Date().toISOString();
          const updatedMs = new Date(updatedAt).getTime();
          const stale = !isNaN(updatedMs) && (now - updatedMs) > STALE_DAYS * 86_400_000;

          const outbound_links = toStringArray(fm.outbound_links);
          const inbound_links = toStringArray(fm.inbound_links);

          pages.push({
            id: pageId,
            title,
            category,
            path: path.relative(docuDir, filePath),
            created_at: fm.created_at ?? new Date().toISOString(),
            updated_at: updatedAt,
            sources: toStringArray(fm.sources),
            tags: toStringArray(fm.tags),
            stale,
            outbound_links,
            inbound_links,
            degree: outbound_links.length + inbound_links.length,
          });

          categoryCount++;
        }

        if (categoryCount > 0) {
          categories[category] = categoryCount;
        }
      } catch (e) {
        // Category directory may not exist yet
      }
    }

    return {
      total_pages: pages.length,
      stale_pages: pages.filter((p) => p.stale).length,
      pages: pages.sort((a, b) => a.title.localeCompare(b.title)),
      categories,
    };
  } catch (e: any) {
    return {
      total_pages: 0,
      stale_pages: 0,
      pages: [],
      categories: {},
      error: e?.message ?? String(e),
    };
  }
}
