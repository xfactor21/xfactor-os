import { useMemo, useState } from 'react';
import { Archive, ArrowLeft, ArrowRight, BookMarked, Code2, Download, ExternalLink, Globe2, Image, RefreshCw, Search, Star, Video } from 'lucide-react';
import type { AssetKind } from './domain';
import { loadM6Settings } from './m6Settings';
import { isTauri } from '../lib/platform';

type Bookmark = { id: string; url: string; title: string; createdAt: number };
type MediaHit = { url: string; kind: 'image'|'audio'|'video'|'style'|'script' };
type DesktopHtml = { text: string; finalUrl: string; contentType: string };
type DesktopAsset = { bytes: number[]; finalUrl: string; contentType: string };

const BOOKMARK_KEY = 'xfactor-m6-browser-bookmarks-v1';

function loadBookmarks(): Bookmark[] {
  try { const raw=JSON.parse(localStorage.getItem(BOOKMARK_KEY)||'[]'); return Array.isArray(raw)?raw:[]; } catch { return []; }
}
function saveBookmarks(items: Bookmark[]) { localStorage.setItem(BOOKMARK_KEY, JSON.stringify(items.slice(0,250))); }
function normalizeUrl(raw: string) {
  const value=raw.trim();
  if (!value) return 'https://planet-x.co';
  try { return new URL(/^https?:\/\//i.test(value)?value:'https://'+value).toString(); } catch { return 'https://planet-x.co'; }
}
function filenameFromUrl(url:string,fallback='capture.html'){ try { const u=new URL(url); const leaf=u.pathname.split('/').filter(Boolean).pop(); return leaf || fallback; } catch { return fallback; } }

export default function BrowserRoom({
  onVaultReference,
  onVaultBlob,
  onOpenVault,
}: {
  onVaultReference:(name:string,url:string,kind?:AssetKind,tags?:string[])=>void;
  onVaultBlob:(name:string,blob:Blob,kind:AssetKind,tags?:string[])=>Promise<void>;
  onOpenVault:()=>void;
}) {
  const [current,setCurrent]=useState('https://planet-x.co');
  const [address,setAddress]=useState(current);
  const [history,setHistory]=useState<string[]>([current]);
  const [historyIndex,setHistoryIndex]=useState(0);
  const [bookmarks,setBookmarks]=useState<Bookmark[]>(loadBookmarks);
  const [status,setStatus]=useState('READY');
  const [source,setSource]=useState('');
  const [selector,setSelector]=useState('');
  const [media,setMedia]=useState<MediaHit[]>([]);
  const [panel,setPanel]=useState<'tools'|'bookmarks'|'source'>('tools');

  async function invokeDesktop<T>(command:string,args:Record<string,unknown>):Promise<T>{
    const {invoke}=await import('@tauri-apps/api/core');
    return invoke<T>(command,args);
  }

  const canBack=historyIndex>0, canForward=historyIndex<history.length-1;
  const host=useMemo(()=>{try{return new URL(current).host}catch{return current}},[current]);

  function navigate(raw=address) {
    const url=normalizeUrl(raw);
    const next=[...history.slice(0,historyIndex+1),url];
    setHistory(next);setHistoryIndex(next.length-1);setCurrent(url);setAddress(url);setStatus('NAVIGATED');
  }

  async function openIsolated(raw=current) {
    const url=normalizeUrl(raw);
    if(!isTauri()){window.open(url,'_blank','noopener,noreferrer');return;}
    try {
      const { WebviewWindow } = await import('@tauri-apps/api/webviewWindow');
      const label='xf-browser-'+Date.now();
      new WebviewWindow(label,{url,title:`xFactor Browser // ${new URL(url).hostname}`,width:1220,height:820,resizable:true,focus:true});
      setStatus('ISOLATED DESKTOP WEBVIEW OPEN');
    } catch(err) {
      setStatus('WEBVIEW OPEN FAILED: '+(err instanceof Error?err.message:String(err)));
    }
  }
  function back(){if(!canBack)return;const i=historyIndex-1;setHistoryIndex(i);setCurrent(history[i]);setAddress(history[i]);}
  function forward(){if(!canForward)return;const i=historyIndex+1;setHistoryIndex(i);setCurrent(history[i]);setAddress(history[i]);}

  async function fetchHtml(url=current) {
    if(isTauri()){
      const result=await invokeDesktop<DesktopHtml>('browser_fetch_html',{url});
      return {text:result.text,finalUrl:result.finalUrl};
    }
    const response=await fetch(url,{credentials:'omit',redirect:'follow'});
    if(!response.ok)throw new Error('HTTP '+response.status);
    const type=response.headers.get('content-type')||'';
    if(!type.includes('text/html'))throw new Error('Not HTML ('+(type||'unknown type')+')');
    const text=await response.text();
    if(text.length>4_000_000)throw new Error('Page exceeds the 4 MB capture safety cap.');
    return {text,finalUrl:response.url||url};
  }

  function scanMedia(html:string,base:string){
    const doc=new DOMParser().parseFromString(html,'text/html');
    const hits:MediaHit[]=[];
    const add=(raw:string|null,kind:MediaHit['kind'])=>{if(!raw)return;try{hits.push({url:new URL(raw,base).toString(),kind})}catch{}};
    doc.querySelectorAll('img[src]').forEach(n=>add(n.getAttribute('src'),'image'));
    doc.querySelectorAll('video[src],video source[src]').forEach(n=>add(n.getAttribute('src'),'video'));
    doc.querySelectorAll('audio[src],audio source[src]').forEach(n=>add(n.getAttribute('src'),'audio'));
    doc.querySelectorAll('link[rel="stylesheet"][href]').forEach(n=>add(n.getAttribute('href'),'style'));
    doc.querySelectorAll('script[src]').forEach(n=>add(n.getAttribute('src'),'script'));
    setMedia(Array.from(new Map(hits.map(hit=>[hit.url,hit])).values()).slice(0,120));
  }

  async function inspectPage() {
    setStatus('FETCHING PAGE...');
    try { const result=await fetchHtml();setSource(result.text);scanMedia(result.text,result.finalUrl);setPanel('source');setStatus('PAGE SOURCE READY'); }
    catch(err){setStatus('CAPTURE BLOCKED: '+(err instanceof Error?err.message:String(err)))}
  }

  function bookmark() {
    const title=host||current;
    const next=[{id:crypto.randomUUID(),url:current,title,createdAt:Date.now()},...bookmarks.filter(b=>b.url!==current)];
    setBookmarks(next);saveBookmarks(next);onVaultReference(title,current,'link',['browser-bookmark']);setStatus('BOOKMARKED + VAULTED');
  }

  async function archivePage() {
    setStatus('ARCHIVING PAGE...');
    try {
      const result=await fetchHtml();
      await onVaultBlob(filenameFromUrl(result.finalUrl,'page')+'.html',new Blob([result.text],{type:'text/html'}),'document',['browser-offline','web-page']);
      scanMedia(result.text,result.finalUrl);setSource(result.text);setStatus('PAGE SAVED TO VAULT');
    } catch(err){setStatus('ARCHIVE BLOCKED: '+(err instanceof Error?err.message:String(err)))}
  }

  async function captureProject() {
    const settings=loadM6Settings();
    setStatus('CRAWLING SITE...');
    try {
      const start=new URL(current);
      const queue:Array<{url:string;depth:number}>=[{url:start.toString(),depth:0}];
      const seen=new Set<string>();const pages:Array<{url:string;html:string}>=[];
      while(queue.length&&pages.length<settings.browserMaxPages){
        const next=queue.shift()!;if(seen.has(next.url))continue;seen.add(next.url);
        const result=await fetchHtml(next.url);pages.push({url:result.finalUrl,html:result.text});
        if(next.depth>=settings.browserCaptureDepth)continue;
        const doc=new DOMParser().parseFromString(result.text,'text/html');
        for(const a of Array.from(doc.querySelectorAll('a[href]'))){
          try{const url=new URL(a.getAttribute('href')!,result.finalUrl);url.hash='';if(url.origin===start.origin&&!seen.has(url.toString()))queue.push({url:url.toString(),depth:next.depth+1});}catch{}
        }
      }
      const payload={format:'xfactor-site-capture-v1',capturedAt:new Date().toISOString(),root:start.toString(),depth:settings.browserCaptureDepth,pages};
      await onVaultBlob(start.hostname+'-site-capture.json',new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}),'code',['browser-project','offline-site']);
      setStatus('PROJECT CAPTURED · '+pages.length+' PAGES');
    } catch(err){setStatus('PROJECT CAPTURE BLOCKED: '+(err instanceof Error?err.message:String(err)))}
  }

  async function saveComponent() {
    if(!selector.trim()){setStatus('ENTER A CSS SELECTOR FIRST');return;}
    setStatus('AUDITING COMPONENT...');
    try {
      const result=await fetchHtml();
      const doc=new DOMParser().parseFromString(result.text,'text/html');
      const node=doc.querySelector(selector);
      if(!node)throw new Error('Selector matched nothing.');
      const bundle='<!-- Captured from '+result.finalUrl+' selector: '+selector+' -->\n'+node.outerHTML;
      await onVaultBlob('component-'+(selector.replace(/[^a-z0-9_-]+/gi,'-').slice(0,60)||'capture')+'.html',new Blob([bundle],{type:'text/html'}),'code',['component','browser-audit']);
      setStatus('COMPONENT SAVED TO VAULT');
    } catch(err){setStatus('COMPONENT AUDIT BLOCKED: '+(err instanceof Error?err.message:String(err)))}
  }

  async function vaultMedia(hit:MediaHit){
    const kind:AssetKind=hit.kind==='image'?'image':hit.kind==='video'?'video':hit.kind==='audio'?'audio':hit.kind==='script'||hit.kind==='style'?'code':'link';
    try {
      let blob:Blob;
      let finalUrl=hit.url;
      if(isTauri()){
        const result=await invokeDesktop<DesktopAsset>('browser_fetch_asset',{url:hit.url});
        blob=new Blob([new Uint8Array(result.bytes)],{type:result.contentType||'application/octet-stream'});
        finalUrl=result.finalUrl||hit.url;
      }else{
        const r=await fetch(hit.url,{credentials:'omit'});if(!r.ok)throw new Error('HTTP '+r.status);
        blob=await r.blob();if(blob.size>12_000_000)throw new Error('Asset exceeds 12 MB capture cap.');
      }
      await onVaultBlob(filenameFromUrl(finalUrl,'asset-'+Date.now()),blob,kind,['browser-asset']);
      setStatus('ASSET SAVED TO VAULT');
    } catch { onVaultReference(filenameFromUrl(hit.url),hit.url,kind,['browser-asset','remote-reference']);setStatus('REMOTE ASSET SAVED AS VAULT REFERENCE'); }
  }

  return <section className="xf-page m6-browser-room">
    <div className="xf-section-head"><div><span className="kicker">BROWSER //</span><h1>STEAL THE USEFUL PARTS.</h1><p>An xFactor research browser: browse, bookmark, capture accessible page source, archive bounded same-origin projects, and throw useful fragments straight into the Vault.</p></div><button className="xf-big-action" onClick={onOpenVault}><Archive size={15}/> OFFLINE VAULT</button></div>

    <div className="m6-browser-chrome">
      <div className="m6-browser-nav"><button disabled={!canBack} onClick={back}><ArrowLeft/></button><button disabled={!canForward} onClick={forward}><ArrowRight/></button><button onClick={()=>setCurrent(current)}><RefreshCw/></button></div>
      <div className="m6-address"><Globe2/><input value={address} onChange={e=>setAddress(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')navigate()}}/><button onClick={()=>navigate()}>GO</button></div>
      <button className="m6-bookmark" onClick={bookmark}><Star size={15}/> SAVE SITE</button>
      <button className="m6-browser-isolated" onClick={()=>void openIsolated()}><ExternalLink size={15}/> {isTauri()?'OPEN ISOLATED':'OPEN TAB'}</button>
    </div>

    <div className="m6-browser-status"><b>{host}</b><span>{status}</span><small>{isTauri()?'REMOTE SITES OPEN IN A NON-PRIVILEGED CHILD WEBVIEW · ':''}DESKTOP CAPTURE USES A BOUNDED PUBLIC-NETWORK FETCHER · NO LOCAL NETWORK / AUTH / DRM BYPASS</small></div>

    <div className="m6-browser-layout">
      <section className="m6-browser-frame"><iframe key={current} title="xFactor browser" src={current} sandbox="allow-scripts allow-forms allow-same-origin allow-popups allow-downloads"/></section>
      <aside className="m6-browser-tools">
        <div className="m6-browser-tabs"><button className={panel==='tools'?'active':''} onClick={()=>setPanel('tools')}>TOOLS</button><button className={panel==='bookmarks'?'active':''} onClick={()=>setPanel('bookmarks')}>BOOKMARKS</button><button className={panel==='source'?'active':''} onClick={()=>setPanel('source')}>SOURCE</button></div>
        {panel==='tools'&&<div className="m6-browser-tool-list">
          <button onClick={()=>void archivePage()}><Archive/><div><b>ARCHIVE PAGE</b><span>Save accessible HTML to the Vault for offline reference.</span></div></button>
          <button onClick={()=>void captureProject()}><Download/><div><b>CAPTURE SITE AS PROJECT</b><span>Bounded same-origin crawl using your Settings depth/page cap.</span></div></button>
          <button onClick={()=>void inspectPage()}><Search/><div><b>SCAN PAGE ASSETS</b><span>Find directly referenced images, media, scripts and styles.</span></div></button>
          <div className="m6-component-audit"><Code2/><input value={selector} onChange={e=>setSelector(e.target.value)} placeholder=".component, #hero, article"/><button onClick={()=>void saveComponent()}>SAVE COMPONENT</button></div>
          {media.length>0&&<div className="m6-media-list"><b>PAGE ASSETS // {media.length}</b>{media.slice(0,40).map(hit=>{const I=hit.kind==='image'?Image:hit.kind==='video'||hit.kind==='audio'?Video:Code2;return <button key={hit.url} onClick={()=>void vaultMedia(hit)}><I/><span>{filenameFromUrl(hit.url)}</span><small>{hit.kind.toUpperCase()}</small></button>})}</div>}
        </div>}
        {panel==='bookmarks'&&<div className="m6-bookmark-list">{bookmarks.length?bookmarks.map(b=><button key={b.id} onClick={()=>navigate(b.url)}><BookMarked/><span>{b.title}</span><small>{b.url}</small></button>):<div className="m6-browser-empty">SAVE A SITE AND IT BECOMES A FIRST-CLASS REFERENCE HERE AND IN THE VAULT.</div>}</div>}
        {panel==='source'&&<div className="m6-source-view">{source?<pre>{source.slice(0,180000)}</pre>:<div className="m6-browser-empty">SCAN OR ARCHIVE THE CURRENT PAGE TO LOAD ACCESSIBLE SOURCE HERE.</div>}</div>}
      </aside>
    </div>
  </section>;
}
