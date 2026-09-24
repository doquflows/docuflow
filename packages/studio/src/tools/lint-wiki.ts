import * as fs from "fs";
import * as path from "path";

interface LintIssue {
  type: "orphan" | "contradiction" | "stale" | "missing_ref" | "metadata_gap" | "unverified_claim" | "stale_extraction";
  page_id: string;
  page_title: string;
  severity: "high" | "medium" | "low";
  detail: string;
  suggestion?: string;
}

interface WikiPageMetadata {
  created_at: string;
  updated_at: string;
  sources: string[];
  tags: string[];
  inbound_links: string[];
  outbound_links: string[];
}

interface LintResult {
  total_pages: number;
  issues_found: LintIssue[];
  metrics: {
    orphan_pages: number;
    contradictions: number;
    stale_pages: number;
    missing_refs: number;
    metadata_gaps: number;
    unverified_claims: number;
    stale_extractions: number;
  };
  recommendations: string[];
  health_score: number;
}

function parsePageMetadata(
  content: string
): { metadata: WikiPageMetadata | null; body: string } {
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!frontmatterMatch) {
    return { metadata: null, body: content };
  }

  const frontmatterStr = frontmatterMatch[1];
  const body = frontmatterMatch[2];

  const metadata: WikiPageMetadata = {
    created_at: extractYamlField(frontmatterStr, "created_at") || new Date().toISOString(),
    updated_at: extractYamlField(frontmatterStr, "updated_at") || new Date().toISOString(),
    sources: parseYamlArray(frontmatterStr, "sources") || [],
    tags: parseYamlArray(frontmatterStr, "tags") || [],
    inbound_links: parseYamlArray(frontmatterStr, "inbound_links") || [],
    outbound_links: parseYamlArray(frontmatterStr, "outbound_links") || [],
  };

  return { metadata, body };
}

function extractYamlField(yaml: string, field: string): string | null {
  const regex = new RegExp(`^${field}:\\s*(.+)$`, "m");
  const match = yaml.match(regex);
  return match ? match[1].trim() : null;
}

