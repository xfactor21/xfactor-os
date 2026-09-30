import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type RefObject } from 'react';
import { Check, Pin, RotateCcw, Search, Sparkles, Trash2 } from 'lucide-react';
import { Plasma, PlasmaProvider, type Offset } from '@cruxgarden/plasma-ui';
import type { Incident, Signal, SignalType } from './domain';
import type { MatterMaterial, MatterSlot, PlasmaController, PlasmaLook, PlasmaPolicy } from './plasmaMode';
import { beginMomentum, joinedAny, momentumTarget, sampleMomentum, type PointerMomentum } from './spatialPhysics';
import { loadM6Settings } from './m6Settings';
import './plasmaMode.css';

interface PlasmaSignalWorkspaceProps {
  signals: Signal[];
  incidents: Incident[];
  selectedIncidentId?: string;
  query: string;
  onQueryChange: (value: string) => void;
  onUpdate: (id: string, changes: Partial<Signal>) => void;
  onDelete: (signal: Signal) => void;
  plasma: PlasmaController;
  onBundle?: (firstId: string, secondId: string) => void;
}

type Layout = Record<string, Offset>;

type MaterialPhysics = {
  thickness: number;
  tension: number;
  blend: number;
  viscosity: number;
  stretch: number;
  radius: number;
  edge: number;
  edgeScale: number;
  edgeSharpness: number;
  roughness: number;
  anisotropy: number;
};

const MATERIAL_OPTIONS: MatterMaterial[] = ['plasma', 'crystal', 'metal', 'wood', 'stone', 'cloud'];
const MATTER_SLOTS: Array<{ slot: MatterSlot; label: string }> = [
  { slot: 'spark', label: 'SPARK' },
  { slot: 'task', label: 'TASK' },
  { slot: 'note', label: 'NOTE' },
  { slot: 'link', label: 'LINK' },
  { slot: 'doneTask', label: 'DONE TASK' },
];

const MATERIAL_PHYSICS: Record<MatterMaterial, MaterialPhysics> = {
  plasma: { thickness: 18, tension: 0, blend: 24, viscosity: 0.5, stretch: 1, radius: 26, edge: 0, edgeScale: 0.01, edgeSharpness: 0, roughness: 0.28, anisotropy: 0 },
  crystal: { thickness: 26, tension: 0, blend: 14, viscosity: 0.9, stretch: 0.15, radius: 10, edge: 3, edgeScale: 0.05, edgeSharpness: 1, roughness: 0.18, anisotropy: 0 },
  metal: { thickness: 10, tension: 0, blend: 8, viscosity: 0.85, stretch: 0.2, radius: 3, edge: 0, edgeScale: 0.01, edgeSharpness: 0, roughness: 0.24, anisotropy: 0.42 },
  wood: { thickness: 16, tension: 0, blend: 6, viscosity: 1, stretch: 0, radius: 5, edge: 1.5, edgeScale: 0.02, edgeSharpness: 0.3, roughness: 0.46, anisotropy: 0.65 },
  stone: { thickness: 22, tension: 0, blend: 4, viscosity: 1, stretch: 0, radius: 8, edge: 7, edgeScale: 0.03, edgeSharpness: 0.85, roughness: 0.72, anisotropy: 0 },
  cloud: { thickness: 40, tension: 0.35, blend: 60, viscosity: 0.15, stretch: 2.2, radius: 40, edge: 26, edgeScale: 0.005, edgeSharpness: 0, roughness: 0.5, anisotropy: 0 },
};

const typeTint: Record<PlasmaLook, Record<SignalType, string>> = {
  'neon-x': { task: '#ff2aa3', note: '#20d9ff', spark: '#9b5cff', link: '#ff55d8' },
  'pink-riot': { task: '#ff238d', note: '#ff68c3', spark: '#d946ef', link: '#ff91d2' },
  afterglow: { task: '#8b5cf6', note: '#22d3ee', spark: '#c026d3', link: '#38bdf8' },
};

