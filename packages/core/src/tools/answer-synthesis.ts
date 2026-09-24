import path from "node:path";
import fsp from "node:fs/promises";
import { safeReadFile } from "../filesystem";

interface SourcePage {
  page_id: string;
  title: string;
  category: string;
  content: string;
  relevance: number;
}

interface SynthesisOutput {
  answer: string;
  source_pages: SourcePage[];
  confidence: number;
  key_concepts: string[];
}

/**
 * Extract key sentences from content that relate to the query
 */
function extractRelevantSentences(content: string, queryTerms: string[], maxSentences: number = 3): string[] {
  const sentences = content
    .split(/[.!?]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 10 && !s.startsWith("#") && !s.startsWith("---"));

  const scoredSentences: Array<{ text: string; score: number }> = [];

  for (const sentence of sentences) {
    let score = 0;
    const sentenceLower = sentence.toLowerCase();

    for (const term of queryTerms) {
      if (sentenceLower.includes(term)) {
        // Count occurrences
        const matches = sentenceLower.split(term).length - 1;
        score += matches * 2;
      }
    }

    if (score > 0) {
      scoredSentences.push({ text: sentence, score });
    }
  }

  // Sort by score and take top N
  return scoredSentences
    .sort((a, b) => b.score - a.score)
    .slice(0, maxSentences)
    .map((s) => s.text);
}

/**
 * Extract key concepts from page content (from H3 headers, bold text)
 */
function extractKeyConcepts(content: string): string[] {
  const concepts: Set<string> = new Set();

  // Extract from H3 headers
  const h3Matches = content.matchAll(/^###\s+(.+?)$/gm);
  for (const match of h3Matches) {
    const concept = match[1].trim();
    if (concept && concept.length < 80) {
      concepts.add(concept);
    }
  }

  // Extract from bold text (but not arrays/JSON)
  const boldMatches = content.matchAll(/\*\*([^*]+)\*\*/g);
  for (const match of boldMatches) {
    const text = match[1].trim();
    if (
      text.length > 3 &&
      text.length < 60 &&
      !text.includes("[") &&
      !text.includes("{") &&
      !text.includes('"')
    ) {
      concepts.add(text);
    }
  }

  return Array.from(concepts).slice(0, 5);
}

/**
 * Build a synthesis answer from multiple source pages
 */
function buildSynthesis(
  query: string,
  sourcePages: SourcePage[],
  queryTerms: string[]
): { answer: string; concepts: string[] } {
  if (!sourcePages.length) {
    return {
      answer: `No information found related to: ${query}`,
      concepts: [],
    };
  }

  const allConcepts: Set<string> = new Set();
  const sections: string[] = [];

  // Add introduction
  sections.push(`## Synthesis: ${query}\n`);
  sections.push(`Based on ${sourcePages.length} source page(s):\n`);

  // Add content from each source
  for (const page of sourcePages) {
    sections.push(`### ${page.title}`);
    sections.push(`*Category: ${page.category} | Relevance: ${Math.round(page.relevance * 100)}%*\n`);

    // Extract relevant sentences
    const relevantSentences = extractRelevantSentences(page.content, queryTerms, 2);
    if (relevantSentences.length > 0) {
      sections.push(relevantSentences.map((s) => `- ${s.trim()}`).join("\n"));
    } else {
      // Fallback: use first paragraph
      const firstPara = page.content
        .split("\n")
        .filter((l) => l.trim() && !l.startsWith("#") && !l.startsWith("---"))
        .slice(0, 1);
      sections.push(firstPara.join("\n"));
    }

    // Collect concepts
    const pageConcepts = extractKeyConcepts(page.content);
    pageConcepts.forEach((c) => allConcepts.add(c));

    sections.push("");
  }

  // Add summary
  sections.push("\n## Key Concepts Found");
  Array.from(allConcepts).forEach((c) => {
    sections.push(`- ${c}`);
  });

  sections.push("\n## How to Extend This\n");
  sections.push(`This synthesis was generated from ${sourcePages.length} page(s) containing the key terms: `);
  sections.push(queryTerms.join(", "));
  sections.push("\n\nAdd more source pages to deepen this synthesis.");

  return {
    answer: sections.join("\n"),
    concepts: Array.from(allConcepts),
  };
}

export async function synthesizeAnswer(input: {
  project_path: string;
  query: string;
  source_page_ids: string[];
}): Promise<{
  query: string;
  answer: string;
  source_pages: Array<{ page_id: string; title: string; category: string }>;
  confidence: number;
  key_concepts: string[];
  error?: string;
}> {
  try {
    const projectPath = path.resolve(input.project_path);
    const docuDir = path.join(projectPath, ".docuflow");
    const wikiDir = path.join(docuDir, "wiki");

    // Load each source page
    const sourcePages: SourcePage[] = [];
    for (const pageId of input.source_page_ids) {
      // Try to find the page (scan all category directories)
      let found = false;
      for (const categoryDir of ["entities", "concepts", "timelines", "syntheses"]) {
        const filePath = path.join(wikiDir, categoryDir, `${pageId}.md`);
        try {
          const read = await safeReadFile(filePath);
          if (!read.error && !read.binary && read.content) {
            const titleMatch = read.content.match(/^#\s+(.+?)$/m);
            const title = titleMatch ? titleMatch[1].trim() : pageId;
            const category = categoryDir.replace("s", "");

            sourcePages.push({
              page_id: pageId,
              title,
              category,
              content: read.content,
              relevance: 1.0 - (sourcePages.length * 0.1), // Slight decay for order
            });
            found = true;
            break;
          }
        } catch (e) {
          // Try next category
        }
      }

      if (!found && sourcePages.length === 0) {
        // At least one page should be found
        return {
          query: input.query,
          answer: `Could not find source page: ${pageId}`,
          source_pages: [],
          confidence: 0,
          key_concepts: [],
          error: `Page not found: ${pageId}`,
        };
      }
    }

    // Build query terms
    const queryTerms = input.query.toLowerCase().split(/\s+/).filter((t) => t.length > 2);

    // Generate synthesis
    const { answer, concepts } = buildSynthesis(input.query, sourcePages, queryTerms);

    // Calculate confidence based on number and relevance of sources
    const confidence = Math.min(1.0, Math.max(0.3, sourcePages.length * 0.25));

    return {
      query: input.query,
      answer,
      source_pages: sourcePages.map((p) => ({
        page_id: p.page_id,
        title: p.title,
        category: p.category,
      })),
      confidence,
      key_concepts: concepts,
    };
  } catch (e: any) {
    return {
      query: input.query,
      answer: `Error synthesizing answer: ${e?.message ?? String(e)}`,
      source_pages: [],
      confidence: 0,
      key_concepts: [],
      error: e?.message ?? String(e),
    };
  }
}
