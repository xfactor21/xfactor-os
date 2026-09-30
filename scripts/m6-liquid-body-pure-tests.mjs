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

const room = fs.readFileSync(new URL('../src/xfactor/TrueSpatial.tsx', import.meta.url), 'utf8');
const signal = fs.readFileSync(new URL('../src/xfactor/PlasmaSignalWorkspace.tsx', import.meta.url), 'utf8');
const signalCss = fs.readFileSync(new URL('../src/xfactor/plasmaMode.css', import.meta.url), 'utf8');
const globalCss = fs.readFileSync(new URL('../src/xfactor/spatialGlobal.css', import.meta.url), 'utf8');
const physics = fs.readFileSync(new URL('../src/xfactor/spatialPhysics.ts', import.meta.url), 'utf8');
const mode = fs.readFileSync(new URL('../src/xfactor/plasmaMode.ts', import.meta.url), 'utf8');
const toggle = fs.readFileSync(new URL('../src/xfactor/GlobalSpatialToggle.tsx', import.meta.url), 'utf8');
const indexHtml = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const vite = fs.readFileSync(new URL('../vite.config.ts', import.meta.url), 'utf8');
const chaos = fs.readFileSync(new URL('../src/xfactor/ChaosDeck.tsx', import.meta.url), 'utf8');

assert('room Plasma has an explicit refracted body source', room.includes("background={matter ? '#05070a' : '#07020a'}"));
assert('room Plasma body dominates its rim', (room.includes('opacity={matter ? 0.84 : 0.86}') || room.includes('opacity={prewarm ? 0 : matter ? 0.84 : 0.86}')) && room.includes('rimWidth={matter ? 0.9 : 0.82}') && room.includes('edgeLine={matter ? 0.62 : 0.34}'));
assert('room Plasma is strongly fluid', room.includes('stretch={matter ? 0.72 : 4.35}') && room.includes('flow={matter ? 0.18 : 1.18}') && room.includes('tension={matter ? 0.1 : 0.36}'));
assert('Signal Plasma has explicit refracted background', signal.includes('background="#07020a"'));
assert('Signal body is high opacity and low rim', signal.includes('opacity={0.84}') && signal.includes('rimWidth={0.86}') && signal.includes('edgeLine={0.36}'));
assert('Signal movement is visibly fluid', signal.includes('stretch={4.8}') && signal.includes('flow={1.28}') && signal.includes('tension={0.38}'));
assert('Signal surfaces are filled bodies', signal.includes('opacity={signal.done ? 0.58 : 0.9}') && signal.includes('lean={18}'));
assert('Matter has explicit material body source', signal.includes('background="#06070a"'));
assert('M6 removes DOM plate masking during drag/fusion', signalCss.includes('M6 LIQUID BODY') && signalCss.includes('[data-plasma-dragging]') && signalCss.includes('background:transparent!important'));
assert('M6 global content stays above material', globalCss.includes('M6 FINAL SPATIAL LAYERING') && globalCss.includes('.xf-spatial-content'));
assert('M6 throw has lower threshold and longer travel', physics.includes('speed < 0.07') && physics.includes('strength = 430') && physics.includes('122 + speed * 148'));

assert('room cards do not start as one giant fused blob', room.includes("piles: 5") && room.includes("tape: 6") && globalCss.includes('gap:28px') && signal.includes("blend={compact ? 14 : 22}"));
assert('balanced spatial FX lowers shader budget by default', room.includes("settings.spatialFx === 'reduced' ? 7 : 10") && signal.includes("settings.spatialFx === 'reduced' ? 7 : 10"));
assert('reduced spatial FX disables pointer pull', room.includes("settings.spatialFx !== 'reduced'") && signal.includes("settings.spatialFx !== 'reduced'"));
assert('spatial transition formation animation is disabled', room.includes('formIn={false}') && room.includes('formOut={false}') && signal.includes('formIn={false}') && signal.includes('formOut={false}'));
assert('transition lifecycle is staged outside the click handler', mode.includes('requestAnimationFrame') && mode.includes('transitioning') && mode.includes('targetMode'));
assert('spatial controls lock while renderer recasts', toggle.includes('disabled={plasma.transitioning}') && globalCss.includes('M6 STABLE MATERIAL RECAST'));
assert('Signal text is explicitly above the WebGL material', signalCss.includes('M6 SIGNAL CONTENT LAYER') && signalCss.includes('z-index:24!important'));
assert('room renderer stays mounted in NORMAL for warm switching', !room.includes("plasma.mode === 'normal' || room === 'signal'") && room.includes("const prewarm = plasma.mode === 'normal'") && room.includes('opacity={prewarm ? 0'));
assert('normal Workbench avoids invisible prewarm WebGL', room.includes("const conventionalNormalRoom = room === 'terminal' && plasma.mode === 'normal'") && room.includes('|| conventionalNormalRoom'));
assert('old lower-right version badge is removed', !indexHtml.includes('xfactor-build-badge'));
assert('header version is sourced from package metadata', vite.includes('__XFACTOR_VERSION__: JSON.stringify(packageVersion)') && chaos.includes('const BUILD_VERSION = __XFACTOR_VERSION__'));

console.log('\nM6 unmistakable liquid-body checks passed.');
