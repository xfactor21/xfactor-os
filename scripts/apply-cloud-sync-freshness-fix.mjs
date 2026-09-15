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

fs.writeFileSync('scripts/cloud-sync-clock-smoke.mjs', `import fs from 'node:fs';\n\nfunction assert(label, condition) {\n  if (!condition) throw new Error(\\`FAIL: \\${label}\\`);\n  console.log(\\`PASS: \\${label}\\`);\n}\n\nconst domain = fs.readFileSync('src/xfactor/domain.ts', 'utf8');\nconst store = fs.readFileSync('src/xfactor/store.ts', 'utf8');\nconst deck = fs.readFileSync('src/xfactor/ChaosDeck.tsx', 'utf8');\nconst sync = fs.readFileSync('src/xfactor/syncAdapter.ts', 'utf8');\n\nassert('workspace state has an explicit updatedAt clock', /interface WorkspaceState[\\s\\S]*updatedAt: number;/.test(domain));\nassert('fresh workspaces initialize the clock', store.includes('updatedAt:now()'));\nassert('normalization accepts legacy schema-v2 payloads and derives a clock', store.includes('finite(value.updatedAt, 0)') && store.includes('...signals.flatMap(item => [item.createdAt, item.updatedAt])') && store.includes('...assets.flatMap(item => [item.createdAt, item.updatedAt])'));\nassert('workspaceClock includes explicit whole-workspace timestamp', store.includes('export function workspaceClock(state: WorkspaceState)') && store.includes('state.updatedAt || 0'));\nassert('cloud hydration uses the complete workspace clock', deck.includes('const localClock = workspaceClock(local);') && deck.includes('const remoteClock = workspaceClock(remote);'));\nassert('central mutations stamp workspace updatedAt', deck.includes('normalizeWorkspace({...recipe(prev),updatedAt:Date.now()})'));\nassert('legacy partial incident/activity clock is gone', !deck.includes('local.incidents.map(i=>i.updatedAt)') && !deck.includes('remote.incidents.map(i=>i.updatedAt)'));\nassert('cloud writes remain normalized owner-scoped upserts', sync.includes(".upsert({ owner_id:this.ownerId") && sync.includes(".eq('owner_id',this.ownerId)"));\nconsole.log('Cloud sync freshness contract passed.');\n`);

fs.writeFileSync('.github/workflows/cloud-sync-freshness-acceptance.yml', `name: Cloud Sync Freshness Acceptance\n\non:\n  pull_request:\n    branches: ['main']\n    paths:\n      - 'src/xfactor/domain.ts'\n      - 'src/xfactor/store.ts'\n      - 'src/xfactor/ChaosDeck.tsx'\n      - 'src/xfactor/syncAdapter.ts'\n      - 'scripts/cloud-sync-clock-smoke.mjs'\n      - '.github/workflows/cloud-sync-freshness-acceptance.yml'\n  workflow_dispatch: {}\n\npermissions:\n  contents: read\n\njobs:\n  cloud-sync-freshness:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v6\n      - uses: actions/setup-node@v6\n        with:\n          node-version: 22\n          cache: npm\n      - name: Install dependencies\n        run: npm ci\n      - name: Verify cloud freshness contract\n        run: node scripts/cloud-sync-clock-smoke.mjs\n      - name: Release smoke\n        run: npm run test:release\n      - name: Production build\n        run: npm run build\n`);

fs.rmSync('scripts/apply-cloud-sync-freshness-fix.mjs');
fs.rmSync('.github/workflows/cloud-sync-freshness-codemod.yml');
console.log('Applied cloud sync freshness fix and removed one-shot codemod files.');
