#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';

const url = process.env.XFACTOR_LIVE_SYNC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const anonKey = process.env.XFACTOR_LIVE_SYNC_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const email = process.env.XFACTOR_LIVE_SYNC_EMAIL;
const password = process.env.XFACTOR_LIVE_SYNC_PASSWORD;

const missing = Object.entries({
  XFACTOR_LIVE_SYNC_SUPABASE_URL: url,
  XFACTOR_LIVE_SYNC_ANON_KEY: anonKey,
  XFACTOR_LIVE_SYNC_EMAIL: email,
  XFACTOR_LIVE_SYNC_PASSWORD: password,
}).filter(([, value]) => !value).map(([key]) => key);

if (missing.length) {
  console.error(`Live cloud-sync acceptance requires configured test credentials: ${missing.join(', ')}`);
  process.exit(2);
}

const makeClient = () => createClient(url, anonKey, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});

const a = makeClient();
const b = makeClient();
const marker = `live-sync-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
let ownerId;
let priorRow = null;

function assert(label, condition) {
  if (!condition) throw new Error(`FAIL: ${label}`);
  console.log(`PASS: ${label}`);
}

async function signIn(client, label) {
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`${label} sign-in failed: ${error.message}`);
  assert(`${label} has authenticated user`, Boolean(data.user?.id));
  return data.user.id;
}

async function readRow(client) {
  const { data, error } = await client.from('xfactor_workspaces')
    .select('owner_id,schema_version,payload,updated_at')
    .eq('owner_id', ownerId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function upsert(client, payload) {
  const { error } = await client.from('xfactor_workspaces').upsert({
    owner_id: ownerId,
    schema_version: 2,
    payload,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'owner_id' });
  if (error) throw error;
}

try {
  const ownerA = await signIn(a, 'session A');
  const ownerB = await signIn(b, 'session B');
  assert('both sessions resolve to the same owner', ownerA === ownerB);
  ownerId = ownerA;
  priorRow = await readRow(a);

  const firstClock = Date.now();
  const payloadA = {
    schemaVersion: 2,
    updatedAt: firstClock,
    incidents: [], piles: [], signals: [], assets: [], activity: [], savedLayouts: [], positions: {},
    __liveAcceptance: { marker, writer: 'A', revision: 1 },
  };
  await upsert(a, payloadA);
  const seenByB = await readRow(b);
  assert('session B reads session A write', seenByB?.payload?.__liveAcceptance?.marker === marker && seenByB.payload.__liveAcceptance.writer === 'A');

  const payloadB = {
    ...seenByB.payload,
    updatedAt: firstClock + 1,
    __liveAcceptance: { marker, writer: 'B', revision: 2 },
  };
  await upsert(b, payloadB);
  const seenByA = await readRow(a);
  assert('session A reads session B write', seenByA?.payload?.__liveAcceptance?.writer === 'B' && seenByA.payload.__liveAcceptance.revision === 2);
  assert('owner-scoped row remains singular', seenByA.owner_id === ownerId);

  console.log('Live two-session xFactor.OS cloud sync acceptance passed.');
} finally {
  if (ownerId) {
    if (priorRow) {
      const { error } = await a.from('xfactor_workspaces').upsert(priorRow, { onConflict: 'owner_id' });
      if (error) console.error(`Cleanup restore failed: ${error.message}`);
    } else {
      const { error } = await a.from('xfactor_workspaces').delete().eq('owner_id', ownerId);
      if (error) console.error(`Cleanup delete failed: ${error.message}`);
    }
  }
  await Promise.allSettled([a.auth.signOut(), b.auth.signOut()]);
}
