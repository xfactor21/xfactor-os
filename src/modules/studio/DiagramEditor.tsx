import { useEffect, useRef, useState } from 'react';
import type { PointerEvent as RPointerEvent } from 'react';
import Icon from '../../design-system/icons/Icon';

type NodeType = 'process' | 'decision' | 'terminal';
type RouteMode = 'straight' | 'orthogonal';
type Tool = NodeType | 'select' | 'connect';
interface DNode { id:string; type:NodeType; x:number; y:number; w:number; h:number; text:string; fill:string; visible:boolean; locked:boolean; }
interface DEdge { id:string; from:string; to:string; label:string; route:RouteMode; dashed:boolean; }
interface Lane { id:string; label:string; }
interface DiagramDoc { version:2; nodes:DNode[]; edges:DEdge[]; lanes:Lane[]; snap:boolean; grid:number; }

const W = 1040, H = 680;
const DEFAULTS:Record<NodeType,{w:number;h:number;fill:string}> = {
  process:{w:150,h:70,fill:'#1b2536'}, decision:{w:150,h:100,fill:'#2a1b36'}, terminal:{w:140,h:56,fill:'#0f2b2e'}
};
let ids = 0;
const nid = (p:string) => `${p}-${Date.now().toString(36)}-${++ids}`;
const key = (boardId:string) => `xos-studio-diagram2-${boardId}`;
const legacyKey = (boardId:string) => `xos-studio-diagram-${boardId}`;
const blank = ():DiagramDoc => ({version:2,nodes:[],edges:[],lanes:[],snap:true,grid:10});

function normalize(input:Partial<DiagramDoc>):DiagramDoc {
  return {
    version:2,
    nodes:(input.nodes ?? []).map(n => ({...n, visible:n.visible !== false, locked:!!n.locked})),
    edges:(input.edges ?? []).map(e => ({...e, route:e.route ?? 'orthogonal', dashed:!!e.dashed, label:e.label ?? ''})),
    lanes:input.lanes ?? [], snap:input.snap !== false, grid:Math.max(4,Math.min(40,input.grid ?? 10)),
  };
}
function load(boardId:string):DiagramDoc {
  try {
    const current = localStorage.getItem(key(boardId));
    if (current) return normalize(JSON.parse(current) as DiagramDoc);
    const old = localStorage.getItem(legacyKey(boardId));
    if (old) return normalize({...blank(), ...(JSON.parse(old) as object)});
  } catch { /* corrupt storage */ }
  return blank();
}
function snapValue(v:number,d:DiagramDoc){ return d.snap ? Math.round(v/d.grid)*d.grid : v; }
function center(n:DNode):[number,number]{ return [n.x+n.w/2,n.y+n.h/2]; }
function clip(type:NodeType,hw:number,hh:number,dx:number,dy:number){
  if (!dx && !dy) return 0;
  if (type==='decision') { const den=Math.abs(dx)/hw+Math.abs(dy)/hh; return den ? 1/den : 0; }
  return Math.min(dx ? hw/Math.abs(dx) : Infinity, dy ? hh/Math.abs(dy) : Infinity);
}
function ends(a:DNode,b:DNode){
  const [ax,ay]=center(a),[bx,by]=center(b),dx=bx-ax,dy=by-ay;
  const sa=clip(a.type,a.w/2,a.h/2,dx,dy), sb=clip(b.type,b.w/2,b.h/2,-dx,-dy);
  return {x1:ax+dx*sa,y1:ay+dy*sa,x2:bx-dx*sb,y2:by-dy*sb};
}
function pathFor(a:DNode,b:DNode,mode:RouteMode){
  const g=ends(a,b); if(mode==='straight') return `M ${g.x1} ${g.y1} L ${g.x2} ${g.y2}`;
  const mx=(g.x1+g.x2)/2; return `M ${g.x1} ${g.y1} L ${mx} ${g.y1} L ${mx} ${g.y2} L ${g.x2} ${g.y2}`;
}
function xml(s:string){return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}