function relative(ts: number): string {
  const sec = Math.max(1, Math.floor((Date.now() - ts) / 1000));
  if (sec < 60) return `${sec}s`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h`;
  return `${Math.floor(sec / 86400)}d`;
}

function layoutKey(mode: 'plasma' | 'matter', scopeId: string): string {
  return mode === 'matter' ? `xfactor-matter-layout-v1:${scopeId}` : `xfactor-plasma-layout-v1:${scopeId}`;
}

function homeLayout(signals: Signal[]): Layout {
  const layout: Layout = {};
  signals.forEach((signal, index) => {
    layout[signal.id] = {
      x: 18 + (index % 3) * 282,
      y: 18 + Math.floor(index / 3) * 192,
    };
  });
  return layout;
}

function loadLayout(mode: 'plasma' | 'matter', scopeId: string, signals: Signal[]): Layout {
  try {
    const raw = localStorage.getItem(layoutKey(mode, scopeId));
    return raw ? { ...homeLayout(signals), ...JSON.parse(raw) as Layout } : homeLayout(signals);
  } catch {
    return homeLayout(signals);
  }
}

function signalMaterial(signal: Signal, plasma: PlasmaController): MatterMaterial {
  if (signal.type === 'task' && signal.done) return plasma.matterMap.doneTask;
  return plasma.matterMap[signal.type];
}

function NormalSignalList({
  signals,
  incidents,
  onUpdate,
  onDelete,
}: {
  signals: Signal[];
  incidents: Incident[];
  onUpdate: (id: string, changes: Partial<Signal>) => void;
  onDelete: (signal: Signal) => void;
}) {
  if (!signals.length) return <div className="xf-empty plasma-empty"><Sparkles size={22}/><b>NO SIGNAL YET</b><p>Use Hotwire below. Capture anything before your brain talks you out of it.</p></div>;
  return <div className="signal-full">{signals.map(signal => <article className={`signal-row signal-row-full ${signal.done ? 'done' : ''}`} key={signal.id}>
    <button onClick={() => onUpdate(signal.id, { done: !signal.done })}>{signal.done ? <Check size={14}/> : <span className={`sig-dot ${signal.type}`}/>}</button>
    <div className="signal-body">
      <small>{signal.type.toUpperCase()} · {relative(signal.createdAt)} AGO</small>
      <textarea value={signal.text} onChange={event => onUpdate(signal.id, { text: event.target.value })}/>
      <div className="signal-routing">
        <select value={signal.type} onChange={event => onUpdate(signal.id, { type: event.target.value as SignalType })}>
          <option value="spark">SPARK</option><option value="task">TASK</option><option value="note">NOTE</option><option value="link">LINK</option>
        </select>
        <select value={signal.incidentId ?? ''} onChange={event => onUpdate(signal.id, { incidentId: event.target.value || undefined })}>
          <option value="">UNROUTED</option>{incidents.map(incident => <option key={incident.id} value={incident.id}>{incident.name}</option>)}
        </select>
      </div>
    </div>
    <button className={signal.pinned ? 'active-icon' : ''} onClick={() => onUpdate(signal.id, { pinned: !signal.pinned })}><Pin size={13}/></button>
    <button onClick={() => onDelete(signal)}><Trash2 size={13}/></button>
  </article>)}</div>;
}

function SignalSurfaceContent({
  signal,
  incidents,
  material,
  onUpdate,
  onDelete,
}: {
  signal: Signal;
  incidents: Incident[];
  material?: MatterMaterial;
  onUpdate: (id: string, changes: Partial<Signal>) => void;
  onDelete: (signal: Signal) => void;
}) {
  return <div className={`xf-plasma-note-inner ${material ? `matter-inner material-${material}` : ''}`}>
    <div className="xf-plasma-note-head"><span>{signal.type.toUpperCase()} · {relative(signal.createdAt)} AGO{material ? ` · ${material.toUpperCase()}` : ''}</span><button data-plasma-nodrag className={signal.pinned ? 'active' : ''} onClick={() => onUpdate(signal.id, { pinned: !signal.pinned })}><Pin size={12}/></button></div>
    <textarea data-plasma-nodrag value={signal.text} onChange={event => onUpdate(signal.id, { text: event.target.value })}/>
    <div className="xf-plasma-note-route" data-plasma-nodrag>
      <select value={signal.type} onChange={event => onUpdate(signal.id, { type: event.target.value as SignalType })}><option value="spark">SPARK</option><option value="task">TASK</option><option value="note">NOTE</option><option value="link">LINK</option></select>
      <select value={signal.incidentId ?? ''} onChange={event => onUpdate(signal.id, { incidentId: event.target.value || undefined })}><option value="">UNROUTED</option>{incidents.map(incident => <option key={incident.id} value={incident.id}>{incident.name}</option>)}</select>
    </div>
    <div className="xf-plasma-note-foot"><button data-plasma-nodrag onClick={() => onUpdate(signal.id, { done: !signal.done })}>{signal.done ? <><Check size={11}/> DONE</> : 'MARK DONE'}</button><button data-plasma-nodrag className="danger" onClick={() => onDelete(signal)}><Trash2 size={11}/> REMOVE</button></div>
  </div>;
}

function LiquidBoard({
  signals,
  incidents,
  compact,
  layout,
  layoutScope,
  stage,
  plasma,
  onLayout,
  onUpdate,
  onDelete,
  onBundle,
}: {
  signals: Signal[];
  incidents: Incident[];
  compact: boolean;
  layout: Layout;
  layoutScope: string;
  stage: RefObject<HTMLDivElement | null>;
  plasma: PlasmaController;
  onLayout: (id: string, next: Offset) => void;
  onUpdate: (id: string, changes: Partial<Signal>) => void;
  onDelete: (signal: Signal) => void;
  onBundle?: (firstId: string, secondId: string) => void;
}) {
  const momentum = useRef(new Map<string, PointerMomentum>());
  const [joinedIds, setJoinedIds] = useState<Set<string>>(() => new Set());
  const settings = loadM6Settings();
  const quality = compact ? 0.62 : settings.spatialFx === 'full' ? 1.08 : settings.spatialFx === 'reduced' ? 0.58 : 0.82;
  const maxSurfaces = compact ? 6 : settings.spatialFx === 'full' ? 14 : settings.spatialFx === 'reduced' ? 7 : 10;
  const pointerPull = settings.spatialFx !== 'reduced' && !settings.reduceMotion;
  const rememberPointer = (id: string, event: ReactPointerEvent) => {
    const previous = momentum.current.get(id);
    momentum.current.set(id, previous ? sampleMomentum(previous, event.clientX, event.clientY) : beginMomentum(event.clientX, event.clientY));
  };
  const settle = (id: string, next: Offset) => {
    const rect = stage.current?.getBoundingClientRect();
    const target = momentumTarget(next, momentum.current.get(id), rect, { width: 258, height: 170 });
    momentum.current.delete(id);
    onLayout(id, target);
  };

  return <PlasmaProvider
    mood={plasma.look === 'afterglow' ? 'tidal' : plasma.look === 'pink-riot' ? 'ember' : 'aurora'}
    theme="dark"
    tint={plasma.look === 'afterglow' ? '#8b5cf6' : '#ff2aa3'}
    background="#07020a"
    opacity={0.84}
    frost={Math.max(0.01, plasma.frost * 0.09)}
    blend={compact ? 14 : 22}
    viscosity={0.055}
    stretch={4.8}
    flow={1.28}
    tension={0.38}
    refraction={2.12}
    dispersion={1.9}
    rimColor="iridescent"
    rimWidth={0.86}
    highlight={2.0}
    edgeLine={0.36}
    shimmer={2.25}
    shimmerSpeed={1.6}
    glow={2.3}
    wash={1.12}
    grain={0.06}
    grid={24}
    magnet={compact ? 22 : 30}
    quality={quality}
    maxSurfaces={maxSurfaces}
    pointerDrop={false}
    pointerPull={pointerPull}
    ambientDrops={false}
    ground="clear"
    zIndex={8}
    formIn={false}
    formOut={false}
  >
    {signals.map((signal, index) => {
      const fallback = homeLayout(signals)[signal.id] ?? { x: 18 + (index % 3) * 282, y: 18 + Math.floor(index / 3) * 192 };
      const offset = layout[signal.id] ?? fallback;
      return <Plasma
        key={signal.id}
        className={`xf-plasma-note type-${signal.type} ${signal.done ? 'done' : ''} ${joinedIds.has(signal.id) ? 'is-fused' : ''}`}
        draggable
        snap
        fuse
        bounds={stage}
        group={layoutScope}
        offset={offset}
        onPointerDownCapture={event => momentum.current.set(signal.id, beginMomentum(event.clientX, event.clientY))}
        onPointerMoveCapture={event => rememberPointer(signal.id, event)}
        onDragEnd={next => settle(signal.id, next)}
        onJoinChange={joined => {
          setJoinedIds(current => { const next = new Set(current); if (joinedAny(joined)) next.add(signal.id); else next.delete(signal.id); return next; });
          if (joinedAny(joined) && onBundle) {
            const currentOffset = layout[signal.id] ?? fallback;
            const nearest = signals.filter(other => other.id !== signal.id).map(other => {
              const otherOffset = layout[other.id] ?? homeLayout(signals)[other.id] ?? {x:18,y:18};
              return {id:other.id,distance:Math.hypot(otherOffset.x-currentOffset.x,otherOffset.y-currentOffset.y)};
            }).sort((a,b)=>a.distance-b.distance)[0];
            if (nearest && nearest.distance < 330) onBundle(signal.id,nearest.id);
          }
        }}
        tint={typeTint[plasma.look][signal.type]}
        opacity={signal.done ? 0.58 : 0.9}
        frost={signal.type === 'note' ? Math.min(0.09, plasma.frost * 0.08 + 0.01) : 0.01}
        elevation={signal.pinned ? 0.86 : 0.62}
        lean={18}
        radius={signal.type === 'spark' ? 38 : 30}
        padding={16}
        style={{ width: 258, height: 170, position: 'absolute', left: 0, top: 0 }}
      >
        <SignalSurfaceContent signal={signal} incidents={incidents} onUpdate={onUpdate} onDelete={onDelete}/>
      </Plasma>;
    })}
  </PlasmaProvider>;
}

function MatterBoard({
  signals,
  incidents,
  compact,
  layout,
  layoutScope,
  stage,
  plasma,
  onLayout,
  onUpdate,
  onDelete,
}: {
  signals: Signal[];
  incidents: Incident[];
  compact: boolean;
  layout: Layout;
  layoutScope: string;
  stage: RefObject<HTMLDivElement | null>;
  plasma: PlasmaController;
  onLayout: (id: string, next: Offset) => void;
  onUpdate: (id: string, changes: Partial<Signal>) => void;
  onDelete: (signal: Signal) => void;
}) {
  const momentum = useRef(new Map<string, PointerMomentum>());
  const [joinedIds, setJoinedIds] = useState<Set<string>>(() => new Set());
  const settings = loadM6Settings();
  const matterQuality = compact ? 0.5 : settings.spatialFx === 'full' ? 0.9 : settings.spatialFx === 'reduced' ? 0.5 : 0.72;
  const matterBudget = compact ? 5 : settings.spatialFx === 'full' ? 10 : settings.spatialFx === 'reduced' ? 6 : 8;
  const matterPointerPull = settings.spatialFx !== 'reduced' && !settings.reduceMotion;
  const rememberPointer = (id: string, event: ReactPointerEvent) => {
    const previous = momentum.current.get(id);
    momentum.current.set(id, previous ? sampleMomentum(previous, event.clientX, event.clientY) : beginMomentum(event.clientX, event.clientY));
  };
  const settle = (id: string, next: Offset) => {
    const rect = stage.current?.getBoundingClientRect();
    const target = momentumTarget(next, momentum.current.get(id), rect, { width: 258, height: 170 }, 190);
    momentum.current.delete(id);
    onLayout(id, target);
  };

  const grouped = useMemo(() => {
    const map = new Map<MatterMaterial, Signal[]>();
    signals.forEach(signal => {
      const material = signalMaterial(signal, plasma);
      const current = map.get(material) ?? [];
      current.push(signal);
      map.set(material, current);
    });
    return map;
  }, [
    signals,
    plasma.matterMap.spark,
    plasma.matterMap.task,
    plasma.matterMap.note,
    plasma.matterMap.link,
    plasma.matterMap.doneTask,
  ]);

  return <>
    {[...grouped.entries()].map(([material, materialSignals]) => {
      const physics = MATERIAL_PHYSICS[material];
      return <PlasmaProvider
        key={material}
        mood={plasma.look === 'afterglow' ? 'tidal' : plasma.look === 'pink-riot' ? 'ember' : 'aurora'}
        theme="dark"
        material={material}
        tint={plasma.look === 'afterglow' ? '#8b5cf6' : '#ff2aa3'}
        background="#06070a"
        opacity={material === 'crystal' ? 0.66 : material === 'cloud' ? 0.62 : 0.9}
        frost={material === 'plasma' || material === 'crystal' ? Math.min(0.26, plasma.frost * 0.3) : 0}
        blend={physics.blend}
        viscosity={physics.viscosity}
        stretch={physics.stretch}
        thickness={physics.thickness}
        tension={physics.tension}
        radius={physics.radius}
        edge={physics.edge}
        edgeScale={physics.edgeScale}
        edgeSharpness={physics.edgeSharpness}
        roughness={physics.roughness}
        anisotropy={physics.anisotropy}
        lightDir={[-0.42, -0.62, 0.66]}
        elevation={material === 'cloud' ? 0 : 0.42}
        rimColor="iridescent"
        rimWidth={material === 'metal' || material === 'stone' ? 0.7 : 1.1}
        highlight={material === 'metal' || material === 'crystal' ? 1.25 : 0.9}
        shimmer={material === 'plasma' || material === 'crystal' ? 1.2 : 0.4}
        glow={material === 'cloud' ? 1.0 : 1.18}
        wash={0.72}
        grain={material === 'stone' || material === 'wood' ? 0.62 : 0.16}
        grid={24}
        magnet={48}
        quality={matterQuality}
        maxSurfaces={Math.max(1, Math.min(materialSignals.length, matterBudget))}
        pointerDrop={false}
        pointerPull={matterPointerPull}
        ambientDrops={false}
        ground="clear"
        zIndex={18}
      >
        {materialSignals.map(signal => {
          const offset = layout[signal.id] ?? { x: 18, y: 18 };
          return <Plasma
            key={signal.id}
            className={`xf-plasma-note xf-matter-note material-${material} type-${signal.type} ${signal.done ? 'done' : ''} ${joinedIds.has(signal.id) ? 'is-fused' : ''}`}
            draggable
            snap
            fuse
            bounds={stage}
            group={`${layoutScope}:${material}`}
            offset={offset}
            onPointerDownCapture={event => momentum.current.set(signal.id, beginMomentum(event.clientX, event.clientY))}
            onPointerMoveCapture={event => rememberPointer(signal.id, event)}
            onDragEnd={next => settle(signal.id, next)}
            onJoinChange={joined => setJoinedIds(current => { const next = new Set(current); if (joinedAny(joined)) next.add(signal.id); else next.delete(signal.id); return next; })}
            tint={typeTint[plasma.look][signal.type]}
            opacity={signal.done ? 0.58 : material === 'metal' ? 0.94 : material === 'stone' ? 0.96 : material === 'wood' ? 0.92 : material === 'crystal' ? 0.7 : material === 'cloud' ? 0.66 : 0.9}
            frost={material === 'crystal' ? Math.min(0.28, plasma.frost * 0.32 + 0.03) : material === 'plasma' ? Math.min(0.18, plasma.frost * 0.22) : 0}
            elevation={signal.pinned ? 0.74 : material === 'cloud' ? 0.12 : 0.42}
            radius={physics.radius}
            padding={16}
            style={{ width: 258, height: 170, position: 'absolute', left: 0, top: 0 }}
          >
            <SignalSurfaceContent signal={signal} incidents={incidents} material={material} onUpdate={onUpdate} onDelete={onDelete}/>
          </Plasma>;
        })}
      </PlasmaProvider>;
    })}
  </>;
}

export default function PlasmaSignalWorkspace({
  signals,
  incidents,
  selectedIncidentId,
  query,
  onQueryChange,
  onUpdate,
  onDelete,
  plasma,
  onBundle,
}: PlasmaSignalWorkspaceProps) {
  const stage = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState<Layout>({});
  const [scope, setScope] = useState<'incident' | 'all'>(selectedIncidentId ? 'incident' : 'all');
  const [compact, setCompact] = useState(() => typeof window !== 'undefined' && window.matchMedia('(max-width: 700px)').matches);

  const filtered = useMemo(() => signals.filter(signal => {
    if (query && !`${signal.text} ${signal.type}`.toLowerCase().includes(query.toLowerCase())) return false;
    if (plasma.active && scope === 'incident' && selectedIncidentId && signal.incidentId !== selectedIncidentId) return false;
    return true;
  }), [signals, query, plasma.active, scope, selectedIncidentId]);

  const settings = loadM6Settings();
  const plasmaCap = compact ? 5 : settings.spatialFx === 'full' ? 14 : settings.spatialFx === 'reduced' ? 7 : 10;
  const matterCap = compact ? 5 : settings.spatialFx === 'full' ? 10 : settings.spatialFx === 'reduced' ? 6 : 8;
  const visibleSignals = useMemo(() => filtered.slice(0, plasma.mode === 'matter' ? matterCap : plasmaCap), [filtered, matterCap, plasmaCap, plasma.mode]);
  // Global mode; spatial arrangements still belong to the Incident being viewed.
  const layoutScope = scope === 'all' ? 'all-signals' : selectedIncidentId ?? 'unrouted';
  const spatialMode = plasma.mode === 'matter' ? 'matter' : 'plasma';

  useEffect(() => {
    if (!selectedIncidentId) setScope('all');
  }, [selectedIncidentId]);

  useEffect(() => {
    const media = window.matchMedia('(max-width: 700px)');
    const sync = () => setCompact(media.matches);
    sync();
    media.addEventListener?.('change', sync);
    return () => media.removeEventListener?.('change', sync);
  }, []);

  useEffect(() => {
    if (!plasma.active) return;
    setLayout(loadLayout(spatialMode, layoutScope, visibleSignals));
  }, [layoutScope, spatialMode, plasma.active]);

  useEffect(() => {
    if (!plasma.active || !Object.keys(layout).length) return;
    try { localStorage.setItem(layoutKey(spatialMode, layoutScope), JSON.stringify(layout)); } catch { /* device-local enhancement only */ }
  }, [layout, layoutScope, spatialMode, plasma.active]);

  function resetLayout() {
    const next = homeLayout(visibleSignals);
    setLayout(next);
    try { localStorage.setItem(layoutKey(spatialMode, layoutScope), JSON.stringify(next)); } catch { /* device-local enhancement only */ }
  }

  const status = plasma.active
    ? `${plasma.mode === 'matter' ? 'MATTER' : 'PLASMA'} // ${plasma.policy === 'remember' ? 'UNTIL OFF' : plasma.policy === '30m' ? '30 MIN WINDOW' : 'THIS SESSION'}`
    : 'STANDARD MODE';

  return <section className="xf-page plasma-signal-workspace">
    <div className="xf-section-head plasma-section-head">
      <div><span className="kicker">SIGNAL //</span><h1>{plasma.mode === 'matter' ? 'THOUGHTS HAVE WEIGHT NOW.' : plasma.mode === 'plasma' ? 'LET THE THOUGHTS TOUCH.' : "DON'T ORGANIZE IT YET."}</h1><p>{plasma.mode === 'matter' ? 'Tasks cut like metal. Notes refract like crystal. Sparks drift like cloud. Same data, but the material tells you what kind of thing you are touching.' : plasma.mode === 'plasma' ? 'Same notes. Same tasks. Different physics. Drag related thoughts together and let surface tension become temporary organization.' : 'Capture first. Route, convert, pin, and finish it when the thought survives contact with reality.'}</p></div>
      <div className="plasma-page-state" aria-label="Spatial mode status"><small>GLOBAL DISPLAY //</small><b>{status}</b><span>Use the NORMAL / PLASMA / MATTER control in the top bar from any room.</span></div>
    </div>

    <div className="signal-toolbar plasma-toolbar">
      <Search size={14}/><input value={query} placeholder="FILTER THE LEAK..." onChange={event => onQueryChange(event.target.value)}/><span>{signals.length} TOTAL</span>
      {plasma.active && <><button className={scope === 'incident' ? 'active' : ''} disabled={!selectedIncidentId} onClick={() => setScope('incident')}>CURRENT INCIDENT</button><button className={scope === 'all' ? 'active' : ''} onClick={() => setScope('all')}>ALL SIGNALS</button></>}
    </div>

    {plasma.mode === 'normal' ? <NormalSignalList signals={filtered} incidents={incidents} onUpdate={onUpdate} onDelete={onDelete}/> : <>
      <div className={`plasma-controls ${plasma.mode === 'matter' ? 'matter-controls' : ''}`}>
        <div className="plasma-control-group"><span>KEEP IT ON //</span>{(['session', '30m', 'remember'] as PlasmaPolicy[]).map(policy => <button key={policy} className={plasma.policy === policy ? 'active' : ''} onClick={() => plasma.setPolicy(policy)}>{policy === 'session' ? 'THIS SESSION' : policy === '30m' ? '30 MIN' : 'UNTIL OFF'}</button>)}</div>
        <div className="plasma-control-group"><span>LOOK //</span>{(['neon-x', 'pink-riot', 'afterglow'] as PlasmaLook[]).map(look => <button key={look} className={plasma.look === look ? 'active' : ''} onClick={() => plasma.setLook(look)}>{look === 'neon-x' ? 'NEON X' : look === 'pink-riot' ? 'PINK RIOT' : 'AFTERGLOW'}</button>)}</div>
        {plasma.mode === 'plasma' ? <>
          <label><span>FROST {Math.round(plasma.frost * 100)}%</span><input type="range" min="0" max="0.75" step="0.05" value={plasma.frost} onChange={event => plasma.setFrost(Number(event.target.value))}/></label>
          <label><span>FUSION {Math.round(plasma.blend)}px</span><input type="range" min="8" max="52" step="2" value={plasma.blend} onChange={event => plasma.setBlend(Number(event.target.value))}/></label>
        </> : <div className="matter-map" data-plasma-nodrag>
          <span>MATTER MAP //</span>
          {MATTER_SLOTS.map(({ slot, label }) => <label key={slot}>{label}<select value={plasma.matterMap[slot]} onChange={event => plasma.setMatterMaterial(slot, event.target.value as MatterMaterial)}>{MATERIAL_OPTIONS.map(material => <option key={material} value={material}>{material.toUpperCase()}</option>)}</select></label>)}
          <button onClick={plasma.resetMatterMap}><RotateCcw size={10}/> DEFAULT MATTER</button>
        </div>}
        <button className="plasma-reset" onClick={resetLayout}><RotateCcw size={11}/> RESET LAYOUT</button>
      </div>

      <div ref={stage} className={`xf-plasma-stage ${plasma.mode === 'matter' ? 'xf-matter-stage' : ''}`}>
        <div className="xf-plasma-hint">{plasma.mode === 'matter' ? 'LIKE MATTER FUSES // UNLIKE MATTER STAYS DISTINCT // ALL OF IT STILL SNAPS TO THE GRID' : 'DRAG UNTIL THEY TOUCH // PROXIMITY IS TEMPORARY ORGANIZATION'}</div>
        {plasma.mode === 'plasma' ? <LiquidBoard signals={visibleSignals} incidents={incidents} compact={compact} layout={layout} layoutScope={layoutScope} stage={stage} plasma={plasma} onLayout={(id, next) => setLayout(current => ({ ...current, [id]: next }))} onUpdate={onUpdate} onDelete={onDelete} onBundle={onBundle}/> : <MatterBoard signals={visibleSignals} incidents={incidents} compact={compact} layout={layout} layoutScope={layoutScope} stage={stage} plasma={plasma} onLayout={(id, next) => setLayout(current => ({ ...current, [id]: next }))} onUpdate={onUpdate} onDelete={onDelete}/>} 
        {filtered.length > visibleSignals.length && <div className="xf-plasma-overflow">SHOWING {visibleSignals.length} OF {filtered.length} // FILTER TO REDUCE GPU LOAD</div>}
      </div>
    </>}
  </section>;
}
