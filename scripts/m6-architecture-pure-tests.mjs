import fs from 'node:fs';
import ts from 'typescript';

function assert(name, condition) {
  if (!condition) throw new Error(`FAIL: ${name}`);
  console.log(`PASS: ${name}`);
}
function read(path){return fs.readFileSync(new URL('../'+path, import.meta.url),'utf8');}

const domain=read('src/xfactor/domain.ts');
const store=read('src/xfactor/store.ts');
const spatial=read('src/xfactor/TrueSpatial.tsx');
const signal=read('src/xfactor/PlasmaSignalWorkspace.tsx');
const chaos=read('src/xfactor/ChaosDeck.tsx');
const workbench=read('src/xfactor/DeveloperWorkbench.tsx');
const browser=read('src/xfactor/XBrowser.tsx');
const nativeBrowser=read('src-tauri/src/browser.rs');
const index=read('index.html');
const pkg=JSON.parse(read('package.json'));

for(const file of ['src/xfactor/SpatialOrganizer.tsx','src/xfactor/LocalFileExplorer.tsx','src/xfactor/XBrowser.tsx','src/xfactor/M6SettingsPanel.tsx']){
  const source=read(file);
  const out=ts.transpileModule(source,{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext},reportDiagnostics:true,fileName:file});
  assert(file+' parses',(out.diagnostics??[]).filter(d=>d.category===ts.DiagnosticCategory.Error).length===0);
}
assert('M6 is the 0.6 milestone',pkg.version==='0.6.0');
assert('semantic spatial clusters live in canonical workspace',domain.includes('interface SpatialCluster')&&domain.includes('spatialClusters: SpatialCluster[]')&&store.includes('normalizeSpatialCluster'));
assert('Incident fusion can create real Pile membership',chaos.includes("bundleSpatial(kind:'incident'")&&chaos.includes("pile.stamp='PLASMA BUNDLE'"));
assert('Signal fusion persists semantic bundle callback',signal.includes('onBundle?: (a: string, b: string) => void')&&signal.includes('if(other)onBundle(id,other.id)'));
assert('Signal starting layout is separated beyond M5 fusion gap',signal.includes('(index % 3) * 350')&&signal.includes('Math.floor(index / 3) * 240'));
assert('room renderer is not keyed by mode/look',!spatial.includes('key={`${plasma.mode}:${room}:${plasma.look}`}'));
assert('global room renderer disables mass form transitions',spatial.includes('formIn={false}')&&spatial.includes('formOut={false}'));
assert('Plasma content is explicitly layered inside the body',spatial.includes('className="xf-spatial-content"'));
assert('Workbench has persisted named layouts',workbench.includes('xfactor-workbench-layout-v2:')&&workbench.includes('CODE FOCUS')&&workbench.includes('PREVIEW FOCUS')&&workbench.includes('FLIP SIDES'));
assert('Workbench spatial panes cannot fuse',workbench.includes('group="workbench-panels" fuse={false}'));
assert('Rift Explorer and Browser are first-class dev tools',chaos.includes('<small>FILES</small>')&&chaos.includes('<small>BROWSER</small>')&&chaos.includes('<small>SETTINGS</small>'));
assert('Command Deck has a visible FAB',chaos.includes('xf-command-fab')&&chaos.includes('Open Command Deck'));
assert('Signal metric is real routing data, not random jitter',chaos.includes('ws.signals.filter(signal=>signal.incidentId)')&&!chaos.includes('Math.random() > .5'));
assert('native browser window is isolated by its own label',nativeBrowser.includes('"xf-browser"')&&nativeBrowser.includes('validate_public_url'));
assert('native browser capture rejects local/internal hosts',nativeBrowser.includes('lower == "localhost"')&&nativeBrowser.includes('private_ip(ip)'));
assert('browser capture has bounded static project export',browser.includes("format:'xfactor-site-project-v1'")&&browser.includes('pages.length<18'));
assert('floating build badge is gone',!index.includes('id="xfactor-build-badge"')&&index.includes('xfactor-build-version'));
console.log('\nM6 architecture acceptance checks passed.');
