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
