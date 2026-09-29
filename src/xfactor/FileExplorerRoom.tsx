import { useMemo, useState } from 'react';
import { FileCode2, FileText, Folder, FolderOpen, Image, Music, RefreshCw, Search, Video } from 'lucide-react';
import { isTauri } from '../lib/platform';
import { chooseProjectFolder, flattenProjectFiles, isLikelyTextProjectFile, readProjectTextFile, scanProjectFolder, type ProjectEntry, type ProjectScanResult } from '../lib/projectFolder';

type Preview = { path: string; content: string };

const RECENT_KEY = 'xfactor-m6-file-roots-v1';

function recentRoots(): string[] {
  try { const value = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]'); return Array.isArray(value) ? value.filter(v => typeof v === 'string').slice(0,8) : []; }
  catch { return []; }
}

function saveRecent(path: string) {
  const next = [path, ...recentRoots().filter(item => item !== path)].slice(0,8);
  localStorage.setItem(RECENT_KEY, JSON.stringify(next));
}

function kind(path: string) {
  const ext = path.split('.').pop()?.toLowerCase() || '';
  if (['png','jpg','jpeg','gif','webp','svg'].includes(ext)) return 'IMAGE';
  if (['mp3','wav','ogg','m4a'].includes(ext)) return 'AUDIO';
  if (['mp4','webm','mov'].includes(ext)) return 'VIDEO';
  if (['js','jsx','ts','tsx','css','html','py','rs','json','toml','md'].includes(ext)) return 'CODE';
  return 'FILE';
}

function iconFor(path: string) {
  const k = kind(path);
  return k === 'IMAGE' ? Image : k === 'AUDIO' ? Music : k === 'VIDEO' ? Video : k === 'CODE' ? FileCode2 : FileText;
}

export default function FileExplorerRoom() {
  const [root, setRoot] = useState('');
  const [scan, setScan] = useState<ProjectScanResult>();
  const [query, setQuery] = useState('');
  const [preview, setPreview] = useState<Preview>();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [recents, setRecents] = useState(recentRoots);

  const files = useMemo(() => scan ? flattenProjectFiles(scan.entries).filter(entry => entry.kind === 'file') : [], [scan]);
  const filtered = useMemo(() => files.filter(file => !query || file.relativePath.toLowerCase().includes(query.toLowerCase())), [files, query]);

  async function load(path: string) {
    setBusy(true); setError('');
    try {
      const next = await scanProjectFolder(path);
      setRoot(path); setScan(next); setPreview(undefined); saveRecent(path); setRecents(recentRoots());
    } catch (err) { setError(err instanceof Error ? err.message : String(err)); }
    finally { setBusy(false); }
  }

  async function choose() {
    if (!isTauri()) { setError('THE EXPERIMENTAL FILE EXPLORER USES THE DESKTOP APP APPROVED FOLDER SCOPE.'); return; }
    try { const path = await chooseProjectFolder(); if (path) await load(path); }
    catch (err) { setError(err instanceof Error ? err.message : String(err)); }
  }

  async function open(entry: ProjectEntry) {
    if (!root || entry.kind !== 'file') return;
    if (!isLikelyTextProjectFile(entry.relativePath)) {
      setPreview({ path: entry.relativePath, content: 'BINARY / NON-TEXT FRAGMENT\n\nOpen this file through its associated tool or Workbench project.' });
      return;
    }
    try {
      const body = await readProjectTextFile(root, entry.relativePath);
      setPreview({ path: entry.relativePath, content: body.slice(0, 120000) });
    } catch (err) { setError(err instanceof Error ? err.message : String(err)); }
  }

  return <section className="xf-page m6-files-room">
    <div className="xf-section-head"><div><span className="kicker">FILES //</span><h1>SHATTER EXPLORER.</h1><p>A local-only project map: pick one approved root, then move through fragments instead of pretending the whole disk belongs to the app.</p></div>
      <div className="xf-floor-actions"><button onClick={choose}><FolderOpen size={16}/> OPEN ROOT</button>{root&&<button onClick={() => void load(root)}><RefreshCw size={16}/> RESCAN</button>}</div>
    </div>

    <div className="m6-file-status"><b>{root || 'NO LOCAL ROOT CONNECTED'}</b><span>{scan ? `${scan.fileCount} FILES · ${scan.directoryCount} DIRECTORIES${scan.truncated ? ' · SAFETY-TRUNCATED' : ''}` : isTauri() ? 'CHOOSE A ROOT TO BEGIN' : 'DESKTOP APP REQUIRED FOR LOCAL FILE ACCESS'}</span></div>
    {error && <div className="dev-binding-error">{error}</div>}

    <div className="m6-file-grid">
      <aside className="m6-file-roots">
        <div className="m6-pane-label"><Folder size={14}/> ROOT STACK</div>
        <button className="m6-root-open" onClick={choose}><FolderOpen size={18}/><span>OPEN SOMETHING REAL</span></button>
        {recents.map(path => <button key={path} className={path===root?'active':''} onClick={() => void load(path)}><small>RECENT</small><span>{path.split(/[\\/]/).pop()}</span><i>{path}</i></button>)}
      </aside>

      <section className="m6-fragment-map">
        <div className="m6-file-search"><Search size={15}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="FILTER FRAGMENTS..."/><span>{filtered.length}</span></div>
        {busy ? <div className="m6-file-empty">READING THE DAMAGE...</div> : !scan ? <div className="m6-file-empty">PICK A FOLDER. THIS VIEW WILL TURN IT INTO A PROJECT MAP.</div> :
          <div className="m6-fragment-grid">{filtered.slice(0,1200).map(file => { const I = iconFor(file.relativePath); return <button key={file.relativePath} className={`m6-fragment kind-${kind(file.relativePath).toLowerCase()} ${preview?.path===file.relativePath?'active':''}`} onClick={() => void open(file)}><I size={17}/><span>{file.name}</span><small>{file.relativePath}</small></button>; })}</div>}
      </section>

      <aside className="m6-file-inspector">
        <div className="m6-pane-label"><FileCode2 size={14}/> FRAGMENT INSPECTOR</div>
        {preview ? <><b>{preview.path.split('/').pop()}</b><small>{preview.path}</small><pre>{preview.content}</pre></> : <div className="m6-file-empty">SELECT A FILE TO PEEK INSIDE WITHOUT LEAVING THE MAP.</div>}
      </aside>
    </div>
  </section>;
}