function parseYamlArray(yaml: string, field: string): string[] {
  const regex = new RegExp(`^${field}:\\s*\\[(.+)\\]$`, "m");
  const match = yaml.match(regex);
  if (!match) return [];
  return match[1].split(",").map((s) => s.trim().replace(/['"]/g, ""));
}

function extractLinks(content: string): string[] {
  const linkRegex = /\[([^\]]+)\]\(\.\/([^)]+)\)/g;
  const links: string[] = [];
  let match;
  while ((match = linkRegex.exec(content)) !== null) {
    links.push(match[2].replace(".md", ""));
  }
  return links;
}

function findOrphanPages(
  pageMap: Map<string, string>
): LintIssue[] {
  const issues: LintIssue[] = [];

  for (const [pageId, filePath] of pageMap) {
    if (!fs.existsSync(filePath)) continue;

    const content = fs.readFileSync(filePath, "utf-8");
    const { metadata } = parsePageMetadata(content);

    if (metadata && metadata.inbound_links.length === 0) {
      issues.push({
        type: "orphan",
        page_id: pageId,
        page_title: extractPageTitle(content),
        severity: "medium",
        detail: `Page has no inbound links from other wiki pages`,
        suggestion: `Consider linking this page from related entity or concept pages, or remove if not needed.`,
      });
    }
  }

  return issues;
}

function findStalePages(pageMap: Map<string, string>): LintIssue[] {
  const issues: LintIssue[] = [];
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  for (const [pageId, filePath] of pageMap) {
    if (!fs.existsSync(filePath)) continue;

    const content = fs.readFileSync(filePath, "utf-8");
    const { metadata } = parsePageMetadata(content);

    if (metadata) {
      const updatedAt = new Date(metadata.updated_at);
      if (updatedAt < thirtyDaysAgo) {
        issues.push({
          type: "stale",
          page_id: pageId,
          page_title: extractPageTitle(content),
          severity: "low",
          detail: `Page last updated ${Math.floor((Date.now() - updatedAt.getTime()) / (24 * 60 * 60 * 1000))} days ago`,
          suggestion: `Consider reviewing and updating if new information is available.`,
        });
      }
    }
  }

  return issues;
}

function findMissingReferences(
  pageMap: Map<string, string>
): LintIssue[] {
  const issues: LintIssue[] = [];

  for (const [pageId, filePath] of pageMap) {
    if (!fs.existsSync(filePath)) continue;

    const content = fs.readFileSync(filePath, "utf-8");
    const { body } = parsePageMetadata(content);

    const links = extractLinks(body);
    for (const link of links) {
      if (!pageMap.has(link)) {
        issues.push({
          type: "missing_ref",
          page_id: pageId,
          page_title: extractPageTitle(content),
          severity: "high",
          detail: `References non-existent page: ${link}`,
          suggestion: `Check if ${link} should be created or if the reference should be updated.`,
        });
      }
    }
  }

  return issues;
}

function findMetadataGaps(
  pageMap: Map<string, string>
): LintIssue[] {
  const issues: LintIssue[] = [];

  for (const [pageId, filePath] of pageMap) {
    if (!fs.existsSync(filePath)) continue;

    const content = fs.readFileSync(filePath, "utf-8");
    const { metadata } = parsePageMetadata(content);

    if (!metadata) {
      issues.push({
        type: "metadata_gap",
        page_id: pageId,
        page_title: extractPageTitle(content),
        severity: "medium",
        detail: `Page missing YAML frontmatter with metadata`,
        suggestion: `Add frontmatter with created_at, updated_at, sources, tags, and links.`,
      });
    } else {
      if (!metadata.created_at || !metadata.updated_at) {
        issues.push({
          type: "metadata_gap",
          page_id: pageId,
          page_title: extractPageTitle(content),
          severity: "low",
          detail: `Page missing timestamp metadata (created_at or updated_at)`,
          suggestion: `Ensure all pages have creation and update timestamps in frontmatter.`,
        });
      }
      if (metadata.sources.length === 0) {
        issues.push({
          type: "metadata_gap",
          page_id: pageId,
          page_title: extractPageTitle(content),
          severity: "low",
          detail: `Page has no source references`,
          suggestion: `Add source document references to improve traceability.`,
        });
      }
    }
  }

  return issues;
}

function findContradictions(wikiPath: string): LintIssue[] {
  const issues: LintIssue[] = [];
  const pageContents: Map<string, { title: string; content: string }> = new Map();

  // Load all pages
  for (const categoryDir of fs.readdirSync(wikiPath)) {
    const categoryPath = path.join(wikiPath, categoryDir);
    if (!fs.statSync(categoryPath).isDirectory()) continue;

    for (const file of fs.readdirSync(categoryPath)) {
      if (!file.endsWith(".md")) continue;
      const pageId = file.replace(".md", "");
      const content = fs.readFileSync(path.join(categoryPath, file), "utf-8");
      const title = extractPageTitle(content);
      pageContents.set(pageId, { title, content });
    }
  }

  // Look for contradiction patterns
  const contradictionPatterns = [
    { pattern: /should be|must be/i, opposite: /should not be|must not be/i },
    { pattern: /recommended/i, opposite: /not recommended/i },
    { pattern: /required/i, opposite: /optional/i },
  ];

  const contentArray = Array.from(pageContents.values()).map((p) => p.content);

  for (let i = 0; i < contentArray.length; i++) {
    for (let j = i + 1; j < contentArray.length; j++) {
      for (const { pattern, opposite } of contradictionPatterns) {
        if (pattern.test(contentArray[i]) && opposite.test(contentArray[j])) {
          const key1 = Array.from(pageContents.entries()).find(
            ([, v]) => v.content === contentArray[i]
          )?.[0];
          const key2 = Array.from(pageContents.entries()).find(
            ([, v]) => v.content === contentArray[j]
          )?.[0];

          if (key1 && key2) {
            issues.push({
              type: "contradiction",
              page_id: key1,
              page_title: pageContents.get(key1)?.title || key1,
              severity: "high",
              detail: `Potential contradiction with ${key2}`,
              suggestion: `Review both pages and resolve conflicting statements.`,
            });
          }
        }
      }
    }
  }

  return issues;
}


function collectClaimIDs(sourcesPath: string): Map<string, { origin: "curated" | "generated" }> {
  const claims = new Map<string, { origin: "curated" | "generated" }>();
  if (!fs.existsSync(sourcesPath)) return claims;
  
  const files = fs.readdirSync(sourcesPath);
  for (const file of files) {
    if (!file.endsWith(".md")) continue;
    const isGenerated = file.startsWith("auto_sync_");
    const content = fs.readFileSync(path.join(sourcesPath, file), "utf-8");
    const claimRegex = />\s*(?:CLAIM|EXTRACT)\[([^\]]+)\]/g;
    let match;
    while ((match = claimRegex.exec(content)) !== null) {
      claims.set(match[1], { origin: isGenerated ? "generated" : "curated" });
    }
  }
  return claims;
}


