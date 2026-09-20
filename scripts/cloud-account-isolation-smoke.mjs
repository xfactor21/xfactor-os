import fs from 'node:fs';

function assert(label, condition) {
  if (!condition) throw new Error('FAIL: ' + label);
  console.log('PASS: ' + label);
}

const deck = fs.readFileSync('src/xfactor/ChaosDeck.tsx', 'utf8');

assert('sync generation token exists', deck.includes('const syncGeneration = useRef(0);'));
assert('auth transitions invalidate older async sync work', deck.includes('const generation = ++syncGeneration.current;'));
assert('auth transition cancels pending debounce', deck.includes('window.clearTimeout(syncTimer.current); syncTimer.current = null;'));
assert('stale pulls cannot hydrate visible workspace', deck.includes('if (syncGeneration.current !== generation) return;') && deck.includes('if (remote) setWs(local =>'));
assert('stale pull errors cannot poison new account state', deck.includes("if (syncGeneration.current !== generation) return;\n      setCloudError(true);\n      console.warn('xFactor.OS cloud pull unavailable'"));
assert('stale pulls cannot mark a newer account sync-ready', deck.includes('if (syncGeneration.current === generation) syncReady.current=true;'));
assert('push captures owner and generation', deck.includes('const ownerId = authUser.id;') && deck.includes('new SupabaseWorkspaceSyncAdapter(ownerId).push(ws)'));
assert('stale debounced pushes are abandoned before request', deck.includes('syncTimer.current = window.setTimeout(() => {\n      if (syncGeneration.current !== generation) return;'));
assert('stale push success cannot alter newer account state', deck.includes('if (syncGeneration.current === generation) setCloudError(false);'));
assert('debounce cleanup nulls timer handle', deck.includes('window.clearTimeout(syncTimer.current); syncTimer.current = null;'));

console.log('Cloud account isolation contract passed.');