export default function DiagramEditor({boardId,onExit}:{boardId:string;onExit:()=>void}) {
  const [doc,setDoc] = useState<DiagramDoc>(()=>load(boardId));
  const [tool,setTool] = useState<Tool>('select');
  const [selectedNodes,setSelectedNodes] = useState<string[]>([]);
  const [selectedEdge,setSelectedEdge] = useState<string|null>(null);
  const [connectFrom,setConnectFrom] = useState<string|null>(null);
  const [zoom,setZoom] = useState(1);
  const stageRef = useRef<HTMLDivElement>(null);
  const history = useRef<string[]>([]), future = useRef<string[]>([]);
  const drag = useRef<{ids:string[];start:[number,number];before:string;orig:Record<string,{x:number;y:number}>;resize?:{id:string;w:number;h:number}}|null>(null);

  useEffect(()=>{const t=setTimeout(()=>{try{localStorage.setItem(key(boardId),JSON.stringify(doc));}catch{/* best effort */}},160);return()=>clearTimeout(t);},[doc,boardId]);

  function commit(mutator:(d:DiagramDoc)=>void){
    history.current.push(JSON.stringify(doc)); if(history.current.length>80) history.current.shift(); future.current=[];
    const next=structuredClone(doc); mutator(next); setDoc(normalize(next));
  }
  function undo(){if(!history.current.length)return;future.current.push(JSON.stringify(doc));setDoc(normalize(JSON.parse(history.current.pop()!) as DiagramDoc));}
  function redo(){if(!future.current.length)return;history.current.push(JSON.stringify(doc));setDoc(normalize(JSON.parse(future.current.pop()!) as DiagramDoc));}
  function stagePoint(e:RPointerEvent):[number,number]{const r=stageRef.current?.getBoundingClientRect();if(!r)return[0,0];return[((e.clientX-r.left)/r.width)*W,((e.clientY-r.top)/r.height)*H];}

  function addNode(type:NodeType,x:number,y:number){const d=DEFAULTS[type],node:DNode={id:nid('n'),type,x:snapValue(x-d.w/2,doc),y:snapValue(y-d.h/2,doc),w:d.w,h:d.h,text:type.toUpperCase(),fill:d.fill,visible:true,locked:false};commit(next=>next.nodes.push(node));setSelectedNodes([node.id]);setSelectedEdge(null);setTool('select');}
  function onStageDown(e:RPointerEvent<HTMLDivElement>){if(tool==='process'||tool==='decision'||tool==='terminal'){const[x,y]=stagePoint(e);addNode(tool,x,y);return;}if(e.target===stageRef.current){setSelectedNodes([]);setSelectedEdge(null);}}
  function onNodeDown(e:RPointerEvent<HTMLDivElement>,node:DNode){
    e.stopPropagation();
    if(tool==='connect'){if(!connectFrom)setConnectFrom(node.id);else if(connectFrom!==node.id){commit(d=>d.edges.push({id:nid('e'),from:connectFrom,to:node.id,label:'',route:'orthogonal',dashed:false}));setConnectFrom(null);}return;}
    if(tool!=='select'||node.locked)return;
    const nextSel=e.shiftKey?(selectedNodes.includes(node.id)?selectedNodes.filter(id=>id!==node.id):[...selectedNodes,node.id]):(selectedNodes.includes(node.id)?selectedNodes:[node.id]);
    setSelectedNodes(nextSel);setSelectedEdge(null);const pt=stagePoint(e),orig:Record<string,{x:number;y:number}>={};
    nextSel.forEach(id=>{const n=doc.nodes.find(x=>x.id===id);if(n)orig[id]={x:n.x,y:n.y};});
    drag.current={ids:nextSel,start:pt,before:JSON.stringify(doc),orig};
  }
  function onResizeDown(e:RPointerEvent<HTMLDivElement>,node:DNode){e.stopPropagation();if(node.locked)return;drag.current={ids:[node.id],start:stagePoint(e),before:JSON.stringify(doc),orig:{[node.id]:{x:node.x,y:node.y}},resize:{id:node.id,w:node.w,h:node.h}};}
  function onMove(e:RPointerEvent<HTMLDivElement>){const g=drag.current;if(!g)return;const[x,y]=stagePoint(e),dx=x-g.start[0],dy=y-g.start[1];setDoc(d=>({...d,nodes:d.nodes.map(n=>{if(g.resize?.id===n.id)return{...n,w:Math.max(60,snapValue(g.resize.w+dx,d)),h:Math.max(40,snapValue(g.resize.h+dy,d))};const o=g.orig[n.id];return o?{...n,x:snapValue(o.x+dx,d),y:snapValue(o.y+dy,d)}:n;})}));}
  function onUp(){if(!drag.current)return;history.current.push(drag.current.before);if(history.current.length>80)history.current.shift();future.current=[];drag.current=null;}

  function patchNode(id:string,patch:Partial<DNode>){commit(d=>{d.nodes=d.nodes.map(n=>n.id===id?{...n,...patch}:n);});}
  function patchEdge(id:string,patch:Partial<DEdge>){commit(d=>{d.edges=d.edges.map(e=>e.id===id?{...e,...patch}:e);});}
  function removeSelection(){if(!selectedNodes.length&&!selectedEdge)return;commit(d=>{const idsSet=new Set(selectedNodes);d.nodes=d.nodes.filter(n=>!idsSet.has(n.id));d.edges=selectedEdge?d.edges.filter(e=>e.id!==selectedEdge):d.edges.filter(e=>!idsSet.has(e.from)&&!idsSet.has(e.to));});setSelectedNodes([]);setSelectedEdge(null);}
  function duplicate(){if(!selectedNodes.length)return;const created:string[]=[];commit(d=>{d.nodes.filter(n=>selectedNodes.includes(n.id)).forEach(n=>{const id=nid('n');created.push(id);d.nodes.push({...n,id,x:n.x+20,y:n.y+20,text:`${n.text} copy`});});});setSelectedNodes(created);}

  function align(kind:'left'|'center'|'right'|'top'|'middle'|'bottom'){
    const ns=doc.nodes.filter(n=>selectedNodes.includes(n.id));if(ns.length<2)return;
    const left=Math.min(...ns.map(n=>n.x)),right=Math.max(...ns.map(n=>n.x+n.w)),top=Math.min(...ns.map(n=>n.y)),bottom=Math.max(...ns.map(n=>n.y+n.h)),cx=(left+right)/2,cy=(top+bottom)/2;
    commit(d=>{d.nodes=d.nodes.map(n=>!selectedNodes.includes(n.id)?n:{...n,x:kind==='left'?left:kind==='right'?right-n.w:kind==='center'?cx-n.w/2:n.x,y:kind==='top'?top:kind==='bottom'?bottom-n.h:kind==='middle'?cy-n.h/2:n.y});});
  }
  function distribute(axis:'h'|'v'){
    const ns=doc.nodes.filter(n=>selectedNodes.includes(n.id)).sort((a,b)=>axis==='h'?a.x-b.x:a.y-b.y);if(ns.length<3)return;
    const first=ns[0],last=ns[ns.length-1],span=axis==='h'?last.x-first.x:last.y-first.y;
    commit(d=>{d.nodes=d.nodes.map(n=>{const i=ns.findIndex(x=>x.id===n.id);if(i<=0||i===ns.length-1)return n;return axis==='h'?{...n,x:first.x+span*i/(ns.length-1)}:{...n,y:first.y+span*i/(ns.length-1)};});});
  }
  function autoLayout(){
    if(!doc.nodes.length)return;const indegree=new Map(doc.nodes.map(n=>[n.id,0]));doc.edges.forEach(e=>indegree.set(e.to,(indegree.get(e.to)??0)+1));const q=doc.nodes.filter(n=>(indegree.get(n.id)??0)===0).map(n=>n.id),order:string[]=[],seen=new Set<string>();
    while(q.length){const id=q.shift()!;if(seen.has(id))continue;seen.add(id);order.push(id);doc.edges.filter(e=>e.from===id).forEach(e=>q.push(e.to));}doc.nodes.forEach(n=>{if(!seen.has(n.id))order.push(n.id);});
    commit(d=>{d.nodes=d.nodes.map(n=>{const i=order.indexOf(n.id);return{...n,x:80+(i%4)*225,y:80+Math.floor(i/4)*150};});});
  }

  useEffect(()=>{function onKey(e:KeyboardEvent){const t=e.target as HTMLElement|null;if(t?.matches('input,textarea,select,[contenteditable="true"]'))return;const mod=e.metaKey||e.ctrlKey;if(mod&&e.key.toLowerCase()==='z'){e.preventDefault();e.shiftKey?redo():undo();return;}if(mod&&e.key.toLowerCase()==='y'){e.preventDefault();redo();return;}if(mod&&e.key.toLowerCase()==='d'){e.preventDefault();duplicate();return;}if(e.key==='Delete'||e.key==='Backspace'){e.preventDefault();removeSelection();return;}if(e.key==='Escape'){setConnectFrom(null);setTool('select');return;}if(selectedNodes.length){const dx=e.key==='ArrowLeft'?-1:e.key==='ArrowRight'?1:0,dy=e.key==='ArrowUp'?-1:e.key==='ArrowDown'?1:0;if(dx||dy){e.preventDefault();const step=e.shiftKey?10:1;commit(d=>{d.nodes=d.nodes.map(n=>selectedNodes.includes(n.id)?{...n,x:n.x+dx*step,y:n.y+dy*step}:n);});}}}
    window.addEventListener('keydown',onKey);return()=>window.removeEventListener('keydown',onKey);},[doc,selectedNodes,selectedEdge]);

  function exportJson(){download(new Blob([JSON.stringify(doc,null,2)],{type:'application/json'}),'xfactor-flowchart.json');}
  function exportSvg(){
    const laneH=doc.lanes.length?H/doc.lanes.length:0;
    const laneSvg=doc.lanes.map((l,i)=>`<rect x="0" y="${i*laneH}" width="${W}" height="${laneH}" fill="${i%2?'#0c0f16':'#12161f'}" stroke="#2a3040"/><text x="8" y="${i*laneH+16}" fill="#8aa" font-size="11" font-family="monospace">${xml(l.label)}</text>`).join('');
    const edgeSvg=doc.edges.map(e=>{const a=doc.nodes.find(n=>n.id===e.from),b=doc.nodes.find(n=>n.id===e.to);if(!a||!b)return'';const g=ends(a,b);return`<path d="${pathFor(a,b,e.route)}" fill="none" stroke="#00F5FF" stroke-width="2" ${e.dashed?'stroke-dasharray="6 4"':''} marker-end="url(#arrow)"/>${e.label?`<text x="${(g.x1+g.x2)/2}" y="${(g.y1+g.y2)/2-6}" fill="#00F5FF" font-size="10" text-anchor="middle">${xml(e.label)}</text>`:''}`;}).join('');
    const nodeSvg=doc.nodes.filter(n=>n.visible).map(n=>{const[cx,cy]=center(n);const shape=n.type==='decision'?`<polygon points="${cx},${n.y} ${n.x+n.w},${cy} ${cx},${n.y+n.h} ${n.x},${cy}" fill="${n.fill}" stroke="#7A5CFF"/>`:`<rect x="${n.x}" y="${n.y}" width="${n.w}" height="${n.h}" rx="${n.type==='terminal'?n.h/2:4}" fill="${n.fill}" stroke="#00F5FF"/>`;return`${shape}<text x="${cx}" y="${cy}" fill="#e6f4ff" font-size="12" text-anchor="middle" dominant-baseline="middle" font-family="monospace">${xml(n.text)}</text>`;}).join('');
    const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><defs><marker id="arrow" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto"><path d="M0,0 L0,6 L9,3z" fill="#00F5FF"/></marker></defs><rect width="100%" height="100%" fill="#05080d"/>${laneSvg}${edgeSvg}${nodeSvg}</svg>`;
    download(new Blob([svg],{type:'image/svg+xml'}),'xfactor-flowchart.svg');
  }

  const single=selectedNodes.length===1?doc.nodes.find(n=>n.id===selectedNodes[0]):null;
  const edge=selectedEdge?doc.edges.find(e=>e.id===selectedEdge):null;
  const tools:{id:Tool;label:string}[]=[{id:'select',label:'SELECT'},{id:'process',label:'PROCESS'},{id:'decision',label:'DECISION'},{id:'terminal',label:'TERMINAL'},{id:'connect',label:'CONNECT'}];

  return <div className="toolShell diagram2" data-testid="diagram-2-root">
    <div className="toolShellBar">
      <button className="chip" onClick={onExit}><Icon name="chevronLeft" size={12}/> ALL BOARDS</button>
      <h3 className="toolShellTitle">DIAGRAM / FLOWCHART 2.0</h3>
      <div className="toolShellActions" style={{display:'flex',gap:5,flexWrap:'wrap',alignItems:'center'}}>
        {tools.map(t=><button key={t.id} className={`chip small ${tool===t.id?'on':''}`} onClick={()=>{setTool(t.id);setConnectFrom(null);}}>{t.label}</button>)}
        <button className="chip small" disabled={!history.current.length} onClick={undo}>UNDO</button>
        <button className="chip small" disabled={!future.current.length} onClick={redo}>REDO</button>
        <button className={`chip small ${doc.snap?'on':''}`} onClick={()=>commit(d=>{d.snap=!d.snap;})}>SNAP {doc.grid}</button>
        <button className="chip small" onClick={autoLayout}>AUTO LAYOUT</button>
        <button className="chip small" onClick={()=>commit(d=>{d.lanes.push({id:nid('lane'),label:`Lane ${d.lanes.length+1}`});})}>+ LANE</button>
        <button className="wbtn" onClick={exportSvg}>SVG</button><button className="wbtn ghost" onClick={exportJson}>JSON</button>
      </div>
    </div>

    <div className="toolShellBody" style={{display:'grid',gridTemplateColumns:'225px minmax(0,1fr)',gap:12}}>
      <aside className="gpanel" style={{padding:10}}>
        <h3>INSPECTOR</h3>
        {selectedNodes.length>1 && <><div className="toolHint">{selectedNodes.length} NODES SELECTED</div><div className="toolRow" style={{gap:4,flexWrap:'wrap'}}>{(['left','center','right','top','middle','bottom'] as const).map(k=><button key={k} className="chip small" onClick={()=>align(k)}>{k.toUpperCase()}</button>)}</div><div className="toolRow" style={{gap:4,marginTop:6}}><button className="chip small" onClick={()=>distribute('h')}>DISTRIBUTE H</button><button className="chip small" onClick={()=>distribute('v')}>DISTRIBUTE V</button></div><button className="wbtn ghost" style={{marginTop:8}} onClick={duplicate}>DUPLICATE</button></>}
        {single && <>
          <label className="toolField"><span className="toolHint">TEXT</span><input value={single.text} onChange={e=>patchNode(single.id,{text:e.target.value})}/></label>
          <div className="toolRow"><label className="toolField">X<input type="number" value={Math.round(single.x)} onChange={e=>patchNode(single.id,{x:Number(e.target.value)})}/></label><label className="toolField">Y<input type="number" value={Math.round(single.y)} onChange={e=>patchNode(single.id,{y:Number(e.target.value)})}/></label></div>
          <div className="toolRow"><label className="toolField">W<input type="number" min={60} value={Math.round(single.w)} onChange={e=>patchNode(single.id,{w:Number(e.target.value)})}/></label><label className="toolField">H<input type="number" min={40} value={Math.round(single.h)} onChange={e=>patchNode(single.id,{h:Number(e.target.value)})}/></label></div>
          <label className="toolField"><span className="toolHint">FILL</span><input type="color" value={single.fill} onChange={e=>patchNode(single.id,{fill:e.target.value})}/></label>
          <div className="toolRow" style={{gap:5,flexWrap:'wrap'}}><button className={`chip small ${single.visible?'on':''}`} onClick={()=>patchNode(single.id,{visible:!single.visible})}>{single.visible?'VISIBLE':'HIDDEN'}</button><button className={`chip small ${single.locked?'on':''}`} onClick={()=>patchNode(single.id,{locked:!single.locked})}>{single.locked?'LOCKED':'UNLOCKED'}</button><button className="chip small" onClick={duplicate}>DUPLICATE</button></div>
        </>}
        {edge && <><label className="toolField"><span className="toolHint">CONNECTOR LABEL</span><input value={edge.label} onChange={e=>patchEdge(edge.id,{label:e.target.value})}/></label><label className="toolField"><span className="toolHint">ROUTING</span><select value={edge.route} onChange={e=>patchEdge(edge.id,{route:e.target.value as RouteMode})}><option value="orthogonal">Orthogonal</option><option value="straight">Straight</option></select></label><button className={`chip small ${edge.dashed?'on':''}`} onClick={()=>patchEdge(edge.id,{dashed:!edge.dashed})}>DASHED</button></>}
        {!single&&!edge&&selectedNodes.length<2 && <div className="toolHint">Select a node or connector. Shift-click nodes for multi-select.</div>}
        {doc.lanes.length>0 && <><h3 style={{marginTop:16}}>SWIMLANES</h3>{doc.lanes.map((l,i)=><div className="toolRow" key={l.id} style={{gap:4}}><input value={l.label} onChange={e=>commit(d=>{const lane=d.lanes.find(x=>x.id===l.id);if(lane)lane.label=e.target.value;})}/><button className="chip small" onClick={()=>commit(d=>{d.lanes=d.lanes.filter(x=>x.id!==l.id);})}>×</button><span className="toolHint">{i+1}</span></div>)}</>}
      </aside>

      <div style={{minWidth:0,overflow:'auto'}}>
        <div style={{display:'flex',justifyContent:'flex-end',gap:4,marginBottom:6}}><button className="chip small" onClick={()=>setZoom(z=>Math.max(.5,z-.1))}>−</button><span className="chip small">{Math.round(zoom*100)}%</span><button className="chip small" onClick={()=>setZoom(z=>Math.min(1.6,z+.1))}>+</button><button className="chip small" onClick={()=>setZoom(1)}>100%</button></div>
        <div style={{width:W*zoom,height:H*zoom}}>
          <div ref={stageRef} onPointerDown={onStageDown} onPointerMove={onMove} onPointerUp={onUp} onPointerLeave={onUp} style={{position:'relative',width:W,height:H,transform:`scale(${zoom})`,transformOrigin:'top left',backgroundColor:'#05080d',backgroundImage:doc.snap?'linear-gradient(rgba(255,255,255,.035) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.035) 1px,transparent 1px)':'none',backgroundSize:`${doc.grid}px ${doc.grid}px`,border:'1px solid var(--edge)',overflow:'hidden',cursor:tool==='select'?'default':'crosshair'}}>
            {doc.lanes.map((l,i)=>{const h=H/doc.lanes.length;return <div key={l.id} style={{position:'absolute',left:0,top:i*h,width:W,height:h,borderTop:'1px solid rgba(255,255,255,.08)',background:i%2?'transparent':'rgba(255,255,255,.018)',pointerEvents:'none'}}><span style={{position:'absolute',left:7,top:5,fontSize:10,color:'#789'}}>{l.label}</span></div>;})}
            <svg width={W} height={H} style={{position:'absolute',inset:0,overflow:'visible'}}><defs><marker id="arrowDiagram2" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto"><path d="M0,0 L0,6 L9,3z" fill="#00F5FF"/></marker></defs>{doc.edges.map(e=>{const a=doc.nodes.find(n=>n.id===e.from),b=doc.nodes.find(n=>n.id===e.to);if(!a||!b)return null;const g=ends(a,b);return <g key={e.id} onPointerDown={ev=>{ev.stopPropagation();setSelectedEdge(e.id);setSelectedNodes([]);}} style={{cursor:'pointer'}}><path d={pathFor(a,b,e.route)} fill="none" stroke={selectedEdge===e.id?'#FF2D78':'#00F5FF'} strokeWidth={selectedEdge===e.id?3:2} strokeDasharray={e.dashed?'6 4':undefined} markerEnd="url(#arrowDiagram2)"/><path d={pathFor(a,b,e.route)} fill="none" stroke="transparent" strokeWidth={14}/>{e.label&&<text x={(g.x1+g.x2)/2} y={(g.y1+g.y2)/2-7} fill="#00F5FF" fontSize={10} textAnchor="middle">{e.label}</text>}</g>;})}</svg>
            {doc.nodes.filter(n=>n.visible).map(n=>{const selected=selectedNodes.includes(n.id);return <div key={n.id} onPointerDown={e=>onNodeDown(e,n)} style={{position:'absolute',left:n.x,top:n.y,width:n.w,height:n.h,cursor:n.locked?'not-allowed':tool==='select'?'move':tool==='connect'?'crosshair':'default',opacity:n.locked?.9:1}}>
              <svg width={n.w} height={n.h} style={{position:'absolute',inset:0,overflow:'visible'}}>{n.type==='decision'?<polygon points={`${n.w/2},0 ${n.w},${n.h/2} ${n.w/2},${n.h} 0,${n.h/2}`} fill={n.fill} stroke={selected?'#FF2D78':'#7A5CFF'} strokeWidth={selected?2.5:1.5}/>:<rect x={.75} y={.75} width={n.w-1.5} height={n.h-1.5} rx={n.type==='terminal'?n.h/2:4} fill={n.fill} stroke={selected?'#FF2D78':'#00F5FF'} strokeWidth={selected?2.5:1.5}/>}</svg>
              <div style={{position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center',padding:'0 8px',fontSize:11,color:'#e6f4ff',textAlign:'center',pointerEvents:'none'}}>{n.text}</div>
              {selected&&selectedNodes.length===1&&tool==='select'&&!n.locked&&<div onPointerDown={e=>onResizeDown(e,n)} style={{position:'absolute',right:-5,bottom:-5,width:10,height:10,background:'#FF2D78',borderRadius:2,cursor:'nwse-resize'}}/>}
            </div>;})}
            {connectFrom&&(()=>{const n=doc.nodes.find(x=>x.id===connectFrom);if(!n)return null;const[cx,cy]=center(n);return <div style={{position:'absolute',left:cx-8,top:cy-8,width:16,height:16,border:'2px solid #FF2D78',borderRadius:'50%',pointerEvents:'none'}}/>;})()}
          </div>
        </div>
        <div className="toolHint" style={{marginTop:6}}>Shift-click multi-select · drag nodes · pink handle resizes · connectors stay attached · Ctrl/Cmd+D duplicate · arrows nudge · Shift+arrows 10px · Delete removes.</div>
      </div>
    </div>
  </div>;
}

function download(blob:Blob,name:string){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),4000);}
