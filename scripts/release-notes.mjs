#!/usr/bin/env node
// Build GitHub Release notes for a version: the CHANGELOG section for that
// version, followed by install instructions and links to the npm packages the
// release publishes.
//
// Exists because the release workflow previously used the whole of
// release/CHANGELOG.md as the release body — which was stale, so the v2.3.0
// release opened with the 2.2.0 notes and never mentioned 2.3.0 at all.
import { readFileSync } from 'node:fs';

const PACKAGES = ['@doquflow/cli', '@doquflow/core', '@doquflow/studio', '@doquflow/server'];
const PRIMARY = '@doquflow/cli';
const DOCS = 'https://shaifulshabuj.github.io/docuflow-mcp/';

const version = (process.argv[2] || '').replace(/^v/, '');
if (!version) {
  console.error('usage: release-notes.mjs <version>');
  process.exit(1);
}

const lines = readFileSync(new URL('../CHANGELOG.md', import.meta.url), 'utf8').split('\n');
const start = lines.findIndex((l) => l.startsWith(`## [${version}]`));
if (start === -1) {
  console.error(`No CHANGELOG.md section found for ${version} — refusing to publish wrong notes.`);
  process.exit(1);
}
let end = lines.length;
for (let i = start + 1; i < lines.length; i++) {
  if (lines[i].startsWith('## [')) { end = i; break; }
}
const section = lines.slice(start + 1, end).join('\n').trim();

const npmLinks = PACKAGES
  .map((p) => `- [\`${p}@${version}\`](https://www.npmjs.com/package/${p}/v/${version})`)
  .join('\n');

console.log(`${section}

## Install

\`\`\`bash
npm install -g ${PRIMARY}@${version}
\`\`\`

### Packages published in this release

${npmLinks}

Documentation: ${DOCS}`);
