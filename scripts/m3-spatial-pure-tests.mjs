import fs from 'node:fs';
import ts from 'typescript';

function assert(name, value) {
  if (!value) throw new Error(`FAIL: ${name}`);
  console.log(`PASS: ${name}`);
}

for (const file of ['src/xfactor/GlobalSpatialToggle.tsx', 'src/xfactor/spatialPhysics.ts']) {
  const source = fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
  const out = ts.transpileModule(source, {
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
    reportDiagnostics: true,
    fileName: file,
  });
  const errors = (out.diagnostics ?? []).filter(d => d.category === ts.DiagnosticCategory.Error);
  assert(`${file} parses`, errors.length === 0);
}

const toggle = fs.readFileSync(new URL('../src/xfactor/GlobalSpatialToggle.tsx', import.meta.url), 'utf8');
const physics = fs.readFileSync(new URL('../src/xfactor/spatialPhysics.ts', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../src/xfactor/spatialGlobal.css', import.meta.url), 'utf8');
const chaos = fs.readFileSync(new URL('../src/xfactor/ChaosDeck.tsx', import.meta.url), 'utf8');
const signal = fs.readFileSync(new URL('../src/xfactor/PlasmaSignalWorkspace.tsx', import.meta.url), 'utf8');
const workbench = fs.readFileSync(new URL('../src/xfactor/DeveloperWorkbench.tsx', import.meta.url), 'utf8');

assert('global 3-way control exposes Normal Plasma Matter', toggle.includes('NORMAL') && toggle.includes('PLASMA') && toggle.includes('MATTER'));
assert('global mode keeps explicit duration choices', toggle.includes('THIS SESSION') && toggle.includes('30 MIN') && toggle.includes('UNTIL OFF'));
assert('momentum target has velocity threshold and bounds clamp', (physics.includes('speed < 0.18') || physics.includes('speed < 0.1') || physics.includes('speed < 0.07')) && physics.includes('bounds.width - surface.width'));
assert('global CSS targets Floor/Piles/Vault/Tape/Workbench surfaces', ['.xf-shard', '.pile-card', '.asset-card', '.tape-ledger article', '.dev-workbench'].every(token => css.includes(token)));
assert('Matter global CSS gives rooms distinct material treatments', css.includes('.xf-matter-mode .xf-shard') && css.includes('.xf-matter-mode .pile-card') && css.includes('.xf-matter-mode .asset-card'));
assert('controller is OS-global', chaos.includes("usePlasmaMode('global')") && chaos.includes('<GlobalSpatialToggle plasma={plasma}/>'));
assert('Signal uses inertial throw', signal.includes('momentumTarget') && signal.includes('onPointerMoveCapture'));
assert('Signal fusion is explicit', signal.includes('onJoinChange') && signal.includes('is-fused') && signal.includes('fuse'));
assert('Workbench build capabilities are surfaced', workbench.includes('OPEN REAL PROJECT') && (workbench.includes('WORKBENCH M2 //') || workbench.includes('BUILD // PROJECT COCKPIT')));

console.log('\nM3 corrective spatial source checks passed.');
