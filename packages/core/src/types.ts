export interface ExtractedFacts {
  classes: string[];
  functions: string[];
  dependencies: string[];
  db_tables: string[];
  endpoints: string[];
  config_refs: string[];
}

export interface ModuleInfo extends ExtractedFacts {
  path: string;
  language: string;
  size_bytes: number;
  raw_content?: string;
  error?: string;
}

export interface ListResult {
  scanned_at: string;
  project_path: string;
  total_files: number;
  skipped_files: { path: string; reason: string }[];
  languages_found: string[];
  modules: ModuleInfo[];
}

export interface SpecIndexEntry {
  filename: string;
  written_at: string;
}

export interface SpecIndex {
  specs: SpecIndexEntry[];
}

// ============================================================
// LLM Wiki Extensions (Phase 1+)
// ============================================================

export interface WikiPageFrontmatter {
  created_at: string;
  updated_at: string;
  sources: string[];
  tags: string[];
  inbound_links: string[];
  outbound_links: string[];
}

export interface WikiPage {
  id: string;
  title: string;
  category: "entity" | "concept" | "timeline" | "synthesis" | "index" | "log";
  content: string;
  frontmatter: WikiPageFrontmatter;
}

export interface IngestResult {
  source_id: string;
  summary: string;
  pages_created: string[];
  pages_updated: string[];
  entities_discovered: string[];
  contradictions: Array<{ page: string; issue: string }>;
}

export interface QueryResult {
  answer: string;
  source_pages: string[];
  confidence: number;
  new_page_created?: string;
}

export interface LintResult {
  issues: Array<{ type: string; page: string; detail: string }>;
  metrics: {
    orphans: number;
    missing_refs: number;
    contradictions: number;
  };
  recommendations: string[];
}

export interface DriftDiscrepancy {
  field: string;
  doc_value?: string;
  code_value?: string;
  type: "missing_in_doc" | "missing_in_code" | "type_mismatch" | "contradiction" | "source_hash_mismatch";
  description: string;
}

export interface DriftReport {
  doc_path: string;
  source_paths: string[];
  is_stale: boolean;
  discrepancies: DriftDiscrepancy[];
}
