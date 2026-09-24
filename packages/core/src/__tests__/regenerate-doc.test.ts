import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { regenerateDoc } from "../tools/regenerate-doc";

const temporaryProjects: string[] = [];

async function makeProject(docName: string, docContent: string, codeName: string, codeContent: string): Promise<string> {
  const projectPath = await fsp.mkdtemp(path.join(os.tmpdir(), "docuflow-regen-"));
  temporaryProjects.push(projectPath);
  
  const docDir = path.dirname(path.join(projectPath, docName));
  await fsp.mkdir(docDir, { recursive: true });
  await fsp.writeFile(path.join(projectPath, docName), docContent, "utf8");

  const codeDir = path.dirname(path.join(projectPath, codeName));
  await fsp.mkdir(codeDir, { recursive: true });
  await fsp.writeFile(path.join(projectPath, codeName), codeContent, "utf8");
  
  return projectPath;
}

afterEach(async () => {
  await Promise.all(temporaryProjects.splice(0).map((projectPath) =>
    fsp.rm(projectPath, { recursive: true, force: true })
  ));
});

describe("doc regeneration", () => {
  it("successfully updates an intentionally stale synthetic specimen to match its code counterpart", async () => {
    const staleDoc = [
      "# Users Table",
      "Contains user data.",
      "Columns:",
      "- id: UUID",
      "- email: string",
      "- name: string",
    ].join("\n");

    const newCode = [
      "export interface User {",
      "  id: string;",
      "  emailAddress: string;",
      "  fullName: string;",
      "  createdAt: Date;",
      "}",
    ].join("\n");

    const projectPath = await makeProject(
      "docs/tables/users_table.md",
      staleDoc,
      "src/auth/user.ts",
      newCode
    );

    const rewriteDocument = vi.fn(async (docContent: string, codeContent: string) => {
      return [
        "# Users Table",
        "Contains user data.",
        "Columns:",
        "- id: string",
        "- emailAddress: string",
        "- fullName: string",
        "- createdAt: Date",
      ].join("\n");
    });

    const result = await regenerateDoc(
      { 
        project_path: projectPath, 
        doc_path: "docs/tables/users_table.md", 
        code_paths: ["src/auth/user.ts"] 
      },
      { rewriteDocument }
    );

    expect(result.success).toBe(true);
    expect(rewriteDocument).toHaveBeenCalled();

    const updatedDoc = await fsp.readFile(
      path.join(projectPath, "docs/tables/users_table.md"),
      "utf8"
    );

    expect(updatedDoc).toContain("emailAddress");
    expect(updatedDoc).toContain("fullName");
    expect(updatedDoc).toContain("createdAt");
    expect(updatedDoc).not.toContain("name: string");
  });
});
