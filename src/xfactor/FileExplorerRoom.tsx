import { useMemo, useState, type CSSProperties } from 'react';
import { File, FileCode2, Folder, FolderOpen, HardDrive, RefreshCw, Search, Vault, Zap } from 'lucide-react';
import { isTauri } from '../lib/platform';
import {
  chooseProjectFolder, flattenProjectFiles, isLikelyTextProjectFile, readProjectTextFile,
  scanProjectFolder, type ProjectEntry, type ProjectScanResult,
} from '../lib/projectFolder';

function flattenDirectories(entries: ProjectEntry[]) {
  const out: ProjectEntry[] = [];
  const walk = (items: ProjectEntry[]) => items.forEach(item => {
    if (item.kind === 'directory') { out.push(item); if (item.children) walk(item.children); }
  });
  walk(entries);
  return out;
}

export default function FileExplorerRoom({
  onVaultText,
  onOpenWorkbench,
}: {
  onVaultText: (name: string, text: string, relativePath: string) => Promise<void> | void;
  onOpenWorkbench: () => void;
}) {
  const [rootPath,setRootPath]=useState<string>();
  const [scan,setScan]=useState<ProjectScanResult>();
  const [selected,setSelected]=useState<string>();
  const [preview,setPreview]=useState('');
  const [query,setQuery]=useState('');
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState<string>();

  const files=useMemo(()=>scan?flattenProjectFiles(scan.entries):[],[scan]);
  const dirs=useMemo(()=>scan?flattenDirectories(scan.entries):[],[scan]);
  const shown=useMemo(()=>{
    const q=query.trim().toLowerCase();
    return (q?files.filter(item=>item.relativePath.toLowerCase().includes(q)):files).slice(0,220);
  },[files,query]);

  async function openRoot() {
    if(!isTauri()) return;
    setError(undefined);
    try{
      const root=await chooseProjectFolder();
      if(!root)return;
      setRootPath(root);
      setBusy(true);
      const next=await scanProjectFolder(root,{maxEntries:6000,maxDepth:24});
      setScan(next);setSelected(undefined);setPreview('');
    }catch(e){setError(e instanceof Error?e.message:String(e));}
    finally{setBusy(false);}
  }
  async function rescan(){
    if(!rootPath)return;
    setBusy(true);setError(undefined);
    try{setScan(await scanProjectFolder(rootPath,{maxEntries:6000,maxDepth:24}));}
    catch(e){setError(e instanceof Error?e.message:String(e));}
    finally{setBusy(false);}
  }
  async function inspect(path:string){
    setSelected(path);setError(undefined);
    if(!rootPath||!isLikelyTextProjectFile(path)){setPreview('BINARY / NON-TEXT FILE\n\nPreview is intentionally metadata-only in this M6 explorer. Open the containing project in BUILD for full editing.');return;}
    try{setPreview((await readProjectTextFile(rootPath,path)).slice(0,120000));}
    catch(e){setPreview('');setError(e instanceof Error?e.message:String(e));}
  }
  const selectedEntry=files.find(f=>f.relativePath===selected);

  return <section className="xf-page xf-file-room">
    <div className="xf-section-head">
      <div><span className="kicker">RIFT EXPLORER //</span><h1>THE DISK, WITHOUT THE BEIGE FOLDER TREE.</h1><p>A scoped local filesystem lens. You choose the root; xFactor.OS does not roam the machine on its own.</p></div>
      <div className="xf-floor-actions"><button className="pink" onClick={()=>void openRoot()}><FolderOpen size={16}/> {rootPath?'CHANGE ROOT':'OPEN LOCAL ROOT'}</button>{rootPath&&<button onClick={()=>void rescan()}><RefreshCw size={15}/> RESCAN</button>}</div>
    </div>
    {!isTauri()&&<div className="xf-local-only"><HardDrive size={24}/><b>RIFT EXPLORER IS A DESKTOP SURFACE.</b><p>The web build stays sandboxed. Install/open xFactor.OS for scoped Windows folder access.</p></div>}
    {isTauri()&&!rootPath&&<div className="xf-file-launch"><div className="rift-orbit"><Folder size={34}/><i/><i/><i/></div><h2>CHOOSE A ROOT. MAKE A MAP.</h2><p>The explorer reads only the directory you approve, skips generated dependency forests, ignores symlinks, and bounds deep scans for safety.</p><button onClick={()=>void openRoot()}><Zap size={14}/> OPEN A FOLDER</button></div>}
    {rootPath&&<div className="xf-rift-shell">
      <aside className="xf-rift-map">
        <div className="rift-root"><HardDrive size={15}/><div><small>SCOPED ROOT</small><b>{rootPath.split(/[\\/]/).pop()}</b></div></div>
        <div className="rift-stats"><span><b>{scan?.fileCount??0}</b> FILES</span><span><b>{scan?.directoryCount??0}</b> FOLDERS</span>{scan?.truncated&&<span className="warn">BOUNDED</span>}</div>
        <div className="rift-search"><Search size={14}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="FILTER THE DISK..."/></div>
        <div className="rift-dir-cloud">{dirs.slice(0,36).map((dir,index)=><button key={dir.relativePath} title={dir.relativePath} style={{'--rift-i':index} as CSSProperties} onClick={()=>setQuery(dir.relativePath+'/')}><Folder size={12}/>{dir.name}</button>)}</div>
      </aside>
      <section className="xf-rift-files">
        <div className="rift-files-head"><b>{busy?'SCANNING…':query?'FILTER // '+query:'FILES // SCATTERED INDEX'}</b><small>{shown.length} VISIBLE</small></div>
        <div className="rift-file-grid">{shown.map((file,index)=><button key={file.relativePath} className={selected===file.relativePath?'active':''} style={{'--rift-i':index} as CSSProperties} onClick={()=>void inspect(file.relativePath)} title={file.relativePath}>{isLikelyTextProjectFile(file.relativePath)?<FileCode2/>:<File/>}<b>{file.name}</b><small>{file.relativePath}</small></button>)}</div>
      </section>
      <aside className="xf-rift-inspector">
        <small>INSPECTOR //</small>
        {selectedEntry?<><h3>{selectedEntry.name}</h3><p>{selectedEntry.relativePath}</p><div className="rift-inspect-actions"><button onClick={onOpenWorkbench}>OPEN BUILD</button>{isLikelyTextProjectFile(selectedEntry.relativePath)&&<button onClick={()=>void onVaultText(selectedEntry.name,preview,selectedEntry.relativePath)}><Vault size={12}/> VAULT COPY</button>}</div><pre>{preview||'SELECT A TEXT FILE TO READ IT.'}</pre></>:<div className="rift-empty">PICK A FILE. THE RIGHT SIDE BECOMES ITS BLACKBOX.</div>}
      </aside>
    </div>}
    {error&&<div className="dev-error">{error}</div>}
  </section>;
}
