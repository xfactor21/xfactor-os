import { createContext, createElement, useContext, useEffect, useState, type ElementType, type HTMLAttributes, type ReactNode } from 'react';
import { Plasma, PlasmaProvider, type Offset } from '@cruxgarden/plasma-ui';
import type { PlasmaController, SpatialMode } from './plasmaMode';
import { loadM6Settings } from './m6Settings';

export type SpatialRoom = 'deck' | 'piles' | 'signal' | 'vault' | 'tape' | 'fabrix' | 'terminal' | 'studio' | 'files' | 'browser' | 'settings';

type MaterialName = 'plasma' | 'crystal' | 'metal' | 'wood' | 'stone' | 'cloud';

const ROOM_MATERIAL: Record<'deck'|'piles'|'vault'|'tape'|'fabrix'|'terminal'|'studio', MaterialName> = {
  deck: 'metal',
  piles: 'stone',
  vault: 'crystal',
  tape: 'wood',
  fabrix: 'crystal',
  terminal: 'metal',
  studio: 'crystal',
};

const ROOM_BLEND: Record<'deck'|'piles'|'vault'|'tape'|'fabrix'|'terminal'|'studio', number> = {
  deck: 20,
  piles: 5,
  vault: 12,
  tape: 6,
  fabrix: 10,
  terminal: 7,
  studio: 9,
};

const PlasmaSurface = Plasma as any;

const SpatialContext = createContext<{ mode: SpatialMode; room: SpatialRoom }>({ mode: 'normal', room: 'deck' });

function tintFor(plasma: PlasmaController) {
  if (plasma.look === 'afterglow') return '#8b5cf6';
  if (plasma.look === 'pink-riot') return '#ff238d';
  return '#ff2aa3';
}

function offsetKey(room: SpatialRoom, mode: SpatialMode, id: string) {
  return `xfactor-spatial-offset-v1:${room}:${mode}:${id}`;
}
function readOffset(room: SpatialRoom, mode: SpatialMode, id?: string): Offset {
  if (!id || mode === 'normal') return {x:0,y:0};
  try {
    const raw=localStorage.getItem(offsetKey(room,mode,id));
    if (!raw) return {x:0,y:0};
    const value=JSON.parse(raw) as Offset;
    return Number.isFinite(value.x)&&Number.isFinite(value.y)?value:{x:0,y:0};
  } catch { return {x:0,y:0}; }
}
function nearestSpatialNeighbor(room: SpatialRoom, id: string, source: HTMLElement): string | undefined {
  const own=source.getBoundingClientRect();
  const cx=own.left+own.width/2, cy=own.top+own.height/2;
  const candidates=[...document.querySelectorAll<HTMLElement>(`[data-spatial-room="${room}"][data-spatial-id]`)]
    .filter(node=>node.dataset.spatialId && node.dataset.spatialId!==id);
  return candidates.map(node=>{
    const rect=node.getBoundingClientRect();
    return {id:node.dataset.spatialId!,distance:Math.hypot((rect.left+rect.width/2)-cx,(rect.top+rect.height/2)-cy)};
  }).sort((a,b)=>a.distance-b.distance)[0]?.id;
}

