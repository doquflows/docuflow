/**
 * docuflow ui / docuflow start
 *
 * Starts the DocuFlow web interface — a single Express server on port 48821 that serves:
 *   • All /api/* routes (projects, wiki, health, activity, ask, search, sync, init, watch)
 *   • Static Vite build from ui-dist/ (bundled with this CLI package)
 *   • SPA fallback — any non-API, non-asset route returns index.html
 *
 * The built UI targets http://localhost:48821 for all API calls, so API + UI
 * share the same origin with zero CORS friction.
 */

import { exec, spawn } from 'node:child_process';
import http             from 'node:http';
import path             from 'node:path';
import os               from 'node:os';
import fs               from 'node:fs';
import fsp              from 'node:fs/promises';
import express          from 'express';
import cors             from 'cors';
import { runInit }      from './init';
import {
  getPidFilePath,
  readPidFile,
  isProcessAlive,
  type WatchPidData,
} from './watch';

// ── Tool loader ───────────────────────────────────────────────────────────────
// Core tools (query-wiki, wiki-search, ingest-source) live in @doquflow/core;
// studio tools (list-wiki, lint-wiki, build-graph, etc.) in @doquflow/studio.
// We use a core-first fallback chain identical to query.ts:loadServerTool.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ToolFn = (args: Record<string, any>) => Promise<any>;

function loadTool(file: string, exportName: string): ToolFn {
  const candidates = [
    () => require(`@doquflow/core/dist/tools/${file}`),
    () => require(path.resolve(__dirname, '../../../core/dist/tools', file)),
    () => require(path.resolve(__dirname, '../../core/dist/tools', file)),
    () => require(`@doquflow/studio/dist/tools/${file}`),
    () => require(path.resolve(__dirname, '../../../studio/dist/tools', file)),
    () => require(path.resolve(__dirname, '../../studio/dist/tools', file)),
  ];
  for (const load of candidates) {
    try {
      const mod = load() as Record<string, ToolFn>;
      if (typeof mod[exportName] === 'function') return mod[exportName];
    } catch { /* try next candidate */ }
  }
  throw new Error(`Cannot load tool "${file}" (export: "${exportName}"). Run "npm run build" first.`);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function findDocuflowProjects(scanRoot: string): Promise<string[]> {
  const found: string[] = [];
  try {
    const entries = await fsp.readdir(scanRoot, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const candidate = path.join(scanRoot, entry.name);
      if (fs.existsSync(path.join(candidate, '.docuflow'))) found.push(candidate);
    }
  } catch { /* dir may not exist */ }
  return found;
}

async function parseLastIngest(docuDir: string): Promise<string> {
  try {
    const log = await fsp.readFile(path.join(docuDir, 'log.md'), 'utf8');
    const match = log.match(/(\d{4}-\d{2}-\d{2}T[\d:.Z+-]+).*ingest/i);
    if (match) {
      const diffMs = Date.now() - new Date(match[1]).getTime();
      const diffH  = Math.floor(diffMs / 3_600_000);
      if (diffH < 1)  return 'just now';
      if (diffH < 24) return `${diffH}h ago`;
      return `${Math.floor(diffH / 24)}d ago`;
    }
  } catch { /* no log yet */ }
  return 'never';
}

async function countMdFiles(dir: string): Promise<number> {
  try {
    return (await fsp.readdir(dir)).filter(f => f.endsWith('.md')).length;
  } catch { return 0; }
}

interface ProjectStats {
  name: string; path: string; health: number; pages: number;
  sources: number; entities: number; specs: number;
  lastIngest: string; syncStatus: string;
}

async function getProjectStats(
  projectPath: string,
  lintWiki: ToolFn,
): Promise<ProjectStats> {
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
    health, pages: totalPages, sources, entities, specs, lastIngest,
    syncStatus: totalPages > 0 ? 'live' : 'not initialized',
  };
}

