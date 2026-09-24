import path from "node:path";
import fsp from "node:fs/promises";
import { readJsonIfExists } from "@doquflow/core/lib";
import type { WikiPage } from "@doquflow/core/lib";

interface SchemaPart {
  name: string;
  entities?: string[];
  concepts?: string[];
  syntheses?: string[];
  timelines?: string[];
}

interface SchemaGuidance {
  domain: string;
  recommended_pages: Array<{
    name: string;
    category: string;
    suggested_title: string;
    reason: string;
  }>;
  existing_pages: Array<{ name: string; category: string }>;
  missing_pages: string[];
  recommendations: string[];
}

/**
 * get_schema_guidance
 *
 * Analyzes what documents should exist based on the project schema and current wiki state.
 * Helps users understand what to create next.
 *
 * Input:
 * - project_path: string
 * - domain?: string (optional; auto-detected from schema if not provided)
 *
 * Output:
 * - domain: detected domain
 * - recommended_pages: list of pages that should exist with reasons
 * - existing_pages: what's already in the wiki
 * - missing_pages: high-priority missing documents
 * - recommendations: actionable next steps
 */
export async function getSchemataGuidance(input: {
  project_path: string;
  domain?: string;
}): Promise<SchemaGuidance> {
  const projectPath = path.resolve(input.project_path);
  const docuDir = path.join(projectPath, ".docuflow");
  const wikiDir = path.join(docuDir, "wiki");
  const schemaPath = path.join(docuDir, "schema.md");

  // Read schema to understand domain
  let domain = input.domain || "General";
  try {
    const schemaContent = await fsp.readFile(schemaPath, "utf-8");
    if (schemaContent.includes("Research")) domain = "Research";
    else if (schemaContent.includes("Business")) domain = "Business";
    else if (schemaContent.includes("Architecture")) domain = "Code/Architecture";
    else if (schemaContent.includes("Personal")) domain = "Personal";
  } catch {
    // Use default if schema not readable
  }

  // Scan wiki for existing pages
  const indexPath = path.join(docuDir, "index.md");
  const indexContent = await fsp
    .readFile(indexPath, "utf-8")
    .catch(() => "");

  // Count pages by category
  const existingPages: Array<{ name: string; category: string }> = [];
  const categories = ["entities", "concepts", "syntheses", "timelines"];

  for (const cat of categories) {
    const catDir = path.join(wikiDir, cat);
    try {
      const files = await fsp.readdir(catDir);
      for (const file of files.filter((f) => f.endsWith(".md"))) {
        existingPages.push({
          name: file.replace(".md", ""),
          category: cat,
        });
      }
    } catch {
      // Directory may not exist
    }
  }

  // Define recommended pages by domain
  const recommendedByDomain: Record<
    string,
    Array<{
      name: string;
      category: string;
      suggested_title: string;
      reason: string;
    }>
  > = {
    "Code/Architecture": [
      {
        name: "architecture_overview",
        category: "syntheses",
        suggested_title: "System Architecture Overview",
        reason: "High-level view of how all components fit together",
      },
      {
        name: "core_patterns",
        category: "concepts",
        suggested_title: "Core Architectural Patterns",
        reason: "Design patterns used throughout the codebase",
      },
      {
        name: "module_dependencies",
        category: "concepts",
        suggested_title: "Module Dependencies",
        reason: "How modules depend on and integrate with each other",
      },
      {
        name: "data_flow",
        category: "syntheses",
        suggested_title: "Data Flow Diagram",
        reason: "How data moves through the system",
      },
    ],
    Research: [
      {
        name: "research_overview",
        category: "syntheses",
        suggested_title: "Research Domain Overview",
        reason: "Big picture of the research area",
      },
      {
        name: "key_findings",
        category: "syntheses",
        suggested_title: "Key Findings & Synthesis",
        reason: "Major discoveries and insights",
      },
      {
        name: "contradictions",
        category: "syntheses",
        suggested_title: "Areas of Contradiction",
        reason: "Where researchers disagree",
      },
      {
        name: "open_questions",
        category: "concepts",
        suggested_title: "Open Research Questions",
        reason: "What's still unknown in this domain",
      },
    ],
    Business: [
      {
        name: "market_overview",
        category: "syntheses",
        suggested_title: "Market Overview",
        reason: "Big picture of the market and competitive landscape",
      },
      {
        name: "competitive_analysis",
        category: "syntheses",
        suggested_title: "Competitive Analysis",
        reason: "Comparison of key competitors",
      },
      {
        name: "opportunities",
        category: "syntheses",
        suggested_title: "Market Opportunities",
        reason: "Gaps and growth areas",
      },
      {
        name: "risks",
        category: "concepts",
        suggested_title: "Market Risks",
        reason: "Threats and challenges",
      },
    ],
    Personal: [
      {
        name: "learning_goals",
        category: "concepts",
        suggested_title: "Learning Goals",
        reason: "What you want to learn in this domain",
      },
      {
        name: "key_insights",
        category: "syntheses",
        suggested_title: "Key Personal Insights",
        reason: "Major learnings and takeaways",
      },
      {
        name: "action_items",
        category: "concepts",
        suggested_title: "Action Items & Next Steps",
        reason: "What to do with this knowledge",
      },
      {
        name: "resources",
        category: "concepts",
        suggested_title: "Key Resources",
        reason: "Important links, books, people",
      },
    ],
  };

  const recommended = recommendedByDomain[domain] || recommendedByDomain.General;

  // Find missing pages
  const missingPages: string[] = [];
  for (const rec of recommended) {
    const found = existingPages.find((p) => p.name === rec.name);
    if (!found) {
      missingPages.push(rec.suggested_title);
    }
  }

  // Generate recommendations
  const recommendations: string[] = [];

  if (existingPages.length === 0) {
    recommendations.push("🌱 Start by ingesting your first source");
    recommendations.push("📝 Create an overview/synthesis page");
  } else if (existingPages.length < 10) {
    recommendations.push("📚 Add more sources to deepen understanding");
    if (missingPages.length > 0) {
      recommendations.push(`⚠️ Consider creating: ${missingPages[0]}`);
    }
  } else if (existingPages.length > 50) {
    recommendations.push("✅ You have a solid wiki foundation");
    recommendations.push("🔍 Run lint_wiki to health-check for gaps");
    recommendations.push("🔗 Verify cross-references are accurate");
  }

  if (missingPages.length > 2) {
    recommendations.push(
      `💡 Biggest gap: ${missingPages[0]} could improve wiki significantly`
    );
  }

  return {
    domain,
    recommended_pages: recommended,
    existing_pages: existingPages,
    missing_pages: missingPages,
    recommendations,
  };
}