export function SpatialRoomProvider({
  plasma,
  room,
  children,
}: {
  plasma: PlasmaController;
  room: SpatialRoom;
  children: ReactNode;
}) {
  const value = { mode: plasma.mode, room };

  // Signal owns its specialized renderer. Files/Browser/Settings intentionally
  // stay conventional. Planning surfaces keep ONE provider warm in NORMAL so
  // switching to Plasma does not tear down/recreate the WebGL shader graph.
  // Workbench is the exception: in NORMAL, keep its CodeMirror/WebContainer
  // runtime free from an invisible WebGL field; Plasma/Matter mounts it on demand.
  const conventionalNormalRoom = room === 'terminal' && plasma.mode === 'normal';
  if (room === 'signal' || room === 'files' || room === 'browser' || room === 'settings' || conventionalNormalRoom) {
    return <SpatialContext.Provider value={value}>{children}</SpatialContext.Provider>;
  }

  const spatialRoom = room as 'deck'|'piles'|'vault'|'tape'|'fabrix'|'terminal'|'studio';
  const prewarm = plasma.mode === 'normal';
  const material: MaterialName = plasma.mode === 'matter' ? ROOM_MATERIAL[spatialRoom] : 'plasma';
  const matter = plasma.mode === 'matter';
  const blend = matter ? Math.max(3, ROOM_BLEND[spatialRoom]-2) : ROOM_BLEND[spatialRoom];
  const settings = loadM6Settings();
  const quality = settings.spatialFx === 'full' ? 1.04 : settings.spatialFx === 'reduced' ? 0.62 : 0.82;
  const maxSurfaces = settings.spatialFx === 'full' ? 16 : settings.spatialFx === 'reduced' ? 7 : 10;
  const pointerPull = settings.spatialFx !== 'reduced' && !settings.reduceMotion;

  return <SpatialContext.Provider value={value}>
    <PlasmaProvider
      mood={plasma.look === 'afterglow' ? 'tidal' : plasma.look === 'pink-riot' ? 'ember' : 'aurora'}
      theme="dark"
      material={material}
      tint={tintFor(plasma)}
      background={matter ? '#05070a' : '#07020a'}
      opacity={prewarm ? 0 : matter ? 0.84 : 0.86}
      frost={matter ? (material === 'crystal' ? 0.2 : 0.03) : 0.035}
      blend={blend}
      viscosity={matter ? 0.42 : 0.1}
      stretch={matter ? 0.72 : 4.35}
      flow={matter ? 0.18 : 1.18}
      tension={matter ? 0.1 : 0.36}
      refraction={matter ? 1.28 : 1.78}
      dispersion={matter ? 1.16 : 1.58}
      rimColor="iridescent"
      rimWidth={matter ? 0.9 : 0.82}
      highlight={matter ? 1.25 : 1.8}
      edgeLine={matter ? 0.62 : 0.34}
      shimmer={matter ? 0.55 : 1.72}
      shimmerSpeed={matter ? 0.8 : 1.42}
      glow={matter ? 1.05 : 1.8}
      wash={matter ? 0.7 : 0.9}
      grain={0.1}
      grid={24}
      magnet={matter ? 24 : 30}
      quality={quality}
      maxSurfaces={maxSurfaces}
      pointerDrop={false}
      pointerPull={!prewarm && pointerPull}
      ambientDrops={false}
      ground="clear"
      zIndex={8}
      formIn={false}
      formOut={false}
    >
      {children}
    </PlasmaProvider>
  </SpatialContext.Provider>;
}

export function SpatialSurface({
  as = 'div',
  className,
  children,
  fuse,
  group,
  radius,
  tint,
  elevation,
  spatialId,
  spatialDraggable = false,
  onSpatialJoin,
  ...rest
}: HTMLAttributes<HTMLElement> & {
  as?: ElementType;
  children?: ReactNode;
  fuse?: boolean;
  group?: string;
  radius?: number;
  tint?: string;
  elevation?: number;
  spatialId?: string;
  spatialDraggable?: boolean;
  onSpatialJoin?: (otherId: string) => void;
}) {
  const { mode, room } = useContext(SpatialContext);
  const [offset,setOffset]=useState<Offset>(()=>readOffset(room,mode,spatialId));
  useEffect(() => {
    setOffset(readOffset(room, mode, spatialId));
  }, [room, mode, spatialId]);
  const classes = ['xf-true-spatial', className].filter(Boolean).join(' ');

  if (mode === 'normal') {
    return createElement(as, { ...rest, className }, children);
  }

  return <PlasmaSurface
    as={as}
    className={classes}
    fuse={fuse ?? true}
    group={group ?? `room:${room}`}
    lean={mode === 'plasma' ? 15 : 5}
    radius={radius ?? (mode === 'plasma' ? 28 : 10)}
    padding={0}
    tint={tint}
    elevation={elevation ?? (mode === 'plasma' ? 0.58 : 0.42)}
    draggable={spatialDraggable}
    snap={spatialDraggable}
    offset={spatialDraggable ? offset : undefined}
    onDragEnd={spatialDraggable ? ((next:Offset)=>{
      setOffset(next);
      if(spatialId)try{localStorage.setItem(offsetKey(room,mode,spatialId),JSON.stringify(next));}catch{/* enhancement only */}
    }) : undefined}
    onJoinChange={spatialId&&onSpatialJoin ? ((joined:boolean)=>{
      if(!joined)return;
      const source=document.querySelector<HTMLElement>(`[data-spatial-room="${room}"][data-spatial-id="${CSS.escape(spatialId)}"]`);
      if(!source)return;
      const other=nearestSpatialNeighbor(room,spatialId,source);
      if(other)onSpatialJoin(other);
    }) : undefined}
    formIn={false}
    formOut={false}
    data-spatial-id={spatialId}
    data-spatial-room={room}
    {...rest}
  >
    <div className="xf-spatial-content">{children}</div>
  </PlasmaSurface>;
}
