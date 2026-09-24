/**
 * @docuflow/api — standalone Express API bridge (development server)
 *
 * This is a lightweight dev-only server that exposes the same /api/* routes
 * as packages/cli/src/commands/ui.ts, but imports server tools directly from
 * TypeScript source (via tsx) rather than compiled dist/.
 *
 * Port priority:
 *   1. PORT env var          (standard Node convention)
 *   2. DOCUFLOW_PORT env var (DocuFlow-specific, matches CLI behaviour)
 *   3. 48821                 (default — matches UI's hardcoded API_BASE)
 *
 * Usage:
 *   PORT=3333 npm run dev -w packages/api        # custom port, hot-reload
 *   DOCUFLOW_PORT=3333 npm run dev -w packages/api
 *   npm run dev -w packages/api                   # default port 48821
 */

import express  from 'express';
import cors     from 'cors';
import path     from 'node:path';
import fs       from 'node:fs';
import fsp      from 'node:fs/promises';
import os       from 'node:os';

// ── Server tool imports (TypeScript source, resolved via tsconfig includes) ──
import { listWiki }    from '../tools/list-wiki';
import { lintWiki }    from '../tools/lint-wiki';
import { queryWiki, wikiSearch, ingestSource } from '@doquflow/core/lib';
import { buildGraph }  from '../tools/build-graph';
import { updateIndex }  from '../tools/update-index';

// ── Port resolution ───────────────────────────────────────────────────────────
const PORT = parseInt(
  process.env.PORT ?? process.env.DOCUFLOW_PORT ?? '48821',
  10,
);

const app = express();
app.use(cors());
app.use(express.json());

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Scan a directory (non-recursively) for subdirs that contain .docuflow/ */
async function findDocuflowProjects(scanRoot: string): Promise<string[]> {
  const found: string[] = [];
  try {
    const entries = await fsp.readdir(scanRoot, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const candidate = path.join(scanRoot, entry.name);
      if (fs.existsSync(path.join(candidate, '.docuflow'))) {
        found.push(candidate);
      }
    }
  } catch { /* dir may not exist */ }
  return found;
}

async function parseLastIngest(docuDir: string): Promise<string> {
  try {
    const log = await fsp.readFile(path.join(docuDir, 'log.md'), 'utf8');
    const match = log.match(/(\d{4}-\d{2}-\d{2}T[\d:.Z+-]+).*ingest/i);
    if (match) {
      const d = new Date(match[1]);
      const diffMs = Date.now() - d.getTime();
      const diffH  = Math.floor(diffMs / 3_600_000);
      const diffD  = Math.floor(diffMs / 86_400_000);
      if (diffH < 1)  return 'just now';
      if (diffH < 24) return `${diffH}h ago`;
      return `${diffD}d ago`;
    }
  } catch { /* no log */ }
  return 'never';
}

async function countMdFiles(dir: string): Promise<number> {
  try {
    const files = await fsp.readdir(dir);
    return files.filter(f => f.endsWith('.md')).length;
  } catch { return 0; }
}

interface ProjectStats {
  name: string; path: string; health: number; pages: number;
  sources: number; entities: number; specs: number;
  lastIngest: string; syncStatus: string;
}

async function getProjectStats(projectPath: string): Promise<ProjectStats> {
  const docuDir = path.join(projectPath, '.docuflow');
  const wikiDir = path.join(docuDir, 'wiki');

  const [entities, concepts, timelines, syntheses, specs, sources, lastIngest] =
    await Promise.all([
      countMdFiles(path.join(wikiDir, 'entities')),
      countMdFiles(path.join(wikiDir, 'concepts')),
      countMdFiles(path.join(wikiDir, 'timelines')),
      countMdFiles(path.join(wikiDir, 'syntheses')),
      countMdFiles(path.join(docuDir, 'specs')),
      countMdFiles(path.join(docuDir, 'sources')),
      parseLastIngest(docuDir),
    ]);

  const totalPages = entities + concepts + timelines + syntheses;
  let health = 0;
  try {
    const lint = await lintWiki({ project_path: projectPath }) as { health_score?: number };
    health = typeof lint.health_score === 'number' ? lint.health_score : 0;
  } catch { health = totalPages > 0 ? 70 : 0; }

  return {
    name: path.basename(projectPath),
    path: projectPath,
    health,
    pages: totalPages,
    sources,
    entities,
    specs,
    lastIngest,
    syncStatus: totalPages > 0 ? 'live' : 'not initialized',
  };
}

