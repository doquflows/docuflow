/**
 * Stop-list for wiki entity extraction.
 * Any candidate whose normalized form appears here is rejected as a generic term
 * that adds noise without semantic value.
 *
 * Applied as single-word match AND whole-phrase match. Multi-word phrases
 * where every word is on this list are also rejected (see ruleStopList).
 */
export const ENTITY_STOPLIST = new Set([
  // Generic quantifiers / determiners
  "any", "all", "some", "each", "every", "one", "two", "three", "four", "five",
  "none", "both", "either", "other", "another", "several", "many", "few",
  // Conjunctions / prepositions / filler / connectors
  "the", "and", "or", "for", "with", "from", "into", "onto", "over", "under",
  "then", "when", "while", "where", "which", "what", "who", "why", "how",
  "that", "this", "these", "those", "here", "there", "of", "in", "on", "at",
  "to", "by", "as", "is", "are", "was", "were", "be", "been", "being",
  // Modal / auxiliary verbs
  "can", "will", "shall", "would", "could", "should", "must", "may", "might",
  "also", "just", "only", "even", "already", "still", "yet", "more",
  // Boolean / status tokens
  "true", "false", "yes", "no", "ok", "done", "todo",
  // Common vague action words
  "add", "added", "remove", "removed", "update", "updated",
  "change", "changed", "fix", "fixed", "use", "used", "get", "set",
  "allow", "allowed", "block", "blocked", "enable", "enabled", "disable", "disabled",
  "create", "created", "build", "built", "run", "ran", "make", "made",
  "show", "shows", "display", "displayed", "include", "included",
  // Generic noun noise
  "active", "audience", "behavior", "behaviour", "benefits", "binary",
  "append", "approval", "audit", "auditable",
  "note", "notes", "type", "types", "item", "items", "list", "value", "values",
  "option", "options", "example", "examples", "result", "results",
  "output", "outputs", "input", "inputs", "data", "info", "information",
  "step", "steps", "section", "sections", "part", "parts", "content",
  // Section-heading boilerplate (single words)
  "architecture", "overview", "purpose", "documentation", "installation",
  "commands", "components", "configuration", "management", "registration",
  "views", "view", "iteration", "iterations",
  "summary", "introduction", "background", "context", "scope", "rationale",
  "goals", "goal", "motivation", "definition", "definitions", "terminology",
  "implementation", "design", "approach", "methodology", "method", "methods",
  "usage", "setup", "tutorial", "guide", "guides", "reference",
  "requirements", "dependencies", "prerequisites", "features", "feature",
  "categories", "category", "kind", "kinds",
  "workflow", "workflows", "pipeline", "pipelines",
  "system", "systems", "module", "modules", "package", "packages",
  "service", "services", "interface", "interfaces", "layer", "layers",
  "support", "supports", "supported", "available", "current",
  // Common section adjectives (combined with stop nouns → all-stop phrase rejected)
  "key", "core", "main", "primary", "secondary", "general", "basic", "advanced",
  "common", "typical", "standard", "default", "custom", "specific", "generic",
  "new", "old", "next", "previous", "first", "last", "final", "initial",
  // Doc-structure terms
  "title", "abstract", "outline", "table", "figure", "diagram", "appendix",
  "footnote", "footnotes", "see", "above", "below",
  // Common project section phrases (multi-word, exact match)
  "getting started", "next steps", "key components", "key commands",
  "core modules", "core components", "core types", "tech stack",
  "technology stack", "use case", "use cases", "see also", "edge cases",
  "acceptance criteria", "test scenarios", "testing results",
  "implementation status", "implementation steps", "files to touch",
  "format options", "format purity", "data flow", "data storage",
  "entry point", "output includes", "step by step",
  "command pattern", "tool pattern", "document type", "release history",
  "design principles", "security considerations",
  "global flags", "environment variables", "flag normalization",
  "filename validation", "commit deduplication", "commit message format",
  "create update", "find contradictions", "find gaps", "find orphans", "find stale",
  "build pipeline", "ci cd", "ci cd pipeline", "github actions workflow",
  "github actions integration", "version controlled", "version injection",
  "deployment to release repo", "readme integration",
  "lessons learned applied to docuflow", "specific wiki pages for docuflow",
  "wiki maintenance for docuflow", "wiki pipeline tools", "codebase scanner tools",
  "health guidance tools", "tool categories summary", "package responsibilities",
  "component architecture", "monorepo overview", "package architecture",
  "phase 2 testing", "initial setup", "ingest workflow", "query workflow",
  "lint workflow", "related entities", "agent integration",
  "integration with docuflow", "mcp registration",
  "project context", "project auto discovery", "provider detection",
  "silent fallback warning", "reviewer verdict format", "task spec format",
  "reusable skill", "supported languages",
  "what it detects", "what it does", "what it shows", "what starts",
  "concepts ideas", "entities things", "syntheses analyses", "timelines events",
  "graph tool", "format options",
]);
