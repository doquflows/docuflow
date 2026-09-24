import path from "node:path";
import { wikiSearch } from "./wiki-search";
import { synthesizeAnswer } from "./answer-synthesis";

export async function queryWiki(input: {
  project_path: string;
  question: string;
  max_sources?: number;
}): Promise<{
  question: string;
  answer: string;
  source_pages: Array<{ page_id: string; title: string; category: string }>;
  search_results: number;
  confidence: number;
  error?: string;
}> {
  try {
    const projectPath = path.resolve(input.project_path);
    const maxSources = input.max_sources ?? 5;

    // Step 1: Search the wiki for relevant pages
    const searchResult = await wikiSearch({
      project_path: projectPath,
      query: input.question,
      limit: Math.max(10, maxSources * 2), // Get extra to filter
    });

    if (searchResult.error || !searchResult.results.length) {
      return {
        question: input.question,
        answer: `No relevant wiki pages found for: ${input.question}`,
        source_pages: [],
        search_results: 0,
        confidence: 0,
        error: searchResult.error,
      };
    }

    // Step 2: Select top N results for synthesis
    const topResults = searchResult.results.slice(0, maxSources);
    const sourcePageIds = topResults.map((r) => r.page_id);

    // Step 3: Synthesize answer from selected pages
    const synthesisResult = await synthesizeAnswer({
      project_path: projectPath,
      query: input.question,
      source_page_ids: sourcePageIds,
    });

    if (synthesisResult.error) {
      return {
        question: input.question,
        answer: `Error synthesizing answer: ${synthesisResult.error}`,
        source_pages: synthesisResult.source_pages,
        search_results: searchResult.total_results,
        confidence: 0,
        error: synthesisResult.error,
      };
    }

    return {
      question: input.question,
      answer: synthesisResult.answer,
      source_pages: synthesisResult.source_pages,
      search_results: searchResult.total_results,
      confidence: synthesisResult.confidence,
    };
  } catch (e: any) {
    return {
      question: input.question,
      answer: `Query failed: ${e?.message ?? String(e)}`,
      source_pages: [],
      search_results: 0,
      confidence: 0,
      error: e?.message ?? String(e),
    };
  }
}
