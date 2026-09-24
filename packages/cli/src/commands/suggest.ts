import fsp from "node:fs/promises";
import path from "node:path";
import fs from "node:fs";

interface SuggestionItem {
  priority: number;
  type: "first_source" | "wiki_page" | "starter_question" | "action";
  title: string;
  reason: string;
  prompt?: string;
}

const DOMAIN_SUGGESTIONS: Record<string, SuggestionItem[]> = {
  "Code/Architecture": [
    { priority: 1, type: "wiki_page", title: "System Architecture Overview", reason: "High-level view of how all components fit together", prompt: "Ingest the README or architecture doc, then ask: 'Create a System Architecture Overview page in the wiki'" },
    { priority: 2, type: "wiki_page", title: "Core Architectural Patterns", reason: "Design patterns used throughout the codebase", prompt: "Ask Claude: 'Scan the codebase with list_modules and identify the core architectural patterns'" },
    { priority: 3, type: "wiki_page", title: "Module Dependencies", reason: "Which modules depend on which — risky to change without knowing", prompt: "Ask Claude: 'Use list_modules to build a module dependency map and write it as a wiki page'" },
    { priority: 4, type: "wiki_page", title: "Database Schema Overview", reason: "Tables, relationships, and ownership by module", prompt: "Ask Claude: 'Scan the project for DB tables using list_modules and create a Database Schema wiki page'" },
    { priority: 5, type: "starter_question", title: "What modules are most connected?", reason: "Identifies the highest-risk code to change", prompt: "Ask Claude: 'Use list_modules on this project and tell me which files have the most dependencies'" },
  ],
  Research: [
    { priority: 1, type: "wiki_page", title: "Research Domain Overview", reason: "Big picture of the research area", prompt: "Ingest your main survey paper, then ask: 'Create a Research Domain Overview page'" },
    { priority: 2, type: "wiki_page", title: "Key Findings & Synthesis", reason: "Major discoveries and insights", prompt: "Ask Claude: 'After ingesting my sources, synthesize the key findings into a wiki page'" },
    { priority: 3, type: "wiki_page", title: "Areas of Contradiction", reason: "Where researchers disagree — critical to track", prompt: "Ask Claude: 'Run lint_wiki and identify any contradictions, then create an Areas of Contradiction page'" },
    { priority: 4, type: "wiki_page", title: "Open Research Questions", reason: "What's still unknown in this domain", prompt: "Ask Claude: 'Based on ingested sources, what questions remain unanswered?'" },
    { priority: 5, type: "starter_question", title: "What are the most cited entities?", reason: "Shows which concepts are most important", prompt: "Ask Claude: 'Which entities appear most often across all ingested sources?'" },
  ],
  Business: [
    { priority: 1, type: "wiki_page", title: "Market Overview", reason: "Big picture of the market and competitive landscape", prompt: "Ingest market research docs, then ask: 'Create a Market Overview wiki page'" },
    { priority: 2, type: "wiki_page", title: "Competitive Analysis", reason: "How competitors differ — essential strategic context", prompt: "Ask Claude: 'After ingesting competitor info, create a Competitive Analysis synthesis page'" },
    { priority: 3, type: "wiki_page", title: "Market Opportunities", reason: "Gaps and growth areas to track", prompt: "Ask Claude: 'Identify market opportunities from ingested sources and create a wiki page'" },
    { priority: 4, type: "wiki_page", title: "Key Players", reason: "Entities (companies, people) to track over time", prompt: "Ask Claude: 'Create an entity page for each key competitor found in sources'" },
    { priority: 5, type: "starter_question", title: "Who are the key players in this market?", reason: "First question to anchor the wiki", prompt: "Ask Claude: 'List the key companies and people from ingested market data'" },
  ],
  Personal: [
    { priority: 1, type: "wiki_page", title: "Learning Goals", reason: "Anchors everything else in the wiki", prompt: "Ask Claude: 'Create a Learning Goals page from my notes in .docuflow/sources/'" },
    { priority: 2, type: "wiki_page", title: "Key Personal Insights", reason: "Preserve insights before they fade", prompt: "Ask Claude: 'Ingest my notes and create a Key Insights synthesis page'" },
    { priority: 3, type: "wiki_page", title: "Key Resources", reason: "Books, courses, links to revisit", prompt: "Ask Claude: 'Extract and create an entity page for each key resource mentioned in my notes'" },
    { priority: 4, type: "wiki_page", title: "Action Items & Next Steps", reason: "Turns knowledge into action", prompt: "Ask Claude: 'What action items can you find across my wiki pages? Create a synthesis page'" },
    { priority: 5, type: "starter_question", title: "What do I already know about this topic?", reason: "Baseline before adding more sources", prompt: "Ask Claude: 'Query the wiki for what I know about [your topic]'" },
  ],
  General: [
    { priority: 1, type: "action", title: "Add your first source file", reason: "Nothing can be ingested until you put a file in .docuflow/sources/", prompt: "Copy your README, main doc, or any markdown file into .docuflow/sources/" },
    { priority: 2, type: "wiki_page", title: "Overview / Summary page", reason: "A starting page that links to everything else", prompt: "Ask Claude: 'Ingest my first source and create an overview synthesis page'" },
    { priority: 3, type: "starter_question", title: "What are the key entities in this domain?", reason: "Gets the wiki started with real content", prompt: "Ask Claude: 'After ingesting my first source, what are the key entities?'" },
    { priority: 4, type: "wiki_page", title: "Key Concepts", reason: "Important ideas worth preserving", prompt: "Ask Claude: 'Create concept pages for the top 5 ideas from ingested sources'" },
    { priority: 5, type: "action", title: "Run get_schema_guidance", reason: "DocuFlow will tell you what's missing based on your domain", prompt: "Ask Claude: 'Run get_schema_guidance on my project and show what pages are recommended'" },
  ],
};

