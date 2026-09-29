import { useEffect, useMemo, useState } from 'react';
import { FileCode2, Folder, FolderOpen, RefreshCw, Search, ShieldCheck } from 'lucide-react';
import { chooseProjectFolder, flattenProjectFiles, readProjectTextFile, scanProjectFolder, type ProjectEntry, type ProjectScanResult } from '../lib/projectFolder';
import { isTauri } from '../lib/platform';

const KEY='xfactor-files-root-v1';

function Tree({entries,onOpen}:{entries:ProjectEntry[];onOpen:(path:string)=>void}) {
  return <div className="xfiles-tree">{entries.map(entry => entry.kind === 'directory'
    ? <details key={entry.relativePath} open={entry.depth<1}><summary style={{paddingLeft:6+entry.depth*10}}><Folder size={13}/>{entry.name}</summary>{entry.children && <Tree entries={entry.children} onOpen={onOpen}/>}</details>
    : <button key={entry.relativePath} style={{paddingLeft:20+entry.depth*10}} onClick={()=>onOpen(entry.relativePath)}><FileCode2 size={12}/><span>{entry.name}</span></button>)}</div>;
}

export default function XFilesExplorer(){
  const [root,setRoot]=useState(()=>localStorage.getItem(KEY)??'');
  const [scan,setScan]=useState<ProjectScanResult>();
  const [active,setActive]=useState('');
  const [content,setContent]=useState('');
  const [query,setQuery]=useState('');
  const [error,setError]=useState('');

  async function rescan(path=root){
    if(!path)return;
    setError('');
    try{setScan(await scanProjectFolder(path));}
    catch(err){setError(err instanceof Error?err.message:String(err));}
  }
  useEffect(()=>{if(root&&isTauri())void rescan(root);},[root]);

  async function pick(){
    try{
      const path=await chooseProjectFolder(); if(!path)return;
      localStorage.setItem(KEY,path);setRoot(path);await rescan(path);
    }catch(err){setError(err instanceof Error?err.message:String(err));}
  }
  async function openFile(path:string){
    setActive(path);
    try{setContent(await readProjectTextFile(root,path));setError('');}
    catch{setContent('Preview unavailable for this file type.');}
  }

  const matches=useMemo(()=>query.trim()&&scan?flattenProjectFiles(scan.entries).filter(file=>file.relativePath.toLowerCase().includes(query.toLowerCase())).slice(0,100):[],[query,scan]);

  return <section className="xf-page xfiles">
    <div className="xf-section-head"><div><span className="kicker">FILES //</span><h1>FRACTURE THE FILESYSTEM.</h1><p>A project-aware local explorer. xFactor.OS only touches the folder you explicitly choose.</p></div><div className="xf-floor-actions"><button onClick={()=>void pick()}><FolderOpen size={15}/> {root?'CHANGE ROOT':'OPEN ROOT'}</button><button disabled={!root} onClick={()=>void rescan()}><RefreshCw size={14}/> RESCAN</button></div></div>
    {!isTauri()?<div className="xf-empty"><ShieldCheck size={24}/><b>DESKTOP-ONLY FILE ACCESS</b><p>The web build intentionally cannot browse your machine. Install xFactor.OS to use Files.</p></div>:!root?<div className="xf-empty"><FolderOpen size={24}/><b>CHOOSE A ROOT</b><p>Pick a project or workspace folder. The persisted Tauri scope keeps access bounded to what you approved.</p></div>:<>
      <div className="xfiles-root"><span>ROOT //</span><b>{root}</b><i>{scan?.fileCount??0} FILES · {scan?.directoryCount??0} DIRS{scan?.truncated?' · BOUNDED VIEW':''}</i></div>
      <div className="xfiles-grid">
        <aside><label><Search size={13}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="FILTER PATHS..."/></label>{query?<div className="xfiles-matches">{matches.map(file=><button key={file.relativePath} onClick={()=>void openFile(file.relativePath)}>{file.relativePath}</button>)}</div>:scan?<Tree entries={scan.entries} onOpen={path=>void openFile(path)}/>:null}</aside>
        <article><div className="xfiles-preview-head"><b>{active||'SELECT A FILE'}</b><span>READ-ONLY PREVIEW</span></div><pre>{content||'Pick a text/code file from the fracture tree. Editing stays in BUILD so there is one authoritative project editor.'}</pre></article>
      </div>
    </>}
    {error&&<div className="dev-error">{error}</div>}
  </section>;
}
