import * as fs from 'fs';
import * as path from 'path';
import { describe, it, beforeEach, afterEach, expect } from 'vitest';
import { lintWiki } from '../lint-wiki';

describe('lintWiki', () => {
  const testDir = path.join(__dirname, 'test-docuflow');
  const sourcesDir = path.join(testDir, '.docuflow', 'sources');
  const wikiDir = path.join(testDir, '.docuflow', 'wiki', 'entities');

  beforeEach(() => {
    fs.mkdirSync(sourcesDir, { recursive: true });
    fs.mkdirSync(path.join(testDir, '.docuflow', 'wiki', 'entities'), { recursive: true });
    fs.mkdirSync(wikiDir, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  it('identifies unverified claims and invalid citations', async () => {
    fs.writeFileSync(path.join(sourcesDir, 'auth-rules.md'), `
# Auth Rules
> CLAIM[auth-001] (deletion): Only owners can delete projects.
    `.trim());

    fs.writeFileSync(path.join(wikiDir, 'page1.md'), `
---
created_at: 2026-08-01T00:00:00Z
updated_at: 2026-08-01T00:00:00Z
sources: ["auth-rules"]
tags: []
inbound_links: ["page2"]
outbound_links: []
---
# Page 1
> ASSERT: Only owners can delete projects. CITE[auth-001]
> ASSERT: Only admins can manage users. CITE[auth-invalid]
    `.trim());

    fs.writeFileSync(path.join(wikiDir, 'page2.md'), `
---
created_at: 2026-08-01T00:00:00Z
updated_at: 2026-08-01T00:00:00Z
sources: []
tags: []
inbound_links: []
outbound_links: ["page1"]
---
# Page 2
> ASSERT: Unverified claim without any citation tag!
[Page 1](./page1.md)
    `.trim());

    const result = await lintWiki({ project_path: testDir, check_type: "claims" });
    const issues = result.issues_found;

    expect(result.metrics.unverified_claims).toBe(2);
    expect(issues).toHaveLength(2);

    expect(issues[0].type).toBe('unverified_claim');
    expect(issues[0].page_id).toBe('page1');
    expect(issues[0].detail).toContain("cites invalid claim ID 'auth-invalid'");

    expect(issues[1].type).toBe('unverified_claim');
    expect(issues[1].page_id).toBe('page2');
    expect(issues[1].detail).toContain("missing citation");
  });

  it('rejects citations of machine-generated claims', async () => {
    // A generated file (starts with auto_sync_)
    fs.writeFileSync(path.join(sourcesDir, 'auto_sync_2026-08-01T00-00-00.md'), `
# Auto Sync
> CLAIM[auto-001] (feature): We added a new feature.
    `.trim());

    // A curated file
    fs.writeFileSync(path.join(sourcesDir, 'curated.md'), `
# Curated
> CLAIM[curated-001] (feature): We added a curated feature.
    `.trim());

    fs.writeFileSync(path.join(wikiDir, 'page1.md'), `
---
created_at: 2026-08-01T00:00:00Z
updated_at: 2026-08-01T00:00:00Z
sources: ["auto_sync", "curated"]
tags: []
inbound_links: []
outbound_links: []
---
# Page 1
> ASSERT: We added a new feature. CITE[auto-001]
> ASSERT: We added a curated feature. CITE[curated-001]
    `.trim());

    const result = await lintWiki({ project_path: testDir, check_type: "claims" });
    const issues = result.issues_found;

    // Only the machine-generated claim should cause an issue
    expect(result.metrics.unverified_claims).toBe(1);
    expect(issues).toHaveLength(1);
    expect(issues[0].type).toBe('unverified_claim');
    expect(issues[0].page_id).toBe('page1');
    expect(issues[0].detail).toContain("cites machine-generated claim ID 'auto-001'");
  });
});

describe('stale extractions', () => {
  const testDir = path.join(__dirname, 'test-docuflow-staleness');
  const sourcesDir = path.join(testDir, '.docuflow', 'sources');
  const srcDir = path.join(testDir, 'src');

  beforeEach(() => {
    fs.mkdirSync(sourcesDir, { recursive: true });
    fs.mkdirSync(path.join(testDir, '.docuflow', 'wiki', 'entities'), { recursive: true });
    fs.mkdirSync(srcDir, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  it('flags stale code extractions when source hash mismatches', async () => {
    const filePath = path.join(srcDir, 'test.ts');
    fs.writeFileSync(filePath, 'const a = 1;');
    
    // Create an extraction file with a hash that doesn't match
    fs.writeFileSync(path.join(sourcesDir, 'extract.md'), `
> EXTRACT[code:src/test.ts#var]
> source-hash: fakeHash
`.trim());

    const result = await lintWiki({ project_path: testDir, check_type: "claims" });
    const issues = result.issues_found.filter((i: any) => i.type === 'stale_extraction');

    expect(result.metrics.stale_extractions).toBe(1);
    expect(issues).toHaveLength(1);
    expect(issues[0].detail).toContain("src/test.ts which has changed or been deleted.");
  });

  it('accepts code extractions when source hash matches', async () => {
    const filePath = path.join(srcDir, 'test.ts');
    const content = 'const a = 1;';
    fs.writeFileSync(filePath, content);
    
    const crypto = require('crypto');
    const hash = crypto.createHash('sha256').update(content).digest('hex');
    
    // Create an extraction file with matching hash
    fs.writeFileSync(path.join(sourcesDir, 'extract.md'), `
> EXTRACT[code:src/test.ts#var]
> source-hash: ${hash}
`.trim());

    const result = await lintWiki({ project_path: testDir, check_type: "claims" });
    const issues = result.issues_found.filter((i: any) => i.type === 'stale_extraction');

    expect(result.metrics.stale_extractions).toBe(0);
    expect(issues).toHaveLength(0);
  });
});
