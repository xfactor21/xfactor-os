import { useMemo, useState } from 'react';
import { ChevronRight, File, Folder, FolderOpen, RefreshCw, Search, Sparkles } from 'lucide-react';
import { isTauri } from '../lib/platform';
import { chooseProjectFolder, flattenProjectFiles, readProjectTextFile, scanProjectFolder, type ProjectEntry, type ProjectScanResult } from '../lib/projectFolder';

function flatten(entries:ProjectEntry[]):ProjectEntry[]{const out:ProjectEntry[]=[];const walk=(items:ProjectEntry[])=>{for(const item of items){out.push(item);if(item.children)walk(item.children)}};walk(entries);return out;}

export default function LocalFileExplorer(){
  const [scan,setScan]=useState<ProjectScanResult>();
  const [selected,setSelected]=useState<ProjectEntry>();
  const [preview,setPreview]=useState('');
  const [query,setQuery]=useState('');
  const [busy,setBusy]=useState(false);
  const all=useMemo(()=>scan?flatten(scan.entries):[],[scan]);
  const visible=useMemo(()=>all.filter(entry=>!query||entry.relativePath.toLowerCase().includes(query.toLowerCase())).slice(0,1200),[all,query]);

  async function choose(){
    setBusy(true);
    try{const root=await chooseProjectFolder();if(root){const next=await scanProjectFolder(root,{maxEntries:8000,maxDepth:30});setScan(next);setSelected(undefined);setPreview('');}}
    finally{setBusy(false)}
  }
  async function open(entry:ProjectEntry){
    setSelected(entry);
    if(entry.kind==='file'&&scan){
      try{setPreview(await readProjectTextFile(scan.rootPath,entry.relativePath));}
      catch{setPreview('PREVIEW NOT AVAILABLE FOR THIS FILE TYPE.');}
    }
  }
  if(!isTauri())return <section className="xf-page m6-files"><div className="xf-section-head"><div><span className="kicker">FILES //</span><h1>THE RIFT EXPLORER.</h1><p>Desktop-only native filesystem view. Web builds stay sandboxed.</p></div></div><div className="xf-empty"><Sparkles/><b>INSTALL THE WINDOWS BUILD</b><p>Rift Explorer only opens folders you explicitly select on the desktop app.</p></div></section>;

  const crumbs=scan?.rootPath.split(/[\\/]/).filter(Boolean)??[];
  return <section className="xf-page m6-files">
    <div className="xf-section-head"><div><span className="kicker">FILES //</span><h1>THE RIFT EXPLORER.</h1><p>A filesystem that feels like a project map instead of a beige filing cabinet.</p></div><div className="xf-floor-actions"><button className="pink" onClick={()=>void choose()}><FolderOpen size={16}/>{scan?'CHANGE ROOT':'OPEN FOLDER'}</button>{scan&&<button onClick={()=>void choose()}><RefreshCw size={15}/>RESCAN</button>}</div></div>
    {scan&&<><div className="rift-breadcrumb"><span>ROOT</span>{crumbs.map((part,index)=><span key={index}><ChevronRight size={12}/>{part}</span>)}</div>
    <div className="rift-search"><Search size={15}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="FILTER THIS FILESYSTEM..."/><span>{scan.fileCount} FILES · {scan.directoryCount} DIRS</span></div>
    <div className="rift-layout"><aside className="rift-tree">{visible.map(entry=><button key={entry.relativePath} className={selected?.relativePath===entry.relativePath?'active':''} style={{paddingLeft:10+entry.depth*13}} onClick={()=>void open(entry)}>{entry.kind==='directory'?<Folder size={14}/>:<File size={13}/>}<span>{entry.name}</span><i>{entry.kind==='directory'?'DIR':entry.relativePath.split('.').pop()?.toUpperCase()}</i></button>)}</aside>
    <section className="rift-inspector">{selected?<><div className="rift-inspector-head"><b>{selected.name}</b><span>{selected.relativePath}</span></div>{selected.kind==='file'?<pre>{preview.slice(0,120000)}</pre>:<div className="rift-folder-map"><FolderOpen size={42}/><b>DIRECTORY NODE</b><p>Expand through the left-side rift map. Drag/drop + richer file operations are isolated from the project Workbench for now.</p></div>}</>:<div className="rift-folder-map"><FolderOpen size={42}/><b>{busy?'OPENING...':'PICK A NODE'}</b><p>Text/code files preview here. The Workbench remains the place to edit project code.</p></div>}</section></div></>}
  </section>;
}
