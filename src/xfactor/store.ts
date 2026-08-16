import type { ActivityEvent, Asset, AssetSource, Incident, IncidentPriority, IncidentStatus, Pile, Position, SavedLayout, Signal, SignalType, WorkspaceState } from './domain';

export const WORKSPACE_STORAGE_KEY = 'xfactor-os-workspace-v2';
const KEY = WORKSPACE_STORAGE_KEY;
const LEGACY_SHARDS = 'xfactor-chaos-deck-v1';
const LEGACY_CAPTURES = 'xfactor-chaos-captures-v1';

const now = () => Date.now();
const uid = () => crypto.randomUUID();
const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const finite = (value: unknown, fallback = 0) => typeof value === 'number' && Number.isFinite(value) ? value : fallback;
const text = (value: unknown, fallback = '') => typeof value === 'string' ? value : fallback;
const bool = (value: unknown, fallback = false) => typeof value === 'boolean' ? value : fallback;
const stringArray = (value: unknown) => Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
const status = (value: unknown): IncidentStatus => value === 'LIVE' || value === 'FERAL' || value === 'DORMANT' || value === 'BREACH' ? value : 'FERAL';
const priority = (value: unknown): IncidentPriority => value === 'LOW' || value === 'MEDIUM' || value === 'HIGH' || value === 'CRITICAL' ? value : 'MEDIUM';
const signalType = (value: unknown): SignalType => value === 'task' || value === 'note' || value === 'link' || value === 'spark' ? value : 'spark';
const assetKind = (value: unknown): Asset['kind'] => value === 'image' || value === 'audio' || value === 'video' || value === 'document' || value === 'code' || value === 'link' || value === 'studio' || value === 'other' ? value : 'other';
const assetSource = (value: unknown): AssetSource => value === 'file' || value === 'studio' || value === 'reference' ? value : 'reference';

export function freshWorkspace(): WorkspaceState {
  return {
    schemaVersion:2,
    incidents:[],
    piles:[],
    signals:[],
    assets:[],
    activity:[],
    positions:{},
    savedLayouts:[],
    selectedIncidentId:undefined,
  };
}

function normalizeIncident(value: unknown): Incident | null {
  if (!isRecord(value) || typeof value.id !== 'string' || !value.id) return null;
  const createdAt = finite(value.createdAt, now());
  return {
    id:value.id,
    name:text(value.name,'UNNAMED INCIDENT').slice(0,240),
    kind:text(value.kind,'NEW / UNKNOWN').slice(0,160),
    tagline:text(value.tagline,'').slice(0,500),
    description:text(value.description,'').slice(0,12000),
    nextMove:text(value.nextMove,'').slice(0,1200),
    heat:Math.max(0,Math.min(100,finite(value.heat,50))),
    open:Math.max(0,Math.floor(finite(value.open,0))),
    done:Math.max(0,Math.floor(finite(value.done,0))),
    status:status(value.status),
    priority:priority(value.priority),
    tags:stringArray(value.tags).slice(0,100),
    pileIds:stringArray(value.pileIds).slice(0,100),
    relatedIncidentIds:stringArray(value.relatedIncidentIds).slice(0,200),
    archived:bool(value.archived),
    createdAt,
    updatedAt:finite(value.updatedAt,createdAt),
  };
}

function normalizePile(value: unknown): Pile | null {
  if (!isRecord(value) || typeof value.id !== 'string' || !value.id) return null;
  return { id:value.id, name:text(value.name,'NEW PILE').slice(0,240), stamp:text(value.stamp,'CONTROLLED MESS').slice(0,160), collapsed:bool(value.collapsed), createdAt:finite(value.createdAt,now()) };
}

function normalizeSignal(value: unknown): Signal | null {
  if (!isRecord(value) || typeof value.id !== 'string' || !value.id) return null;
  const createdAt=finite(value.createdAt,now());
  return { id:value.id, text:text(value.text).slice(0,10000), type:signalType(value.type), incidentId:typeof value.incidentId === 'string' ? value.incidentId : undefined, pinned:bool(value.pinned), done:bool(value.done), createdAt, updatedAt:finite(value.updatedAt,createdAt) };
}

