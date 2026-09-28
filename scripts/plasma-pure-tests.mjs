import fs from 'node:fs';
import ts from 'typescript';

function assert(name, condition) {
  if (!condition) throw new Error(`FAIL: ${name}`);
  console.log(`PASS: ${name}`);
}

for (const file of [
  'src/xfactor/plasmaMode.ts',
  'src/xfactor/PlasmaSignalWorkspace.tsx',
]) {
  const source = fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
  const transpiled = ts.transpileModule(source, {
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
    reportDiagnostics: true,
    fileName: file,
  });
  const errors = (transpiled.diagnostics ?? []).filter((diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error);
  assert(`${file} parses`, errors.length === 0);
}

const mode = fs.readFileSync(new URL('../src/xfactor/plasmaMode.ts', import.meta.url), 'utf8');
const board = fs.readFileSync(new URL('../src/xfactor/PlasmaSignalWorkspace.tsx', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../src/xfactor/plasmaMode.css', import.meta.url), 'utf8');

assert('spatial modes include Normal, Plasma and Matter', mode.includes("'normal' | 'plasma' | 'matter'"));
assert('activation is device-local, not WorkspaceState', mode.includes('sessionStorage') && mode.includes('localStorage') && !mode.includes('WorkspaceState'));
assert('temporary session mode exists', mode.includes("'session' | '30m' | 'remember'"));
assert('30 minute mode stores an expiry', mode.includes('30 * 60 * 1000'));
assert('remembered mode is incident-scoped', mode.includes('REMEMBER_PREFIX + scopeId'));
assert('Matter defaults map Spark cloud, Task metal, Note crystal, Link plasma and done task stone', mode.includes("spark: 'cloud'") && mode.includes("task: 'metal'") && mode.includes("note: 'crystal'") && mode.includes("link: 'plasma'") && mode.includes("doneTask: 'stone'"));
assert('Matter map is user configurable and device-local', mode.includes('setMatterMaterial') && mode.includes('matterMap'));
assert('Plasma and Matter layouts are stored separately from Signal data', board.includes('xfactor-plasma-layout-v1:') && board.includes('xfactor-matter-layout-v1:'));
assert('Normal and spatial modes share canonical Signal update callback', board.includes('onUpdate(signal.id, { text: event.target.value })'));
assert('spatial modes preserve routing/type controls', board.includes('incidentId: event.target.value || undefined') && board.includes('type: event.target.value as SignalType'));
assert('Matter uses true Plasma UI material providers', board.includes('material={material}') && board.includes('MATERIAL_PHYSICS'));
assert('unlike Matter is isolated into separate renderer groups', board.includes('group={`${layoutScope}:${material}`}'));
assert('same Matter can still fuse', board.includes('blend={physics.blend}') && !board.includes('fuse={false}'));
assert('Matter uses semantic done-task override', board.includes("signal.type === 'task' && signal.done"));
assert('desktop Matter surface cap is stricter than liquid Plasma', board.includes("plasma.mode === 'matter' ? 10 : 14"));
assert('compact Matter surface cap is five', board.includes('compact ? 5'));
assert('Matter renderer quality remains below liquid Plasma for multi-pass safety', board.includes('quality={compact ? 0.56 : 0.9}'));
assert('Matter disables pointer droplets across multiple render passes', board.includes('pointerDrop={false}'));
assert('shell receives distinct Matter styling', css.includes('.xf-root.xf-matter-mode'));
assert('Matter mapping UI exposes all six supported materials', board.includes("'plasma', 'crystal', 'metal', 'wood', 'stone', 'cloud'"));
assert('Workbench and Terminal are not spatially wrapped', !board.includes('DeveloperWorkbench') && !board.includes('TerminalRoom'));

console.log('\nNeon Plasma + Matter Mode local source checks passed.');
