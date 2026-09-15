import fs from 'node:fs';

function assert(label, condition) {
  if (!condition) throw new Error('FAIL: ' + label);
  console.log('PASS: ' + label);
}

const domain = fs.readFileSync('src/xfactor/domain.ts', 'utf8');
const store = fs.readFileSync('src/xfactor/store.ts', 'utf8');
const deck = fs.readFileSync('src/xfactor/ChaosDeck.tsx', 'utf8');
const sync = fs.readFileSync('src/xfactor/syncAdapter.ts', 'utf8');

assert('workspace state has an explicit updatedAt clock', /interface WorkspaceState[\s\S]*updatedAt: number;/.test(domain));
assert('fresh workspaces initialize the clock', store.includes('updatedAt:now()'));
assert('normalization derives a legacy-compatible clock', store.includes('finite(value.updatedAt, 0)') && store.includes('...signals.flatMap(item => [item.createdAt, item.updatedAt])') && store.includes('...assets.flatMap(item => [item.createdAt, item.updatedAt])'));
assert('workspaceClock includes the whole-workspace timestamp', store.includes('export function workspaceClock(state: WorkspaceState)') && store.includes('state.updatedAt || 0'));
assert('cloud hydration uses complete workspace clocks', deck.includes('const localClock = workspaceClock(local);') && deck.includes('const remoteClock = workspaceClock(remote);'));
assert('central mutations stamp workspace updatedAt', deck.includes('normalizeWorkspace({...recipe(prev),updatedAt:Date.now()})'));
assert('legacy partial freshness comparison is gone', !deck.includes('local.incidents.map(i=>i.updatedAt)') && !deck.includes('remote.incidents.map(i=>i.updatedAt)'));
assert('cloud writes remain owner-scoped', sync.includes('.upsert({ owner_id:this.ownerId') && sync.includes(".eq('owner_id',this.ownerId)"));
console.log('Cloud sync freshness contract passed.');
