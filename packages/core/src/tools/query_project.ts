import path from "node:path";
import fsp from "node:fs/promises";
import { wikiSearch } from "./wiki-search";
import { safeReadFile } from "../filesystem";

interface SourceCodeMatch {
  file: string;
  relevance: number;
  snippet: string;
}

async function searchCodebase(projectPath: string, query: string): Promise<SourceCodeMatch[]> {
  const srcDir = path.join(projectPath, "src");
  const queryTerms = query.toLowerCase().split(/\s+/).filter(t => t.length > 2);
  const results: SourceCodeMatch[] = [];

  async function scanDir(dir: string) {
    try {
      const entries = await fsp.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          await scanDir(fullPath);
        } else if (entry.isFile() && (entry.name.endsWith(".ts") || entry.name.endsWith(".js") || entry.name.endsWith(".tsx"))) {
          const read = await safeReadFile(fullPath);
          if (!read.error && read.content) {
            let score = 0;
            const contentLower = read.content.toLowerCase();
            for (const term of queryTerms) {
              if (contentLower.includes(term)) {
                score += 10;
              }
            }
            if (score > 0) {
              const relPath = path.relative(projectPath, fullPath);
              results.push({
                file: relPath,
                relevance: score,
                snippet: read.content.substring(0, 150).replace(/\n/g, " ") + "..."
              });
            }
          }
        }
      }
    } catch (e) {
      // Ignore
    }
  }

  await scanDir(srcDir);
  return results.sort((a, b) => b.relevance - a.relevance).slice(0, 5);
}

export async function queryProject(input: {
  project_path: string;
  question: string;
  max_sources?: number;
}) {
  const projectPath = path.resolve(input.project_path);
  const maxSources = input.max_sources ?? 5;

  // 1. Search Wiki
  const wikiResult = await wikiSearch({
    project_path: projectPath,
    query: input.question,
    limit: maxSources,
  });

  // 2. Search Code
  const codeResults = await searchCodebase(projectPath, input.question);

  // 3. Pass to LLM (mock)
  const answerSections: string[] = [];
  answerSections.push(`## Answer for: ${input.question}`);
  
  if (wikiResult.results.length === 0 && codeResults.length === 0) {
    answerSections.push("No relevant documents or code found.");
  } else {
    answerSections.push("Based on the search results, here is the synthesized information:");
    
    // Add doc citations
    if (wikiResult.results.length > 0) {
      answerSections.push("\n### From Documentation:");
      for (const res of wikiResult.results) {
        answerSections.push(`- The wiki page [${res.path}] discusses this concept.`);
      }
    }
    
    // Add code citations
    if (codeResults.length > 0) {
      answerSections.push("\n### From Source Code:");
      for (const res of codeResults) {
        answerSections.push(`- The implementation can be found in [${res.file}].`);
      }
    }
  }

  return {
    question: input.question,
    answer: answerSections.join("\n"),
    doc_sources: wikiResult.results,
    code_sources: codeResults
  };
}
