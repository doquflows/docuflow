import { execSync, spawnSync } from 'child_process';
import * as net from 'net';
import * as path from 'path';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { version: currentVersion } = require('../../package.json') as { version: string };

const PKG = '@doquflow/cli';
const DEFAULT_PORT = 48821;

interface UpdateOptions {
  check?: boolean;
  force?: boolean;
  dryRun?: boolean;
}

function fetchLatestVersion(): string {
  try {
    const out = execSync(`npm view ${PKG} version`, { stdio: ['ignore', 'pipe', 'pipe'] })
      .toString()
      .trim();
    if (!/^\d+\.\d+\.\d+/.test(out)) throw new Error(`unexpected npm output: ${out}`);
    return out;
  } catch (e: unknown) {
    throw new Error(`Could not fetch latest version from npm registry: ${(e as Error).message}`);
  }
}

function compareSemver(a: string, b: string): number {
  const pa = a.split('.').map(n => parseInt(n, 10));
  const pb = b.split('.').map(n => parseInt(n, 10));
  for (let i = 0; i < 3; i++) {
    if ((pa[i] ?? 0) > (pb[i] ?? 0)) return 1;
    if ((pa[i] ?? 0) < (pb[i] ?? 0)) return -1;
  }
  return 0;
}

function isPortInUse(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const sock = net.createConnection({ port, host: '127.0.0.1' });
    sock.once('connect', () => { sock.end(); resolve(true); });
    sock.once('error', () => resolve(false));
  });
}

export async function run(opts: UpdateOptions = {}): Promise<void> {
  console.log(`DocuFlow update`);
  console.log(`  Current: ${currentVersion}`);

  let latest: string;
  try {
    latest = fetchLatestVersion();
  } catch (e: unknown) {
    console.error(`✗ ${(e as Error).message}`);
    process.exit(1);
  }
  console.log(`  Latest:  ${latest}`);

  const cmp = compareSemver(latest, currentVersion);

  if (opts.check) {
    if (cmp > 0) console.log(`\n→ Update available. Run \`docuflow update\` to install.`);
    else         console.log(`\n✓ You are on the latest version.`);
    return;
  }

  if (cmp <= 0 && !opts.force) {
    console.log(`\n✓ Already on the latest version. Use --force to reinstall.`);
    return;
  }

  // Derive the global prefix from the node binary that is running this CLI.
  // e.g. /usr/local/bin/node  →  /usr/local
  // This avoids installing into a different prefix (e.g. .hermes) when multiple
  // node managers are present on the host.
  const npmPrefix = path.dirname(path.dirname(process.execPath));

  if (opts.dryRun) {
    console.log(`\n[dry-run] Would run: npm install -g --prefix ${npmPrefix} ${PKG}@latest`);
    console.log(`[dry-run] No changes made.`);
    return;
  }

  console.log(`\nInstalling ${PKG}@${latest} globally (prefix: ${npmPrefix})…`);
  const result = spawnSync(
    'npm', ['install', '-g', '--prefix', npmPrefix, `${PKG}@latest`],
    { stdio: 'inherit' },
  );
  if (result.status !== 0) {
    console.error(`✗ npm install failed (exit ${result.status}). Try with sudo if this is a permissions issue.`);
    process.exit(result.status ?? 1);
  }

  console.log(`\n✓ Updated to ${latest}.`);
  console.log(`  This refreshed the CLI, bundled UI (ui-dist), and the @doquflow/core + @doquflow/studio dependencies.`);

  const stale = await isPortInUse(DEFAULT_PORT);
  if (stale) {
    console.log('');
    console.log(`⚠  A DocuFlow server is still running on port ${DEFAULT_PORT} — it is the OLD version.`);
    console.log(`   Stop and restart it to use the new code:`);
    console.log(`     lsof -ti:${DEFAULT_PORT} | xargs kill`);
    console.log(`     docuflow ui`);
  }
}
