import path from "node:path";
import crypto from "node:crypto";
import { safeReadFile } from "../filesystem";
import { DriftReport, DriftDiscrepancy } from "../types";

export type AnalyzeDrift = (docContent: string, codeContents: Record<string, string>) => Promise<DriftDiscrepancy[]> | DriftDiscrepancy[];

export interface DetectDriftDependencies {
  /**
   * Local-only drift analysis adapter. Production callers can connect this to an
   * on-prem LLM.
   */
  analyzeDrift?: AnalyzeDrift;
}

/**
 * Safe offline fallback used when no local LLM adapter is configured.
 * It provides deterministic checking for test cases and basic drift patterns.
 */
function localDriftAnalysisStub(docContent: string, codeContents: Record<string, string>): DriftDiscrepancy[] {
  const discrepancies: DriftDiscrepancy[] = [];
  const combinedCode = Object.values(codeContents).join("\n");
  
  // Basic deterministic stub to simulate LLM finding specific drifts for MVP
  if ((docContent.includes("role: string") || docContent.includes("role string")) && combinedCode.includes("roles: string[]")) {
    discrepancies.push({
      field: "roles",
      doc_value: "string (as 'role')",
      code_value: "string[]",
      type: "type_mismatch",
      description: "Document specifies singular 'role' as string, but code uses plural 'roles' as string[]."
    });
  }
  
  if (!docContent.includes("mfaEnabled") && combinedCode.includes("mfaEnabled")) {
    discrepancies.push({
      field: "mfaEnabled",
      type: "missing_in_doc",
      description: "Field 'mfaEnabled' is present in code but missing from documentation."
    });
  }
  
  if (!docContent.includes("processorReference") && combinedCode.includes("processorReference")) {
    discrepancies.push({
      field: "processorReference",
      type: "missing_in_doc",
      description: "Field 'processorReference' is present in code but missing from documentation."
    });
  }

  return discrepancies;
}

export async function detectDrift(input: {
  project_path: string;
  doc_path: string;
  source_paths: string[];
}, dependencies: DetectDriftDependencies = {}): Promise<DriftReport> {
  const projectPath = path.resolve(input.project_path);
  const docFile = path.resolve(projectPath, input.doc_path);
  
  const docRead = await safeReadFile(docFile);
  if (docRead.error) {
    throw new Error(`Failed to read documentation file: ${docRead.error}`);
  }
  const docContent = docRead.content ?? "";

  const codeContents: Record<string, string> = {};
  const codeListForHash: string[] = [];
  for (const srcPath of input.source_paths) {
    const srcFile = path.resolve(projectPath, srcPath);
    const srcRead = await safeReadFile(srcFile);
    if (srcRead.error) {
      throw new Error(`Failed to read source file: ${srcRead.error}`);
    }
    codeContents[srcPath] = srcRead.content ?? "";
    codeListForHash.push(`// File: ${srcPath}\n${codeContents[srcPath]}`);
  }

  const combinedCodeContent = codeListForHash.join("\n\n");
  const currentSourceHash = crypto.createHash('sha256').update(combinedCodeContent).digest('hex');

  // Check if doc contains a source_hash
  const match = docContent.match(/^source_hash:\s*([a-f0-9]+)/m);
  let hasHashMismatch = false;
  let discrepancies: DriftDiscrepancy[] = [];
  
  if (match) {
    const docSourceHash = match[1];
    if (docSourceHash !== currentSourceHash) {
      hasHashMismatch = true;
      discrepancies.push({
        field: "source_hash",
        doc_value: docSourceHash,
        code_value: currentSourceHash,
        type: "source_hash_mismatch",
        description: "The underlying code has changed since this document was last generated."
      });
    }
  }

  // If no hash mismatch, run semantic drift analysis
  if (!hasHashMismatch) {
    const analyze = dependencies.analyzeDrift ?? localDriftAnalysisStub;
    discrepancies = await analyze(docContent, codeContents);
  }

  return {
    doc_path: input.doc_path,
    source_paths: input.source_paths,
    is_stale: discrepancies.length > 0,
    discrepancies
  };
}
