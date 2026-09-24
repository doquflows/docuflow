import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { containsJapaneseText, ingestSource } from "../tools/ingest-source";
import { wikiSearch } from "../tools/wiki-search";

const temporaryProjects: string[] = [];

async function makeProject(sourceName: string, source: string): Promise<string> {
  const projectPath = await fsp.mkdtemp(path.join(os.tmpdir(), "docuflow-bilingual-"));
  temporaryProjects.push(projectPath);
  const sourcesDir = path.join(projectPath, ".docuflow", "sources");
  await fsp.mkdir(sourcesDir, { recursive: true });
  await fsp.writeFile(path.join(sourcesDir, sourceName), source, "utf8");
  return projectPath;
}

afterEach(async () => {
  await Promise.all(temporaryProjects.splice(0).map((projectPath) =>
    fsp.rm(projectPath, { recursive: true, force: true })
  ));
});

describe("bilingual ingestion", () => {
  it("detects Japanese text without misclassifying English text", () => {
    expect(containsJapaneseText("認証サービスの設計")).toBe(true);
    expect(containsJapaneseText("カタカナとひらがな")).toBe(true);
    expect(containsJapaneseText("Authentication service design v2")).toBe(false);
  });

  it("leaves English sources untagged and does not invoke translation", async () => {
    const projectPath = await makeProject(
      "english.md",
      "# Authentication\n\n## Token Service\n\nThe token service validates every request."
    );
    const translateToEnglish = vi.fn(async () => "should not run");

    const result = await ingestSource(
      { project_path: projectPath, source_filename: "english.md" },
      { translateToEnglish }
    );

    expect(result.pages_created.length).toBeGreaterThan(0);
    expect(translateToEnglish).not.toHaveBeenCalled();
    const summary = await fsp.readFile(
      path.join(projectPath, ".docuflow", "wiki", "syntheses", "source_english.md"),
      "utf8"
    );
    expect(summary).not.toContain("bilingual");
    expect(summary).not.toContain("Original Japanese");
  });

  it("stores English and Japanese together and supports English lexical search", async () => {
    const japaneseSource = [
      "# 認証設計",
      "",
      "## トークンサービス",
      "",
      "トークンサービスはすべての要求を検証します。",
    ].join("\n");
    const englishTranslation = [
      "# Authentication Design",
      "",
      "## Token Service",
      "",
      "The token service validates every request for the authentication gateway.",
    ].join("\n");
    const projectPath = await makeProject("auth-ja.md", japaneseSource);
    const translateToEnglish = vi.fn(async () => englishTranslation);

    await ingestSource(
      { project_path: projectPath, source_filename: "auth-ja.md" },
      { translateToEnglish }
    );

    expect(translateToEnglish).toHaveBeenCalledWith(japaneseSource);
    const summary = await fsp.readFile(
      path.join(projectPath, ".docuflow", "wiki", "syntheses", "source_auth_ja.md"),
      "utf8"
    );
    expect(summary).toContain('tags: ["source","ingested","bilingual","translated"]');
    expect(summary).toContain("## English Translation");
    expect(summary).toContain("authentication gateway");
    expect(summary).toContain("## Original Japanese");
    expect(summary).toContain("認証設計");

    const search = await wikiSearch({ project_path: projectPath, query: "authentication gateway" });
    expect(search.results.map((result) => result.page_id)).toContain("entity_token_service");
  });
});
