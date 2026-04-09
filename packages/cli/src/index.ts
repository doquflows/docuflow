#!/usr/bin/env node
const [,, cmd] = process.argv;
if (cmd === 'init') {
  import('./commands/init').then(m => m.run());
} else if (cmd === 'status') {
  import('./commands/status').then(m => m.run());
} else {
  console.log('Usage: npx @doquflow/cli <init|status>');
  console.log('');
  console.log('  init    Register Docuflow MCP server in Claude Desktop config');
  console.log('  status  Show spec count and MCP registration status');
}
