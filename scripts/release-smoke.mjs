import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

let passed = 0;
function assert(name, condition) {
  if (!condition) throw new Error(`FAIL: ${name}`);
  passed += 1;
  console.log(`PASS: ${name}`);
}

function loadCommonJs(file) {
  const source = fs.readFileSync(file, 'utf8');
  const js = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
    fileName: file,
  }).outputText;
  const module = { exports: {} };
  const storage = new Map();
  const context = {
    module,
    exports: module.exports,
    require: () => { throw new Error(`Unexpected runtime import while testing ${file}`); },
    console,
    Date,
    Math,
    JSON,
    Object,
    Array,
    Set,
    Map,
    Boolean,
    String,
    Number,
    Error,
    crypto: globalThis.crypto,
    structuredClone: globalThis.structuredClone,
    localStorage: {
      getItem: key => storage.has(key) ? storage.get(key) : null,
      setItem: (key, value) => storage.set(key, String(value)),
      removeItem: key => storage.delete(key),
    },
  };
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(js, context, { filename: file });
  return module.exports;
}

const store = loadCommonJs('src/xfactor/store.ts');
const clean = store.normalizeWorkspace({
  schemaVersion: 2,
  incidents: [{ id: 'i1', name: 12, heat: 999, status: 'BAD', tags: 'bad' }],
  piles: 'bad',
  signals: [{ id: 's1', text: 'hello', type: 'BAD', incidentId: 'missing' }],
  assets: [],
  activity: [],
  positions: { i1: { x: -4, y: 999, rotation: 999 } },
  savedLayouts: [],
  selectedIncidentId: 'missing',
});
assert('workspace v2 normalizes', Boolean(clean));
assert('workspace clamps unsafe numeric values', clean.incidents[0].heat === 100 && clean.positions.i1.y === 100);
assert('workspace removes dangling relations', clean.signals[0].incidentId === undefined && clean.selectedIncidentId === undefined);
assert('old schema is rejected', store.normalizeWorkspace({ schemaVersion: 1 }) === null);
const roundTrip = store.freshWorkspace();
roundTrip.incidents = [store.newIncident()];
assert('local persistence reports success', store.saveWorkspace(roundTrip) === true);
assert('local persistence round-trips', store.loadWorkspace().incidents[0].id === roundTrip.incidents[0].id);
const exported = store.exportWorkspace(roundTrip);
assert('workspace exports a branded backup envelope', exported.includes('xFactor.OS'));
assert('workspace backup imports successfully', store.importWorkspace(exported).incidents[0].id === roundTrip.incidents[0].id);
const relationClean = store.normalizeWorkspace({ ...roundTrip, incidents:[{...roundTrip.incidents[0], relatedIncidentIds:['missing','self']}] });
assert('workspace removes invalid incident relations', relationClean.incidents[0].relatedIncidentIds.length === 0);

const grammar = loadCommonJs('src/xfactor/commandGrammar.ts');
assert('riot command parses', grammar.parseCommand('riot').type === 'riot');
assert('new project preserves user casing', grammar.parseCommand('new project Monster X').name === 'Monster X');
assert('capture command preserves text', grammar.parseCommand('capture Fix The Mix').text === 'Fix The Mix');
assert('terminal command parses', grammar.parseCommand('open terminal').target === 'terminal');
assert('typed task command parses', grammar.parseCommand('task Ship The Build').signalType === 'task');
assert('tape command parses', grammar.parseCommand('open tape').target === 'tape');
assert('search command parses', grammar.parseCommand('find Monster X').query === 'Monster X');

const deck = fs.readFileSync('src/xfactor/ChaosDeck.tsx', 'utf8');
assert('main product exposes Tape view', deck.includes("view==='tape'"));
assert('main product exposes account/cloud panel', deck.includes('AccountPanel'));
assert('Black Vault exposes real file ingestion', deck.includes('putAssetBlob'));
assert('Blackbox exposes related incidents', deck.includes('RELATED DAMAGE'));
const boards = fs.readFileSync('src/modules/studio/boards.ts','utf8');
assert('Design Lab metadata uses xFactor storage key', boards.includes('xfactor-studio-boards-v1'));
assert('Design Lab emits xFactor board events', boards.includes('xfactor:studio-board'));
const qr = fs.readFileSync('src/modules/studio/tools/QrGenerator.tsx', 'utf8');
assert('QR tool has no legacy deployed URL seed', !qr.includes('xos-nexus.surge.sh'));
const widget = fs.readFileSync('src/components/CaptureWidget.tsx', 'utf8');
assert('desktop capture writes xFactor workspace', widget.includes("from '../xfactor/store'"));
assert('desktop capture no longer targets legacy nodes sync', !widget.includes('commitOrQueue'));

for (const file of [
  'public/pyodide/pyodide.mjs',
  'public/pyodide/pyodide.asm.wasm',
  'public/ruby/ruby+stdlib.wasm',
  'public/php/php_8_3.js',
  'public/php/php_8_3.wasm',
  'public/gowasm/wasm_exec.js',
  'public/gowasm/xos-go.wasm',
  'public/xfactor-mask.jpeg',
  'src-tauri/icons/32x32.png',
  'src-tauri/icons/128x128.png',
  'src-tauri/icons/128x128@2x.png',
  'src-tauri/icons/icon.icns',
  'src-tauri/icons/icon.ico',
]) assert(`required asset exists: ${file}`, fs.existsSync(file));

const studioIndex = fs.readFileSync('src/modules/studio/index.tsx', 'utf8');
const studioTypes = fs.readFileSync('src/modules/studio/types.ts', 'utf8');
const modeList = studioTypes.match(/export const IMPLEMENTED_MODES: StudioMode\[\] = \[(.*?)\];/s)?.[1] ?? '';
const modes = [...modeList.matchAll(/'([A-Za-z]+)'/g)].map(match => match[1]);
assert('Design Lab advertises exactly 25 implemented modes', modes.length === 25);
for (const mode of modes) assert(`Design Lab routes implemented mode: ${mode}`, studioIndex.includes(`openBoard.mode === '${mode}'`));

console.log(`\nRelease smoke checks passed: ${passed}`);
