import { useMemo, useState } from 'react';
import { Archive, Bookmark, ExternalLink, Globe2, Search, ShieldCheck, Trash2 } from 'lucide-react';
import { isTauri } from '../lib/platform';

type BookmarkItem={id:string;url:string;title:string;createdAt:number};
const KEY='xfactor-browser-bookmarks-v1';
const load=():BookmarkItem[]=>{try{return JSON.parse(localStorage.getItem(KEY)||'[]')}catch{return[]}};
const valid=(value:string)=>{try{const url=new URL(value.includes('://')?value:'https://'+value);return ['http:','https:'].includes(url.protocol)?url.toString():undefined}catch{return undefined}};

export default function XBrowser({onVault}:{onVault:(url:string,title:string)=>void}){
  const [input,setInput]=useState('https://planet-x.co');
  const [current,setCurrent]=useState('https://planet-x.co');
  const [bookmarks,setBookmarks]=useState<BookmarkItem[]>(load);
  const [query,setQuery]=useState('');
  const filtered=useMemo(()=>bookmarks.filter(b=>!query||`${b.title} ${b.url}`.toLowerCase().includes(query.toLowerCase())),[bookmarks,query]);

  function persist(next:BookmarkItem[]){setBookmarks(next);localStorage.setItem(KEY,JSON.stringify(next));}
  async function go(){
    const url=valid(input);if(!url)return;
    setCurrent(url);setInput(url);
    if(isTauri()){
      const {WebviewWindow}=await import('@tauri-apps/api/webviewWindow');
      const label='xf-browser-'+Date.now();
      new WebviewWindow(label,{url,title:`xFactor Browser // ${new URL(url).hostname}`,width:1180,height:780,resizable:true});
    }else window.open(url,'_blank','noopener,noreferrer');
  }
  function bookmark(){
    const url=valid(current);if(!url)return;
    const title=new URL(url).hostname;
    if(bookmarks.some(b=>b.url===url))return;
    persist([{id:crypto.randomUUID(),url,title,createdAt:Date.now()},...bookmarks]);
  }

  return <section className="xf-page xbrowser">
    <div className="xf-section-head"><div><span className="kicker">BROWSER //</span><h1>STEAL CONTEXT. NOT FOCUS.</h1><p>An isolated research browser that feeds useful references back into the project instead of becoming another place to get lost.</p></div></div>
    <div className="xbrowser-bar"><Globe2 size={17}/><input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')void go()}}/><button onClick={()=>void go()}>OPEN IN X-BROWSER</button><button onClick={bookmark}><Bookmark size={14}/> BOOKMARK</button><button onClick={()=>onVault(current,new URL(valid(current)||'https://example.com').hostname)}><Archive size={14}/> SEND TO VAULT</button></div>
    <div className="xbrowser-grid">
      <article className="xbrowser-stage"><div className="xbrowser-safe"><ShieldCheck size={28}/><b>ISOLATED WEBVIEW</b><p>Remote sites open in their own xFactor browser window, outside the privileged main-window filesystem capability. That is deliberate: arbitrary web content never gets direct project-file access.</p><small>{current}</small></div>
        <div className="xbrowser-tools"><b>BUILT-IN RESEARCH TOOLS //</b><span>BOOKMARK → persistent reference</span><span>VAULT → attach URL to project</span><span className="planned">SOURCE AUDIT / COMPONENT CAPTURE / OFFLINE WACZ → staged for the archive engine</span></div>
      </article>
      <aside className="xbrowser-bookmarks"><div><Search size={13}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="SEARCH SAVED SITES..."/></div><h3>SAVED SITES</h3>{filtered.length?filtered.map(item=><section key={item.id}><button onClick={()=>{setInput(item.url);setCurrent(item.url);void go()}}><b>{item.title}</b><small>{item.url}</small></button><button title="Remove bookmark" onClick={()=>persist(bookmarks.filter(b=>b.id!==item.id))}><Trash2 size={12}/></button></section>):<p>No bookmarks yet.</p>}<button className="xbrowser-vault-jump" onClick={()=>onVault(current,'Browser reference')}><ExternalLink size={13}/> VAULT CURRENT URL</button></aside>
    </div>
  </section>;
}