function parseActivityLog(logContent: string): Array<{
  t: string; tool: string; target: string; kind: string; delta: string;
}> {
  const activity: Array<{ t: string; tool: string; target: string; kind: string; delta: string }> = [];
  const headingRe = /^##\s+\[([^\]]+)\]\s+([^|]+?)(?:\s*\|\s*(.+))?$/;

  for (const line of logContent.split('\n')) {
    const trimmed = line.trim();

    // Format: ## [2026-05-07T05:13:30.675Z] tool | description
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

    // Legacy format: timestamp | tool | target | delta
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

function openBrowser(url: string): void {
  const cmd =
    process.platform === 'darwin' ? `open "${url}"` :
    process.platform === 'win32'  ? `start "" "${url}"` :
                                    `xdg-open "${url}"`;
  exec(cmd, (err) => {
    if (err) console.log(`  (Could not auto-open browser — visit ${url} manually)`);
  });
}

// ── Public API ────────────────────────────────────────────────────────────────


// ── Port conflict helper ──────────────────────────────────────────────────────
// Returns true if a DocuFlow server is already answering on this port.
function pingDocuflow(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const req = http.get(
      { hostname: 'localhost', port, path: '/api/ping', timeout: 1500 },
      (res) => {
        let body = '';
        res.on('data', (chunk: Buffer) => { body += chunk; });
        res.on('end', () => {
          try { resolve((JSON.parse(body) as { ok?: boolean }).ok === true); }
          catch { resolve(false); }
        });
      },
    );
    req.on('error',   () => resolve(false));
    req.on('timeout', () => { req.destroy(); resolve(false); });
  });
}

export interface UiOptions {
  /** HTTP port. Defaults to 48821 (matches the UI's hardcoded API_BASE). */
  port?: number;
  /** Skip auto-opening the browser. */
  noOpen?: boolean;
}

