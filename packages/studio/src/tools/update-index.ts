import path from "node:path";
import fsp from "node:fs/promises";
import { ensureDir, safeReadFile, writeFileAtomic } from "@doquflow/core/lib";

interface IndexEntry {
  id: string;
  title: string;
  category: string;
  path: string;
  created_at: string;
}

/**
 * Parse frontmatter from a markdown file.
 * Expects YAML format between --- markers.
 */
function parseFrontmatter(content: string): Record<string, any> {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};

  const yaml = match[1];
  const result: Record<string, any> = {};

  for (const line of yaml.split("\n")) {
    if (!line.trim()) continue;
    const [key, ...valueParts] = line.split(":");
    const value = valueParts.join(":").trim();

    try {
      // Try to parse as JSON (arrays, objects)
      if (value.startsWith("[") || value.startsWith("{")) {
        result[key.trim()] = JSON.parse(value);
      } else {
        result[key.trim()] = value;
      }
    } catch {
      result[key.trim()] = value;
    }
  }

  return result;
}

/**
 * Extract title from markdown content.
 * Looks for first H1 header.
 */
function extractTitle(content: string): string {
  const match = content.match(/^#\s+(.+?)$/m);
  return match ? match[1].trim() : "Untitled";
}

/**
 * Scan all wiki pages and regenerate index.md
 */
export async function updateIndex(input: { project_path: string }): Promise<{
  entries_indexed: number;
  index_file: string;
  log_appended: boolean;
  error?: string;
}> {
  try {
    const projectPath = path.resolve(input.project_path);
    const docuDir = path.join(projectPath, ".docuflow");
    const wikiDir = path.join(docuDir, "wiki");
    const indexFile = path.join(docuDir, "index.md");
    const logFile = path.join(docuDir, "log.md");

    // Scan all wiki pages
    const entries: IndexEntry[] = [];
    const categories = ["entities", "concepts", "timelines", "syntheses"];
    const PLURAL_TO_SINGULAR: Record<string, string> = {
      entities: "entity",
      concepts: "concept",
      timelines: "timeline",
      syntheses: "synthesis",
    };

    for (const category of categories) {
      const categoryDir = path.join(wikiDir, category);
      try {
        const files = await fsp.readdir(categoryDir);
        for (const file of files) {
          if (!file.endsWith(".md")) continue;
          const filePath = path.join(categoryDir, file);
          const read = await safeReadFile(filePath);
          if (read.error || read.binary || !read.content) continue;

          const fm = parseFrontmatter(read.content);
          const title = extractTitle(read.content);
          const pageId = file.replace(".md", "");

          entries.push({
            id: pageId,
            title,
            category: PLURAL_TO_SINGULAR[category] ?? category.replace(/s$/, ""),
            path: path.relative(docuDir, filePath),
            created_at: fm.created_at ?? new Date().toISOString(),
          });
        }
      } catch (e) {
        // Category dir may not exist yet
      }
    }

    // Generate index.md content
    const now = new Date().toISOString();
    let indexContent = `# Wiki Index

Generated: ${now}

## Overview

Total pages: ${entries.length}

## By Category

`;

    // Group by category
    const byCategory: Record<string, IndexEntry[]> = {};
    for (const entry of entries) {
      if (!byCategory[entry.category]) byCategory[entry.category] = [];
      byCategory[entry.category].push(entry);
    }

    // Add each category section
    for (const category of ["entity", "concept", "timeline", "synthesis"]) {
      const categoryEntries = byCategory[category] || [];
      if (categoryEntries.length === 0) continue;

      indexContent += `### ${category.charAt(0).toUpperCase() + category.slice(1)} Pages (${categoryEntries.length})\n\n`;
      for (const entry of categoryEntries.sort((a, b) => a.title.localeCompare(b.title))) {
        indexContent += `- [\`${entry.id}\`](./${entry.path}) — **${entry.title}**\n`;
      }
      indexContent += "\n";
    }

    // Write index.md
    await ensureDir(docuDir);
    await writeFileAtomic(indexFile, indexContent);

    // Append to log.md
    let logUpdated = false;
    try {
      const logRead = await safeReadFile(logFile);
      let logContent = logRead.content ?? "# Operation Log\n\n";

      // Add entry
      const timestamp = now.split("T")[0]; // YYYY-MM-DD
      const logEntry = `## [${timestamp}] index-update | ${entries.length} pages indexed\n\n`;
      logContent += logEntry;

      await writeFileAtomic(logFile, logContent);
      logUpdated = true;
    } catch (e) {
      // Log may not exist, that's ok
    }

    return {
      entries_indexed: entries.length,
      index_file: indexFile,
      log_appended: logUpdated,
    };
  } catch (e: any) {
    return {
      entries_indexed: 0,
      index_file: "",
      log_appended: false,
      error: e?.message ?? String(e),
    };
  }
}
