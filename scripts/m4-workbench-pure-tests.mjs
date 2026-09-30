import fs from 'node:fs';
import ts from 'typescript';

function assert(name, condition) {
  if (!condition) throw new Error(`FAIL: ${name}`);
  console.log(`PASS: ${name}`);
}

const source = fs.readFileSync(new URL('../src/xfactor/DeveloperWorkbench.tsx', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../src/xfactor/workbench.css', import.meta.url), 'utf8');

const out = ts.transpileModule(source, {
  compilerOptions: { jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
  reportDiagnostics: true,
  fileName: 'DeveloperWorkbench.tsx',
});
const errors = (out.diagnostics ?? []).filter((d) => d.category === ts.DiagnosticCategory.Error);
assert('M4 Workbench TSX parses', errors.length === 0);
assert('project cockpit is explicit', source.includes('BUILD // PROJECT COCKPIT') && source.includes('dev-project-connection'));
assert('real project CTA is primary and visible', source.includes('OPEN REAL PROJECT') && source.includes('NO DISK PROJECT ATTACHED'));
assert('editor remains CodeMirror-backed through CodeEditor', source.includes('<CodeEditor') && source.includes('language={languageFor(activePath)}'));
assert('file tree remains persistent in main frame', source.includes('<ProjectTree') && source.includes('dev-explorer'));
assert('live preview remains beside code', source.includes('dev-preview-pane') && source.includes('RUN PROJECT') && source.includes('LIVE DEV SERVER'));
assert('terminal is promoted into dock', source.includes("DockView = 'terminal' | 'problems' | 'git' | 'search'") && source.includes("dockView === 'terminal'"));
assert('problems is promoted into dock', source.includes("dockView === 'problems'") && source.includes('dev-problems-list'));
assert('Git is promoted into dock', source.includes("dockView === 'git'") && source.includes('<GitPanel rootPath={binding.rootPath}/>'));
assert('project search is promoted into dock', source.includes("dockView === 'search'") && source.includes('SEARCH ACROSS THIS PROJECT'));
assert('keyboard save/search/terminal shortcuts exist', source.includes("event.key.toLowerCase() === 's'") && source.includes('event.shiftKey') && source.includes("event.key === '`'"));
assert('cockpit CSS has desktop and compact layouts', css.includes('.dev-cockpit .dev-workbench-grid') && css.includes('@media(max-width:760px)'));
assert('old vertical M2 beacon is suppressed', css.includes('.dev-cockpit .dev-m2-beacon'));
assert('M6 Workbench exposes three adaptive view presets', source.includes("'cockpit'") && source.includes("'code-focus'") && source.includes("'preview-focus'") && source.includes('dev-view-presets'));
assert('M6 Workbench persists user sizing', source.includes('xfactor-workbench-explorer-width') && source.includes('xfactor-workbench-preview-width'));
assert('M6 Workbench grid responds to view presets', css.includes('.view-code-focus') && css.includes('.view-preview-focus') && css.includes('--dev-explorer-w'));
assert('M6 Workbench panes are independent non-fusing spatial surfaces', source.includes('workbench-panes') && source.includes('fuse={false}') && source.includes('dev-spatial-pane'));
assert('M6 Workbench keeps editor interactions out of drag capture', source.includes('dev-code-editor-wrap') && source.includes('data-plasma-nodrag'));
assert('M6 Workbench uses container-aware pane adaptation', css.includes('container-type:inline-size') && css.includes('@container workbench-pane'));
console.log('\nWorkbench M4 Project Cockpit source checks passed.');