export async function run(opts: UiOptions = {}): Promise<void> {
  const port = opts.port ?? (
    process.env.DOCUFLOW_PORT ? parseInt(process.env.DOCUFLOW_PORT, 10) : 48821
  );

  // ── 1. Locate bundled UI ────────────────────────────────────────────────
  // Installed:  <prefix>/lib/node_modules/@doquflow/cli/dist/commands/ui.js
  //             → ui-dist is two levels up: @doquflow/cli/ui-dist/
  // Monorepo:   packages/cli/dist/commands/ui.js
  //             → ui-dist is two levels up: packages/cli/ui-dist/
  const uiDist = path.join(__dirname, '../../ui-dist');

  if (!fs.existsSync(path.join(uiDist, 'index.html'))) {
    console.error('');
    console.error('  ❌ DocuFlow Web UI bundle not found.');
    console.error('');
    console.error('  Expected: ' + uiDist);
    console.error('');
    console.error('  If you installed @doquflow/cli from npm, this is a packaging bug — please');
    console.error('  report it at https://github.com/doquflows/docuflow/issues');
    console.error('');
    console.error('  If you are running from source, build the UI first:');
    console.error('    npm run build:ui          # build packages/ui → packages/ui/dist/');
    console.error('    npm run build -w packages/cli   # copy dist + compile CLI');
    console.error('');
    process.exit(1);
  }

  // ── 2. Load server tools ────────────────────────────────────────────────
  const listWikiTool    = loadTool('list-wiki',      'listWiki');
  const lintWikiTool    = loadTool('lint-wiki',       'lintWiki');
  const queryWikiTool   = loadTool('query-wiki',      'queryWiki');
  const wikiSearchTool  = loadTool('wiki-search',     'wikiSearch');
  const buildGraphTool  = loadTool('build-graph',     'buildGraph');
  const ingestSourceTool = loadTool('ingest-source',  'ingestSource');
  const updateIndexTool  = loadTool('update-index',   'updateIndex');

  // ── 3. Express app ──────────────────────────────────────────────────────
  const app = express();
  app.use(cors());
  app.use(express.json());

  // ── API routes ────────────────────────────────────────────────────────

  app.get('/api/ping', (_req, res) => { res.json({ ok: true }); });

  app.get('/api/projects', async (req, res) => {
    try {
      // ── Path-scoped query: only search within the provided path ──────────
      if (typeof req.query.path === 'string') {
        const qp = req.query.path as string;
        // Direct match: the path itself is a docuflow project
        if (fs.existsSync(path.join(qp, '.docuflow'))) {
          return res.json([await getProjectStats(qp, lintWikiTool)]);
        }
        // Nested: scan one level inside the provided path
        const nested = await findDocuflowProjects(qp);
        if (nested.length === 0) return res.json([]); // not found — no fallback to global scan
        const nestedProjects = await Promise.all(nested.map(p => getProjectStats(p, lintWikiTool)));
        return res.json(nestedProjects.sort((a, b) => a.name.localeCompare(b.name)));
      }

      // ── Full auto-discovery across common dev directories ─────────────────
      const home = process.env.HOME ?? process.env.USERPROFILE ?? os.homedir();
      const scanRoots = [
        home,
        path.join(home, 'code'),  path.join(home, 'dev'),
        path.join(home, 'projects'), path.join(home, 'work'),
        path.join(home, 'src'),   path.join(home, 'Desktop'),
      ];
      const allPaths = new Set<string>();
      for (const root of scanRoots) {
        (await findDocuflowProjects(root)).forEach(p => allPaths.add(p));
      }

      // Also include projects registered via `docuflow init` global registry
      try {
        const registryPath = path.join(os.homedir(), '.docuflow', 'projects.json');
        const raw = await fsp.readFile(registryPath, 'utf8');
        const registry = JSON.parse(raw) as { projects?: string[] };
        (registry.projects ?? []).forEach(p => {
          if (fs.existsSync(path.join(p, '.docuflow'))) allPaths.add(p);
        });
      } catch { /* registry doesn't exist yet — skip */ }

      const projects = await Promise.all([...allPaths].map(p => getProjectStats(p, lintWikiTool)));
      return res.json(projects.sort((a, b) => a.name.localeCompare(b.name)));
    } catch (e: unknown) {
      return res.status(500).json({ error: (e as Error).message });
    }
  });

  app.get('/api/project', async (req, res) => {
    const projectPath = req.query.path as string;
    if (!projectPath) return res.status(400).json({ error: 'path required' });
    try {
      return res.json(await getProjectStats(projectPath, lintWikiTool));
    } catch (e: unknown) {
      return res.status(500).json({ error: (e as Error).message });
    }
  });

  app.get('/api/wiki', async (req, res) => {
    const projectPath = req.query.path as string;
    if (!projectPath) return res.status(400).json({ error: 'path required' });
    try {
      return res.json(await listWikiTool({ project_path: projectPath }));
    } catch (e: unknown) {
      return res.status(500).json({ error: (e as Error).message });
    }
  });

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

  app.get('/api/graph', async (req, res) => {
    const projectPath = req.query.path as string;
    if (!projectPath) return res.status(400).json({ error: 'path required' });
    try {
      return res.json(await buildGraphTool({ project_path: projectPath }));
    } catch (e: unknown) {
      return res.status(500).json({ error: (e as Error).message });
    }
  });

  app.get('/api/health', async (req, res) => {
    const projectPath = req.query.path as string;
    if (!projectPath) return res.status(400).json({ error: 'path required' });
    try {
      return res.json(await lintWikiTool({ project_path: projectPath }));
    } catch (e: unknown) {
      return res.status(500).json({ error: (e as Error).message });
    }
  });

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

  app.post('/api/ask', async (req, res) => {
    const { path: projectPath, question } = req.body as { path: string; question: string };
    if (!projectPath || !question) return res.status(400).json({ error: 'path and question required' });
    try {
      return res.json(await queryWikiTool({ project_path: projectPath, question }));
    } catch (e: unknown) {
      return res.status(500).json({ error: (e as Error).message });
    }
  });

  app.get('/api/search', async (req, res) => {
    const projectPath = req.query.path as string;
    const query = req.query.q as string;
    if (!projectPath || !query) return res.status(400).json({ error: 'path and q required' });
    try {
      return res.json(await wikiSearchTool({ project_path: projectPath, query }));
    } catch (e: unknown) {
      return res.status(500).json({ error: (e as Error).message });
    }
  });

  // ── Sync: ingest all sources → rebuild index → lint ──────────────────────

  app.post('/api/sync', async (req, res) => {
    const { path: projectPath } = req.body as { path?: string };
    if (!projectPath) return res.status(400).json({ error: 'path required' });
    const docuDir    = path.join(projectPath, '.docuflow');
    const sourcesDir = path.join(docuDir, 'sources');
    if (!fs.existsSync(docuDir)) {
      return res.status(400).json({ error: '.docuflow not found — run init first' });
    }
    try {
      // Collect source files
      let sourceFiles: string[] = [];
      try {
        sourceFiles = (await fsp.readdir(sourcesDir)).filter(f => f.endsWith('.md'));
      } catch { /* sources/ may not exist yet */ }

      // Ingest each source file
      let pagesCreated = 0;
      const errors: string[] = [];
      for (const filename of sourceFiles) {
        try {
          const r = await ingestSourceTool({ project_path: projectPath, source_filename: filename }) as { pages_created?: unknown[] };
          pagesCreated += r.pages_created?.length ?? 0;
        } catch (e: unknown) {
          errors.push(`${filename}: ${(e as Error).message}`);
        }
      }

      // Rebuild index and lint — wiki dir may be empty on a fresh/blank project
      let health_score = 0;
      try {
        await updateIndexTool({ project_path: projectPath });
        const lint = await lintWikiTool({ project_path: projectPath }) as { health_score?: number };
        health_score = lint.health_score ?? 0;
      } catch { /* empty wiki dir — health_score stays 0 */ }

      return res.json({
        sources_processed: sourceFiles.length,
        pages_created: pagesCreated,
        health_score,
        errors,
      });
    } catch (e: unknown) {
      return res.status(500).json({ error: (e as Error).message });
    }
  });

  // ── Init: create .docuflow/ structure and register project ────────────────

  app.post('/api/init', async (req, res) => {
    const { path: projectPath } = req.body as { path?: string };
    if (!projectPath) return res.status(400).json({ error: 'path required' });
    if (!fs.existsSync(projectPath)) {
      return res.status(400).json({ error: 'path does not exist' });
    }
    try {
      const result = await runInit(projectPath);
      return res.json(result);
    } catch (e: unknown) {
      return res.status(500).json({ error: (e as Error).message });
    }
  });

  // ── Watch daemon status / stop / start ────────────────────────────────────

  app.get('/api/watch/status', async (req, res) => {
    const projectPath = req.query.path as string;
    if (!projectPath) return res.status(400).json({ error: 'path required' });
    try {
      const data: WatchPidData | null = await readPidFile(projectPath);
      if (!data) return res.json({ running: false });
      const alive = isProcessAlive(data.pid);
      if (!alive) return res.json({ running: false });
      const uptimeMs  = Date.now() - new Date(data.started_at).getTime();
      const uptimeMin = Math.floor(uptimeMs / 60_000);
      return res.json({
        running:    true,
        pid:        data.pid,
        bridge:     data.bridge,
        started_at: data.started_at,
        uptime:     uptimeMin < 60 ? `${uptimeMin}m` : `${Math.floor(uptimeMin / 60)}h ${uptimeMin % 60}m`,
      });
    } catch (e: unknown) {
      return res.status(500).json({ error: (e as Error).message });
    }
  });

  app.post('/api/watch/stop', async (req, res) => {
    const { path: projectPath } = req.body as { path?: string };
    if (!projectPath) return res.status(400).json({ error: 'path required' });
    try {
      const data: WatchPidData | null = await readPidFile(projectPath);
      if (!data || !isProcessAlive(data.pid)) {
        return res.json({ ok: true, message: 'Daemon not running' });
      }
      process.kill(data.pid, 'SIGTERM');
      // Remove stale PID file — daemon will also try to clean it up on exit
      setTimeout(async () => {
        try { await fsp.unlink(getPidFilePath(projectPath)); } catch { /* already removed */ }
      }, 2000);
      return res.json({ ok: true, message: `Stopped watch daemon (PID ${data.pid})` });
    } catch (e: unknown) {
      return res.status(500).json({ error: (e as Error).message });
    }
  });

  app.post('/api/watch/start', async (req, res) => {
    const { path: projectPath } = req.body as { path?: string };
    if (!projectPath) return res.status(400).json({ error: 'path required' });
    if (!fs.existsSync(projectPath)) {
      return res.status(400).json({ error: 'path does not exist' });
    }
    if (!fs.existsSync(path.join(projectPath, '.docuflow'))) {
      return res.status(400).json({ error: '.docuflow not found — run init first' });
    }
    try {
      // Check if already running
      const existing: WatchPidData | null = await readPidFile(projectPath);
      if (existing && isProcessAlive(existing.pid)) {
        return res.json({ ok: true, message: 'Watch daemon already running', pid: existing.pid });
      }
      // require.resolve fails in compiled ESM dist/ — fall back to the running entry point
      let cliBin: string;
      try {
        cliBin = require.resolve('./index')
          .replace(/\.ts$/, '.js')
          .replace('/src/', '/dist/');
      } catch {
        cliBin = process.argv[1];
      }
      const child = spawn(process.execPath, [cliBin, 'watch'], {
        cwd:      projectPath,
        detached: true,
        stdio:    'ignore',
      });
      child.unref();
      return res.json({ ok: true, message: 'Watch daemon spawned' });
    } catch (e: unknown) {
      return res.status(500).json({ error: (e as Error).message });
    }
  });

  // ── Static UI (must come after all /api/* routes) ─────────────────────
  app.use(express.static(uiDist));

  // SPA fallback — any unmatched route returns index.html so React Router
  // can handle client-side navigation (e.g. /wiki, /graph, /health).
  app.get('*', (_req, res) => {
    res.sendFile(path.join(uiDist, 'index.html'));
  });

  // ── 4. Start ─────────────────────────────────────────────────────────────
  const server = app.listen(port, () => {
    const url = `http://localhost:${port}`;
    console.log('');
    console.log('  ✅ DocuFlow Web UI running');
    console.log(`  🌐 ${url}`);
    console.log('');
    console.log('  Auto-discovers projects in: ~/dev  ~/code  ~/projects  ~/work  ~/src  ~/Desktop');
    console.log('  Press Ctrl+C to stop.');
    console.log('');

    if (!opts.noOpen) {
      // Small delay so the HTTP server is fully bound before the browser hits it
      setTimeout(() => openBrowser(url), 400);
    }
  });

  server.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
      // Check if it's already our own server before erroring
      pingDocuflow(port).then(isDocuflow => {
        if (isDocuflow) {
          const url = `http://localhost:${port}`;
          console.log('');
          console.log('  ✅ DocuFlow is already running — reusing existing server.');
          console.log(`  🌐 ${url}`);
          console.log('');
          if (!opts.noOpen) openBrowser(url);
          process.exit(0);
        }
        // Different process owns the port
        console.error(`\n  ❌ Port ${port} is already in use by another process.`);
        console.error(`  Find and stop it:  lsof -ti:${port} | xargs kill`);
        console.error(`  Or try:            DOCUFLOW_PORT=48822 docuflow ui\n`);
        process.exit(1);
      });
    } else {
      console.error(`\n  ❌ Server error: ${err.message}\n`);
      process.exit(1);
    }
  });

  // Graceful shutdown
  const shutdown = (signal: string) => {
    console.log(`\n  Stopping DocuFlow UI (${signal})...`);
    server.close(() => process.exit(0));
  };
  process.on('SIGINT',  () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}
