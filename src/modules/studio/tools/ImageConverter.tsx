import { useEffect, useMemo, useState } from 'react';
import ToolShell from './ToolShell';
import Icon from '../../../design-system/icons/Icon';

type OutFormat = 'png' | 'jpeg' | 'webp';
interface StoredPrefs { format: OutFormat; quality: number; width: number; height: number; lockAspect: boolean; background: string; }
interface SourceItem { id: string; file: File; width: number; height: number; url: string; }
interface ResultItem { id: string; name: string; blob: Blob; before: number; width: number; height: number; }

const MIME: Record<OutFormat,string>={png:'image/png',jpeg:'image/jpeg',webp:'image/webp'};
const EXT: Record<OutFormat,string>={png:'png',jpeg:'jpg',webp:'webp'};
const KEY='xfactor-studio-imgconv2-';
const LEGACY='xos-studio-imgconv-';
const defaults:StoredPrefs={format:'png',quality:85,width:0,height:0,lockAspect:true,background:'#ffffff'};
const kb=(n:number)=>`${Math.max(1,Math.round(n/1024))} KB`;
const stem=(name:string)=>name.replace(/\.[^.]+$/,'')||'converted';

function load(boardId:string):StoredPrefs{
  try{const raw=localStorage.getItem(`${KEY}${boardId}`);if(raw)return {...defaults,...JSON.parse(raw)};const old=localStorage.getItem(`${LEGACY}${boardId}`);if(old)return {...defaults,...JSON.parse(old)};}catch{}
  return defaults;
}
function download(blob:Blob,name:string){const u=URL.createObjectURL(blob);const a=document.createElement('a');a.href=u;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),3000);}
async function readImage(file:File):Promise<SourceItem>{return await new Promise((resolve,reject)=>{const url=URL.createObjectURL(file);const img=new Image();img.onload=()=>resolve({id:`${file.name}-${file.lastModified}-${Math.random()}`,file,width:img.naturalWidth,height:img.naturalHeight,url});img.onerror=()=>{URL.revokeObjectURL(url);reject(new Error(`Could not load ${file.name}`));};img.src=url;});}
async function convert(item:SourceItem,p:StoredPrefs):Promise<ResultItem>{const ratio=item.width/item.height;let w=p.width||item.width,h=p.height||item.height;if(p.lockAspect){if(p.width&&!p.height)h=Math.max(1,Math.round(w/ratio));else if(p.height&&!p.width)w=Math.max(1,Math.round(h*ratio));else if(p.width&&p.height){const fit=Math.min(p.width/item.width,p.height/item.height);w=Math.max(1,Math.round(item.width*fit));h=Math.max(1,Math.round(item.height*fit));}}
  const img=await new Promise<HTMLImageElement>((resolve,reject)=>{const x=new Image();x.onload=()=>resolve(x);x.onerror=reject;x.src=item.url;});const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Canvas unavailable');if(p.format!=='png'){ctx.fillStyle=p.background;ctx.fillRect(0,0,w,h);}ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';ctx.drawImage(img,0,0,w,h);const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('Conversion failed')),MIME[p.format],p.format==='png'?undefined:p.quality/100));return {id:item.id,name:`${stem(item.file.name)}.${EXT[p.format]}`,blob,before:item.file.size,width:w,height:h};}

