import { createContext, createElement, useContext, useEffect, useMemo, useRef, useState, type CSSProperties, type ElementType, type HTMLAttributes, type ReactNode } from 'react';
import { Plasma, PlasmaProvider, type Offset } from '@cruxgarden/plasma-ui';
import type { PlasmaController, SpatialMode } from './plasmaMode';

export type SpatialRoom = 'deck' | 'piles' | 'signal' | 'vault' | 'tape' | 'terminal' | 'files' | 'browser' | 'lab';

type MaterialName = 'plasma' | 'crystal' | 'metal' | 'wood' | 'stone' | 'cloud';

const ROOM_MATERIAL: Record<Exclude<SpatialRoom, 'signal' | 'browser'>, MaterialName> = {
  deck: 'metal',
  piles: 'stone',
  vault: 'crystal',
  tape: 'wood',
  terminal: 'metal',
  files: 'crystal',
  lab: 'plasma',
};

const ROOM_BLEND: Record<Exclude<SpatialRoom, 'signal' | 'browser'>, number> = {
  deck: 20,
  piles: 11,
  vault: 14,
  tape: 9,
  terminal: 7,
  files: 10,
  lab: 12,
};

const PlasmaSurface = Plasma as any;

type SpatialContextValue={
  mode:SpatialMode;
  room:SpatialRoom;
  reportJoin:(id:string,joined:boolean)=>void;
};
const SpatialContext = createContext<SpatialContextValue>({ mode: 'normal', room: 'deck', reportJoin:()=>{} });

function tintFor(plasma: PlasmaController) {
  if (plasma.look === 'afterglow') return '#8b5cf6';
  if (plasma.look === 'pink-riot') return '#ff238d';
  return '#ff2aa3';
}

function layoutKey(room:SpatialRoom){return `xfactor-spatial-room-layout-v2:${room}`;}
function readLayout(room:SpatialRoom):Record<string,Offset>{
  try{const parsed=JSON.parse(localStorage.getItem(layoutKey(room))||'{}');return parsed&&typeof parsed==='object'?parsed:{}}catch{return{}}
}
function defaultOffset(index:number,width:number,height:number):Offset{
  const columns=3;
  return {x:34+(index%columns)*(width+58),y:34+Math.floor(index/columns)*(height+52)};
}

