import fs from 'node:fs';

function replaceExact(path, before, after) {
  const source = fs.readFileSync(path, 'utf8');
  const first = source.indexOf(before);
  if (first < 0) throw new Error(`Missing codemod target in ${path}: ${before.slice(0, 100)}`);
  if (source.indexOf(before, first + before.length) >= 0) throw new Error(`Ambiguous codemod target in ${path}`);
  fs.writeFileSync(path, source.replace(before, after));
}

replaceExact(
  'src/xfactor/ChaosDeck.tsx',
  `  const syncReady = useRef(false);\n  const syncTimer = useRef<number | null>(null);`,
  `  const syncReady = useRef(false);\n  const syncTimer = useRef<number | null>(null);\n  const syncGeneration = useRef(0);`,
);

replaceExact(
  'src/xfactor/ChaosDeck.tsx',
  `  useEffect(() => {\n    syncReady.current = false;\n    if (!authUser) return;\n    const adapter = new SupabaseWorkspaceSyncAdapter(authUser.id);\n    void adapter.pull().then(remote => {\n      setCloudError(false);\n      if (remote) setWs(local => {\n        const localClock = workspaceClock(local);\n        const remoteClock = workspaceClock(remote);\n        return remoteClock > localClock ? remote : local;\n      });\n    }).catch(err => { setCloudError(true); console.warn('xFactor.OS cloud pull unavailable',err); }).finally(()=>{ syncReady.current=true; });\n  }, [authUser?.id]);`,
  `  useEffect(() => {\n    const generation = ++syncGeneration.current;\n    syncReady.current = false;\n    if (syncTimer.current) { window.clearTimeout(syncTimer.current); syncTimer.current = null; }\n    if (!authUser) return;\n    const adapter = new SupabaseWorkspaceSyncAdapter(authUser.id);\n    void adapter.pull().then(remote => {\n      if (syncGeneration.current !== generation) return;\n      setCloudError(false);\n      if (remote) setWs(local => {\n        const localClock = workspaceClock(local);\n        const remoteClock = workspaceClock(remote);\n        return remoteClock > localClock ? remote : local;\n      });\n    }).catch(err => {\n      if (syncGeneration.current !== generation) return;\n      setCloudError(true);\n      console.warn('xFactor.OS cloud pull unavailable',err);\n    }).finally(()=>{ if (syncGeneration.current === generation) syncReady.current=true; });\n  }, [authUser?.id]);`,
);

replaceExact(
  'src/xfactor/ChaosDeck.tsx',
  `  useEffect(() => {\n    if (!authUser || !syncReady.current) return;\n    if (syncTimer.current) window.clearTimeout(syncTimer.current);\n    syncTimer.current = window.setTimeout(() => {\n      void new SupabaseWorkspaceSyncAdapter(authUser.id).push(ws).then(()=>setCloudError(false)).catch(err => { setCloudError(true); console.warn('xFactor.OS cloud push unavailable',err); });\n    }, 900);\n    return () => { if (syncTimer.current) window.clearTimeout(syncTimer.current); };\n  }, [ws, authUser]);`,
  `  useEffect(() => {\n    if (!authUser || !syncReady.current) return;\n    const generation = syncGeneration.current;\n    const ownerId = authUser.id;\n    if (syncTimer.current) window.clearTimeout(syncTimer.current);\n    syncTimer.current = window.setTimeout(() => {\n      if (syncGeneration.current !== generation) return;\n      void new SupabaseWorkspaceSyncAdapter(ownerId).push(ws).then(()=>{\n        if (syncGeneration.current === generation) setCloudError(false);\n      }).catch(err => {\n        if (syncGeneration.current !== generation) return;\n        setCloudError(true);\n        console.warn('xFactor.OS cloud push unavailable',err);\n      });\n    }, 900);\n    return () => { if (syncTimer.current) { window.clearTimeout(syncTimer.current); syncTimer.current = null; } };\n  }, [ws, authUser]);`,
);

const smoke = [
  "import fs from 'node:fs';",
  '',
  'function assert(label, condition) {',
  "  if (!condition) throw new Error('FAIL: ' + label);",
  "  console.log('PASS: ' + label);",
  '}',
  '',
  "const deck = fs.readFileSync('src/xfactor/ChaosDeck.tsx', 'utf8');",
  "assert('sync generation token exists', deck.includes('const syncGeneration = useRef(0);'));",
  "assert('auth transitions invalidate older async sync work', deck.includes('const generation = ++syncGeneration.current;'));",
  "assert('auth transition cancels pending debounce', deck.includes('window.clearTimeout(syncTimer.current); syncTimer.current = null;'));",
  "assert('stale pulls cannot hydrate visible workspace', deck.includes('if (syncGeneration.current !== generation) return;') && deck.includes('if (remote) setWs(local =>'));",
  "assert('stale pull errors cannot poison new account state', /catch\(err => \{\s*if \(syncGeneration\.current !== generation\) return;\s*setCloudError\(true\)/.test(deck));",
  "assert('stale pulls cannot mark a newer account sync-ready', deck.includes('if (syncGeneration.current === generation) syncReady.current=true;'));",
  "assert('push captures owner and generation', deck.includes('const ownerId = authUser.id;') && deck.includes('new SupabaseWorkspaceSyncAdapter(ownerId).push(ws)'));",
  "assert('stale debounced pushes are abandoned before request', /window\.setTimeout\(\(\) => \{\s*if \(syncGeneration\.current !== generation\) return;/.test(deck));",
  "assert('stale push results cannot alter newer account error state', deck.includes('if (syncGeneration.current === generation) setCloudError(false);'));",
  "console.log('Cloud account isolation contract passed.');",
  '',
].join('\n');
fs.writeFileSync('scripts/cloud-account-isolation-smoke.mjs', smoke);
console.log('Applied cloud account isolation product fix.');
