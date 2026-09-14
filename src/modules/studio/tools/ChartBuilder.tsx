import { useEffect, useMemo, useRef, useState } from 'react';
import ToolShell from './ToolShell';
import Icon from '../../../design-system/icons/Icon';

type ChartType='bar'|'line'|'pie';
type Row={id:string;label:string;value:number};
type Doc={version:2;chartType:ChartType;rows:Row[];title:string;outputName:string;accent:string;background:string};
const oldPrefix='xos-studio-chart-';
const safe=(v:string)=>(v.trim()||'chart').replace(/[^a-z0-9._-]+/gi,'-');
const makeRows=():Row[]=>[{id:'r1',label:'Mon',value:42},{id:'r2',label:'Tue',value:68},{id:'r3',label:'Wed',value:35},{id:'r4',label:'Thu',value:90}];
const fallback=():Doc=>({version:2,chartType:'bar',rows:makeRows(),title:'Chart',outputName:'chart',accent:'#00f5ff',background:'#05080d'});
const isType=(v:unknown):v is ChartType=>v==='bar'||v==='line'||v==='pie';

export default function ChartBuilder({boardId,onExit}:{boardId:string;onExit:()=>void}){
 const key=`xfactor-studio-chart2-${boardId}`, canvasRef=useRef<HTMLCanvasElement>(null), idRef=useRef(10);
 const initial=useMemo(()=>{try{const raw=localStorage.getItem(key)??localStorage.getItem(`${oldPrefix}${boardId}`);if(!raw)return fallback();const p=JSON.parse(raw) as Partial<Doc>;return {...fallback(),...p,version:2,chartType:isType(p.chartType)?p.chartType:'bar',rows:Array.isArray(p.rows)&&p.rows.length?p.rows.map((r:any)=>({id:typeof r.id==='string'?r.id:`r${++idRef.current}`,label:typeof r.label==='string'?r.label:'',value:Number.isFinite(r.value)?r.value:0})):makeRows()};}catch{return fallback();}},[boardId,key]);
 const [doc,setDoc]=useState<Doc>(initial); const [status,setStatus]=useState('READY');
 useEffect(()=>{try{localStorage.setItem(key,JSON.stringify(doc));}catch{setStatus('LOCAL SAVE FAILED');}},[doc,key]);
 const patch=(p:Partial<Doc>)=>setDoc(d=>({...d,...p}));
 const rows=doc.rows;
 function add(){patch({rows:[...rows,{id:`r${++idRef.current}`,label:`Item ${rows.length+1}`,value:0}]});}
 function update(id:string,p:Partial<Row>){patch({rows:rows.map(r=>r.id===id?{...r,...p}:r)});}
 function remove(id:string){if(rows.length>1)patch({rows:rows.filter(r=>r.id!==id)});}
 function download(blob:Blob,name:string){const u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),1500);}
 function exportJson(){download(new Blob([JSON.stringify(doc,null,2)],{type:'application/json'}),`${safe(doc.outputName)}.chart.json`);}
 function exportCsv(){const lines=['label,value',...rows.map(r=>`${JSON.stringify(r.label)},${r.value}`)];download(new Blob([lines.join('\n')],{type:'text/csv'}),`${safe(doc.outputName)}.csv`);}
 async function importJson(f:File){try{const p=JSON.parse(await f.text()) as Partial<Doc>;if(p.version!==2||!isType(p.chartType)||!Array.isArray(p.rows))throw new Error();setDoc({...fallback(),...p,version:2,chartType:p.chartType,rows:p.rows as Row[]});setStatus('PROJECT IMPORTED');}catch{setStatus('INVALID CHART PROJECT');}}
 function exportPng(){canvasRef.current?.toBlob(b=>b&&download(b,`${safe(doc.outputName)}.png`),'image/png');}
 useEffect(()=>{const c=canvasRef.current;if(!c)return;const ctx=c.getContext('2d');if(!ctx)return;c.width=640;c.height=400;ctx.fillStyle=doc.background;ctx.fillRect(0,0,c.width,c.height);ctx.fillStyle='#d7e1ea';ctx.font='600 20px sans-serif';ctx.textAlign='center';ctx.fillText(doc.title||'Chart',320,28);const left=58,right=610,top=58,bottom=350,w=right-left,h=bottom-top;const max=Math.max(1,...rows.map(r=>Math.max(0,r.value)));ctx.strokeStyle='rgba(180,200,220,.22)';ctx.fillStyle='#9eb0bf';ctx.font='11px monospace';ctx.textAlign='right';for(let i=0;i<=4;i++){const y=bottom-h*i/4;ctx.beginPath();ctx.moveTo(left,y);ctx.lineTo(right,y);ctx.stroke();ctx.fillText(String(Math.round(max*i/4)),left-8,y+3);}if(doc.chartType==='bar'){const slot=w/rows.length,bw=Math.max(8,slot*.55);rows.forEach((r,i)=>{const bh=Math.max(0,r.value)/max*h,x=left+i*slot+(slot-bw)/2,y=bottom-bh;ctx.fillStyle=doc.accent;ctx.fillRect(x,y,bw,bh);ctx.fillStyle='#d7e1ea';ctx.textAlign='center';ctx.fillText(r.label.slice(0,12),x+bw/2,bottom+18);});}else if(doc.chartType==='line'){ctx.strokeStyle=doc.accent;ctx.lineWidth=3;ctx.beginPath();rows.forEach((r,i)=>{const x=rows.length===1?left+w/2:left+i*w/(rows.length-1),y=bottom-Math.max(0,r.value)/max*h;i?ctx.lineTo(x,y):ctx.moveTo(x,y);});ctx.stroke();rows.forEach((r,i)=>{const x=rows.length===1?left+w/2:left+i*w/(rows.length-1),y=bottom-Math.max(0,r.value)/max*h;ctx.fillStyle=doc.accent;ctx.beginPath();ctx.arc(x,y,4,0,Math.PI*2);ctx.fill();ctx.fillStyle='#d7e1ea';ctx.textAlign='center';ctx.fillText(r.label.slice(0,12),x,bottom+18);});}else{const total=rows.reduce((s,r)=>s+Math.max(0,r.value),0);let a=-Math.PI/2;const palette=[doc.accent,'#8b5cf6','#ff2d78','#ffa500','#39ff88','#ffd700'];rows.forEach((r,i)=>{if(total<=0)return;const n=a+Math.max(0,r.value)/total*Math.PI*2;ctx.fillStyle=palette[i%palette.length];ctx.beginPath();ctx.moveTo(320,205);ctx.arc(320,205,120,a,n);ctx.closePath();ctx.fill();a=n;});}},[doc]);
 return <ToolShell title="CHART / GRAPH BUILDER 2.0" onExit={onExit}><div data-testid="chart-builder-2-root" className="toolCol">
  <div className="toolRow"><label className="toolField">TITLE<input value={doc.title} onChange={e=>patch({title:e.target.value})}/></label><label className="toolField">OUTPUT<input value={doc.outputName} onChange={e=>patch({outputName:e.target.value})}/></label><label className="toolField">ACCENT<input type="color" value={doc.accent} onChange={e=>patch({accent:e.target.value})}/></label><label className="toolField">BG<input type="color" value={doc.background} onChange={e=>patch({background:e.target.value})}/></label></div>
  <div className="toolRow">{(['bar','line','pie'] as ChartType[]).map(t=><button key={t} className={doc.chartType===t?'chip on':'chip'} onClick={()=>patch({chartType:t})}>{t.toUpperCase()}</button>)}<span className="toolHint">{status}</span></div>
  <div className="toolRow"><div className="toolCol" style={{minWidth:280}}>{rows.map(r=><div key={r.id} className="toolRow"><input value={r.label} onChange={e=>update(r.id,{label:e.target.value})}/><input type="number" value={r.value} onChange={e=>update(r.id,{value:Number(e.target.value)||0})}/><button className="chip small" onClick={()=>remove(r.id)} disabled={rows.length<=1}><Icon name="trash" size={11}/></button></div>)}<button className="chip" onClick={add}>+ ADD ROW</button></div><div className="toolCanvasWrap"><canvas ref={canvasRef} style={{maxWidth:'100%',height:'auto'}}/></div></div>
  <div className="toolRow"><label className="toolDrop"><input type="file" accept="application/json" hidden onChange={e=>{const f=e.target.files?.[0];if(f)void importJson(f);e.target.value='';}}/>IMPORT PROJECT</label><button className="wbtn ghost" onClick={exportJson}>EXPORT PROJECT</button><button className="wbtn ghost" onClick={exportCsv}>EXPORT CSV</button><button className="wbtn" onClick={exportPng}>EXPORT PNG</button></div>
 </div></ToolShell>;
}
