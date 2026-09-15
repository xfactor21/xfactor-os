import fs from 'node:fs';

function replaceExact(path, before, after) {
  const source = fs.readFileSync(path, 'utf8');
  const first = source.indexOf(before);
  if (first < 0) throw new Error(`Missing codemod target in ${path}: ${before.slice(0, 80)}`);
  if (source.indexOf(before, first + before.length) >= 0) throw new Error(`Ambiguous codemod target in ${path}`);
  fs.writeFileSync(path, source.replace(before, after));
}

replaceExact(
  'src/xfactor/domain.ts',
  `export interface WorkspaceState {\n  schemaVersion: 2;\n`,
  `export interface WorkspaceState {\n  schemaVersion: 2;\n  /** Monotonic-enough wall-clock timestamp for whole-workspace conflict resolution. */\n  updatedAt: number;\n`,
);

replaceExact(
  'src/xfactor/store.ts',
  `  return {\n    schemaVersion:2,\n    incidents:[],`,
  `  return {\n    schemaVersion:2,\n    updatedAt:now(),\n    incidents:[],`,
);

replaceExact(
  'src/xfactor/store.ts',
  `/** Treat localStorage and cloud payloads as untrusted input. */\nexport function normalizeWorkspace(value: unknown): WorkspaceState | null {`,
  `/** Return the newest meaningful timestamp represented by the workspace.\n * The explicit workspace clock covers mutations such as pile collapse or floor movement\n * that do not naturally update an entity timestamp. Legacy schema-v2 payloads still\n * get a useful clock from their timestamp-bearing entities. */\nexport function workspaceClock(state: WorkspaceState): number {\n  return Math.max(\n    0, state.updatedAt || 0,\n    ...state.incidents.flatMap(item => [item.createdAt, item.updatedAt]),\n    ...state.piles.map(item => item.createdAt),\n    ...state.signals.flatMap(item => [item.createdAt, item.updatedAt]),\n    ...state.assets.flatMap(item => [item.createdAt, item.updatedAt]),\n    ...state.activity.map(item => item.createdAt),\n    ...state.savedLayouts.map(item => item.createdAt),\n  );\n}\n\n/** Treat localStorage and cloud payloads as untrusted input. */\nexport function normalizeWorkspace(value: unknown): WorkspaceState | null {`,
);

replaceExact(
  'src/xfactor/store.ts',
  `  const savedLayouts = (Array.isArray(value.savedLayouts) ? value.savedLayouts : []).map(normalizeLayout).filter((v): v is SavedLayout => Boolean(v));\n  return {\n    schemaVersion:2,`,
  `  const savedLayouts = (Array.isArray(value.savedLayouts) ? value.savedLayouts : []).map(normalizeLayout).filter((v): v is SavedLayout => Boolean(v));\n  const updatedAt = Math.max(\n    0, finite(value.updatedAt, 0),\n    ...cleanIncidents.flatMap(item => [item.createdAt, item.updatedAt]),\n    ...piles.map(item => item.createdAt),\n    ...signals.flatMap(item => [item.createdAt, item.updatedAt]),\n    ...assets.flatMap(item => [item.createdAt, item.updatedAt]),\n    ...activity.map(item => item.createdAt),\n    ...savedLayouts.map(item => item.createdAt),\n  );\n  return {\n    schemaVersion:2,\n    updatedAt,`,
);

replaceExact(
  'src/xfactor/ChaosDeck.tsx',
  `  newSignal, normalizeWorkspace, saveWorkspace, WORKSPACE_STORAGE_KEY\n} from './store';`,
  `  newSignal, normalizeWorkspace, saveWorkspace, workspaceClock, WORKSPACE_STORAGE_KEY\n} from './store';`,
);

replaceExact(
  'src/xfactor/ChaosDeck.tsx',
  `        const localClock = Math.max(0,...local.incidents.map(i=>i.updatedAt),...local.activity.map(a=>a.createdAt));\n        const remoteClock = Math.max(0,...remote.incidents.map(i=>i.updatedAt),...remote.activity.map(a=>a.createdAt));`,
  `        const localClock = workspaceClock(local);\n        const remoteClock = workspaceClock(remote);`,
);

