import path from "node:path";
import fsp from "node:fs/promises";
import { safeReadFile } from "../filesystem";

export interface SearchResult {
  page_id: string;
  title: string;
  category: string;
  path: string;
  relevance_score: number;
  preview: string;
  matched_terms: string[];
}

/**
 * Simple BM25-inspired scoring with term frequency and document frequency.
 * Weights entity pages more heavily than concepts, titles match higher.
 */
function scoreMatch(
  query: string,
  content: string,
  title: string,
  category: string,
  totalPages: number
): { score: number; matched_terms: string[] } {
  const queryTerms = query.toLowerCase().split(/\s+/).filter((t) => t.length > 2);
  let score = 0;
  const matched_terms: Set<string> = new Set();

  for (const term of queryTerms) {
    // Title match (highest weight)
    if (title.toLowerCase().includes(term)) {
      score += 50;
      matched_terms.add(term);
    }

    // Content match with term frequency (TF)
    const contentLower = content.toLowerCase();
    const termRegex = new RegExp(`\\b${term}\\b`, "gi");
    const matches = contentLower.match(termRegex);
    if (matches) {
      const tf = matches.length;
      // Inverse document frequency approximation
      const idf = Math.log(totalPages / Math.max(1, matches.length));
      score += tf * idf * 2;
      matched_terms.add(term);
    }
  }

  // Category boost: entities score higher than concepts
  if (category === "entity") {
    score *= 1.3;
  } else if (category === "synthesis") {
    score *= 1.1;
  }

  return { score, matched_terms: Array.from(matched_terms) };
}

/**
 * Extract a preview snippet from content around matched terms
 */
function extractPreview(content: string, matchedTerms: string[], maxLength: number = 150): string {
  if (!matchedTerms.length) {
    // Return first non-empty paragraph
    const lines = content.split("\n").filter((l) => l.trim() && !l.startsWith("#") && !l.startsWith("---"));
    return lines.slice(0, 2).join(" ").substring(0, maxLength);
  }

  // Find first occurrence of any matched term
  const contentLower = content.toLowerCase();
  const term = matchedTerms[0];
  const index = contentLower.indexOf(term);

  if (index === -1) {
    const lines = content.split("\n").filter((l) => l.trim() && !l.startsWith("#"));
    return lines.slice(0, 2).join(" ").substring(0, maxLength);
  }

  const start = Math.max(0, index - 60);
  const end = Math.min(content.length, index + 150);
  let preview = content.substring(start, end);

  // Trim to word boundary
  const lastSpace = preview.lastIndexOf(" ");
  if (lastSpace > 0) {
    preview = preview.substring(0, lastSpace) + "...";
  }

  return preview;
}

export async function wikiSearch(input: {
  project_path: string;
  query: string;
  limit?: number;
  category?: "entity" | "concept" | "timeline" | "synthesis";
}): Promise<{
  query: string;
  results: SearchResult[];
  total_results: number;
  error?: string;
}> {
  try {
    const projectPath = path.resolve(input.project_path);
    const docuDir = path.join(projectPath, ".docuflow");
    const wikiDir = path.join(docuDir, "wiki");
    const limit = input.limit ?? 10;

    const allResults: SearchResult[] = [];

    // Build list of categories to search
    let categoriesToScan = ["entities", "concepts", "timelines", "syntheses"];
    if (input.category) {
      categoriesToScan = [`${input.category}s`];
    }

    // First pass: count total pages (for IDF calculation)
    let totalPages = 0;
    for (const categoryDir of categoriesToScan) {
      const fullCategoryPath = path.join(wikiDir, categoryDir);
      try {
        const files = await fsp.readdir(fullCategoryPath);
        totalPages += files.filter((f) => f.endsWith(".md")).length;
      } catch (e) {
        // Category may not exist
      }
    }

    const PLURAL_TO_SINGULAR: Record<string, string> = {
      entities: "entity",
      concepts: "concept",
      timelines: "timeline",
      syntheses: "synthesis",
    };

    // Second pass: search all pages
    for (const categoryDir of categoriesToScan) {
      const fullCategoryPath = path.join(wikiDir, categoryDir);
      const category = PLURAL_TO_SINGULAR[categoryDir] ?? categoryDir.replace(/s$/, "");

      try {
        const files = await fsp.readdir(fullCategoryPath);

        for (const file of files) {
          if (!file.endsWith(".md")) continue;

          const filePath = path.join(fullCategoryPath, file);
          const read = await safeReadFile(filePath);

          if (read.error || read.binary || !read.content) continue;

          // Extract title from content (first H1)
          const titleMatch = read.content.match(/^#\s+(.+?)$/m);
          const title = titleMatch ? titleMatch[1].trim() : file.replace(".md", "");
          const pageId = file.replace(".md", "");

          // Score the match
          const { score, matched_terms } = scoreMatch(
            input.query,
            read.content,
            title,
            category,
            totalPages
          );

          // Only include if there's at least one match
          if (score > 0 && matched_terms.length > 0) {
            const preview = extractPreview(read.content, matched_terms);

            allResults.push({
              page_id: pageId,
              title,
              category,
              path: path.relative(docuDir, filePath),
              relevance_score: Math.round(score * 10) / 10, // Round to 1 decimal
              preview,
              matched_terms,
            });
          }
        }
      } catch (e) {
        // Category directory may not exist
      }
    }

    // Sort by relevance score (descending) and return top N
    allResults.sort((a, b) => b.relevance_score - a.relevance_score);
    const results = allResults.slice(0, limit);

    return {
      query: input.query,
      results,
      total_results: allResults.length,
    };
  } catch (e: any) {
    return {
      query: input.query,
      results: [],
      total_results: 0,
      error: e?.message ?? String(e),
    };
  }
}
