import { useMemo, useState } from 'react';
import { Boxes, ChevronRight, FileCode2, FileText, Folder, FolderOpen, Search, Sparkles, TerminalSquare } from 'lucide-react';
import { chooseProjectFolder, flattenProjectFiles, isLikelyTextProjectFile, readProjectTextFile, scanProjectFolder, type ProjectEntry, type ProjectScanResult } from '../lib/projectFolder';
import { isTauri } from '../lib/platform';
import { bindLocalProject } from './localProjectBindings';

type ExplorerMode='strata'|'mosaic'|'list';

function extension(path:string){
  const name=path.split('/').pop()||path;
  const index=name.lastIndexOf('.');
  return index>0?name.slice(index+1).toLowerCase():'—';
}

function collectDirectories(entries:ProjectEntry[]){
  const result:ProjectEntry[]=[];
  const walk=(items:ProjectEntry[])=>items.forEach(item=>{if(item.kind==='directory'){result.push(item);if(item.children)walk(item.children)}});
  walk(entries);return result;
}

export default function XFiles({activeIncidentId,onOpenWorkbench}:{activeIncidentId?:string;onOpenWorkbench:()=>void}){
  const [scan,setScan]=useState<ProjectScanResult>();
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState<string>();
  const [query,setQuery]=useState('');
  const [mode,setMode]=useState<ExplorerMode>('strata');
  const [selected,setSelected]=useState<string>();
  const [preview,setPreview]=useState('');
  const files=useMemo(()=>scan?flattenProjectFiles(scan.entries):[],[scan]);
  const dirs=useMemo(()=>scan?collectDirectories(scan.entries):[],[scan]);
  const filtered=useMemo(()=>files.filter(file=>!query||file.relativePath.toLowerCase().includes(query.toLowerCase())),[files,query]);
  const extStats=useMemo(()=>{
    const map=new Map<string,number>();
    files.forEach(file=>map.set(extension(file.relativePath),(map.get(extension(file.relativePath))||0)+1));
    return [...map.entries()].sort((a,b)=>b[1]-a[1]).slice(0,10);
  },[files]);

  async function choose(){
    if(!isTauri()){setError('xFILES needs the installed desktop build for real filesystem access.');return;}
    setBusy(true);setError(undefined);
    try{
      const root=await chooseProjectFolder();
      if(!root)return;
      const next=await scanProjectFolder(root,{maxEntries:7000,maxDepth:28});
      setScan(next);setSelected(undefined);setPreview('');
    }catch(err){setError(err instanceof Error?err.message:String(err));}
    finally{setBusy(false);}
  }

  async function openFile(path:string){
    setSelected(path);setPreview('');
    if(!scan||!isLikelyTextProjectFile(path))return;
    try{
      const text=await readProjectTextFile(scan.rootPath,path);
      setPreview(text.slice(0,12000));
    }catch(err){setPreview(err instanceof Error?err.message:String(err));}
  }

  function sendToWorkbench(){
    if(!scan||!activeIncidentId)return;
    bindLocalProject(activeIncidentId,scan.rootPath);
    onOpenWorkbench();
  }

  return <section className="xf-page xfiles-page">
    <div className="xf-section-head"><div><span className="kicker">xFILES //</span><h1>THE FILESYSTEM, UNFLATTENED.</h1><p>A local-first explorer that treats folders like terrain instead of a beige tree. Nothing is indexed until you choose a root.</p></div><div className="xf-floor-actions"><button onClick={()=>void choose()}><FolderOpen size={16}/>{busy?'SCANNING…':scan?'CHANGE ROOT':'OPEN LOCAL ROOT'}</button>{scan&&<button className="pink" disabled={!activeIncidentId} onClick={sendToWorkbench}><TerminalSquare size={16}/> BIND TO WORKBENCH</button>}</div></div>
    {!isTauri()&&<div className="xfiles-desktop-callout"><Sparkles/><div><b>DESKTOP SURFACE</b><p>The web build shows the design, but Windows xFactor.OS owns the real filesystem bridge.</p></div></div>}
    {error&&<div className="dev-error">{error}</div>}
    {!scan?<div className="xfiles-empty"><FolderOpen size={40}/><b>NO ROOT MOUNTED.</b><p>Pick a project, workspace, drive folder, or messy desktop corner. xFILES scans metadata only and skips common generated directories.</p></div>:<>
      <div className="xfiles-commandbar"><div className="xfiles-root"><Folder/><span>{scan.rootPath}</span><small>{scan.fileCount} FILES · {scan.directoryCount} DIRS{scan.truncated?' · BOUNDED SCAN':''}</small></div><div className="xfiles-search"><Search size={15}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="FILTER THIS ROOT…"/></div><div className="xfiles-modes">{(['strata','mosaic','list'] as ExplorerMode[]).map(value=><button className={mode===value?'active':''} onClick={()=>setMode(value)} key={value}>{value.toUpperCase()}</button>)}</div></div>
      <div className="xfiles-stats">{extStats.map(([ext,count],index)=><div key={ext}><i style={{height:`${Math.max(14,70-index*5)}%`}}/><b>{ext}</b><span>{count}</span></div>)}</div>
      <div className={`xfiles-workspace mode-${mode}`}>
        <aside><header><Boxes size={14}/> STRATA <span>{dirs.length}</span></header>{dirs.slice(0,100).map(dir=><button key={dir.relativePath} onClick={()=>setQuery(dir.relativePath+'/')}><Folder size={13}/><span>{dir.name}</span><small>{dir.depth}</small><ChevronRight size={11}/></button>)}</aside>
        <main>{filtered.slice(0,500).map(file=><button className={selected===file.relativePath?'active':''} key={file.relativePath} onClick={()=>void openFile(file.relativePath)}><FileCode2 size={15}/><span>{file.name}</span><small>{file.relativePath}</small><i>{extension(file.relativePath)}</i></button>)}</main>
        <section className="xfiles-preview"><header><FileText size={14}/> INSPECTOR</header>{selected?<><b>{selected}</b>{preview?<pre>{preview}</pre>:<p>Binary or unsupported preview. The file stays untouched.</p>}</>:<p>Select a file. Text/code previews are read-only here; edit through Workbench.</p>}</section>
      </div>
    </>}
  </section>;
}