replaceExact(
  'src/xfactor/ChaosDeck.tsx',
  `  function patch(recipe:(draft:WorkspaceState)=>WorkspaceState) { setWs(prev => normalizeWorkspace(recipe(prev)) ?? prev); }`,
  `  function patch(recipe:(draft:WorkspaceState)=>WorkspaceState) { setWs(prev => normalizeWorkspace({...recipe(prev),updatedAt:Date.now()}) ?? prev); }`,
);

const smoke = [
  "import fs from 'node:fs';",
  '',
  'function assert(label, condition) {',
  "  if (!condition) throw new Error('FAIL: ' + label);",
  "  console.log('PASS: ' + label);",
  '}',
  '',
  "const domain = fs.readFileSync('src/xfactor/domain.ts', 'utf8');",
  "const store = fs.readFileSync('src/xfactor/store.ts', 'utf8');",
  "const deck = fs.readFileSync('src/xfactor/ChaosDeck.tsx', 'utf8');",
  "const sync = fs.readFileSync('src/xfactor/syncAdapter.ts', 'utf8');",
  '',
  "assert('workspace state has an explicit updatedAt clock', /interface WorkspaceState[\\s\\S]*updatedAt: number;/.test(domain));",
  "assert('fresh workspaces initialize the clock', store.includes('updatedAt:now()'));",
  "assert('normalization derives a legacy-compatible clock', store.includes('finite(value.updatedAt, 0)') && store.includes('...signals.flatMap(item => [item.createdAt, item.updatedAt])') && store.includes('...assets.flatMap(item => [item.createdAt, item.updatedAt])'));",
  "assert('workspaceClock includes the whole-workspace timestamp', store.includes('export function workspaceClock(state: WorkspaceState)') && store.includes('state.updatedAt || 0'));",
  "assert('cloud hydration uses complete workspace clocks', deck.includes('const localClock = workspaceClock(local);') && deck.includes('const remoteClock = workspaceClock(remote);'));",
  "assert('central mutations stamp workspace updatedAt', deck.includes('normalizeWorkspace({...recipe(prev),updatedAt:Date.now()})'));",
  "assert('legacy partial freshness comparison is gone', !deck.includes('local.incidents.map(i=>i.updatedAt)') && !deck.includes('remote.incidents.map(i=>i.updatedAt)'));",
  "assert('cloud writes remain owner-scoped', sync.includes('.upsert({ owner_id:this.ownerId') && sync.includes(\".eq('owner_id',this.ownerId)\"));",
  "console.log('Cloud sync freshness contract passed.');",
  '',
].join('\n');
fs.writeFileSync('scripts/cloud-sync-clock-smoke.mjs', smoke);

const workflow = [
  'name: Cloud Sync Freshness Acceptance',
  '',
  'on:',
  '  pull_request:',
  "    branches: ['main']",
  '    paths:',
  "      - 'src/xfactor/domain.ts'",
  "      - 'src/xfactor/store.ts'",
  "      - 'src/xfactor/ChaosDeck.tsx'",
  "      - 'src/xfactor/syncAdapter.ts'",
  "      - 'scripts/cloud-sync-clock-smoke.mjs'",
  "      - '.github/workflows/cloud-sync-freshness-acceptance.yml'",
  '  workflow_dispatch: {}',
  '',
  'permissions:',
  '  contents: read',
  '',
  'jobs:',
  '  cloud-sync-freshness:',
  '    runs-on: ubuntu-latest',
  '    steps:',
  '      - uses: actions/checkout@v6',
  '      - uses: actions/setup-node@v6',
  '        with:',
  '          node-version: 22',
  '          cache: npm',
  '      - name: Install dependencies',
  '        run: npm ci',
  '      - name: Verify cloud freshness contract',
  '        run: node scripts/cloud-sync-clock-smoke.mjs',
  '      - name: Release smoke',
  '        run: npm run test:release',
  '      - name: Production build',
  '        run: npm run build',
  '',
].join('\n');
fs.writeFileSync('.github/workflows/cloud-sync-freshness-acceptance.yml', workflow);

fs.rmSync('scripts/apply-cloud-sync-freshness-fix.mjs');
fs.rmSync('.github/workflows/cloud-sync-freshness-codemod.yml');
console.log('Applied cloud sync freshness fix and removed one-shot codemod files.');
