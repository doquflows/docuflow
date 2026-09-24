import path from "node:path";
import crypto from "node:crypto";
import { safeReadFile, writeFileAtomic } from "../filesystem";

export type RewriteDocument = (docContent: string, codeContent: string, sourceHash: string) => Promise<string> | string;

export interface RegenerateDocDependencies {
  /**
   * Local-only or injected LLM adapter to rewrite the document.
   */
  rewriteDocument?: RewriteDocument;
}

export interface RegenerateDocInput {
  project_path: string;
  doc_path: string;
  code_paths: string[];
}

/**
 * Safe offline fallback used when no local LLM adapter is configured.
 * Preserves frontmatter and idempotently replaces the auto-generated section.
 */
export function fallbackRewriter(docContent: string, codeContent: string, sourceHash: string): string {
  let frontmatter = "";
  let content = docContent;

  const lines = docContent.split("\n");
  if (lines[0] === "---") {
    let endIdx = -1;
    for (let i = 1; i < lines.length; i++) {
      if (lines[i] === "---") {
        endIdx = i;
        break;
      }
    }
    if (endIdx !== -1) {
      frontmatter = lines.slice(1, endIdx).join("\n");
      content = lines.slice(endIdx + 1).join("\n");
    }
  }

  const existingKeys = new Set<string>();
  const fmLines = frontmatter ? frontmatter.split("\n") : [];
  
  const newFmLines = fmLines.map(line => {
    const match = line.match(/^([a-zA-Z0-9_-]+):(.*)/);
    if (match) {
      const key = match[1];
      existingKeys.add(key);
      if (key === 'source_hash') return `source_hash: ${sourceHash}`;
      if (key === 'updated_by') return `updated_by: docuflow-doc-regeneration`;
      return line;
    }
    return line;
  });

  if (!existingKeys.has('updated_by')) newFmLines.push(`updated_by: docuflow-doc-regeneration`);
  if (!existingKeys.has('source_hash')) newFmLines.push(`source_hash: ${sourceHash}`);

  const autoGenHeader = "## Auto-Generated Updates";
  const contentLines = content.split("\n");
  let headerIdx = -1;
  for (let i = 0; i < contentLines.length; i++) {
    if (contentLines[i].startsWith(autoGenHeader)) {
      headerIdx = i;
      break;
    }
  }
  
  if (headerIdx !== -1) {
    content = contentLines.slice(0, headerIdx).join("\n");
  }
  
  content = content.trimEnd();

  return [
    "---",
    ...newFmLines,
    "---",
    content,
    "",
    "## Auto-Generated Updates",
    "This document was regenerated to match the following code:",
    "```",
    codeContent.substring(0, 200) + (codeContent.length > 200 ? "..." : ""),
    "```"
  ].join("\n");
}

export async function regenerateDoc(input: RegenerateDocInput, dependencies: RegenerateDocDependencies = {}): Promise<{
  success: boolean;
  message: string;
}> {
  try {
    const projectPath = path.resolve(input.project_path);
    const docFile = path.join(projectPath, input.doc_path);
    const docRead = await safeReadFile(docFile);

    if (docRead.error) {
      return { success: false, message: `Failed to read doc: ${docRead.error}` };
    }

    const docContent = docRead.content ?? "";

    const codeContents: string[] = [];
    for (const codePath of input.code_paths) {
      const codeFile = path.join(projectPath, codePath);
      const codeRead = await safeReadFile(codeFile);
      if (codeRead.error) {
        return { success: false, message: `Failed to read code file ${codePath}: ${codeRead.error}` };
      }
      codeContents.push(`// File: ${codePath}\n${codeRead.content ?? ""}`);
    }

    const combinedCodeContent = codeContents.join("\n\n");
    const sourceHash = crypto.createHash('sha256').update(combinedCodeContent).digest('hex');

    const rewriteDocument = dependencies.rewriteDocument;
    if (!rewriteDocument) {
      throw new Error("Missing rewriteDocument dependency. A placeholder that silently ships is the failure mode our own playbook calls out.");
    }
    const newDocContent = await rewriteDocument(docContent, combinedCodeContent, sourceHash);

    await writeFileAtomic(docFile, newDocContent);

    return { success: true, message: `Successfully regenerated ${input.doc_path}` };
  } catch (e: any) {
    return { success: false, message: `Regeneration failed: ${e?.message ?? String(e)}` };
  }
}
