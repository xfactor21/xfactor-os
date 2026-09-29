import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import type { Offset } from '@cruxgarden/plasma-ui';
import type { PlasmaController } from './plasmaMode';
import { SpatialSurface } from './TrueSpatial';

type ItemLike={id:string};
type PositionMap=Record<string,Offset>;

function key(roomKey:string){return `xfactor-m6-organizer-v1:${roomKey}`;}
function load(roomKey:string):PositionMap{try{return JSON.parse(localStorage.getItem(key(roomKey))||'{}') as PositionMap}catch{return {}}}
function save(roomKey:string,value:PositionMap){try{localStorage.setItem(key(roomKey),JSON.stringify(value))}catch{/* local presentation only */}}

function defaults<T extends ItemLike>(items:T[],width:number,height:number,gap:number,columns:number):PositionMap{
  return Object.fromEntries(items.map((item,index)=>[item.id,{
    x:24+(index%columns)*(width+gap),
    y:24+Math.floor(index/columns)*(height+gap),
  }]));
}

export default function SpatialOrganizer<T extends ItemLike>({
  items,
  roomKey,
  plasma,
  renderItem,
  width=280,
  height=210,
  gap=72,
  columns=3,
  fuse=true,
  onBundle,
  className='',
  ariaLabel='Freeform organizer',
}:{
  items:T[];
  roomKey:string;
  plasma:PlasmaController;
  renderItem:(item:T)=>ReactNode;
  width?:number;
  height?:number;
  gap?:number;
  columns?:number;
  fuse?:boolean;
  onBundle?:(a:string,b:string)=>void;
  className?:string;
  ariaLabel?:string;
}){
  const stage=useRef<HTMLDivElement>(null);
  const drag=useRef<{id:string;pointerId:number;ox:number;oy:number;start:Offset}|null>(null);
  const [positions,setPositions]=useState<PositionMap>(()=>load(roomKey));
  const home=useMemo(()=>defaults(items,width,height,gap,columns),[items,width,height,gap,columns]);
  const merged=useMemo(()=>Object.fromEntries(items.map(item=>[item.id,positions[item.id]??home[item.id]])),[items,positions,home]);
  const rows=Math.max(1,Math.ceil(items.length/columns));
  const stageHeight=Math.max(440,48+rows*(height+gap));

  useEffect(()=>{setPositions(current=>({...home,...current}));},[roomKey,home]);
  useEffect(()=>save(roomKey,positions),[roomKey,positions]);

  function nearest(id:string,next:Offset){
    const center={x:next.x+width/2,y:next.y+height/2};
    return items
      .filter(item=>item.id!==id)
      .map(item=>{
        const p=merged[item.id]??home[item.id];
        const d=Math.hypot(center.x-(p.x+width/2),center.y-(p.y+height/2));
        return {id:item.id,d};
      })
      .filter(hit=>hit.d<Math.max(width,height)+Math.max(48,plasma.blend))
      .sort((a,b)=>a.d-b.d)[0]?.id;
  }

  function settle(id:string,next:Offset){
    setPositions(current=>({...current,[id]:next}));
    if(plasma.mode==='plasma'&&fuse&&onBundle){
      const other=nearest(id,next);
      if(other)onBundle(id,other);
    }
  }

  function pointerDown(event:ReactPointerEvent,id:string){
    if(plasma.mode!=='normal')return;
    const target=event.target as HTMLElement;
    if(target.closest('button,input,textarea,select,a,[contenteditable="true"]'))return;
    const p=merged[id]??home[id];
    drag.current={id,pointerId:event.pointerId,ox:event.clientX,oy:event.clientY,start:p};
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  }
  function pointerMove(event:ReactPointerEvent){
    const d=drag.current;if(!d||d.pointerId!==event.pointerId)return;
    const rect=stage.current?.getBoundingClientRect();if(!rect)return;
    const next={
      x:Math.max(8,Math.min(rect.width-width-8,d.start.x+(event.clientX-d.ox))),
      y:Math.max(8,Math.min(rect.height-height-8,d.start.y+(event.clientY-d.oy))),
    };
    setPositions(current=>({...current,[d.id]:next}));
  }
  function pointerUp(event:ReactPointerEvent){
    const d=drag.current;if(!d||d.pointerId!==event.pointerId)return;
    drag.current=null;
  }

  return <div
    ref={stage}
    className={`xf-spatial-organizer ${className}`}
    style={{minHeight:stageHeight}}
    aria-label={ariaLabel}
    onPointerMove={pointerMove}
    onPointerUp={pointerUp}
    onPointerCancel={pointerUp}
  >
    {items.map(item=>{
      const pos=merged[item.id]??home[item.id];
      if(plasma.mode==='normal')return <div key={item.id} className="xf-organizer-normal" style={{left:pos.x,top:pos.y,width,minHeight:height}} onPointerDown={event=>pointerDown(event,item.id)}>
        <div className="xf-organizer-grab">⠿ MOVE</div>{renderItem(item)}
      </div>;
      return <SpatialSurface
        key={item.id}
        className="xf-organizer-spatial"
        group={roomKey}
        draggable
        snap
        fuse={fuse}
        bounds={stage}
        offset={pos}
        onDragEnd={(next:Offset)=>settle(item.id,next)}
        radius={plasma.mode==='plasma'?30:12}
        style={{width,minHeight:height,position:'absolute',left:0,top:0}}
      >
        <div className="xf-organizer-grab">⠿ {plasma.mode==='plasma'?'THROW / FUSE':'MOVE'}</div>{renderItem(item)}
      </SpatialSurface>;
    })}
  </div>;
}
