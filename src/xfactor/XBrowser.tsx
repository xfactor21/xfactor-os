import { useMemo, useState } from 'react';
import { Archive, Bookmark, Code2, Download, ExternalLink, Globe2, Image, Layers3, RefreshCw, Search, Video } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { isTauri } from '../lib/platform';

type BrowserFetch={url:string;status:number;contentType:string;text:string};
type BookmarkItem={id:string;url:string;title:string;createdAt:number};

const BOOKMARKS_KEY='xfactor-browser-bookmarks-v1';

function normalizeUrl(raw:string){
  const input=raw.trim();
  if(!input)return 'https://example.com';
  try{return new URL(input).toString()}catch{return new URL(`https://${input}`).toString()}
}
function readBookmarks():BookmarkItem[]{try{return JSON.parse(localStorage.getItem(BOOKMARKS_KEY)||'[]') as BookmarkItem[]}catch{return []}}
function saveBookmarks(items:BookmarkItem[]){try{localStorage.setItem(BOOKMARKS_KEY,JSON.stringify(items))}catch{/* local only */}}

async function fetchPage(url:string):Promise<BrowserFetch>{
  if(isTauri())return invoke<BrowserFetch>('browser_fetch',{url});
  const response=await fetch(url);
  return {url:response.url,status:response.status,contentType:response.headers.get('content-type')||'',text:await response.text()};
}
function sameOriginLinks(html:string,base:string){
  const doc=new DOMParser().parseFromString(html,'text/html');const baseUrl=new URL(base);
  return [...doc.querySelectorAll('a[href]')].map(a=>{try{return new URL(a.getAttribute('href')||'',baseUrl).toString()}catch{return ''}})
    .filter(Boolean).filter(url=>{try{return new URL(url).origin===baseUrl.origin}catch{return false}}).filter((v,i,a)=>a.indexOf(v)===i);
}
function pageTitle(html:string,fallback:string){return new DOMParser().parseFromString(html,'text/html').title||fallback}

