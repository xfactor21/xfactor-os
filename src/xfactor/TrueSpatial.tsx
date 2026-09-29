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

  if (plasma.mode === 'normal' || room === 'signal' || room === 'browser') {
    return <SpatialContext.Provider value={value}>{children}</SpatialContext.Provider>;
  }

  const material: MaterialName = plasma.mode === 'matter' ? ROOM_MATERIAL[room as Exclude<SpatialRoom,'signal'|'browser'>] : 'plasma';
  const matter = plasma.mode === 'matter';
  const quality = document.documentElement.dataset.xfSpatialQuality === 'high' ? 1.08 : document.documentElement.dataset.xfSpatialQuality === 'performance' ? 0.72 : 0.9;

  return <SpatialContext.Provider value={value}>
    <PlasmaProvider
      key={`${plasma.mode}:${room}:${plasma.look}`}
      mood={plasma.look === 'afterglow' ? 'tidal' : plasma.look === 'pink-riot' ? 'ember' : 'aurora'}
      theme="dark"
      material={material}
      tint={tintFor(plasma)}
      opacity={matter ? 0.7 : 0.62}
      frost={matter ? (material === 'crystal' ? 0.20 : 0.025) : 0.035}
      blend={matter ? 18 : Math.max(34, plasma.blend)}
      viscosity={matter ? 0.48 : 0.10}
      stretch={matter ? 0.38 : 2.75}
      flow={matter ? 0.06 : 0.74}
      tension={matter ? 0.12 : 0.26}
      refraction={matter ? 1.22 : 1.62}
      dispersion={matter ? 1.12 : 1.46}
      rimColor="iridescent"
      rimWidth={matter ? 0.95 : 1.85}
      highlight={matter ? 1.12 : 1.62}
      edgeLine={matter ? 0.65 : 1.05}
      shimmer={matter ? 0.42 : 1.45}
      shimmerSpeed={matter ? 0.72 : 1.28}
      glow={matter ? 0.95 : 1.55}
      wash={matter ? 0.66 : 0.82}
      grain={0.12}
      grid={24}
      magnet={matter ? 34 : 46}
      quality={quality}
      maxSurfaces={24}
      pointerDrop={false}
      pointerPull
      ambientDrops={false}
      ground="clear"
      formIn
      formSpeed={1.8}
      formOut
      freezeOnScroll
      zIndex={18}
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
    lean={mode === 'plasma' ? 12 : 4}
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
