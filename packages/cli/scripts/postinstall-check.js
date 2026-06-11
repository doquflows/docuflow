#!/usr/bin/env node
// Runs after 'npm install -g @doquflow/cli'.
// Warns when the prefix npm installed into doesn't match the node binary
// that is currently active in PATH — the symptom of DEF-4 (two Node
// installations with different npm global prefixes, e.g. nvm + .hermes).
//
// This script never throws or exits non-zero; a warning hint is all we need.

'use strict';

const { execSync } = require('child_process');
const path = require('path');

// Only relevant for global installs.
if (process.env.npm_config_global !== 'true') process.exit(0);

try {
  // Prefix npm just installed into (set by npm as an env var during lifecycle).
  const installedPrefix = process.env.npm_config_prefix
    || execSync('npm config get prefix', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();

  // Prefix derived from the 'node' binary the shell resolves via PATH.
  let activePrefix;
  try {
    const activeNode = execSync('which node', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
    activePrefix = path.dirname(path.dirname(activeNode));
  } catch {
    process.exit(0); // can't detect — skip silently
  }

  if (path.resolve(installedPrefix) === path.resolve(activePrefix)) process.exit(0);

  // Prefixes differ — the active 'docuflow' binary in PATH is NOT the one we
  // just installed. Print a clear, actionable warning.
  const pkg = '@doquflow/cli';
  process.stderr.write('\n');
  process.stderr.write('  ⚠  docuflow installed to a different prefix than your active node:\n');
  process.stderr.write(`     Installed into : ${installedPrefix}\n`);
  process.stderr.write(`     Active node at : ${activePrefix}\n`);
  process.stderr.write('\n');
  process.stderr.write('  The "docuflow" command in your PATH may still be the old version.\n');
  process.stderr.write('  Fix with one of:\n');
  process.stderr.write(`    npm install -g --prefix ${activePrefix} ${pkg}@latest\n`);
  process.stderr.write('    docuflow update   (always targets the right prefix)\n');
  process.stderr.write('\n');
} catch {
  // Never fail the install due to this check.
}