function normalizeAsset(value: unknown): Asset | null {
  if (!isRecord(value) || typeof value.id !== 'string' || !value.id) return null;
  const createdAt=finite(value.createdAt,now());
  return {
    id:value.id,
    name:text(value.name,'UNTITLED ASSET').slice(0,500),
    kind:assetKind(value.kind),
    source:assetSource(value.source),
    uri:typeof value.uri === 'string' ? value.uri.slice(0,5000) : undefined,
    blobKey:typeof value.blobKey === 'string' ? value.blobKey.slice(0,500) : undefined,
    mime:typeof value.mime === 'string' ? value.mime.slice(0,240) : undefined,
    size:Math.max(0,finite(value.size,0)) || undefined,
    incidentId:typeof value.incidentId === 'string' ? value.incidentId : undefined,
    tags:stringArray(value.tags).slice(0,100),
    favorite:bool(value.favorite),
    archived:bool(value.archived),
    createdAt,
    updatedAt:finite(value.updatedAt,createdAt),
  };
}

function normalizeActivity(value: unknown): ActivityEvent | null {
  if (!isRecord(value) || typeof value.id !== 'string' || !value.id) return null;
  return { id:value.id, type:text(value.type,'event').slice(0,100), label:text(value.label,'Activity').slice(0,1000), incidentId:typeof value.incidentId === 'string' ? value.incidentId : undefined, createdAt:finite(value.createdAt,now()) };
}

function normalizePosition(value: unknown): Position | null {
  if (!isRecord(value)) return null;
  return { x:Math.max(0,Math.min(100,finite(value.x,20))), y:Math.max(0,Math.min(100,finite(value.y,20))), rotation:Math.max(-180,Math.min(180,finite(value.rotation,0))) };
}

function normalizeLayout(value: unknown): SavedLayout | null {
  if (!isRecord(value) || typeof value.id !== 'string' || !value.id) return null;
  const positions: Record<string,Position> = {};
  if (isRecord(value.positions)) for (const [id,pos] of Object.entries(value.positions)) { const clean=normalizePosition(pos); if(clean) positions[id]=clean; }
  return { id:value.id, name:text(value.name,'SAVED LAYOUT').slice(0,240), positions, createdAt:finite(value.createdAt,now()) };
}

/** Treat localStorage and cloud payloads as untrusted input. */
export function normalizeWorkspace(value: unknown): WorkspaceState | null {
  if (!isRecord(value) || value.schemaVersion !== 2) return null;
  const incidents = (Array.isArray(value.incidents) ? value.incidents : []).map(normalizeIncident).filter((v): v is Incident => Boolean(v));
  const incidentIds = new Set(incidents.map(i=>i.id));
  const piles = (Array.isArray(value.piles) ? value.piles : []).map(normalizePile).filter((v): v is Pile => Boolean(v));
  const pileIds = new Set(piles.map(p=>p.id));
  const cleanIncidents = incidents.map(i=>({...i,pileIds:i.pileIds.filter(id=>pileIds.has(id)),relatedIncidentIds:i.relatedIncidentIds.filter(id=>incidentIds.has(id)&&id!==i.id)}));
  const signals = (Array.isArray(value.signals) ? value.signals : []).map(normalizeSignal).filter((v): v is Signal => Boolean(v)).map(s=>({...s,incidentId:s.incidentId && incidentIds.has(s.incidentId) ? s.incidentId : undefined}));
  const assets = (Array.isArray(value.assets) ? value.assets : []).map(normalizeAsset).filter((v): v is Asset => Boolean(v)).map(a=>({...a,incidentId:a.incidentId && incidentIds.has(a.incidentId) ? a.incidentId : undefined}));
  const activity = (Array.isArray(value.activity) ? value.activity : []).map(normalizeActivity).filter((v): v is ActivityEvent => Boolean(v)).map(a=>({...a,incidentId:a.incidentId && incidentIds.has(a.incidentId) ? a.incidentId : undefined}));
  const positions: Record<string,Position> = {};
  if (isRecord(value.positions)) for (const [id,pos] of Object.entries(value.positions)) if (incidentIds.has(id)) { const clean=normalizePosition(pos); if(clean) positions[id]=clean; }
  const savedLayouts = (Array.isArray(value.savedLayouts) ? value.savedLayouts : []).map(normalizeLayout).filter((v): v is SavedLayout => Boolean(v));
  return {
    schemaVersion:2,
    incidents:cleanIncidents,
    piles,
    signals,
    assets,
    activity:activity.slice(0,5000),
    positions,
    savedLayouts:savedLayouts.slice(0,50),
    selectedIncidentId:typeof value.selectedIncidentId === 'string' && incidentIds.has(value.selectedIncidentId) ? value.selectedIncidentId : undefined,
  };
}

