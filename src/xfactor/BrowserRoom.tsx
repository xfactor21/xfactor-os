import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Bookmark, Code2, Download, ExternalLink, Globe2, RefreshCw, Search, ShieldCheck, Vault } from 'lucide-react';
import { isTauri } from '../lib/platform';
import type { M6Preferences } from './m6Prefs';

type NativeWebview = {
  close: () => Promise<void>;
  setPosition: (position: unknown) => Promise<void>;
  setSize: (size: unknown) => Promise<void>;
};

function normalizeUrl(raw:string){
  const trimmed=raw.trim();
  if(!trimmed)return 'https://example.com';
  try{return new URL(trimmed).toString();}catch{
    if(!/\s/.test(trimmed)&&trimmed.includes('.'))return new URL('https://'+trimmed).toString();
    return 'https://www.google.com/search?q='+encodeURIComponent(trimmed);
  }
}

function pageTitle(url:string){
  try{return new URL(url).hostname.replace(/^www\./,'');}catch{return url;}
}

async function buildSitePack(startUrl:string, depth:number, maxPages:number){
  const origin=new URL(startUrl).origin;
  const queue:Array<{url:string;depth:number}>=[{url:startUrl,depth:0}];
  const seen=new Set<string>();
  const pages:Array<{url:string;html:string;capturedAt:string}>=[];
  const warnings:string[]=[];
  while(queue.length&&pages.length<maxPages){
    const next=queue.shift()!;
    if(seen.has(next.url))continue;
    seen.add(next.url);
    try{
      const res=await fetch(next.url,{credentials:'omit',redirect:'follow'});
      if(!res.ok)throw new Error('HTTP '+res.status);
      const type=res.headers.get('content-type')||'';
      if(!type.includes('text/html')){warnings.push(next.url+' skipped: '+type);continue;}
      const html=await res.text();
      pages.push({url:next.url,html,capturedAt:new Date().toISOString()});
      if(next.depth<depth){
        const doc=new DOMParser().parseFromString(html,'text/html');
        doc.querySelectorAll('a[href]').forEach(a=>{
          try{
            const child=new URL(a.getAttribute('href')||'',next.url);
            child.hash='';
            if(child.origin===origin&&!seen.has(child.toString())&&queue.length+pages.length<maxPages*4)queue.push({url:child.toString(),depth:next.depth+1});
          }catch{/* ignore malformed links */}
        });
      }
    }catch(error){warnings.push(next.url+' unavailable: '+(error instanceof Error?error.message:String(error)));}
  }
  return {
    format:'xfactor-site-pack-v1',
    source:startUrl,
    capturedAt:new Date().toISOString(),
    depth,
    maxPages,
    pages,
    warnings,
    note:'Static public/CORS-accessible source only. Server behavior, authenticated resources, DRM media and blocked resources are intentionally not bypassed.',
  };
}

