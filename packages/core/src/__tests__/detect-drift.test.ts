import path from "node:path";
import os from "node:os";
import fsp from "node:fs/promises";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { detectDrift } from "../tools/detect-drift";

describe("detect_drift", () => {
  let tmpDir: string;
  let projectPath: string;

  beforeEach(async () => {
    tmpDir = await fsp.mkdtemp(path.join(os.tmpdir(), "docuflow-drift-test-"));
    projectPath = tmpDir;

    // Create synthetic specimens
    const docDir = path.join(projectPath, ".docuflow", "sources", "samples", "docs", "tables");
    await fsp.mkdir(docDir, { recursive: true });

    const srcDir = path.join(projectPath, "src", "auth");
    await fsp.mkdir(srcDir, { recursive: true });

    // Documentation stating outdated facts
    const docContent = `
# Users Table

The users table stores application users.

## Schema
- id: string
- role: string
- email: string
    `;
    await fsp.writeFile(path.join(docDir, "users_table.md"), docContent);

    // Source code with intentional drift
    const srcContent = `
export interface User {
  id: string;
  roles: string[]; // Drift: role -> roles
  email: string;
  mfaEnabled: boolean; // Drift: missing in doc
  processorReference: string; // Drift: missing in doc
}
    `;
    await fsp.writeFile(path.join(srcDir, "user.ts"), srcContent);
  });

  afterEach(async () => {
    await fsp.rm(tmpDir, { recursive: true, force: true });
  });

  it("should flag intentional drifts between doc and code", async () => {
    const report = await detectDrift({
      project_path: projectPath,
      doc_path: ".docuflow/sources/samples/docs/tables/users_table.md",
      source_paths: ["src/auth/user.ts"]
    });

    expect(report.doc_path).toBe(".docuflow/sources/samples/docs/tables/users_table.md");
    expect(report.source_paths).toContain("src/auth/user.ts");
    expect(report.is_stale).toBe(true);

    const types = report.discrepancies.map(d => d.type);
    const fields = report.discrepancies.map(d => d.field);

    // Assert that the specific drifts are detected
    expect(fields).toContain("roles"); // type mismatch for role
    expect(fields).toContain("mfaEnabled"); // missing in doc
    expect(fields).toContain("processorReference"); // missing in doc
    
    const roleDrift = report.discrepancies.find(d => d.field === "roles");
    expect(roleDrift?.type).toBe("type_mismatch");

    const mfaDrift = report.discrepancies.find(d => d.field === "mfaEnabled");
    expect(mfaDrift?.type).toBe("missing_in_doc");
  });
});