import * as crypto from "crypto";

function findStaleExtractions(sourcesPath: string, projectPath: string): LintIssue[] {
  const issues: LintIssue[] = [];
  if (!fs.existsSync(sourcesPath)) return issues;

  const files = fs.readdirSync(sourcesPath);
  for (const file of files) {
    if (!file.endsWith(".md")) continue;
    const content = fs.readFileSync(path.join(sourcesPath, file), "utf-8");
    
    const extractRegex = />\s*EXTRACT\[code:([^#]+)#[^\]]+\]\s*\n>\s*source-hash:\s*([a-f0-9]+)/g;
    let match;
    while ((match = extractRegex.exec(content)) !== null) {
      const relPath = match[1];
      const oldHash = match[2];
      const fullPath = path.resolve(projectPath, relPath);
      
      let isStale = false;
      if (!fs.existsSync(fullPath)) {
        isStale = true;
      } else {
        const currentCode = fs.readFileSync(fullPath, "utf-8");
        const currentHash = crypto.createHash("sha256").update(currentCode).digest("hex");
        if (currentHash !== oldHash) {
          isStale = true;
        }
      }

      if (isStale) {
        issues.push({
          type: "stale_extraction",
          page_id: file,
          page_title: extractPageTitle(content) || file,
          severity: "high",
          detail: `Extracted code claim refers to ${relPath} which has changed or been deleted.`,
          suggestion: `Regenerate the extraction, or let the watch daemon purge it.`,
        });
      }
    }
  }
  return issues;
}

function findUnverifiedClaims(
  pageMap: Map<string, string>,
  validClaims: Map<string, { origin: "curated" | "generated" }>
): LintIssue[] {
  const issues: LintIssue[] = [];

  for (const [pageId, filePath] of pageMap) {
    if (!fs.existsSync(filePath)) continue;

    const content = fs.readFileSync(filePath, "utf-8");
    const lines = content.split('\n');
    let lineNum = 0;
    for (const line of lines) {
      lineNum++;
      if (line.trim().startsWith("> ASSERT:")) {
        const citeMatch = line.match(/CITE\[([^\]]+)\]/);
        if (!citeMatch) {
          issues.push({
            type: "unverified_claim",
            page_id: pageId,
            page_title: extractPageTitle(content),
            severity: "high",
            detail: `Assertion missing citation on line ${lineNum}: ${line.trim()}`,
            suggestion: `Add a CITE[<id>] tag pointing to a valid claim ID from sources.`,
          });
        } else {
          const claimId = citeMatch[1];
          const claim = validClaims.get(claimId);
          if (!claim) {
            issues.push({
              type: "unverified_claim",
              page_id: pageId,
              page_title: extractPageTitle(content),
              severity: "high",
              detail: `Assertion cites invalid claim ID '${claimId}' on line ${lineNum}`,
              suggestion: `Ensure the cited claim ID exists in .docuflow/sources/ documents.`,
            });
          } else if (claim.origin === "generated") {
            issues.push({
              type: "unverified_claim",
              page_id: pageId,
              page_title: extractPageTitle(content),
              severity: "high",
              detail: `Assertion cites machine-generated claim ID '${claimId}' on line ${lineNum}`,
              suggestion: `Assertions must cite human-curated claims, not code-derived syncs.`,
            });
          }
        }
      }
    }
  }
  return issues;
}

function extractPageTitle(content: string): string {
  const match = content.match(/^#+\s+(.+)$/m);
  return match ? match[1].trim() : "Untitled";
}

function calculateHealthScore(result: LintResult): number {
  const { issues_found, total_pages } = result;
  if (total_pages === 0) return 100;

  const issueWeights = {
    high: 10,
    medium: 5,
    low: 2,
  };

  let penalty = 0;
  for (const issue of issues_found) {
    penalty += issueWeights[issue.severity];
  }

  const maxPenalty = total_pages * 10;
  const score = Math.max(0, 100 - (penalty / maxPenalty) * 100);
  return Math.round(score);
}

function generateRecommendations(result: LintResult): string[] {
  const recommendations: string[] = [];

  if (result.metrics.orphan_pages > 0) {
    recommendations.push(
      `${result.metrics.orphan_pages} orphan pages found. Consider linking them or removing if outdated.`
    );
  }

  if (result.metrics.missing_refs > 0) {
    recommendations.push(
      `${result.metrics.missing_refs} broken references found. Update or create missing pages.`
    );
  }

  if (result.metrics.stale_pages > 0) {
    recommendations.push(
      `${result.metrics.stale_pages} pages not updated in 30+ days. Review and refresh content.`
    );
  }

  if (result.metrics.metadata_gaps > 0) {
    recommendations.push(
      `${result.metrics.metadata_gaps} pages have metadata gaps. Add source references and timestamps.`
    );
  }

  if (result.metrics.contradictions > 0) {
    recommendations.push(
      `${result.metrics.contradictions} potential contradictions found. Review and resolve.`
    );
  }

  if (result.health_score >= 90) {
    recommendations.push(
      "✓ Wiki is in excellent health! Continue maintaining current standards."
    );
  } else if (result.health_score >= 70) {
    recommendations.push(
      "Wiki health is good. Address high-severity issues to improve further."
    );
  } else if (result.health_score < 50) {
    recommendations.push(
      "⚠ Wiki needs maintenance. Prioritize fixing high-severity issues."
    );
  }

  return recommendations;
}

export async function lintWiki(params: {
  project_path: string;
  check_type?: "all" | "orphans" | "contradictions" | "stale" | "metadata" | "claims";
}): Promise<LintResult> {
  const { project_path, check_type = "all" } = params;

  const wikiPath = path.join(project_path, ".docuflow", "wiki");
  if (!fs.existsSync(wikiPath)) {
    throw new Error(`Wiki not found at ${wikiPath}`);
  }

  // Collect all page IDs mapped to their full file paths
  const pageMap = new Map<string, string>();
  for (const categoryDir of fs.readdirSync(wikiPath)) {
    const categoryPath = path.join(wikiPath, categoryDir);
    if (!fs.statSync(categoryPath).isDirectory()) continue;

    for (const file of fs.readdirSync(categoryPath)) {
      if (file.endsWith(".md")) {
        const pageId = file.replace(".md", "");
        pageMap.set(pageId, path.join(categoryPath, file));
      }
    }
  }

  // Run checks
  let issues: LintIssue[] = [];

  if (check_type === "all" || check_type === "orphans") {
    issues.push(...findOrphanPages(pageMap));
  }

  if (check_type === "all" || check_type === "contradictions") {
    issues.push(...findContradictions(wikiPath));
  }

  if (check_type === "all" || check_type === "stale") {
    issues.push(...findStalePages(pageMap));
  }

  if (check_type === "all" || check_type === "metadata") {
    issues.push(...findMissingReferences(pageMap));
    issues.push(...findMetadataGaps(pageMap));
  }

  
  if (check_type === "all" || check_type === "claims") {
    const sourcesPath = path.join(project_path, ".docuflow", "sources");
    const validClaimIDs = collectClaimIDs(sourcesPath);
    issues.push(...findUnverifiedClaims(pageMap, validClaimIDs));
    issues.push(...findStaleExtractions(sourcesPath, project_path));
  }

  // Calculate metrics
  const metrics = {
    orphan_pages: issues.filter((i) => i.type === "orphan").length,
    contradictions: issues.filter((i) => i.type === "contradiction").length,
    stale_pages: issues.filter((i) => i.type === "stale").length,
    missing_refs: issues.filter((i) => i.type === "missing_ref").length,
    metadata_gaps: issues.filter((i) => i.type === "metadata_gap").length,
    unverified_claims: issues.filter((i) => i.type === "unverified_claim").length,
    stale_extractions: issues.filter((i) => i.type === "stale_extraction").length,
  };

  // Build result
  const result: LintResult = {
    total_pages: pageMap.size,
    issues_found: issues,
    metrics,
    recommendations: [],
    health_score: 0,
  };

  // Calculate health score and recommendations
  result.health_score = calculateHealthScore(result);
  result.recommendations = generateRecommendations(result);

  // Append to log.md
  const logPath = path.join(project_path, ".docuflow", "log.md");
  if (fs.existsSync(logPath)) {
    const timestamp = new Date().toISOString();
    const logEntry = `\n## [${timestamp}] lint | Wiki lint check completed\n\n- Pages checked: ${result.total_pages}\n- Issues found: ${result.issues_found.length}\n- Health score: ${result.health_score}%\n- High severity: ${metrics.contradictions + metrics.missing_refs + metrics.unverified_claims}\n`;
    fs.appendFileSync(logPath, logEntry);
  }

  return result;
}