export default function BrowserRoom({
  prefs,
  onVaultReference,
  onVaultSnapshot,
}:{
  prefs:M6Preferences;
  onVaultReference:(name:string,url:string,tags:string[])=>void;
  onVaultSnapshot:(name:string,text:string,url:string)=>Promise<void>|void;
}){
  const [url,setUrl]=useState('https://example.com');
  const [address,setAddress]=useState(url);
  const [history,setHistory]=useState<string[]>([url]);
  const [historyIndex,setHistoryIndex]=useState(0);
  const [nativeError,setNativeError]=useState<string>();
  const [captureState,setCaptureState]=useState<string>();
  const frameRef=useRef<HTMLDivElement>(null);
  const webviewRef=useRef<NativeWebview|null>(null);
  const nativeLabelRef=useRef(0);

  const title=useMemo(()=>pageTitle(url),[url]);

  useEffect(()=>{
    if(!isTauri()||!frameRef.current)return;
    let disposed=false;
    let ro:ResizeObserver|undefined;
    let native:NativeWebview|null=null;
    const mount=async()=>{
      try{
        const [{ Webview },{ getCurrentWindow },{ LogicalPosition, LogicalSize }]=await Promise.all([
          import('@tauri-apps/api/webview'),
          import('@tauri-apps/api/window'),
          import('@tauri-apps/api/dpi'),
        ]);
        const rect=frameRef.current?.getBoundingClientRect();
        if(!rect||disposed)return;
        const label='xf-browser-'+(++nativeLabelRef.current);
        native=new Webview(getCurrentWindow(),label,{url,x:rect.left,y:rect.top,width:Math.max(100,rect.width),height:Math.max(100,rect.height)}) as unknown as NativeWebview;
        webviewRef.current=native;
        setNativeError(undefined);
        ro=new ResizeObserver(()=>{
          const r=frameRef.current?.getBoundingClientRect();
          if(!r||!native)return;
          void native.setPosition(new LogicalPosition(r.left,r.top));
          void native.setSize(new LogicalSize(Math.max(100,r.width),Math.max(100,r.height)));
        });
        ro.observe(frameRef.current);
      }catch(error){setNativeError(error instanceof Error?error.message:String(error));}
    };
    void mount();
    return()=>{disposed=true;ro?.disconnect();const current=native||webviewRef.current;webviewRef.current=null;if(current)void current.close().catch(()=>undefined);};
  },[url]);

  function navigate(raw=address,replace=false){
    const next=normalizeUrl(raw);
    setAddress(next);setUrl(next);
    if(replace)return;
    setHistory(current=>{
      const trimmed=current.slice(0,historyIndex+1);
      trimmed.push(next);
      setHistoryIndex(trimmed.length-1);
      return trimmed;
    });
  }
  function back(){if(historyIndex<=0)return;const i=historyIndex-1;setHistoryIndex(i);setAddress(history[i]);setUrl(history[i]);}
  function forward(){if(historyIndex>=history.length-1)return;const i=historyIndex+1;setHistoryIndex(i);setAddress(history[i]);setUrl(history[i]);}
  async function savePage(){
    setCaptureState('CAPTURING PAGE…');
    try{
      const res=await fetch(url,{credentials:'omit'});
      const text=await res.text();
      await onVaultSnapshot(title+' — offline page.html',text,url);
      setCaptureState('PAGE SAVED TO VAULT');
    }catch{onVaultReference(title,url,['browser','offline-pending']);setCaptureState('SOURCE BLOCKED BY CORS — BOOKMARK SAVED INSTEAD');}
  }
  async function savePack(){
    setCaptureState('BUILDING SITE PACK…');
    const pack=await buildSitePack(url,prefs.browserDepth,prefs.browserMaxPages);
    await onVaultSnapshot(title+' — site-pack.json',JSON.stringify(pack,null,2),url);
    setCaptureState(pack.pages.length+' PAGE(S) CAPTURED · '+pack.warnings.length+' WARNING(S)');
  }
  function saveBookmark(){onVaultReference(title,url,['browser','bookmark']);setCaptureState('BOOKMARK SAVED TO VAULT');}
  function vaultUrl(){onVaultReference(title,url,['browser','reference']);setCaptureState('REFERENCE SAVED TO VAULT');}

  return <section className="xf-page xf-browser-page">
    <div className="xf-browser-chrome">
      <div className="xf-browser-nav">
        <button onClick={back} disabled={historyIndex<=0}><ArrowLeft/></button>
        <button onClick={forward} disabled={historyIndex>=history.length-1}><ArrowRight/></button>
        <button onClick={()=>navigate(url,true)}><RefreshCw/></button>
        <div className="xf-browser-address"><ShieldCheck size={13}/><input value={address} onChange={e=>setAddress(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')navigate()}}/><button onClick={()=>navigate()}><Search size={14}/></button></div>
        <button onClick={()=>window.open(url,'_blank','noopener,noreferrer')}><ExternalLink/></button>
      </div>
      <div className="xf-browser-tools">
        <div><small>BROWSER TOOLS //</small><b>{title}</b></div>
        <button onClick={saveBookmark}><Bookmark size={15}/> BOOKMARK / SAVE SITE</button>
        <button onClick={vaultUrl}><Vault size={15}/> VAULT URL</button>
        <button onClick={()=>void savePage()}><Code2 size={15}/> SAVE PAGE SOURCE</button>
        <button className="hot" onClick={()=>void savePack()}><Download size={15}/> SITE PACK · D{prefs.browserDepth}</button>
      </div>
    </div>
    <div className="xf-browser-body">
      <aside className="xf-browser-history"><span>RECENT //</span>{history.slice().reverse().slice(0,10).map((item,index)=><button key={item+index} onClick={()=>navigate(item)}><Globe2 size={12}/><div><b>{pageTitle(item)}</b><small>{item}</small></div></button>)}</aside>
      <div className="xf-browser-webview" ref={frameRef}>
        {!isTauri()&&<iframe title="xFactor browser preview" src={url} sandbox="allow-scripts allow-forms allow-popups allow-same-origin"/>}
        {!isTauri()&&<div className="xf-browser-web-note">WEB PREVIEW // SOME SITES REFUSE EMBEDDING. DESKTOP USES A NATIVE CHILD WEBVIEW.</div>}
        {nativeError&&<div className="xf-local-only"><Globe2 size={22}/><b>NATIVE WEBVIEW DID NOT OPEN.</b><p>{nativeError}</p><button onClick={()=>window.open(url,'_blank','noopener,noreferrer')}>OPEN EXTERNALLY</button></div>}
      </div>
    </div>
    {captureState&&<div className="xf-browser-capture-state">{captureState}</div>}
    <footer className="xf-browser-ethics">CAPTURE BOUNDARY // PUBLIC OR USER-AUTHORIZED CONTENT ONLY · NO DRM / AUTH BYPASS · SITE PACKS ARE STATIC AND BOUNDED</footer>
  </section>;
}
