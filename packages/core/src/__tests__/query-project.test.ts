import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import fsp from 'node:fs/promises';
import { queryProject } from '../tools/query_project';

const TEST_PROJECT = path.resolve(__dirname, '.test-docuflow');
const DOCU_DIR = path.join(TEST_PROJECT, '.docuflow');
const WIKI_DIR = path.join(DOCU_DIR, 'wiki');
const SRC_DIR = path.join(TEST_PROJECT, 'src');

describe('query_project tool', () => {
  beforeEach(async () => {
    // Setup fake wiki
    await fsp.mkdir(path.join(WIKI_DIR, 'entities'), { recursive: true });
    await fsp.writeFile(
      path.join(WIKI_DIR, 'entities', 'auth_system.md'),
      '# Auth System\n\nThe auth system uses JWT tokens for security.'
    );

    // Setup fake src
    await fsp.mkdir(path.join(SRC_DIR, 'auth'), { recursive: true });
    await fsp.writeFile(
      path.join(SRC_DIR, 'auth', 'user.ts'),
      '// Auth module\nexport function login(token: string) { return "Security OK"; }'
    );
  });

  afterEach(async () => {
    await fsp.rm(TEST_PROJECT, { recursive: true, force: true });
  });

  it('should find both wiki docs and source code and generate citations', async () => {
    const result = await queryProject({
      project_path: TEST_PROJECT,
      question: 'How does auth and security work?',
    });

    expect(result.doc_sources.length).toBeGreaterThan(0);
    expect(result.code_sources.length).toBeGreaterThan(0);

    // Check if the answer includes citations
    expect(result.answer).toContain('auth_system.md');
    expect(result.answer).toContain('user.ts');
  });
});