export default function ImageConverter({boardId,onExit}:{boardId:string;onExit:()=>void}){
  const [prefs,setPrefs]=useState<StoredPrefs>(()=>load(boardId));
  const [items,setItems]=useState<SourceItem[]>([]);const [results,setResults]=useState<ResultItem[]>([]);const [busy,setBusy]=useState(false);const [status,setStatus]=useState('DROP OR SELECT ONE OR MORE IMAGES');
  useEffect(()=>{try{localStorage.setItem(`${KEY}${boardId}`,JSON.stringify(prefs));}catch{}},[boardId,prefs]);
  useEffect(()=>()=>{items.forEach(i=>URL.revokeObjectURL(i.url));},[items]);
  const totalBefore=useMemo(()=>items.reduce((n,i)=>n+i.file.size,0),[items]);const totalAfter=useMemo(()=>results.reduce((n,i)=>n+i.blob.size,0),[results]);
  async function addFiles(files:FileList|File[]){const list=Array.from(files).filter(f=>f.type.startsWith('image/'));if(!list.length)return;setStatus('LOADING IMAGES…');try{const loaded=await Promise.all(list.map(readImage));setItems(prev=>{prev.forEach(i=>URL.revokeObjectURL(i.url));return loaded;});setResults([]);setStatus(`${loaded.length} IMAGE${loaded.length===1?'':'S'} READY`);}catch(e){setStatus(e instanceof Error?e.message.toUpperCase():'IMAGE LOAD FAILED');}}
  async function run(){if(!items.length)return;setBusy(true);setStatus('CONVERTING…');try{const out:ResultItem[]=[];for(const item of items)out.push(await convert(item,prefs));setResults(out);setStatus(`${out.length} CONVERSION${out.length===1?'':'S'} COMPLETE`);}catch(e){setStatus(e instanceof Error?e.message.toUpperCase():'CONVERSION FAILED');}finally{setBusy(false);}}
  function setDim(kind:'width'|'height',value:number){setPrefs(p=>({...p,[kind]:Math.max(0,value)}));}
  function clear(){items.forEach(i=>URL.revokeObjectURL(i.url));setItems([]);setResults([]);setStatus('DROP OR SELECT ONE OR MORE IMAGES');}
  return <ToolShell title="IMAGE CONVERTER 2.0" onExit={onExit}><div className="toolCol" data-testid="image-converter-2-root">
    <label className="toolDrop" onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();void addFiles(e.dataTransfer.files);}}><input aria-label="Image files" type="file" multiple accept="image/*" hidden onChange={e=>e.target.files&&void addFiles(e.target.files)}/>{items.length?`${items.length} IMAGE${items.length===1?'':'S'} LOADED`:'CLICK OR DROP IMAGES'}</label>
    {items.length>0&&<><div className="toolRow" style={{alignItems:'flex-start',flexWrap:'wrap'}}>{items.slice(0,8).map(i=><div key={i.id} style={{width:110}}><img src={i.url} alt="" style={{width:110,height:72,objectFit:'cover',borderRadius:6}}/><div className="toolHint" style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{i.file.name}</div><div className="toolHint">{i.width}×{i.height} · {kb(i.file.size)}</div></div>)}</div>{items.length>8&&<div className="toolHint">+ {items.length-8} more</div>}</>}
    <div className="rsub">OUTPUT</div><div className="toolRow">{(['png','jpeg','webp'] as const).map(f=><button key={f} className={`chip${prefs.format===f?' on':''}`} onClick={()=>setPrefs(p=>({...p,format:f}))}>{f.toUpperCase()}</button>)}</div>
    <div className="toolRow"><label className="toolHint">WIDTH <input aria-label="Output width" type="number" min="0" value={prefs.width||''} placeholder="original" onChange={e=>setDim('width',Number(e.target.value))} style={{width:92}}/></label><label className="toolHint">HEIGHT <input aria-label="Output height" type="number" min="0" value={prefs.height||''} placeholder="original" onChange={e=>setDim('height',Number(e.target.value))} style={{width:92}}/></label><label className="toolHint"><input type="checkbox" checked={prefs.lockAspect} onChange={e=>setPrefs(p=>({...p,lockAspect:e.target.checked}))}/> FIT / KEEP ASPECT</label></div>
    {prefs.format!=='png'&&<div className="toolRow"><label className="toolHint">QUALITY {prefs.quality}<input aria-label="Output quality" type="range" min="1" max="100" value={prefs.quality} onChange={e=>setPrefs(p=>({...p,quality:Number(e.target.value)}))}/></label><label className="toolHint">BACKGROUND <input type="color" value={prefs.background} onChange={e=>setPrefs(p=>({...p,background:e.target.value}))}/></label></div>}
    <div className="toolRow"><button className="wbtn" disabled={!items.length||busy} onClick={()=>void run()}>{busy?'CONVERTING…':'CONVERT ALL'}</button><button className="wbtn ghost" disabled={!items.length} onClick={clear}>CLEAR</button>{results.length>0&&<button className="wbtn ghost" onClick={()=>results.forEach((r,i)=>setTimeout(()=>download(r.blob,r.name),i*120))}>DOWNLOAD ALL</button>}</div><div className="toolHint">{status}</div>
    {results.length>0&&<><div className="rsub">RESULTS</div>{results.map(r=><div key={r.id} className="toolRow" style={{justifyContent:'space-between'}}><div><strong>{r.name}</strong><div className="toolHint">{r.width}×{r.height} · {kb(r.before)} <Icon name="arrowRight" size={11}/> {kb(r.blob.size)} ({Math.round((r.blob.size-r.before)/r.before*100)}%)</div></div><button className="toolBtn" onClick={()=>download(r.blob,r.name)}>Download</button></div>)}<div className="toolHint">TOTAL {kb(totalBefore)} <Icon name="arrowRight" size={11}/> {kb(totalAfter)}</div></>}
  </div></ToolShell>;
}