function parseActivityLog(logContent: string): Array<{
  t: string; tool: string; target: string; kind: string; delta: string;
}> {
  type ActivityItem = { t: string; tool: string; target: string; kind: string; delta: string };
  const activity: ActivityItem[] = [];
  const headingRe = /^##\s+\[([^\]]+)\]\s+([^|]+?)(?:\s*\|\s*(.+))?$/;

  for (const line of logContent.split('\n')) {
    const trimmed = line.trim();

    const hMatch = trimmed.match(headingRe);
    if (hMatch) {
      const [, timestamp, toolRaw, descRaw] = hMatch;
      const d = new Date(timestamp);
      if (isNaN(d.getTime())) continue;
      const diffH = Math.floor((Date.now() - d.getTime()) / 3_600_000);
      const t     = diffH < 1 ? '<1h' : diffH < 24 ? `${diffH}h` : `${Math.floor(diffH / 24)}d`;
      const tool  = toolRaw.trim();
      activity.push({
        t, tool, target: descRaw?.trim() ?? '', delta: '',
        kind: tool.includes('ingest') ? 'ingest'
          : tool.includes('query') || tool.includes('search') ? 'query'
          : tool.includes('lint') ? 'lint'
          : tool.includes('index') ? 'index'
          : 'read',
      });
      continue;
    }

    if (trimmed && !trimmed.startsWith('#') && !trimmed.startsWith('-')) {
      const parts = trimmed.split('|').map(p => p.trim());
      if (parts.length >= 3) {
        const d = new Date(parts[0]);
        if (isNaN(d.getTime())) continue;
        const diffH = Math.floor((Date.now() - d.getTime()) / 3_600_000);
        const t    = diffH < 1 ? '<1h' : diffH < 24 ? `${diffH}h` : `${Math.floor(diffH / 24)}d`;
        const tool = parts[1] ?? '';
        activity.push({
          t, tool, target: parts[2] ?? '', delta: parts[3] ?? '',
          kind: tool.includes('ingest') ? 'ingest'
            : tool.includes('query') || tool.includes('search') ? 'query'
            : tool.includes('lint') ? 'lint'
            : tool.includes('index') ? 'index'
            : 'read',
        });
      }
    }
  }

  return activity.slice(-10).reverse();
}

// ── Routes ────────────────────────────────────────────────────────────────────

app.get('/api/ping', (_req, res) => res.json({ ok: true }));

/** GET /api/projects — scan common dev dirs + global registry for .docuflow projects */
app.get('/api/projects', async (req, res) => {
  try {
    if (typeof req.query.path === 'string') {
      const qp = req.query.path as string;
      if (fs.existsSync(path.join(qp, '.docuflow'))) {
        return res.json([await getProjectStats(qp)]);
      }
      const nested = await findDocuflowProjects(qp);
      if (nested.length === 0) return res.json([]);
      const projects = await Promise.all(nested.map(getProjectStats));
      return res.json(projects.sort((a, b) => a.name.localeCompare(b.name)));
    }

    const home = process.env.HOME ?? process.env.USERPROFILE ?? os.homedir();
    const scanRoots = [
      home,
      path.join(home, 'code'),    path.join(home, 'dev'),
      path.join(home, 'projects'), path.join(home, 'work'),
      path.join(home, 'src'),     path.join(home, 'Desktop'),
    ];
    const allPaths = new Set<string>();
    for (const root of scanRoots) {
      (await findDocuflowProjects(root)).forEach(p => allPaths.add(p));
    }
    try {
      const registryPath = path.join(os.homedir(), '.docuflow', 'projects.json');
      const raw = await fsp.readFile(registryPath, 'utf8');
      const registry = JSON.parse(raw) as { projects?: string[] };
      (registry.projects ?? []).forEach(p => {
        if (fs.existsSync(path.join(p, '.docuflow'))) allPaths.add(p);
      });
    } catch { /* registry doesn't exist yet */ }

    const projects = await Promise.all([...allPaths].map(getProjectStats));
    return res.json(projects.sort((a, b) => a.name.localeCompare(b.name)));
  } catch (e: unknown) {
    return res.status(500).json({ error: (e as Error).message });
  }
});

/** GET /api/project?path= — stats for one project */
app.get('/api/project', async (req, res) => {
  const projectPath = req.query.path as string;
  if (!projectPath) return res.status(400).json({ error: 'path required' });
  try {
    return res.json(await getProjectStats(projectPath));
  } catch (e: unknown) {
    return res.status(500).json({ error: (e as Error).message });
  }
});

/** GET /api/wiki?path= — list wiki pages */
app.get('/api/wiki', async (req, res) => {
  const projectPath = req.query.path as string;
  if (!projectPath) return res.status(400).json({ error: 'path required' });
  try {
    return res.json(await listWiki({ project_path: projectPath }));
  } catch (e: unknown) {
    return res.status(500).json({ error: (e as Error).message });
  }
});

