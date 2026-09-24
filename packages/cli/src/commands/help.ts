// Help text for `docuflow --help` and `docuflow advanced --help`.
// No external help library — plain console.log for zero-dependency output.

export function printCoreHelp(): void {
  console.log('DocuFlow — preserve decision context for AI agents.');
  console.log('');
  console.log('CORE');
  console.log('  docuflow init                         Initialise .docuflow/ in this project');
  console.log('  docuflow ingest <file>                Add a source document to the wiki');
  console.log('  docuflow query "<question>"           Ask the wiki — answer with citations');
  console.log('  docuflow status                       Show wiki health and counts');
  console.log('  docuflow rewiki                       Migrate / re-ingest with current rules');
  console.log('  docuflow doctor                       Diagnose install, MCP registration, and wiki health');
  console.log('');
  console.log('ADVANCED');
  console.log('  docuflow advanced --help              See watch / sync / ui / review / recent / suggest / update');
  console.log('');
  console.log('  docuflow --version                    Print version');
  console.log('  docuflow --help                       Show this help');
}

export function printAdvancedHelp(): void {
  console.log('DocuFlow — advanced surface (sync daemons, UI, audit commands).');
  console.log('');
  console.log('  docuflow advanced watch [stop|status|restart]    Auto-sync daemon');
  console.log('  docuflow advanced sync [--ai]                    One-shot sync for CI / git hooks');
  console.log('  docuflow advanced ui [--port N]                  Launch web UI dashboard');
  console.log('  docuflow advanced start                          Alias for ui');
  console.log('  docuflow advanced review                         Review uncommitted changes');
  console.log('  docuflow advanced recent                         Recent work dashboard');
  console.log('  docuflow advanced suggest                        First-steps guidance');
  console.log('  docuflow advanced update                         Self-upgrade DocuFlow');
  console.log('');
  console.log('Note: every "advanced" command also works at its old top-level path');
  console.log('(e.g. `docuflow watch` is still valid). The "advanced" prefix is optional.');
}
