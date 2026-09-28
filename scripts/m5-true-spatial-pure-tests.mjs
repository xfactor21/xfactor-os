import fs from 'node:fs';
import ts from 'typescript';

function assert(name, condition) {
  if (!condition) throw new Error(`FAIL: ${name}`);
  console.log(`PASS: ${name}`);
}

for (const file of ['src/xfactor/TrueSpatial.tsx', 'src/xfactor/PlasmaSignalWorkspace.tsx']) {
  const source = fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
  const out = ts.transpileModule(source, {
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
    reportDiagnostics: true,
    fileName: file,
  });
  const errors = (out.diagnostics ?? []).filter((d) => d.category === ts.DiagnosticCategory.Error);
  assert(`${file} parses`, errors.length === 0);
}

const trueSpatial = fs.readFileSync(new URL('../src/xfactor/TrueSpatial.tsx', import.meta.url), 'utf8');
const chaos = fs.readFileSync(new URL('../src/xfactor/ChaosDeck.tsx', import.meta.url), 'utf8');
const signal = fs.readFileSync(new URL('../src/xfactor/PlasmaSignalWorkspace.tsx', import.meta.url), 'utf8');
const globalCss = fs.readFileSync(new URL('../src/xfactor/spatialGlobal.css', import.meta.url), 'utf8');
const signalCss = fs.readFileSync(new URL('../src/xfactor/plasmaMode.css', import.meta.url), 'utf8');
const physics = fs.readFileSync(new URL('../src/xfactor/spatialPhysics.ts', import.meta.url), 'utf8');

assert('room provider uses actual PlasmaProvider', trueSpatial.includes('<PlasmaProvider') && trueSpatial.includes('ground="clear"'));
assert('room canvas is lifted above legacy room backgrounds', trueSpatial.includes('zIndex={18}'));
assert('room material enables pointer response without unstable ambient drops', trueSpatial.includes('pointerPull') && trueSpatial.includes('ambientDrops={false}'));
assert('Matter has room-level physical materials', ['deck: \'metal\'', 'piles: \'stone\'', 'vault: \'crystal\'', 'tape: \'wood\''].every((token) => trueSpatial.includes(token)));
assert('room surfaces use actual Plasma elements', trueSpatial.includes('const PlasmaSurface = Plasma as any') && trueSpatial.includes('<PlasmaSurface'));
assert('Floor incidents register as true spatial surfaces', chaos.includes('group="floor-incidents"') && chaos.includes('xf-shard'));
assert('Piles register as true spatial surfaces', chaos.includes('group="pile-cards"'));
assert('Vault assets register as true spatial surfaces', chaos.includes('group="vault-assets"'));
assert('Tape entries register as true spatial surfaces', chaos.includes('group="tape-ledger"'));
assert('Blackbox and Workbench register with the room renderer', chaos.includes('group="deck-lower"') && chaos.includes('group="workbench-shell"'));
assert('legacy card fills are removed in spatial modes', globalCss.includes('.xf-root.xf-plasma-mode .xf-true-spatial') && globalCss.includes('background:transparent!important'));
assert('Signal canvas is visible above the board', signal.includes('ground="clear"') && signal.includes('zIndex={18}'));
assert('Signal Plasma has strong liquid body tuning', signal.includes('opacity={0.68}') && signal.includes('stretch={3.15}') && signal.includes('flow={0.78}') && signal.includes('tension={0.24}'));
assert('Signal surfaces are materially opaque enough to read as bodies', signal.includes('opacity={signal.done ? 0.38 : 0.64}'));
assert('Matter surfaces use substantial material opacity', signal.includes("material === 'metal' ? 0.86") && signal.includes("material === 'stone' ? 0.9"));
assert('Signal content no longer paints an opaque card over the material', signalCss.includes('M5 liquid-body correction') && signalCss.includes('rgba(4,3,9,.075)'));
assert('throw threshold and travel were strengthened', physics.includes('speed < 0.1') && physics.includes('strength = 320') && physics.includes('96 + speed * 108'));

console.log('\nM5 true spatial renderer checks passed.');
