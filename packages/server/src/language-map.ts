import path from "node:path";

const EXT_MAP: Record<string, string> = {
  ".cs": "csharp",
  ".vb": "vbnet",
  ".fs": "fsharp",
  ".ts": "typescript",
  ".tsx": "typescript",
  ".js": "javascript",
  ".jsx": "javascript",
  ".mjs": "javascript",
  ".cjs": "javascript",
  ".php": "php",
  ".java": "java",
  ".py": "python",
  ".rb": "ruby",
  ".go": "go",
  ".rs": "rust",
  ".kt": "kotlin",
  ".swift": "swift",
  ".html": "html",
  ".htm": "html",
  ".cshtml": "razor",
  ".razor": "razor",
  ".vue": "vue",
  ".css": "css",
  ".scss": "scss",
  ".sass": "sass",
  ".less": "less",
  ".json": "json",
  ".xml": "xml",
  ".yml": "yaml",
  ".yaml": "yaml",
  ".sql": "sql",
  ".sh": "shell",
  ".bash": "shell",
  ".ps1": "powershell",
  ".md": "markdown",
  ".c": "c",
  ".h": "c",
  ".cpp": "cpp",
  ".hpp": "cpp",
  ".cc": "cpp",
};

export function extensionToLanguage(filePath: string): string {
  const base = path.basename(filePath).toLowerCase();
  // Angular pattern detection — checked first, before generic .ts.
  if (base.endsWith(".component.ts") || base.endsWith(".service.ts") || base.endsWith(".module.ts") || base.endsWith(".directive.ts") || base.endsWith(".pipe.ts") || base.endsWith(".guard.ts")) {
    return "angular";
  }
  const ext = path.extname(base);
  return EXT_MAP[ext] ?? "unknown";
}
