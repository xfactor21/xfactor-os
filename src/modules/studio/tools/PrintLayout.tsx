import { useEffect, useRef, useState } from 'react';
import type { PointerEvent as RPointerEvent } from 'react';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import ToolShell from './ToolShell';
import Icon from '../../../design-system/icons/Icon';

type PageSize='letter'|'a4'; type Orientation='portrait'|'landscape';
type Item={id:string;kind:'image'|'text';x:number;y:number;w:number;h:number;src?:string;text?:string;fontSize?:number;color?:string};
type Page={id:string;items:Item[]};
type Doc={version:2;size:PageSize;orientation:Orientation;pages:Page[];outputName:string};
const SIZE:Record<PageSize,[number,number]>={letter:[612,792],a4:[595.28,841.89]};
const pagePt=(s:PageSize,o:Orientation):[number,number]=>o==='landscape'?[SIZE[s][1],SIZE[s][0]]:SIZE[s];
const safe=(v:string)=>(v.trim()||'print-layout').replace(/[^a-z0-9._-]+/gi,'-');
const fallback=():Doc=>({version:2,size:'letter',orientation:'portrait',pages:[{id:'p1',items:[]}],outputName:'print-layout'});

export default function PrintLayout({boardId,onExit}:{boardId:string;onExit:()=>void}){
 const key=`xfactor-studio-print2-${boardId}`;
 const [doc,setDoc]=useState<Doc>(()=>{try{const raw=localStorage.getItem(key);if(!raw)return fallback();const p=JSON.parse(raw) as Partial<Doc>;return p.version===2&&Array.isArray(p.pages)&&p.pages.length?{...fallback(),...p,version:2,pages:p.pages as Page[]}:fallback();}catch{return fallback();}});
 const [pageIdx,setPageIdx]=useState(0),[selId,setSelId]=useState<string|null>(null),[exporting,setExporting]=useState(false),[status,setStatus]=useState('READY');
 const stageRef=useRef<HTMLDivElement>(null),dragRef=useRef<{id:string;offX:number;offY:number}|null>(null),idRef=useRef(0);
 useEffect(()=>{try{localStorage.setItem(key,JSON.stringify(doc));setStatus('SAVED');}catch{setStatus('LOCAL SAVE FULL — EXPORT PROJECT JSON');}},[doc,key]);
 const page=doc.pages[Math.min(pageIdx,doc.pages.length-1)], [ptW,ptH]=pagePt(doc.size,doc.orientation), aspect=ptW/ptH;
 const patch=(p:Partial<Doc>)=>setDoc(d=>({...d,...p}));
 const updateItems=(fn:(i:Item[])=>Item[])=>setDoc(d=>({...d,pages:d.pages.map((p,i)=>i===pageIdx?{...p,items:fn(p.items)}:p)}));
 const id=()=>`item-${Date.now()}-${++idRef.current}`;
 function addText(){const n=id();updateItems(i=>[...i,{id:n,kind:'text',x:.15,y:.15,w:.7,h:.1,text:'Heading text',fontSize:24,color:'#111111'}]);setSelId(n);}
 function addImage(file:File|null){if(!file)return;const r=new FileReader();r.onload=()=>{const img=new Image();img.onload=()=>{const src=r.result as string,w=.4,h=Math.min(.6,w*(img.naturalHeight/img.naturalWidth)*aspect),n=id();updateItems(i=>[...i,{id:n,kind:'image',x:.3,y:.3,w,h,src}]);setSelId(n);};img.src=r.result as string;};r.readAsDataURL(file);}
 function updateSelected(p:Partial<Item>){if(selId)updateItems(items=>items.map(i=>i.id===selId?{...i,...p}:i));}
 function removeSelected(){if(selId){updateItems(i=>i.filter(x=>x.id!==selId));setSelId(null);}}
 function addPage(){setDoc(d=>({...d,pages:[...d.pages,{id:`p${Date.now()}`,items:[]}]}));setPageIdx(doc.pages.length);setSelId(null);}
 function removePage(i:number){if(doc.pages.length<=1)return;setDoc(d=>({...d,pages:d.pages.filter((_,x)=>x!==i)}));setPageIdx(x=>Math.max(0,Math.min(x,doc.pages.length-2)));setSelId(null);}
 function down(e:RPointerEvent<HTMLDivElement>,item:Item){e.stopPropagation();setSelId(item.id);const r=stageRef.current?.getBoundingClientRect();if(!r)return;dragRef.current={id:item.id,offX:(e.clientX-r.left)/r.width-item.x,offY:(e.clientY-r.top)/r.height-item.y};try{e.currentTarget.setPointerCapture(e.pointerId);}catch{/*optional*/}}
 function move(e:RPointerEvent<HTMLDivElement>){const d=dragRef.current,r=stageRef.current?.getBoundingClientRect();if(!d||!r)return;const px=(e.clientX-r.left)/r.width,py=(e.clientY-r.top)/r.height;updateItems(items=>items.map(i=>i.id===d.id?{...i,x:Math.max(0,Math.min(1-i.w,px-d.offX)),y:Math.max(0,Math.min(1-i.h,py-d.offY))}:i));}
 const up=()=>{dragRef.current=null;};
 function download(blob:Blob,name:string){const u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),2500);}
 function exportJson(){download(new Blob([JSON.stringify(doc,null,2)],{type:'application/json'}),`${safe(doc.outputName)}.layout.json`);}
 async function importJson(file:File){try{const p=JSON.parse(await file.text()) as Partial<Doc>;if(p.version!==2||!Array.isArray(p.pages)||!p.pages.length||(p.size!=='letter'&&p.size!=='a4')||(p.orientation!=='portrait'&&p.orientation!=='landscape'))throw new Error();setDoc({...fallback(),...p,version:2,pages:p.pages as Page[]});setPageIdx(0);setSelId(null);setStatus('PROJECT IMPORTED');}catch{setStatus('INVALID LAYOUT PROJECT');}}
 function hex(hex:string){const m=hex.replace('#',''),n=parseInt(m.length===3?m.split('').map(c=>c+c).join(''):m,16);return [((n>>16)&255)/255,((n>>8)&255)/255,(n&255)/255] as [number,number,number];}
 async function exportPdf(){setExporting(true);setStatus('EXPORTING PDF…');try{const pdf=await PDFDocument.create(),font=await pdf.embedFont(StandardFonts.Helvetica);for(const pg of doc.pages){const p=pdf.addPage([ptW,ptH]);for(const item of pg.items){const x=item.x*ptW,w=item.w*ptW,h=item.h*ptH,y=ptH-item.y*ptH-h;if(item.kind==='image'&&item.src){const bytes=await fetch(item.src).then(r=>r.arrayBuffer()),im=item.src.startsWith('data:image/png')?await pdf.embedPng(bytes):await pdf.embedJpg(bytes);p.drawImage(im,{x,y,width:w,height:h});}else if(item.kind==='text'&&item.text){const fs=item.fontSize??18,[r,g,b]=hex(item.color??'#111111');p.drawText(item.text,{x,y:y+h-fs,size:fs,font,color:rgb(r,g,b),maxWidth:w});}}}download(new Blob([await pdf.save() as BlobPart],{type:'application/pdf'}),`${safe(doc.outputName)}.pdf`);setStatus(`EXPORTED ${doc.pages.length} PAGE PDF`);}catch{setStatus('PDF EXPORT FAILED');}finally{setExporting(false);}}
 const selected=page?.items.find(i=>i.id===selId)??null;
 return <ToolShell title="PRINT LAYOUT DESIGNER 2.0" onExit={onExit} actions={<button className="wbtn" onClick={exportPdf} disabled={exporting}>{exporting?'EXPORTING…':`EXPORT PDF (${doc.pages.length})`}</button>}><div data-testid="print-layout-2-root" className="toolRow">
  <div className="toolCol"><label className="toolField">OUTPUT<input value={doc.outputName} onChange={e=>patch({outputName:e.target.value})}/></label><div className="toolRow">{(['letter','a4'] as PageSize[]).map(s=><button key={s} className={doc.size===s?'chip on':'chip'} onClick={()=>patch({size:s})}>{s.toUpperCase()}</button>)}{(['portrait','landscape'] as Orientation[]).map(o=><button key={o} className={doc.orientation===o?'chip on':'chip'} onClick={()=>patch({orientation:o})}>{o.toUpperCase()}</button>)}</div>
   <div className="toolRow"><label className="wbtn ghost"><Icon name="image" size={12}/> IMAGE<input type="file" accept="image/png,image/jpeg" hidden onChange={e=>addImage(e.target.files?.[0]??null)}/></label><button className="wbtn ghost" onClick={addText}><Icon name="text" size={12}/> TEXT</button></div>
   <div className="toolRow">{doc.pages.map((p,i)=><button key={p.id} className={pageIdx===i?'chip on':'chip'} onClick={()=>{setPageIdx(i);setSelId(null);}}>PAGE {i+1}</button>)}<button className="chip" onClick={addPage}>+ PAGE</button></div>{doc.pages.length>1&&<button className="wbtn ghost" onClick={()=>removePage(pageIdx)}>DELETE PAGE</button>}
   {selected&&<div className="toolField"><label>SELECTED {selected.kind.toUpperCase()}</label>{selected.kind==='text'&&<><textarea value={selected.text} onChange={e=>updateSelected({text:e.target.value})}/><label>SIZE {selected.fontSize}</label><input type="range" min={8} max={72} value={selected.fontSize} onChange={e=>updateSelected({fontSize:+e.target.value})}/><input type="color" value={selected.color} onChange={e=>updateSelected({color:e.target.value})}/></>}<label>WIDTH {Math.round(selected.w*100)}%</label><input type="range" min={10} max={100} value={selected.w*100} onChange={e=>updateSelected({w:+e.target.value/100})}/><button className="wbtn ghost" onClick={removeSelected}>DELETE ELEMENT</button></div>}
   <div className="toolRow"><label className="toolDrop"><input type="file" accept="application/json" hidden onChange={e=>{const f=e.target.files?.[0];if(f)void importJson(f);e.target.value='';}}/>IMPORT PROJECT</label><button className="wbtn ghost" onClick={exportJson}>EXPORT PROJECT</button></div><span className="toolHint">{status}</span>
  </div>
  <div className="toolCol"><div ref={stageRef} onPointerMove={move} onPointerUp={up} onPointerLeave={up} onPointerDown={()=>setSelId(null)} style={{position:'relative',width:'100%',maxWidth:460,aspectRatio:`${aspect}`,background:'#fff',overflow:'hidden'}}>{page?.items.map(item=><div key={item.id} onPointerDown={e=>down(e,item)} style={{position:'absolute',left:`${item.x*100}%`,top:`${item.y*100}%`,width:`${item.w*100}%`,height:`${item.h*100}%`,border:selId===item.id?'2px solid #ff2d78':'1px dashed rgba(0,0,0,.2)',cursor:'move',overflow:'hidden',display:'flex',alignItems:'flex-end'}}>{item.kind==='image'&&item.src&&<img src={item.src} alt="" style={{width:'100%',height:'100%',objectFit:'contain',pointerEvents:'none'}}/>}{item.kind==='text'&&<span style={{color:item.color,fontSize:(item.fontSize??18)*.6,fontFamily:'Helvetica,sans-serif',pointerEvents:'none'}}>{item.text}</span>}</div>)}</div><div className="toolHint">Exact Letter/A4 proportions; export is a real multi-page PDF with embedded images and text.</div></div>
 </div></ToolShell>;
}
