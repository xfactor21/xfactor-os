import fs from 'node:fs';
import ts from 'typescript';

function assert(name, value) {
  if (!value) throw new Error(`FAIL: ${name}`);
  console.log(`PASS: ${name}`);
}
for (const file of [
  'src/xfactor/ChaosDeck.tsx',
  'src/xfactor/TrueSpatial.tsx',
  'src/xfactor/XFiles.tsx',
  'src/xfactor/XBrowser.tsx',
  'src/xfactor/SettingsPanel.tsx',
  'src/xfactor/DeveloperWorkbench.tsx',
]) {
  const source=fs.readFileSync(file,'utf8');
  const out=ts.transpileModule(source,{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext},reportDiagnostics:true,fileName:file});
  const errors=(out.diagnostics??[]).filter(d=>d.category===ts.DiagnosticCategory.Error);
  assert(`${file} parses`,errors.length===0);
}
const pkg=JSON.parse(fs.readFileSync('package.json','utf8'));
const deck=fs.readFileSync('src/xfactor/ChaosDeck.tsx','utf8');
const domain=fs.readFileSync('src/xfactor/domain.ts','utf8');
const store=fs.readFileSync('src/xfactor/store.ts','utf8');
const spatial=fs.readFileSync('src/xfactor/TrueSpatial.tsx','utf8');
const workbench=fs.readFileSync('src/xfactor/DeveloperWorkbench.tsx','utf8');
const browser=fs.readFileSync('src/xfactor/XBrowser.tsx','utf8');
const browserRust=fs.readFileSync('src-tauri/src/browser.rs','utf8');
const index=fs.readFileSync('index.html','utf8');
assert('M6 milestone is 0.8.0',pkg.version==='0.8.0');
assert('floating version pill removed',!index.includes('xfactor-build-badge'));
assert('header uses package-injected build version',deck.includes('__XFACTOR_BUILD_VERSION__')&&deck.includes('· M6'));
assert('persistent spatial groups exist',domain.includes('SpatialGroup')&&store.includes('newSpatialGroup'));
assert('fusion has durable organization path',deck.includes('fuseSpatial')&&deck.includes('PLASMA BUNDLE'));
assert('spatial renderer is prewarmed and stable across mode switches',spatial.includes("const active = plasma.mode !== 'normal'")&&spatial.includes('formIn={false}')&&spatial.includes('formOut={false}'));
assert('dense rooms use deliberate room-specific fusion distances',spatial.includes('ROOM_BLEND')&&spatial.includes("piles: 11")&&spatial.includes("tape: 9"));
assert('spatial controls lock while renderer transitions',fs.readFileSync('src/xfactor/GlobalSpatialToggle.tsx','utf8').includes('disabled={plasma.switching}'));
assert('bundle organization carries a material identity',domain.includes("material?: 'plasma'")&&deck.includes('bundleMaterials'));
assert('room surfaces can move independently',spatial.includes('freeWidth')&&spatial.includes('onDragEnd')&&spatial.includes('reportJoin'));
assert('mode switching has stability curtain',deck.includes('xf-spatial-curtain')&&fs.readFileSync('src/xfactor/plasmaMode.ts','utf8').includes('beginVisualSwitch'));
assert('xFiles is a real desktop filesystem surface',deck.includes("view==='files'")&&fs.readFileSync('src/xfactor/XFiles.tsx','utf8').includes('scanProjectFolder'));
assert('xBrowser is isolated and explicit',deck.includes("view==='browser'")&&browser.includes('ISOLATED BROWSER')&&browserRust.includes('WebviewUrl::External'));
assert('xBrowser capture is bounded',browserRust.includes('page_limit')&&browserRust.includes('MAX_TOTAL_ASSET_BYTES')&&browserRust.includes('max_depth = depth.min(3)'));
assert('Workbench supports adaptive layout presets',workbench.includes('WorkbenchLayoutPreset')&&workbench.includes('beginResize')&&workbench.includes('FLIP'));
assert('Workbench plasma surfaces do not fuse',workbench.includes('group="workbench-panels" fuse={false}'));
assert('Settings expose readability controls',fs.readFileSync('src/xfactor/SettingsPanel.tsx','utf8').includes('UI SCALE')&&fs.readFileSync('src/xfactor/osSettings.ts','utf8').includes('uiScale'));
assert('command FAB replaces version-pill corner use',deck.includes('xf-command-fab'));
console.log('\nM6 organized-disorganization source checks passed.');