export function SpatialRoomProvider({
  plasma,
  room,
  onFuse,
  children,
}: {
  plasma: PlasmaController;
  room: SpatialRoom;
  onFuse?: (room:SpatialRoom,a:string,b:string)=>void;
  children: ReactNode;
}) {
  const joined=useRef(new Set<string>());
  const reportJoin=(id:string,isJoined:boolean)=>{
    if(!id)return;
    if(!isJoined){joined.current.delete(id);return;}
    const other=[...joined.current].find(candidate=>candidate!==id);
    joined.current.add(id);
    if(other)onFuse?.(room,other,id);
  };
  const value=useMemo(()=>({mode:plasma.mode,room,reportJoin}),[plasma.mode,room,onFuse]);

  // Signal owns its semantic multi-provider renderer; Browser intentionally has no Plasma.
  if (room === 'signal' || room === 'browser') {
    return <SpatialContext.Provider value={value}>{children}</SpatialContext.Provider>;
  }

  const active = plasma.mode !== 'normal';
  const roomKey = room as Exclude<SpatialRoom,'signal'|'browser'>;
  const material: MaterialName = plasma.mode === 'matter' ? ROOM_MATERIAL[roomKey] : 'plasma';
  const matter = plasma.mode === 'matter';
  const quality = document.documentElement.dataset.xfSpatialQuality === 'high' ? 1.02 : document.documentElement.dataset.xfSpatialQuality === 'performance' ? 0.66 : 0.84;
  const roomBlend = ROOM_BLEND[roomKey];

  return <SpatialContext.Provider value={value}>
    <PlasmaProvider
      mood={plasma.look === 'afterglow' ? 'tidal' : plasma.look === 'pink-riot' ? 'ember' : 'aurora'}
      theme="dark"
      material={material}
      background="#07020a"
      tint={tintFor(plasma)}
      opacity={!active ? 0 : matter ? 0.78 : 0.86}
      frost={!active ? 0 : matter ? (material === 'crystal' ? 0.18 : 0.02) : 0.025}
      blend={!active ? roomBlend : matter ? Math.max(7, roomBlend - 2) : roomBlend}
      viscosity={!active ? 0.5 : matter ? 0.46 : 0.06}
      stretch={!active ? 0 : matter ? 0.42 : 4.4}
      flow={!active ? 0 : matter ? 0.08 : 1.16}
      tension={!active ? 0 : matter ? 0.14 : 0.36}
      refraction={!active ? 1 : matter ? 1.3 : 2.02}
      dispersion={!active ? 1 : matter ? 1.18 : 1.82}
      rimColor="iridescent"
      rimWidth={!active ? 0 : matter ? 0.72 : 0.82}
      highlight={!active ? 0 : matter ? 1.2 : 1.82}
      edgeLine={!active ? 0 : matter ? 0.5 : 0.3}
      shimmer={!active ? 0 : matter ? 0.62 : 2.05}
      shimmerSpeed={matter ? 0.78 : 1.42}
      glow={!active ? 0 : matter ? 1.12 : 2.0}
      wash={!active ? 0 : matter ? 0.72 : 1.04}
      grain={active ? 0.08 : 0}
      grid={24}
      magnet={matter ? 30 : 38}
      quality={quality}
      maxSurfaces={16}
      pointerDrop={false}
      pointerPull={active}
      ambientDrops={false}
      ground="clear"
      formIn={false}
      formOut={false}
      freezeOnScroll
      zIndex={active ? 8 : -40}
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
  free = false,
  index = 0,
  freeWidth = 280,
  freeHeight = 190,
  style,
  onSpatialMove,
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
  free?: boolean;
  index?: number;
  freeWidth?: number;
  freeHeight?: number;
  onSpatialMove?: (offset:Offset)=>void;
}) {
  const { mode,room,reportJoin } = useContext(SpatialContext);
  const [layout,setLayout]=useState<Record<string,Offset>>(()=>readLayout(room));
  useEffect(()=>setLayout(readLayout(room)),[room]);
  const classes = ['xf-true-spatial', free && mode!=='normal' ? 'xf-spatial-free' : '', className].filter(Boolean).join(' ');
  const id=spatialId||'';
  const offset=id?(layout[id]??defaultOffset(index,freeWidth,freeHeight)):undefined;

  if (mode === 'normal') {
    return createElement(as, { ...rest, className, style }, children);
  }

  const spatialStyle:CSSProperties=free
    ? {...style,position:'absolute',left:0,top:0,width:freeWidth,minHeight:freeHeight}
    : style as CSSProperties;

  return <PlasmaSurface
    as={as}
    className={classes}
    draggable={free}
    snap={free}
    fuse={free ? (fuse ?? true) : (fuse ?? false)}
    group={group}
    offset={free ? offset : undefined}
    onDragEnd={free && id ? (next:Offset)=>{
      const updated={...layout,[id]:next};setLayout(updated);
      try{localStorage.setItem(layoutKey(room),JSON.stringify(updated))}catch{/* device local */}
      onSpatialMove?.(next);
    }:undefined}
    onJoinChange={free&&id?(joined:boolean)=>reportJoin(id,joined):undefined}
    lean={mode === 'plasma' ? 18 : 5}
    radius={radius ?? (mode === 'plasma' ? 28 : 10)}
    padding={0}
    tint={tint}
    elevation={elevation ?? (mode === 'plasma' ? 0.50 : 0.40)}
    style={spatialStyle}
    data-spatial-id={id||undefined}
    {...rest}
  >
    {children}
  </PlasmaSurface>;
}
