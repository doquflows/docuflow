import path from "node:path";
import { safeReadFile } from "../filesystem";
import { extensionToLanguage } from "../language-map";
import { extract } from "../extractor";
import { ModuleInfo } from "../types";

const MAX_RAW = 8000;

export async function readModule(input: { path: string }): Promise<ModuleInfo> {
  const filePath = path.resolve(input.path);
  const language = extensionToLanguage(filePath);
  const read = await safeReadFile(filePath);

  if (read.error) {
    return {
      path: filePath,
      language,
      size_bytes: 0,
      classes: [],
      functions: [],
      dependencies: [],
      db_tables: [],
      endpoints: [],
      config_refs: [],
      error: read.error,
    };
  }
  if (read.binary) {
    return {
      path: filePath,
      language,
      size_bytes: read.size,
      classes: [],
      functions: [],
      dependencies: [],
      db_tables: [],
      endpoints: [],
      config_refs: [],
      error: "binary file skipped",
    };
  }

  const content = read.content ?? "";
  const facts = extract(content);
  return {
    path: filePath,
    language,
    size_bytes: read.size,
    ...facts,
    raw_content: content.length > MAX_RAW ? content.slice(0, MAX_RAW) : content,
  };
}