function detectDomain(schemaContent: string): string {
  if (/Architecture|Code|codebase|microservice|API/i.test(schemaContent)) return "Code/Architecture";
  if (/Research|paper|findings|literature/i.test(schemaContent)) return "Research";
  if (/Business|market|competitor|revenue/i.test(schemaContent)) return "Business";
  if (/Personal|learning|goal|habit/i.test(schemaContent)) return "Personal";
  return "General";
}

async function countWikiPages(docuDir: string): Promise<Record<string, number>> {
  const counts: Record<string, number> = { entities: 0, concepts: 0, timelines: 0, syntheses: 0 };
  for (const cat of Object.keys(counts)) {
    try {
      const files = await fsp.readdir(path.join(docuDir, "wiki", cat));
      counts[cat] = files.filter((f) => f.endsWith(".md")).length;
    } catch {
      // Directory may not exist
    }
  }
  return counts;
}

async function countSources(docuDir: string): Promise<number> {
  try {
    const files = await fsp.readdir(path.join(docuDir, "sources"));
    return files.filter((f) => f.endsWith(".md") || f.endsWith(".txt")).length;
  } catch {
    return 0;
  }
}

export async function run(): Promise<void> {
  const projectDir = process.cwd();
  const docuDir = path.join(projectDir, ".docuflow");

  if (!fs.existsSync(docuDir)) {
    console.log("⚠  DocuFlow not initialised in this directory.");
    console.log('   Run "docuflow init" first.\n');
    return;
  }

  // Detect domain from schema
  let domain = "General";
  try {
    const schema = await fsp.readFile(path.join(docuDir, "schema.md"), "utf8");
    domain = detectDomain(schema);
  } catch {
    // No schema yet — fall back to General
  }

  const [pageCounts, sourceCount] = await Promise.all([
    countWikiPages(docuDir),
    countSources(docuDir),
  ]);
  const totalPages = Object.values(pageCounts).reduce((a, b) => a + b, 0);

  console.log(`\n💡 DocuFlow Suggestions — ${domain} domain\n`);
  console.log(`   Current wiki: ${totalPages} pages | ${sourceCount} source(s) ingested\n`);

  if (totalPages === 0 && sourceCount === 0) {
    console.log("🌱 Your wiki is empty. Here's where to start:\n");
  } else if (totalPages < 10) {
    console.log("📚 Wiki is growing. Recommended next pages:\n");
  } else {
    console.log("✅ Good coverage. Here's what could be stronger:\n");
  }

  const suggestions = DOMAIN_SUGGESTIONS[domain] ?? DOMAIN_SUGGESTIONS.General;

  for (const s of suggestions) {
    const icon = s.type === "action" ? "▶" : s.type === "starter_question" ? "❓" : "📄";
    console.log(`  ${s.priority}. ${icon} ${s.title}`);
    console.log(`     ${s.reason}`);
    if (s.prompt) {
      console.log(`     → ${s.prompt}`);
    }
    console.log();
  }

  console.log("─────────────────────────────────────────────────────");
  console.log("Quick start prompts for Claude:\n");
  console.log(`  • "Scan the project at ${projectDir} with list_modules"`);
  console.log(`  • "Show me get_schema_guidance for ${projectDir}"`);
  console.log(`  • "What wiki pages exist? Run list_wiki on ${projectDir}"`);
  console.log(`  • "What should I document first in this project?"`);
  console.log();
}