function migrateLegacy(): WorkspaceState | null {
  try {
    const rawShards = localStorage.getItem(LEGACY_SHARDS);
    const rawCaptures = localStorage.getItem(LEGACY_CAPTURES);
    if (!rawShards && !rawCaptures) return null;
    const base = freshWorkspace();
    if (rawShards) {
      const shards = JSON.parse(rawShards) as Array<unknown>;
      if (Array.isArray(shards)) {
        base.incidents = shards.map(s=>normalizeIncident(isRecord(s)?{...s,pileIds:[],relatedIncidentIds:[],createdAt:now(),updatedAt:now()}:s)).filter((v):v is Incident=>Boolean(v));
        const validIds=new Set(base.incidents.map(i=>i.id));
        base.positions = Object.fromEntries(shards.flatMap(s=>isRecord(s)&&typeof s.id==='string'&&validIds.has(s.id)?[[s.id,normalizePosition({x:s.x,y:s.y,rotation:s.rotation})??{x:20,y:20,rotation:0}]]:[]));
      }
    }
    if (rawCaptures) {
      const captures=JSON.parse(rawCaptures) as Array<unknown>;
      if(Array.isArray(captures)) base.signals=captures.map(c=>normalizeSignal(isRecord(c)?{...c,createdAt:c.ts??now(),updatedAt:c.ts??now(),pinned:false,done:false}:c)).filter((v):v is Signal=>Boolean(v));
    }
    return base;
  } catch { return null; }
}

export function loadWorkspace(): WorkspaceState {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const clean = normalizeWorkspace(JSON.parse(raw));
      if (clean) return clean;
    }
  } catch { /* fall through */ }
  const migrated = migrateLegacy();
  if (migrated) { saveWorkspace(migrated); return migrated; }
  return freshWorkspace();
}

export function saveWorkspace(state: WorkspaceState): boolean {
  try {
    const clean=normalizeWorkspace(state);
    localStorage.setItem(KEY, JSON.stringify(clean ?? state));
    return true;
  } catch (error) { console.error('xFactor.OS persistence failed', error); return false; }
}

export function exportWorkspace(state: WorkspaceState): string {
  return JSON.stringify({exportedAt:new Date().toISOString(),product:'xFactor.OS',workspace:normalizeWorkspace(state) ?? state},null,2);
}

export function importWorkspace(raw: string): WorkspaceState | null {
  try {
    const parsed=JSON.parse(raw) as unknown;
    if (isRecord(parsed) && 'workspace' in parsed) return normalizeWorkspace(parsed.workspace);
    return normalizeWorkspace(parsed);
  } catch { return null; }
}

export function event(type:string,label:string,incidentId?:string): ActivityEvent { return {id:uid(),type,label,incidentId,createdAt:now()}; }
export function newIncident(name='UNNAMED INCIDENT'): Incident { return {id:uid(),name,kind:'NEW / UNKNOWN',tagline:'It exists now. Figure out what it wants.',description:'',nextMove:'',heat:50,open:0,done:0,status:'FERAL',priority:'MEDIUM',tags:['new'],pileIds:[],relatedIncidentIds:[],archived:false,createdAt:now(),updatedAt:now()}; }
export function newPile(name='NEW PILE'): Pile { return {id:uid(),name,stamp:'CONTROLLED MESS',collapsed:false,createdAt:now()}; }
export function newSignal(textValue:string,type:SignalType='spark',incidentId?:string): Signal { const ts=now(); return {id:uid(),text:textValue,type,incidentId,pinned:false,done:false,createdAt:ts,updatedAt:ts}; }
export function newAsset(name:string, kind:Asset['kind']='other', uri?:string, incidentId?:string, source:AssetSource='reference'): Asset { const ts=now(); return {id:uid(),name,kind,source,uri,incidentId,tags:[],favorite:false,archived:false,createdAt:ts,updatedAt:ts}; }
export function newLayout(name:string, positions:Record<string,Position>): SavedLayout { return {id:uid(),name,positions:typeof structuredClone === 'function' ? structuredClone(positions) : JSON.parse(JSON.stringify(positions)) as Record<string,Position>,createdAt:now()}; }