export default function XBrowser({captureDepth=1,onVault}:{captureDepth?:0|1|2;onVault:(name:string,kind:'document'|'code'|'link'|'image'|'audio'|'video'|'other',blob:Blob|undefined,uri:string,tags:string[])=>Promise<void>}){
  const [url,setUrl]=useState('https://example.com');
  const [activeUrl,setActiveUrl]=useState('https://example.com');
  const [source,setSource]=useState<BrowserFetch>();
  const [busy,setBusy]=useState('');
  const [bookmarks,setBookmarks]=useState<BookmarkItem[]>(readBookmarks);
  const [media,setMedia]=useState<string[]>([]);

  const title=useMemo(()=>source?pageTitle(source.text,new URL(activeUrl).hostname):new URL(activeUrl).hostname,[source,activeUrl]);

  async function navigate(){
    const next=normalizeUrl(url);setUrl(next);setActiveUrl(next);setSource(undefined);setMedia([]);
  }
  async function ensureSource(){if(source&&source.url===activeUrl)return source;const next=await fetchPage(activeUrl);setSource(next);return next;}
  async function nativeOpen(){const next=normalizeUrl(activeUrl);if(isTauri())await invoke('browser_open_window',{url:next});else window.open(next,'_blank','noopener,noreferrer');}
  function addBookmark(){const item={id:crypto.randomUUID(),url:activeUrl,title,createdAt:Date.now()};const next=[item,...bookmarks.filter(x=>x.url!==activeUrl)].slice(0,200);setBookmarks(next);saveBookmarks(next);}
  async function vaultPage(){
    setBusy('SAVING PAGE');try{const page=await ensureSource();await onVault(`${pageTitle(page.text,new URL(activeUrl).hostname)}.html`,'document',new Blob([page.text],{type:'text/html'}),activeUrl,['browser','offline','page']);}finally{setBusy('')}
  }
  async function captureComponent(){
    const selector=window.prompt('CSS selector to capture from the current page', 'main')?.trim();if(!selector)return;
    setBusy('CAPTURING COMPONENT');try{const page=await ensureSource();const doc=new DOMParser().parseFromString(page.text,'text/html');const node=doc.querySelector(selector);if(!node)throw new Error(`No element matched ${selector}`);const code=`<!-- Source: ${activeUrl}\nSelector: ${selector} -->\n${node.outerHTML}\n`;await onVault(`component-${selector.replace(/[^a-z0-9]+/gi,'-').replace(/^-|-$/g,'')||'capture'}.html`,'code',new Blob([code],{type:'text/html'}),activeUrl,['browser','component','code']);}catch(error){alert(error instanceof Error?error.message:String(error))}finally{setBusy('')}
  }
  async function discoverMedia(){
    setBusy('SCANNING MEDIA');try{const page=await ensureSource();const doc=new DOMParser().parseFromString(page.text,'text/html');const urls=[...doc.querySelectorAll('video[src],audio[src],source[src],a[href]')].map(node=>node.getAttribute('src')||node.getAttribute('href')||'').map(raw=>{try{return new URL(raw,activeUrl).toString()}catch{return ''}}).filter(url=>/\.(mp4|webm|mov|mp3|wav|m4a|ogg)(\?|#|$)/i.test(url));setMedia([...new Set(urls)].slice(0,80));}finally{setBusy('')}
  }
  async function saveArchive(asProject:boolean){
    setBusy(asProject?'BUILDING PROJECT':'ARCHIVING SITE');
    try{
      const root=await ensureSource();const queue=[{url:activeUrl,depth:0}];const seen=new Set<string>();const pages:{url:string;html:string}[]=[];
      while(queue.length&&pages.length<18){const item=queue.shift()!;if(seen.has(item.url))continue;seen.add(item.url);let page=item.url===root.url?root:await fetchPage(item.url);pages.push({url:page.url,html:page.text});if(item.depth<captureDepth){for(const link of sameOriginLinks(page.text,page.url).slice(0,20))if(!seen.has(link))queue.push({url:link,depth:item.depth+1});}}
      const payload={format:'xfactor-site-project-v1',createdAt:new Date().toISOString(),root:activeUrl,depth:captureDepth,pages};
      const name=`${new URL(activeUrl).hostname}-${asProject?'project':'offline-site'}.xfsite.json`;
      await onVault(name,asProject?'code':'document',new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}),activeUrl,['browser',asProject?'project':'offline','site']);
      const href=URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=href;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(href),1000);
    }finally{setBusy('')}
  }

  return <section className="xf-page m6-browser">
    <div className="xf-section-head"><div><span className="kicker">BROWSER //</span><h1>STEAL THE USEFUL PARTS.</h1><p>Browse normally. Capture deliberately. Remote pages never inherit xFactor.OS native permissions.</p></div></div>
    <div className="xbrowser-chrome"><button onClick={()=>setActiveUrl(activeUrl)}><RefreshCw size={15}/></button><Globe2 size={16}/><input value={url} onChange={e=>setUrl(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')void navigate()}}/><button className="go" onClick={()=>void navigate()}>GO</button><button onClick={addBookmark}><Bookmark size={15}/> SAVE SITE</button><button onClick={()=>void nativeOpen()}><ExternalLink size={15}/> NATIVE TAB</button></div>
    <div className="xbrowser-tools">
      <button onClick={()=>void vaultPage()}><Archive/><b>SAVE PAGE</b><span>Offline HTML → Vault</span></button>
      <button onClick={()=>void saveArchive(false)}><Layers3/><b>PAGE + SUBPAGES</b><span>Depth {captureDepth} archive</span></button>
      <button onClick={()=>void saveArchive(true)}><Download/><b>SITE → PROJECT</b><span>Static retrievable pages</span></button>
      <button onClick={()=>void captureComponent()}><Code2/><b>CAPTURE COMPONENT</b><span>CSS selector → Components</span></button>
      <button onClick={()=>void discoverMedia()}><Video/><b>FIND MEDIA</b><span>Direct page media URLs</span></button>
      <button onClick={()=>void onVault(title,'link',undefined,activeUrl,['browser','bookmark'])}><Bookmark/><b>VAULT BOOKMARK</b><span>Reference with source URL</span></button>
    </div>
    {busy&&<div className="xbrowser-busy">{busy}…</div>}
    <div className="xbrowser-stage"><iframe title="xFactor browser preview" src={activeUrl} sandbox="allow-forms allow-scripts allow-popups" referrerPolicy="no-referrer"/><aside><div className="xbrowser-note"><b>EMBED PREVIEW</b><p>Some sites block embedding. Use NATIVE TAB for those; capture tools still work from the trusted xFactor.OS side when the page is publicly retrievable.</p></div>{media.length>0&&<div className="xbrowser-media"><b>DIRECT MEDIA</b>{media.map(item=><a key={item} href={item} target="_blank" rel="noreferrer"><Image size={12}/>{item}</a>)}</div>}<div className="xbrowser-bookmarks"><b>SAVED SITES</b>{bookmarks.slice(0,12).map(item=><button key={item.id} onClick={()=>{setUrl(item.url);setActiveUrl(item.url)}}><span>{item.title}</span><small>{new URL(item.url).hostname}</small></button>)}</div></aside></div>
  </section>;
}