/** GET /api/wiki/:pageId?path= — read one wiki page */
app.get('/api/wiki/:pageId', async (req, res) => {
  const projectPath = req.query.path as string;
  if (!projectPath) return res.status(400).json({ error: 'path required' });
  const { pageId } = req.params;
  const wikiDir = path.join(projectPath, '.docuflow', 'wiki');
  for (const cat of ['entities', 'concepts', 'timelines', 'syntheses']) {
    const filePath = path.join(wikiDir, cat, `${pageId}.md`);
    if (fs.existsSync(filePath)) {
      try {
        const content = await fsp.readFile(filePath, 'utf8');
        return res.json({ id: pageId, category: cat.replace(/s$/, ''), content });
      } catch { break; }
    }
  }
  return res.status(404).json({ error: `Page not found: ${pageId}` });
});

/** GET /api/graph?path= — dependency graph */
app.get('/api/graph', async (req, res) => {
  const projectPath = req.query.path as string;
  if (!projectPath) return res.status(400).json({ error: 'path required' });
  try {
    return res.json(await buildGraph({ project_path: projectPath }));
  } catch (e: unknown) {
    return res.status(500).json({ error: (e as Error).message });
  }
});

/** GET /api/health?path= — wiki lint / health score */
app.get('/api/health', async (req, res) => {
  const projectPath = req.query.path as string;
  if (!projectPath) return res.status(400).json({ error: 'path required' });
  try {
    return res.json(await lintWiki({ project_path: projectPath }));
  } catch (e: unknown) {
    return res.status(500).json({ error: (e as Error).message });
  }
});

/** GET /api/activity?path= — recent log entries */
app.get('/api/activity', async (req, res) => {
  const projectPath = req.query.path as string;
  if (!projectPath) return res.status(400).json({ error: 'path required' });
  try {
    const logPath = path.join(projectPath, '.docuflow', 'log.md');
    let activity: ReturnType<typeof parseActivityLog> = [];
    try {
      activity = parseActivityLog(await fsp.readFile(logPath, 'utf8'));
    } catch { /* no log yet */ }
    return res.json(activity);
  } catch (e: unknown) {
    return res.status(500).json({ error: (e as Error).message });
  }
});

/** POST /api/ask — body: { path, question } */
app.post('/api/ask', async (req, res) => {
  const { path: projectPath, question } = req.body as { path: string; question: string };
  if (!projectPath || !question) return res.status(400).json({ error: 'path and question required' });
  try {
    return res.json(await queryWiki({ project_path: projectPath, question }));
  } catch (e: unknown) {
    return res.status(500).json({ error: (e as Error).message });
  }
});

/** GET /api/search?path=&q= */
app.get('/api/search', async (req, res) => {
  const projectPath = req.query.path as string;
  const query       = req.query.q as string;
  if (!projectPath || !query) return res.status(400).json({ error: 'path and q required' });
  try {
    return res.json(await wikiSearch({ project_path: projectPath, query }));
  } catch (e: unknown) {
    return res.status(500).json({ error: (e as Error).message });
  }
});

/** POST /api/sync — body: { path } — ingest all sources, rebuild index, lint */
app.post('/api/sync', async (req, res) => {
  const { path: projectPath } = req.body as { path?: string };
  if (!projectPath) return res.status(400).json({ error: 'path required' });
  const docuDir    = path.join(projectPath, '.docuflow');
  const sourcesDir = path.join(docuDir, 'sources');
  if (!fs.existsSync(docuDir)) {
    return res.status(400).json({ error: '.docuflow not found — run init first' });
  }
  try {
    let sourceFiles: string[] = [];
    try {
      sourceFiles = (await fsp.readdir(sourcesDir)).filter(f => f.endsWith('.md'));
    } catch { /* sources/ may not exist yet */ }

    let pagesCreated = 0;
    const errors: string[] = [];
    for (const filename of sourceFiles) {
      try {
        const r = await ingestSource({ project_path: projectPath, source_filename: filename }) as { pages_created?: unknown[] };
        pagesCreated += r.pages_created?.length ?? 0;
      } catch (e: unknown) {
        errors.push(`${filename}: ${(e as Error).message}`);
      }
    }

    await updateIndex({ project_path: projectPath });
    const lint = await lintWiki({ project_path: projectPath }) as { health_score?: number };

    return res.json({
      sources_processed: sourceFiles.length,
      pages_created:     pagesCreated,
      health_score:      lint.health_score ?? 0,
      errors,
    });
  } catch (e: unknown) {
    return res.status(500).json({ error: (e as Error).message });
  }
});

// ── Start ─────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log('');
  console.log(`  ✅ DocuFlow API bridge running`);
  console.log(`  🌐 http://localhost:${PORT}`);
  console.log('');
  console.log('  Routes: /api/ping  /api/projects  /api/wiki  /api/graph');
  console.log('          /api/health  /api/activity  /api/ask  /api/search  /api/sync');
  console.log('');
  console.log('  Port override:  PORT=3333 npm run dev');
  console.log('                  DOCUFLOW_PORT=3333 npm run dev');
  console.log('');
});
