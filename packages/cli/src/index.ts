#!/usr/bin/env node
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { version } = require('../package.json') as { version: string };

const args = process.argv.slice(2);
const [cmd, ...rest] = args;

// DEF-4: warn once per day if a newer @doquflow/cli exists in another npm prefix.
// Skipped for --version / -v (scripted callers) and non-TTY environments.
if (cmd !== '--version' && cmd !== '-v') {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  (require('./prefix-check') as { runPrefixCheckIfStale: (v: string) => void })
    .runPrefixCheckIfStale(version);
}

// ── Simple arg parser ────────────────────────────────────────────────────────
function hasFlag(...flags: string[]): boolean {
  return flags.some(f => rest.includes(f));
}
function getFlagValue(flag: string): string | undefined {
  const idx = rest.indexOf(flag);
  return idx !== -1 ? rest[idx + 1] : undefined;
}

// ── hasFlagIn / getFlagValueIn — scoped to a specific args array ─────────────
function hasFlagIn(arr: string[], ...flags: string[]): boolean {
  return flags.some(f => arr.includes(f));
}
function getFlagValueIn(arr: string[], flag: string): string | undefined {
  const idx = arr.indexOf(flag);
  return idx !== -1 ? arr[idx + 1] : undefined;
}

// ── dispatch — routes a (cmd, cmdRest) pair to the right handler ──────────────
function dispatch(c: string | undefined, r: string[]): void {

  if (c === '--version' || c === '-v') {
    console.log(version);

  // ── CORE ──────────────────────────────────────────────────────────────────

  } else if (c === 'init') {
    if (hasFlagIn(r, '--interactive', '-i')) {
      import('./commands/init-interactive').then(m => m.runInteractive());
    } else {
      import('./commands/init').then(m => m.run({ repair: hasFlagIn(r, '--repair') }));
    }

  } else if (c === 'status') {
    import('./commands/status').then(m => m.run());

  // ── query — ask the wiki ──────────────────────────────────────────────────
  } else if (c === 'query') {
    const question = r[0] && !r[0].startsWith('--') ? r[0] : '';
    const maxSourcesFlag = getFlagValueIn(r, '--max-sources');
    import('./commands/query').then(m =>
      m.run({
        question,
        maxSources: maxSourcesFlag ? parseInt(maxSourcesFlag, 10) : 5,
        json:       hasFlagIn(r, '--json'),
        noCite:     hasFlagIn(r, '--no-cite'),
        saveAs:     getFlagValueIn(r, '--save-as'),
        quiet:      hasFlagIn(r, '--quiet', '-q'),
      })
    );

  // ── ingest — ingest a source file into the wiki ───────────────────────────
  } else if (c === 'ingest') {
    const sourceFile = r[0] && !r[0].startsWith('--') ? r[0] : undefined;
    import('./commands/ingest').then(m =>
      m.run({
        sourceFile,
        all:    hasFlagIn(r, '--all'),
        dryRun: hasFlagIn(r, '--dry-run'),
        quiet:  hasFlagIn(r, '--quiet', '-q'),
      })
    );

  // ── rewiki — re-ingest all sources with new extractor rules ──────────────
  } else if (c === 'rewiki') {
    import('./commands/rewiki').then(m =>
      m.run({
        dryRun:   hasFlagIn(r, '--dry-run'),
        noBackup: hasFlagIn(r, '--no-backup'),
        quiet:    hasFlagIn(r, '--quiet', '-q'),
      })
    );

  // ── doctor — diagnose install, MCP registration, and wiki health ──────────
  } else if (c === 'doctor') {
    import('./commands/doctor').then(m =>
      m.run({
        json:  hasFlagIn(r, '--json'),
        quiet: hasFlagIn(r, '--quiet', '-q'),
      })
    );

  // ── ADVANCED ──────────────────────────────────────────────────────────────

  } else if (c === 'suggest') {
    import('./commands/suggest').then(m => m.run());

  // ── ui / start — web interface ────────────────────────────────────────────
  } else if (c === 'ui' || c === 'start') {
    const portFlag = getFlagValueIn(r, '--port');
    import('./commands/ui').then(m =>
      m.run({
        port:   portFlag ? parseInt(portFlag, 10) : undefined,
        noOpen: hasFlagIn(r, '--no-open'),
      })
    );

  // ── watch — auto-sync daemon ──────────────────────────────────────────────
  } else if (c === 'watch') {
    const subCmd = r[0];

    if (subCmd === 'stop') {
      import('./commands/watch-stop').then(m => m.runStop(process.cwd()));

    } else if (subCmd === 'status') {
      import('./commands/watch-stop').then(m => m.runStatus(process.cwd()));

    } else if (subCmd === 'restart') {
      import('./commands/watch-stop').then(m => m.runRestart(process.cwd()));

    } else {
      const lintHours = getFlagValueIn(r, '--lint-interval');
      const codeExt   = getFlagValueIn(r, '--code-ext');
      import('./commands/watch').then(m =>
        m.run({
          ai:                         hasFlagIn(r, '--ai'),
          forceCopilot:               hasFlagIn(r, '--copilot'),
          forceClaude:                hasFlagIn(r, '--claude'),
          forceCodex:                 hasFlagIn(r, '--codex'),
          lintIntervalHours:          lintHours ? Number(lintHours) : 24,
          codeExtensions:             codeExt ? codeExt.split(',') : undefined,
          allowDangerousPermissions:  hasFlagIn(r, '--allow-dangerous-permissions'),
        })
      );
    }

  // ── sync — one-shot sync for CI/CD and git hooks ──────────────────────────
  } else if (c === 'sync') {
    const sinceCommit = getFlagValueIn(r, '--since-commit');
    const sourceFile  = getFlagValueIn(r, '--source');
    const failScore   = getFlagValueIn(r, '--fail-on-score');
    import('./commands/sync').then(m =>
      m.run({
        ai:                         hasFlagIn(r, '--ai'),
        forceCopilot:               hasFlagIn(r, '--copilot'),
        forceClaude:                hasFlagIn(r, '--claude'),
        forceCodex:                 hasFlagIn(r, '--codex'),
        sinceCommit,
        sourceFile,
        noLint:                     hasFlagIn(r, '--no-lint'),
        failOnScore:                failScore ? Number(failScore) : 70,
        quiet:                      hasFlagIn(r, '--quiet', '-q'),
        allowDangerousPermissions:  hasFlagIn(r, '--allow-dangerous-permissions'),
      })
    );

  // ── review — git change review & improvement suggestions ──────────────────
  } else if (c === 'review') {
    import('./commands/review').then(m =>
      m.run({
        staged:          hasFlagIn(r, '--staged'),
        sinceCommit:     getFlagValueIn(r, '--since-commit'),
        ai:              hasFlagIn(r, '--ai'),
        failOnCritical:  hasFlagIn(r, '--fail-on-critical'),
        quiet:           hasFlagIn(r, '--quiet', '-q'),
      })
    );

  // ── update — reinstall latest @doquflow/cli globally ─────────────────────
  } else if (c === 'update' || c === 'upgrade') {
    import('./commands/update').then(m =>
      m.run({
        check:  hasFlagIn(r, '--check'),
        force:  hasFlagIn(r, '--force'),
        dryRun: hasFlagIn(r, '--dry-run'),
      })
    );

  // ── recent — show recent task activity ────────────────────────────────────
  } else if (c === 'recent') {
    const daysFlag = getFlagValueIn(r, '--days');
    const fmt = getFlagValueIn(r, '--format') as 'table' | 'md' | undefined;
    import('./commands/recent').then(m =>
      m.run({
        days:   daysFlag ? (isNaN(parseInt(daysFlag, 10)) ? 7 : parseInt(daysFlag, 10)) : 7,
        format: fmt ?? 'table',
      })
    );

  // ── unknown command ───────────────────────────────────────────────────────
  } else {
    import('./commands/help').then(m => m.printCoreHelp());
  }
}

// ── Entry point ───────────────────────────────────────────────────────────────

if (!cmd || cmd === '--help' || cmd === '-h') {
  import('./commands/help').then(m => m.printCoreHelp());

// ── advanced — optional prefix for the advanced surface ──────────────────────
} else if (cmd === 'advanced') {
  const [advCmd, ...advRest] = rest;
  if (!advCmd || advCmd === '--help' || advCmd === '-h') {
    import('./commands/help').then(m => m.printAdvancedHelp());
  } else {
    dispatch(advCmd, advRest);
  }

} else {
  dispatch(cmd, rest);
}
