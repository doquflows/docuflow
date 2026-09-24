import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import readline from "node:readline";
import { buildClaudeMd, registerInGlobalRegistry } from "./init";

type Domain = "code" | "research" | "business" | "personal";

interface InteractiveConfig {
  domain: Domain;
  projectName: string;
  description: string;
}

async function prompt(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

async function selectDomain(): Promise<Domain> {
  console.log("\n📚 What domain is your wiki for?");
  console.log("  1) Code & Architecture");
  console.log("  2) Research & Analysis");
  console.log("  3) Business & Markets");
  console.log("  4) Personal Knowledge");

  let selection = "";
  while (!["1", "2", "3", "4"].includes(selection)) {
    selection = await prompt("Select (1-4): ");
  }

  const domains: Record<string, Domain> = {
    "1": "code",
    "2": "research",
    "3": "business",
    "4": "personal",
  };

  return domains[selection];
}

async function getProjectInfo(domain: Domain): Promise<{ name: string; description: string }> {
  console.log(`\n📝 Tell me about your ${domain} wiki`);

  const name = await prompt(
    "Project name (e.g., 'MyProject', 'Research2026'): "
  );
  const description = await prompt(
    "Brief description (what will this wiki track?): "
  );

  return { name, description };
}

function getSchemaForDomain(domain: Domain): string {
  const schemas: Record<Domain, string> = {
    code: `# Docuflow Wiki Schema - Code/Architecture

## Domain
Architecture and codebase documentation.

## Wiki Structure

### Entities (entities/)
- Services: key microservices and components
- APIs: public interfaces and endpoints  
- Databases: data models and schemas
- Frameworks: libraries and tools used

### Concepts (concepts/)
- Design Patterns: architectural and coding patterns
- Principles: design principles and guidelines
- Integrations: how components work together
- Configuration: important settings and options

### Syntheses (syntheses/)
- Architecture Overview: system design
- Decision Records: design decisions
- Deployment Guide: how to deploy
- API Reference: complete API docs

### Timelines (timelines/)
- Version History: evolution of the system
- Roadmap: planned changes

## Cross-Reference Patterns
- "integrates with" - components/services that work together
- "implemented by" - which entities implement a concept
- "uses pattern" - which architecture patterns apply
- "depends on" - dependencies between components

## Metadata
Each page should include:
- created_at: when first documented
- updated_at: last update date
- tech_stack: relevant technologies
- contributors: who wrote/contributed
`,
    research: `# Docuflow Wiki Schema - Research

## Domain
Research findings and analysis.

## Wiki Structure

### Entities (entities/)
- Papers: academic papers and articles
- Researchers: key people in the field
- Conferences: important venues
- Datasets: data sources used

### Concepts (concepts/)
- Methodologies: research methods
- Theories: key theories and frameworks
- Open Problems: unsolved questions
- Keywords: important terms

### Syntheses (syntheses/)
- Literature Review: synthesis of papers
- Findings: key discoveries
- Future Work: research directions
- Contradictions: areas of disagreement

### Timelines (timelines/)
- Research Evolution: how field evolved
- Timeline of Discoveries: key milestones

## Cross-Reference Patterns
- "cites" - references between papers
- "extends" - builds on prior work
- "contradicts" - disagreement between sources
- "validates" - experimental confirmation
- "relates to" - topical connection

## Metadata
Each page should include:
- created_at: when added
- updated_at: last refresh
- sources: which papers/sources
- citations: number of times cited
- confidence: how confident in findings
`,
    business: `# Docuflow Wiki Schema - Business

## Domain
Business and competitive analysis.

## Wiki Structure

### Entities (entities/)
- Companies: competitors and partners
- Products: key offerings
- Markets: market segments
- Customers: customer types

### Concepts (concepts/)
- Business Models: how companies make money
- Market Segments: addressable markets
- Capabilities: key competitive advantages
- Trends: market trends

### Syntheses (syntheses/)
- Competitive Analysis: comparison matrix
- Market Overview: market positioning
- Opportunities: growth opportunities
- Risks: market risks

### Timelines (timelines/)
- Market Evolution: how market changed
- Competitive Timeline: competitor moves

## Cross-Reference Patterns
- "competes with" - direct competitors
- "targets" - goes after customer/market
- "partners with" - partnerships
- "disrupts" - disruption threat
- "complements" - complementary products

## Metadata
Each page should include:
- created_at: when first documented
- updated_at: last update
- market_size: TAM/SAM/SOM if known
- growth_rate: annual growth
- sources: where info came from
`,
    personal: `# Docuflow Wiki Schema - Personal

## Domain
Personal knowledge, learning, and goals.

## Wiki Structure

### Entities (entities/)
- Topics: areas of interest/expertise
- Resources: books, courses, websites
- People: mentors, collaborators
- Projects: personal projects

### Concepts (concepts/)
- Learning Goals: what to learn
- Skills: competencies to develop
- Insights: key personal learnings
- Practices: habits and routines

### Syntheses (syntheses/)
- Reflections: deeper thinking
- Progress Updates: tracking learning
- Connections: how ideas relate
- Action Plans: what to do next

### Timelines (timelines/)
- Learning Journey: personal evolution
- Milestones: key achievements

## Cross-Reference Patterns
- "builds on" - prerequisite knowledge
- "connects to" - related topics
- "informs" - influences thinking
- "inspires" - inspiration source
- "applies to" - practical application

## Metadata
Each page should include:
- created_at: when started learning
- updated_at: last review
- relevance: importance (high/medium/low)
- mastery_level: expertise level (beginner/intermediate/expert)
- time_invested: hours spent
`,
  };

  return schemas[domain];
}

function getPlanningTemplate(domain: Domain, projectName: string): string {
  return `# ${projectName} Wiki Plan

## Goal
Document and organize knowledge for ${projectName}.

## Initial Sources to Add
1. [ ] README or main overview
2. [ ] Key source file 1
3. [ ] Key source file 2

## Key Entities to Define
- Entity 1: [description]
- Entity 2: [description]

## Key Concepts to Extract
- Concept 1: [description]
- Concept 2: [description]

## First Questions to Answer
1. [What do you want to understand first?]
2. [What relationships are important?]

## Success Criteria
- [ ] Successfully ingested first 3 sources
- [ ] Created 10+ wiki pages
- [ ] Can answer key questions
- [ ] Wiki is at 80%+ health score

## Next Review Date
[Date for first maintenance check]
`;
}

export async function runInteractive(): Promise<void> {
  console.log("\n🌟 Welcome to Docuflow Wiki Setup!\n");
  console.log("I'll help you set up a wiki for your project.");
  console.log(
    "This should take about 2 minutes. You can customize later.\n"
  );

  // Get domain
  const domain = await selectDomain();
  console.log(`✓ Selected: ${domain}`);

  // Get project info
  const { name: projectName, description } = await getProjectInfo(domain);
  console.log(`✓ Project: "${projectName}" - ${description}`);

  // Confirm setup
  console.log(
    "\n✨ I'll create a wiki structure for you with recommended schema."
  );
  const confirm = await prompt("Ready to proceed? (y/n): ");
  if (confirm.toLowerCase() !== "y") {
    console.log("\n👋 Setup cancelled.");
    return;
  }

  // Get schema for domain
  const domainSchema = getSchemaForDomain(domain);
  const planTemplate = getPlanningTemplate(domain, projectName);

  console.log("\n📁 Creating wiki structure...");

  const docuDir = path.join(process.cwd(), ".docuflow");
  const wikiDir = path.join(docuDir, "wiki");

  // Create directories
  await fsp.mkdir(path.join(wikiDir, "entities"), { recursive: true });
  await fsp.mkdir(path.join(wikiDir, "concepts"), { recursive: true });
  await fsp.mkdir(path.join(wikiDir, "syntheses"), { recursive: true });
  await fsp.mkdir(path.join(wikiDir, "timelines"), { recursive: true });
  await fsp.mkdir(path.join(docuDir, "sources"), { recursive: true });
  await fsp.mkdir(path.join(docuDir, "specs"), { recursive: true });

  console.log("  ✓ Created wiki directories");

  // Write schema with domain-specific content
  await fsp.writeFile(
    path.join(docuDir, "schema.md"),
    domainSchema,
    "utf8"
  );
  console.log("  ✓ Created schema.md with domain-specific structure");

  // Write index and log
  const indexContent = `# Wiki Index

Auto-maintained catalog of all wiki pages.

## Generated: ${new Date().toISOString()}

(Index is automatically updated as you ingest sources)
`;
  await fsp.writeFile(path.join(docuDir, "index.md"), indexContent, "utf8");
  console.log("  ✓ Created index.md");

  const logContent = `# Operation Log

Record of all wiki operations.

## [${new Date().toISOString()}] init | Wiki initialized
- Domain: ${domain}
- Project: ${projectName}
- Description: ${description}
`;
  await fsp.writeFile(path.join(docuDir, "log.md"), logContent, "utf8");
  console.log("  ✓ Created log.md");

  // Write planning template
  const planPath = path.join(docuDir, "PLAN.md");
  await fsp.writeFile(planPath, planTemplate, "utf8");
  console.log("  ✓ Created PLAN.md (interactive planning guide)");

  // Generate CLAUDE.md so Claude Code picks up DocuFlow automatically
  const claudeMdContent = buildClaudeMd(process.cwd());
  const claudeMdPath = path.join(process.cwd(), "CLAUDE.md");
  if (fs.existsSync(claudeMdPath)) {
    const existing = await fsp.readFile(claudeMdPath, "utf8");
    if (existing.includes("DocuFlow")) {
      const withoutDocuflow = existing.replace(/\n?# DocuFlow[\s\S]*/, "").trimEnd();
      await fsp.writeFile(claudeMdPath, withoutDocuflow + "\n\n" + claudeMdContent, "utf8");
    } else {
      await fsp.appendFile(claudeMdPath, "\n\n" + claudeMdContent, "utf8");
    }
  } else {
    await fsp.writeFile(claudeMdPath, claudeMdContent, "utf8");
  }
  console.log("  ✓ Created CLAUDE.md (Claude Code will read DocuFlow tool instructions automatically)");

  // Register in global project registry so `docuflow ui` always finds this project
  await registerInGlobalRegistry(process.cwd());

  console.log("\n✅ Wiki successfully initialized!\n");

  // Print summary and next steps
  console.log("📋 Next Steps:");
  console.log("  1. Review your schema: .docuflow/schema.md");
  console.log("  2. Review your plan: .docuflow/PLAN.md");
  console.log("  3. Add first source: copy to .docuflow/sources/");
  console.log("  4. Ask Claude: 'Ingest README.md into my wiki'");
  console.log("  5. Ask Claude: 'What should my wiki contain?'");
  console.log("\n💡 Tip: Claude Code will automatically read CLAUDE.md for DocuFlow instructions.\n");
}
