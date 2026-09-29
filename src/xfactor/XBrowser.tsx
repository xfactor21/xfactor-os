import { useMemo, useState } from 'react';
import { Archive, Bookmark, Box, Code2, Download, ExternalLink, Globe2, Layers3, RefreshCw, Search, ShieldCheck, Sparkles } from 'lucide-react';
import { isTauri } from '../lib/platform';
import type { OsSettings } from './osSettings';

type Inspection={url:string;title:string;description:string;links:string[];images:string[];scripts:string[];styles:string[];media:string[]};
type Audit={selector:string;matches:number;html:string[]};
type BookmarkItem={id:string;url:string;title:string;createdAt:number;captureRoot?:string;capturedAt?:number;capturedPages?:number;capturedAssets?:number};

const BOOKMARK_KEY='xfactor-browser-bookmarks-v1';
function readBookmarks():BookmarkItem[]{try{const p=JSON.parse(localStorage.getItem(BOOKMARK_KEY)||'[]');return Array.isArray(p)?p:[]}catch{return[]}}
function normalizeUrl(value:string){const raw=value.trim();if(!raw)return '';try{return new URL(/^https?:\/\//i.test(raw)?raw:`https://${raw}`).toString()}catch{return ''}}

export default function XBrowser({settings,onVaultLink,onVaultText}:{settings:OsSettings;onVaultLink:(url:string,name:string)=>void;onVaultText:(name:string,content:string)=>void}){
  const [address,setAddress]=useState('https://example.com/');
  const [current,setCurrent]=useState('https://example.com/');
  const [inspection,setInspection]=useState<Inspection>();
  const [audit,setAudit]=useState<Audit>();
  const [selector,setSelector]=useState('');
  const [bookmarks,setBookmarks]=useState<BookmarkItem[]>(readBookmarks);
  const [busy,setBusy]=useState<string>();
  const [message,setMessage]=useState('');
  const currentTitle=inspection?.title||new URL(current).hostname;

  function navigate(){
    const next=normalizeUrl(address);if(!next){setMessage('ENTER A VALID HTTP(S) ADDRESS.');return;}
    setCurrent(next);setAddress(next);setInspection(undefined);setAudit(undefined);setMessage('');
  }
  function persistBookmarks(next:BookmarkItem[]){setBookmarks(next);try{localStorage.setItem(BOOKMARK_KEY,JSON.stringify(next))}catch{/* local enhancement */}}
  function bookmark(){
    const existing=bookmarks.find(item=>item.url===current);
    if(existing){persistBookmarks(bookmarks.filter(item=>item.id!==existing.id));return;}
    persistBookmarks([{id:crypto.randomUUID(),url:current,title:currentTitle,createdAt:Date.now()},...bookmarks].slice(0,250));
  }
  async function invokeDesktop<T>(command:string,args:Record<string,unknown>):Promise<T>{
    if(!isTauri())throw new Error('This tool needs the installed desktop build.');
    const {invoke}=await import('@tauri-apps/api/core');
    return invoke<T>(command,args);
  }
  async function inspect(){
    setBusy('INSPECTING');setMessage('');
    try{const result=await invokeDesktop<Inspection>('browser_inspect',{url:current});setInspection(result);setMessage(`PAGE MAP // ${result.links.length} LINKS · ${result.images.length} IMAGES · ${result.media.length} MEDIA`);}
    catch(err){setMessage(err instanceof Error?err.message:String(err));}finally{setBusy(undefined)}
  }
  async function openIsolated(){
    setBusy('OPENING');setMessage('');
    try{await invokeDesktop<void>('browser_open',{url:current});setMessage('ISOLATED xBROWSER WINDOW OPEN. REMOTE CONTENT HAS NO LOCAL CAPABILITIES.');}
    catch(err){setMessage(err instanceof Error?err.message:String(err));}finally{setBusy(undefined)}
  }
  async function auditComponent(){
    if(!selector.trim())return;
    setBusy('AUDITING');setMessage('');
    try{const result=await invokeDesktop<Audit>('browser_audit_component',{url:current,selector:selector.trim()});setAudit(result);setMessage(`${result.matches} MATCHES FOR ${result.selector}`);}
    catch(err){setMessage(err instanceof Error?err.message:String(err));}finally{setBusy(undefined)}
  }
  async function capture(){
    if(!isTauri()){setMessage('SITE CAPTURE NEEDS THE INSTALLED DESKTOP BUILD.');return;}
    setBusy('CAPTURING');setMessage('');
    try{
      const {open}=await import('@tauri-apps/plugin-dialog');
      const destination=await open({directory:true,multiple:false,recursive:true,title:'Choose where xBrowser should save this public/authorized capture'});
      if(typeof destination!=='string')return;
      const result=await invokeDesktop<{root:string;pages:number;assets:number;bytes:number;manifest:string}>('browser_capture_site',{url:current,destination,depth:settings.browserCaptureDepth});
      setMessage(`CAPTURED ${result.pages} PAGES + ${result.assets} ASSETS // ${result.root}`);
      const previous=bookmarks.find(item=>item.url===current);
      const saved:BookmarkItem={id:previous?.id??crypto.randomUUID(),url:current,title:currentTitle,createdAt:previous?.createdAt??Date.now(),captureRoot:result.root,capturedAt:Date.now(),capturedPages:result.pages,capturedAssets:result.assets};
      persistBookmarks([saved,...bookmarks.filter(item=>item.url!==current)].slice(0,250));
      onVaultText(`${currentTitle} — xBrowser capture.json`,JSON.stringify({...result,source:current},null,2));
    }catch(err){setMessage(err instanceof Error?err.message:String(err));}finally{setBusy(undefined)}
  }

  const bookmarked=useMemo(()=>bookmarks.some(item=>item.url===current),[bookmarks,current]);

  return <section className="xf-page xbrowser-page">
    <div className="xf-section-head"><div><span className="kicker">xBROWSER //</span><h1>THE WEB, WITH TOOLS ATTACHED.</h1><p>Research, capture, audit, vault, and move useful pieces directly into the project. Remote pages never inherit local xFactor.OS permissions.</p></div><div className="xf-floor-actions"><button onClick={bookmark}><Bookmark size={15} fill={bookmarked?'currentColor':'none'}/>{bookmarked?'SAVED SITE':'SAVE SITE'}</button><button onClick={()=>onVaultLink(current,currentTitle)}><Archive size={15}/> VAULT PAGE</button><button className="pink" onClick={()=>void openIsolated()}><ExternalLink size={15}/> ISOLATED BROWSER</button></div></div>
    <div className="xbrowser-bar"><Globe2 size={16}/><input value={address} onChange={e=>setAddress(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')navigate()}}/><button onClick={navigate}>GO</button><button title="Reload embedded preview" onClick={()=>setCurrent(value=>value+'#xf-reload-'+Date.now())}><RefreshCw size={14}/></button></div>
    <div className="xbrowser-tools">
      <button onClick={()=>void inspect()}><Search size={15}/><b>MAP PAGE</b><span>links · assets · media</span></button>
      <button onClick={()=>void capture()}><Download size={15}/><b>CAPTURE SITE</b><span>offline project · depth {settings.browserCaptureDepth}</span></button>
      <button onClick={()=>inspection&&onVaultText(`${currentTitle} — page-map.json`,JSON.stringify(inspection,null,2))} disabled={!inspection}><Layers3 size={15}/><b>VAULT PAGE MAP</b><span>structure + resources</span></button>
      <div className="xbrowser-audit"><Code2 size={15}/><input value={selector} onChange={e=>setSelector(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')void auditComponent()}} placeholder="CSS SELECTOR · .hero · nav · #app"/><button disabled={!selector.trim()} onClick={()=>void auditComponent()}>AUDIT COMPONENT</button></div>
    </div>
    {message&&<div className="xbrowser-message"><ShieldCheck size={14}/>{busy?`${busy}…`:message}</div>}
    <div className="xbrowser-grid">
      <aside><header><Bookmark size={14}/> SAVED SITES <span>{bookmarks.length}</span></header>{bookmarks.length===0?<p>Saving in xBrowser is closer to keeping a working reference than a tiny star. CAPTURE SITE adds a bounded offline copy.</p>:bookmarks.slice(0,80).map(item=><button key={item.id} onClick={()=>{setAddress(item.url);setCurrent(item.url)}}><b>{item.title}</b><small>{item.url}</small>{item.captureRoot&&<em>OFFLINE · {item.capturedPages??1} PAGES · {item.capturedAssets??0} ASSETS</em>}</button>)}</aside>
      <main><div className="xbrowser-frame-head"><span>{current}</span><small>EMBEDDED PREVIEW · SITES MAY BLOCK FRAMING</small></div><iframe title="xBrowser embedded preview" src={current.split('#xf-reload-')[0]} sandbox="allow-forms allow-modals allow-popups allow-scripts allow-same-origin" referrerPolicy="no-referrer"/></main>
      <section className="xbrowser-inspector"><header><Sparkles size={14}/> TOOL OUTPUT</header>{inspection?<><b>{inspection.title||current}</b><p>{inspection.description||'No description reported.'}</p><div className="xbrowser-counts"><span>{inspection.links.length}<small>LINKS</small></span><span>{inspection.images.length}<small>IMAGES</small></span><span>{inspection.scripts.length}<small>SCRIPTS</small></span><span>{inspection.styles.length}<small>STYLES</small></span><span>{inspection.media.length}<small>MEDIA</small></span></div>{inspection.media.slice(0,8).map((url,index)=><div className="xbrowser-media" key={url}><a href={url} target="_blank" rel="noreferrer"><Box size={11}/>{url}</a><button onClick={()=>onVaultLink(url,`${currentTitle} — media ${index+1}`)}>VAULT LINK</button></div>)}</>:<p>Use MAP PAGE to inspect public HTML from the desktop backend without granting the remote page local access.</p>}{audit&&<div className="xbrowser-audit-result"><b>COMPONENT AUDIT // {audit.selector}</b><span>{audit.matches} MATCHES</span>{audit.html.slice(0,4).map((html,index)=><button key={index} onClick={()=>onVaultText(`${currentTitle}-component-${index+1}.html`,html)}>VAULT MATCH {index+1}</button>)}</div>}</section>
    </div>
    <div className="xbrowser-ethics"><ShieldCheck size={13}/><span>Capture is bounded to public/authorized HTTP(S), same-origin pages/resources, and never bypasses logins, DRM, paywalls, robots, or access controls. Direct media is reported only when the page exposes a normal source URL.</span></div>
  </section>;
}
