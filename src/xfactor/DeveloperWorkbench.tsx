import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import {
  ExternalLink,
  FileCode2,
  FolderOpen,
  FolderSync,
  Play,
  Plus,
  RefreshCw,
  Save,
  Search,
  AlertTriangle,
  TerminalSquare,
  Trash2,
  X,
} from 'lucide-react';
import CodeEditor, { type EditorLanguage } from '../design-system/CodeEditor';
import TerminalRoom from '../modules/terminal';
import GitPanel from './GitPanel';
import { isTauri } from '../lib/platform';
import { loadM6Settings, saveM6Settings, type WorkbenchViewMode } from './m6Settings';
import {
  chooseProjectFolder,
  collectProjectMirrorFiles,
  createProjectTextFile,
  flattenProjectFiles,
  isLikelyTextProjectFile,
  readProjectTextFile,
  removeProjectPath,
  renameProjectPath,
  scanProjectFolder,
  writeProjectTextFile,
  type MirrorFile,
  type ProjectEntry,
  type ProjectScanResult,
} from '../lib/projectFolder';
import { getWebContainer, webContainerSupported } from '../lib/webcontainerRuntime';
import { searchProjectText, type ProjectSearchHit } from '../lib/projectSearch';
import { parseWorkbenchProblems } from '../lib/problems';
import {
  bindLocalProject,
  getLocalProjectBinding,
  unbindLocalProject,
  type LocalProjectBinding,
} from './localProjectBindings';
import './workbench.css';

type WorkbenchFile = { path: string; content: string };
type LocalBuffer = { content: string; savedContent: string };
type DevStatus = 'idle' | 'booting' | 'installing' | 'starting' | 'running' | 'error';
type WorkspaceMode = 'sandbox' | 'local';
type DockView = 'terminal' | 'problems' | 'git' | 'search';

const STARTER_FILES: WorkbenchFile[] = [
  {
    path: 'package.json',
    content: JSON.stringify({
      name: 'xfactor-workbench-project',
      private: true,
      version: '0.0.0',
      type: 'module',
      scripts: { dev: 'vite --host 0.0.0.0' },
      devDependencies: { vite: '^8.1.1' },
    }, null, 2) + '\n',
  },
  {
    path: 'index.html',
    content: `<!doctype html>
<html>
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>xFactor.OS Workbench</title>
    <link rel="stylesheet" href="/src/style.css" />
  </head>
  <body>
    <main id="app"></main>
    <script type="module" src="/src/main.js"></script>
  </body>
</html>
`,
  },
  {
    path: 'src/main.js',
    content: `const app = document.querySelector('#app');

app.innerHTML = \`
  <section class="hero">
    <small>xFactor.OS // WORKBENCH</small>
    <h1>Build something impossible to ignore.</h1>
    <p>Edit the project, run Vite, and keep the work tied to this Incident.</p>
    <button id="hit">MAKE NOISE</button>
    <strong id="count">0</strong>
  </section>
\`;

let count = 0;
document.querySelector('#hit').addEventListener('click', () => {
  count += 1;
  document.querySelector('#count').textContent = String(count);
});
`,
  },
  {
    path: 'src/style.css',
    content: `:root {
  font-family: Inter, system-ui, sans-serif;
  color: #f8f7fb;
  background: #09090c;
}

* { box-sizing: border-box; }
body { margin: 0; min-height: 100vh; display: grid; place-items: center; background:
  radial-gradient(circle at 18% 10%, #ff2aa333, transparent 34%),
  radial-gradient(circle at 85% 12%, #20d9ff22, transparent 30%),
  #09090c;
}
.hero { width: min(760px, 90vw); border: 1px solid #ffffff18; padding: 42px; background: #111116; }
small { color: #ff2aa3; letter-spacing: .16em; font-weight: 800; }
h1 { font-size: clamp(42px, 8vw, 82px); line-height: .9; margin: 14px 0; letter-spacing: -.05em; }
p { color: #aaa8b3; max-width: 560px; line-height: 1.6; }
button { border: 0; padding: 12px 16px; font-weight: 900; background: linear-gradient(90deg,#ff2aa3,#8b5cf6,#20d9ff); color:#08080b; }
strong { margin-left: 14px; color: #20d9ff; }
`,
  },
];

function cloneStarter(): WorkbenchFile[] {
  return STARTER_FILES.map((file) => ({ ...file }));
}

function storageKey(projectId?: string) {
  return `xfactor-workbench-v1:${projectId || 'scratch'}`;
}

function loadFiles(key: string): WorkbenchFile[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || '[]') as WorkbenchFile[];
    return Array.isArray(parsed) && parsed.length ? parsed : cloneStarter();
  } catch {
    return cloneStarter();
  }
}

function languageFor(path: string): EditorLanguage {
  const ext = path.split('.').pop()?.toLowerCase();
  if (ext === 'py') return 'python';
  if (ext === 'html' || ext === 'htm') return 'html';
  if (ext === 'js' || ext === 'jsx' || ext === 'mjs' || ext === 'cjs') return 'javascript';
  if (ext === 'ts' || ext === 'tsx') return 'typescript';
  if (ext === 'css' || ext === 'scss' || ext === 'sass' || ext === 'less') return 'css';
  return 'plain';
}

function staticPreview(files: WorkbenchFile[]): string {
  const htmlFile = files.find((file) => file.path === 'index.html');
  if (!htmlFile) return '<!doctype html><body style="font-family:sans-serif;background:#111;color:#eee;padding:32px">Create index.html to preview this project.</body>';
  const css = files.find((file) => file.path === 'src/style.css')?.content ?? '';
  const js = files.find((file) => file.path === 'src/main.js')?.content ?? '';
  let html = htmlFile.content
    .replace(/<link[^>]+href=["'][^"']*src\/style\.css["'][^>]*>/i, '')
    .replace(/<script[^>]+src=["'][^"']*src\/main\.js["'][^>]*><\/script>/i, '');
  const safeJs = js.replace(/<\/script/gi, '<\\/script');
  html = html.includes('</head>') ? html.replace('</head>', `<style>${css}</style></head>`) : `<style>${css}</style>${html}`;
  html = html.includes('</body>') ? html.replace('</body>', `<script type="module">${safeJs}</script></body>`) : `${html}<script type="module">${safeJs}</script>`;
  return html;
}

async function ensureParent(wc: Awaited<ReturnType<typeof getWebContainer>>, path: string) {
  const parts = path.split('/').filter(Boolean);
  if (parts.length <= 1) return;
  const dir = '/workspace/' + parts.slice(0, -1).join('/');
  await wc.fs.mkdir(dir, { recursive: true });
}

function firstUsefulProjectFile(scan: ProjectScanResult): string | undefined {
  const files = flattenProjectFiles(scan.entries).filter((entry) => isLikelyTextProjectFile(entry.relativePath));
  const preferred = [
    'src/main.tsx', 'src/main.ts', 'src/main.jsx', 'src/main.js',
    'src/App.tsx', 'src/App.ts', 'src/App.jsx', 'src/App.js',
    'package.json', 'README.md', 'index.html',
  ];
  return preferred.find((path) => files.some((entry) => entry.relativePath === path)) ?? files[0]?.relativePath;
}

function detectNpmScripts(files: MirrorFile[]): string[] {
  const pkg = files.find((file) => file.path === 'package.json');
  if (!pkg) return [];
  try {
    const parsed = JSON.parse(pkg.content) as { scripts?: Record<string, string> };
    return Object.keys(parsed.scripts ?? {});
  } catch {
    return [];
  }
}

function pickRunScript(scripts: string[]): string | undefined {
  return ['dev', 'start', 'serve', 'preview'].find((candidate) => scripts.includes(candidate)) ?? scripts[0];
}

export default function DeveloperWorkbench({
  active,
  projectId,
  projectName,
  projectStatus,
  projectPriority,
  nextMove,
  openSignals = 0,
  taskCount = 0,
  assetCount = 0,
}: {
  active: boolean;
  projectId?: string;
  projectName?: string;
  projectStatus?: string;
  projectPriority?: string;
  nextMove?: string;
  openSignals?: number;
  taskCount?: number;
  assetCount?: number;
}) {
  const key = storageKey(projectId);
  const [sandboxFiles, setSandboxFiles] = useState<WorkbenchFile[]>(() => loadFiles(key));
  const [binding, setBinding] = useState<LocalProjectBinding | undefined>(() => getLocalProjectBinding(projectId));
  const [mode, setMode] = useState<WorkspaceMode>(() => binding ? 'local' : 'sandbox');
  const [projectScan, setProjectScan] = useState<ProjectScanResult>();
  const [scanError, setScanError] = useState<string>();
  const [localBuffers, setLocalBuffers] = useState<Record<string, LocalBuffer>>({});
  const [activePath, setActivePath] = useState(() => loadFiles(key)[0]?.path ?? 'index.html');
  const [tabs, setTabs] = useState<string[]>(() => [loadFiles(key)[0]?.path ?? 'index.html']);
  const [previewDoc, setPreviewDoc] = useState(() => staticPreview(loadFiles(key)));
  const [previewUrl, setPreviewUrl] = useState<string>();
  const [devStatus, setDevStatus] = useState<DevStatus>('idle');
  const [devError, setDevError] = useState<string>();
  const [logs, setLogs] = useState<string[]>([]);
  const [runScripts, setRunScripts] = useState<string[]>([]);
  const [selectedScript, setSelectedScript] = useState<string>();
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(() => new Set(['src']));
  const [searchQuery, setSearchQuery] = useState('');
  const [searchHits, setSearchHits] = useState<ProjectSearchHit[]>([]);
  const [searchBusy, setSearchBusy] = useState(false);
  const [searchMeta, setSearchMeta] = useState('');
  const [dockView, setDockView] = useState<DockView>('terminal');
  const [workbenchView,setWorkbenchView] = useState<WorkbenchViewMode>(()=>loadM6Settings().workbenchView);
  const [explorerWidth,setExplorerWidth] = useState(()=>Number(localStorage.getItem('xfactor-workbench-explorer-width')||220));
  const [previewWidth,setPreviewWidth] = useState(()=>Number(localStorage.getItem('xfactor-workbench-preview-width')||360));
  const searchInputRef = useRef<HTMLInputElement>(null);
  const wcRef = useRef<Awaited<ReturnType<typeof getWebContainer>> | null>(null);
  const mountedKeyRef = useRef<string | undefined>(undefined);
  const devProcessRef = useRef<{ kill(): void } | null>(null);
  const serverOffRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const nextSandbox = loadFiles(key);
    const nextBinding = getLocalProjectBinding(projectId);
    setSandboxFiles(nextSandbox);
    setBinding(nextBinding);
    setMode(nextBinding ? 'local' : 'sandbox');
    setLocalBuffers({});
    setProjectScan(undefined);
    setScanError(undefined);
    setPreviewUrl(undefined);
    setDevStatus('idle');
    setDevError(undefined);
    setLogs([]);
    setRunScripts([]);
    setSelectedScript(undefined);
    setSearchQuery('');
    setSearchHits([]);
    setSearchMeta('');
    setDockView('terminal');
    const first = nextSandbox.find((file) => file.path === 'src/main.js')?.path ?? nextSandbox[0]?.path ?? 'index.html';
    setActivePath(first);
    setTabs([first]);
  }, [key, projectId]);

  useEffect(() => {
    localStorage.setItem(key, JSON.stringify(sandboxFiles));
    if (mode !== 'sandbox') return;
    const timer = window.setTimeout(() => setPreviewDoc(staticPreview(sandboxFiles)), 180);
    return () => window.clearTimeout(timer);
  }, [sandboxFiles, key, mode]);

  useEffect(() => {
    if (mode !== 'local' || !binding) return;
    let cancelled = false;
    setScanError(undefined);
    void scanProjectFolder(binding.rootPath)
      .then((scan) => {
        if (cancelled) return;
        setProjectScan(scan);
        const first = firstUsefulProjectFile(scan);
        if (first) void openLocalFile(first, scan, binding);
      })
      .catch((error) => {
        if (cancelled) return;
        setProjectScan(undefined);
        setScanError(error instanceof Error ? error.message : String(error));
      });
    return () => { cancelled = true; };
    // openLocalFile is intentionally stable over binding identity for this load path.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, binding?.rootPath]);

  useEffect(() => () => {
    serverOffRef.current?.();
    devProcessRef.current?.kill();
  }, []);

  useEffect(() => {
    const onSettings=(event:Event)=>{
      const next=(event as CustomEvent<ReturnType<typeof loadM6Settings>>).detail ?? loadM6Settings();
      setWorkbenchView(next.workbenchView);
    };
    window.addEventListener('xfactor:m6-settings',onSettings as EventListener);
    return()=>window.removeEventListener('xfactor:m6-settings',onSettings as EventListener);
  }, []);

  function setViewPreset(next:WorkbenchViewMode){
    setWorkbenchView(next);
    saveM6Settings({...loadM6Settings(),workbenchView:next});
  }
  function changeExplorerWidth(next:number){
    const value=Math.max(160,Math.min(360,next));setExplorerWidth(value);localStorage.setItem('xfactor-workbench-explorer-width',String(value));
  }
  function changePreviewWidth(next:number){
    const value=Math.max(260,Math.min(640,next));setPreviewWidth(value);localStorage.setItem('xfactor-workbench-preview-width',String(value));
  }

  useEffect(() => {
    if (!active) return;
    const onKeyDown = (event: KeyboardEvent) => {
      const command = event.ctrlKey || event.metaKey;
      if (!command) return;
      if (event.key.toLowerCase() === 's') {
        event.preventDefault();
        if (mode === 'local') void saveActiveLocal();
      }
      if (event.shiftKey && event.key.toLowerCase() === 'f') {
        event.preventDefault();
        setDockView('search');
        window.setTimeout(() => searchInputRef.current?.focus(), 0);
      }
      if (event.key === '`') {
        event.preventDefault();
        setDockView('terminal');
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [active, mode, activePath, localBuffers, binding]);

  const activeSandboxFile = useMemo(
    () => sandboxFiles.find((file) => file.path === activePath) ?? sandboxFiles[0],
    [sandboxFiles, activePath],
  );
  const activeLocalBuffer = activePath ? localBuffers[activePath] : undefined;
  const activeContent = mode === 'local' ? activeLocalBuffer?.content : activeSandboxFile?.content;
  const activeDirty = mode === 'local' && Boolean(activeLocalBuffer && activeLocalBuffer.content !== activeLocalBuffer.savedContent);
  const dirtyCount = mode === 'local'
    ? Object.values(localBuffers).filter((buffer) => buffer.content !== buffer.savedContent).length
    : 0;
  const problems = useMemo(() => parseWorkbenchProblems(logs.join('')), [logs]);

  function openSandboxFile(path: string) {
    setActivePath(path);
    setTabs((current) => current.includes(path) ? current : [...current, path]);
  }

  async function openLocalFile(
    path: string,
    scanOverride = projectScan,
    bindingOverride = binding,
  ) {
    if (!bindingOverride || !scanOverride) return;
    if (!isLikelyTextProjectFile(path)) {
      setDevError(`${path} is not recognized as editable text.`);
      return;
    }
    if (!localBuffers[path]) {
      try {
        const content = await readProjectTextFile(bindingOverride.rootPath, path);
        setLocalBuffers((current) => ({ ...current, [path]: { content, savedContent: content } }));
      } catch (error) {
        setDevError(error instanceof Error ? error.message : String(error));
        return;
      }
    }
    setActivePath(path);
    setTabs((current) => current.includes(path) ? current : [...current, path]);
  }

  function openFile(path: string) {
    if (mode === 'local') void openLocalFile(path);
    else openSandboxFile(path);
  }

  async function runProjectSearch() {
    if (mode !== 'local' || !binding || !projectScan || !searchQuery.trim()) {
      setSearchHits([]);
      setSearchMeta('');
      return;
    }
    setSearchBusy(true);
    setDevError(undefined);
    try {
      const result = await searchProjectText(binding.rootPath, projectScan.entries, searchQuery);
      setSearchHits(result.hits);
      setDockView('search');
      setSearchMeta(`${result.hits.length} HITS · ${result.scannedFiles} FILES${result.skippedSensitive ? ` · ${result.skippedSensitive} SENSITIVE SKIPPED` : ''}${result.truncated ? ' · TRUNCATED' : ''}`);
    } catch (error) {
      setDevError(error instanceof Error ? error.message : String(error));
    } finally {
      setSearchBusy(false);
    }
  }

  async function bindFolder() {
    if (!projectId) {
      setDevError('Select an Incident before binding a local project.');
      return;
    }
    try {
      const rootPath = await chooseProjectFolder();
      if (!rootPath) return;
      const nextBinding = bindLocalProject(projectId, rootPath);
      setBinding(nextBinding);
      setMode('local');
      setLocalBuffers({});
      setProjectScan(undefined);
      setTabs([]);
      setActivePath('');
      setDockView('terminal');
    } catch (error) {
      setDevError(error instanceof Error ? error.message : String(error));
    }
  }

  function detachFolder() {
    if (!projectId || !binding) return;
    if (dirtyCount > 0 && !window.confirm(`${dirtyCount} local file(s) have unsaved changes. Detach anyway?`)) return;
    unbindLocalProject(projectId);
    setBinding(undefined);
    setMode('sandbox');
    setProjectScan(undefined);
    setLocalBuffers({});
    const first = sandboxFiles.find((file) => file.path === 'src/main.js')?.path ?? sandboxFiles[0]?.path ?? 'index.html';
    setActivePath(first);
    setTabs([first]);
  }

  async function refreshLocalTree() {
    if (!binding) return;
    try {
      setScanError(undefined);
      setProjectScan(await scanProjectFolder(binding.rootPath));
    } catch (error) {
      setScanError(error instanceof Error ? error.message : String(error));
    }
  }

  async function writeToContainer(path: string, content: string) {
    const wc = wcRef.current;
    const runtimeKey = mode === 'local' ? `local:${binding?.rootPath ?? ''}` : key;
    if (!wc || mountedKeyRef.current !== runtimeKey) return;
    try {
      await ensureParent(wc, path);
      await wc.fs.writeFile('/workspace/' + path, content);
    } catch {
      // Disk/localStorage remains authoritative; Run Dev remounts a full bounded snapshot.
    }
  }

  function updateActive(content: string) {
    if (!activePath) return;
    if (mode === 'local') {
      setLocalBuffers((current) => {
        const buffer = current[activePath];
        if (!buffer) return current;
        return { ...current, [activePath]: { ...buffer, content } };
      });
      void writeToContainer(activePath, content);
      return;
    }
    if (!activeSandboxFile) return;
    setSandboxFiles((current) => current.map((file) => file.path === activeSandboxFile.path ? { ...file, content } : file));
    void writeToContainer(activeSandboxFile.path, content);
  }

  async function saveActiveLocal() {
    if (mode !== 'local' || !binding || !activePath) return;
    const buffer = localBuffers[activePath];
    if (!buffer || buffer.content === buffer.savedContent) return;
    try {
      await writeProjectTextFile(binding.rootPath, activePath, buffer.content);
      setLocalBuffers((current) => ({
        ...current,
        [activePath]: { content: buffer.content, savedContent: buffer.content },
      }));
    } catch (error) {
      setDevError(error instanceof Error ? error.message : String(error));
    }
  }

  async function saveAllLocal() {
    if (mode !== 'local' || !binding) return;
    for (const [path, buffer] of Object.entries(localBuffers)) {
      if (buffer.content === buffer.savedContent) continue;
      await writeProjectTextFile(binding.rootPath, path, buffer.content);
    }
    setLocalBuffers((current) => Object.fromEntries(
      Object.entries(current).map(([path, buffer]) => [path, { content: buffer.content, savedContent: buffer.content }]),
    ));
  }

  async function createFile() {
    const raw = window.prompt('New file path', 'src/new-file.js')?.trim().replace(/^\/+/, '');
    if (!raw) return;
    if (mode === 'local') {
      if (!binding) return;
      try {
        await createProjectTextFile(binding.rootPath, raw, '');
        await refreshLocalTree();
        await openLocalFile(raw);
      } catch (error) {
        setDevError(error instanceof Error ? error.message : String(error));
      }
      return;
    }
    if (sandboxFiles.some((file) => file.path === raw)) return;
    const next = { path: raw, content: '' };
    setSandboxFiles((current) => [...current, next].sort((a, b) => a.path.localeCompare(b.path)));
    openSandboxFile(raw);
    void writeToContainer(raw, '');
  }

  async function renameFile(path: string) {
    if (mode !== 'local' || !binding) return;
    const nextPath = window.prompt('Rename / move project path', path)?.trim().replace(/^\/+/, '');
    if (!nextPath || nextPath === path) return;
    if (localBuffers[path] && localBuffers[path].content !== localBuffers[path].savedContent) {
      setDevError('Save the file before renaming it.');
      return;
    }
    try {
      await renameProjectPath(binding.rootPath, path, nextPath);
      setLocalBuffers((current) => {
        const next = { ...current };
        if (next[path]) {
          next[nextPath] = next[path];
          delete next[path];
        }
        return next;
      });
      setTabs((current) => current.map((tab) => tab === path ? nextPath : tab));
      if (activePath === path) setActivePath(nextPath);
      await refreshLocalTree();
    } catch (error) {
      setDevError(error instanceof Error ? error.message : String(error));
    }
  }

  async function deleteFile(path: string) {
    if (!window.confirm(`Delete ${path}${mode === 'local' ? ' from disk' : ' from this Workbench project'}?`)) return;
    if (mode === 'local') {
      if (!binding) return;
      try {
        await removeProjectPath(binding.rootPath, path, false);
        setLocalBuffers((current) => {
          const next = { ...current };
          delete next[path];
          return next;
        });
        setTabs((current) => current.filter((tab) => tab !== path));
        if (activePath === path) setActivePath('');
        await refreshLocalTree();
      } catch (error) {
        setDevError(error instanceof Error ? error.message : String(error));
      }
      return;
    }
    const next = sandboxFiles.filter((file) => file.path !== path);
    setSandboxFiles(next.length ? next : cloneStarter());
    setTabs((current) => current.filter((tab) => tab !== path));
    if (activePath === path) setActivePath(next[0]?.path ?? 'index.html');
    const wc = wcRef.current;
    if (wc && mountedKeyRef.current === key) {
      try { await wc.fs.rm('/workspace/' + path); } catch { /* local state already removed */ }
    }
  }

  function closeTab(path: string) {
    if (mode === 'local') {
      const buffer = localBuffers[path];
      if (buffer && buffer.content !== buffer.savedContent && !window.confirm(`${path} has unsaved changes. Close it?`)) return;
    }
    setTabs((current) => {
      const next = current.filter((tab) => tab !== path);
      if (activePath === path) setActivePath(next[next.length - 1] ?? (mode === 'sandbox' ? sandboxFiles[0]?.path ?? '' : ''));
      return next;
    });
  }

  function resetStarter() {
    if (!window.confirm('Reset this Incident Sandbox to the starter project?')) return;
    const next = cloneStarter();
    setSandboxFiles(next);
    setActivePath('src/main.js');
    setTabs(['src/main.js']);
    setPreviewUrl(undefined);
    setDevStatus('idle');
    setDevError(undefined);
  }

  async function snapshotForRuntime(): Promise<MirrorFile[]> {
    if (mode === 'local') {
      if (!binding || !projectScan) throw new Error('No local project is bound.');
      if (dirtyCount > 0) await saveAllLocal();
      return collectProjectMirrorFiles(binding.rootPath, projectScan.entries);
    }
    return sandboxFiles.map((file) => ({ path: file.path, content: file.content }));
  }

  async function syncAllToContainer(snapshot: MirrorFile[]) {
    const wc = await getWebContainer();
    wcRef.current = wc;
    const runtimeKey = mode === 'local' ? `local:${binding?.rootPath ?? ''}` : key;
    if (mountedKeyRef.current !== runtimeKey) {
      try { await wc.fs.rm('/workspace', { recursive: true }); } catch { /* first mount */ }
      await wc.fs.mkdir('/workspace', { recursive: true });
      mountedKeyRef.current = runtimeKey;
    } else {
      try { await wc.fs.rm('/workspace', { recursive: true }); } catch { /* recreate below */ }
      await wc.fs.mkdir('/workspace', { recursive: true });
    }
    for (const file of snapshot) {
      await ensureParent(wc, file.path);
      await wc.fs.writeFile('/workspace/' + file.path, file.content);
    }
    return wc;
  }

  async function runDev() {
    if (!webContainerSupported()) {
      setDevStatus('error');
      setDevError('Node Workbench needs cross-origin isolation. Use the verified production/desktop build.');
      return;
    }
    setDevError(undefined);
    setLogs([]);
    try {
      setDevStatus('booting');
      const snapshot = await snapshotForRuntime();
      const scripts = detectNpmScripts(snapshot);
      const script = selectedScript && scripts.includes(selectedScript) ? selectedScript : pickRunScript(scripts);
      setRunScripts(scripts);
      setSelectedScript(script);
      if (!snapshot.some((file) => file.path === 'package.json')) {
        throw new Error('Run Dev needs a package.json in the project root.');
      }
      if (!script) throw new Error('No npm scripts were found in package.json.');

      const wc = await syncAllToContainer(snapshot);
      setDevStatus('installing');
      const install = await wc.spawn('npm', ['install'], { cwd: '/workspace' });
      void install.output.pipeTo(new WritableStream({
        write(chunk) { setLogs((current) => [...current.slice(-80), chunk]); },
      }));
      const installCode = await install.exit;
      if (installCode !== 0) throw new Error(`npm install exited with code ${installCode}`);

      devProcessRef.current?.kill();
      serverOffRef.current?.();
      serverOffRef.current = wc.on('server-ready', (_port, url) => {
        setPreviewUrl(url);
        setDevStatus('running');
      }) as unknown as () => void;

      setDevStatus('starting');
      const args = ['run', script];
      if (script === 'dev') args.push('--', '--host', '0.0.0.0');
      const process = await wc.spawn('npm', args, { cwd: '/workspace' });
      devProcessRef.current = process;
      void process.output.pipeTo(new WritableStream({
        write(chunk) { setLogs((current) => [...current.slice(-80), chunk]); },
      }));
      void process.exit.then((code) => {
        if (code !== 0) {
          setDevStatus('error');
          setDevError(`npm run ${script} exited with code ${code}`);
        }
      });
    } catch (error) {
      setDevStatus('error');
      setDevError(error instanceof Error ? error.message : String(error));
    }
  }

  const sandboxFolders = useMemo(() => {
    const names = new Set<string>();
    sandboxFiles.forEach((file) => {
      const parts = file.path.split('/');
      if (parts.length > 1) names.add(parts[0]);
    });
    return [...names];
  }, [sandboxFiles]);
  const topLevelSandbox = sandboxFiles.filter((file) => !file.path.includes('/'));
  const nestedSandbox = (folder: string) => sandboxFiles.filter((file) => file.path.startsWith(folder + '/'));

  const editorValue = activeContent ?? '';
  const editorKey = `${mode}:${binding?.rootPath ?? key}:${activePath}`;
  const diskConnected = mode === 'local' && Boolean(binding);
  const projectFileCount = mode === 'local' ? projectScan?.fileCount ?? 0 : sandboxFiles.length;
  const cockpitState = diskConnected ? 'REAL PROJECT CONNECTED' : 'INCIDENT SANDBOX';
  const runtimeState = previewUrl ? 'LIVE PREVIEW' : devStatus === 'idle' ? 'READY' : devStatus.toUpperCase();

  return (
    <section className={`dev-workbench dev-cockpit ${active ? 'active' : ''} mode-${mode}`}>
      <header className="dev-cockpit-head">
        <div className="dev-cockpit-title">
          <span>BUILD // PROJECT COCKPIT</span>
          <h2>{projectName || 'SCRATCH PROJECT'}</h2>
          <div className="dev-project-meta">
            {projectStatus && <i>{projectStatus}</i>}
            {projectPriority && <i>{projectPriority}</i>}
            <i>{taskCount} TASKS</i>
            <i>{openSignals} OPEN SIGNALS</i>
            <i>{assetCount} ASSETS</i>
            <i className={diskConnected ? 'local-binding' : ''}>{cockpitState}</i>
            {dirtyCount > 0 && <i className="dirty-badge">{dirtyCount} UNSAVED</i>}
          </div>
          {nextMove && <p><strong>NEXT //</strong> {nextMove}</p>}
        </div>
        <div className="dev-cockpit-runtime">
          <small>RUNTIME</small>
          <b className={`dev-status ${devStatus}`}>{runtimeState}</b>
          {activePath && <span>{activePath}</span>}
        </div>
      </header>

      <section className={`dev-project-connection ${diskConnected ? 'connected' : 'sandbox'}`}>
        <div className="dev-connection-copy">
          <small>PROJECT SOURCE //</small>
          <b>{diskConnected ? binding?.name : 'NO DISK PROJECT ATTACHED'}</b>
          {diskConnected ? <p>{binding?.rootPath}</p> : <p>The Workbench is usable now, but binding a real folder unlocks disk-backed editing, project search, Git, Problems and your actual app runtime.</p>}
        </div>
        <div className="dev-connection-stats">
          <span><b>{projectFileCount}</b><small>FILES</small></span>
          <span><b>{tabs.length}</b><small>OPEN</small></span>
          <span><b>{problems.length}</b><small>PROBLEMS</small></span>
          <span><b>{dirtyCount}</b><small>UNSAVED</small></span>
        </div>
        <div className="dev-connection-actions">
          {isTauri() && mode === 'sandbox' && <button className="primary" disabled={!projectId} onClick={() => void bindFolder()}><FolderOpen size={14}/> {projectId ? 'OPEN REAL PROJECT' : 'SELECT INCIDENT FIRST'}</button>}
          {!isTauri() && mode === 'sandbox' && <div className="dev-desktop-hint">DESKTOP APP // OPEN REAL PROJECT ENABLED THERE</div>}
          {mode === 'local' && <button onClick={() => void refreshLocalTree()}><FolderSync size={13}/> RESCAN</button>}
          {mode === 'local' && <button onClick={detachFolder}><X size={13}/> DETACH</button>}
        </div>
      </section>

      <div className="dev-layout-rack">
        <strong>LAYOUT //</strong>
        <div className="dev-view-presets">
          <button className={workbenchView==='cockpit'?'active':''} onClick={()=>setViewPreset('cockpit')}>COCKPIT</button>
          <button className={workbenchView==='code-focus'?'active':''} onClick={()=>setViewPreset('code-focus')}>CODE FOCUS</button>
          <button className={workbenchView==='preview-focus'?'active':''} onClick={()=>setViewPreset('preview-focus')}>PREVIEW FOCUS</button>
        </div>
        <label>EXPLORER <input type="range" min="160" max="360" step="10" value={explorerWidth} onChange={event=>changeExplorerWidth(Number(event.target.value))}/><span>{explorerWidth}px</span></label>
        <label>PREVIEW <input type="range" min="260" max="640" step="10" value={previewWidth} onChange={event=>changePreviewWidth(Number(event.target.value))}/><span>{previewWidth}px</span></label>
      </div>

      <div className="dev-cockpit-toolbar">
        <div className="dev-cockpit-tools">
          <button onClick={() => void createFile()}><Plus size={13}/> NEW FILE</button>
          {mode === 'local' && <button onClick={() => void saveAllLocal()} disabled={dirtyCount === 0}><Save size={13}/> SAVE ALL</button>}
          {mode === 'sandbox' && <button onClick={resetStarter}><RefreshCw size={13}/> RESET SANDBOX</button>}
          {runScripts.length > 1 && <select value={selectedScript ?? ''} onChange={(event) => setSelectedScript(event.target.value)}>{runScripts.map((script) => <option key={script}>{script}</option>)}</select>}
          <button className="run" onClick={() => void runDev()} disabled={devStatus === 'booting' || devStatus === 'installing' || devStatus === 'starting'}>
            <Play size={13}/> {devStatus === 'installing' ? 'INSTALLING' : devStatus === 'starting' ? 'STARTING' : 'RUN PROJECT'}
          </button>
          {previewUrl && <button onClick={() => window.open(previewUrl, '_blank', 'noopener,noreferrer')}><ExternalLink size={13}/> OPEN LIVE</button>}
        </div>
        <div className="dev-cockpit-jump">
          <button onClick={() => setDockView('terminal')}><TerminalSquare size={12}/> TERMINAL</button>
          <button onClick={() => setDockView('problems')}><AlertTriangle size={12}/> PROBLEMS {problems.length ? `· ${problems.length}` : ''}</button>
          <button onClick={() => setDockView('git')}>GIT</button>
          <button onClick={() => { setDockView('search'); window.setTimeout(() => searchInputRef.current?.focus(), 0); }}><Search size={12}/> SEARCH</button>
        </div>
      </div>

      {mode === 'local' && scanError && <div className="dev-binding-error">
        <b>LOCAL PROJECT ACCESS NEEDS ATTENTION</b>
        <span>{scanError}</span>
        <button onClick={() => void bindFolder()}>REBIND FOLDER</button>
      </div>}

      <div className={`dev-workbench-grid view-${workbenchView}`} style={{'--dev-explorer-w':`${explorerWidth}px`,'--dev-preview-w':`${previewWidth}px`} as CSSProperties}>
        <aside className="dev-explorer">
          <div className="dev-pane-title"><FolderOpen size={13}/> {mode === 'local' ? binding?.name ?? 'LOCAL PROJECT' : 'PROJECT'}<span>{projectFileCount}</span></div>
          {mode === 'local' ? (
            projectScan ? <ProjectTree
              entries={projectScan.entries}
              activePath={activePath}
              expanded={expandedFolders}
              onToggleFolder={(path) => setExpandedFolders((current) => {
                const next = new Set(current);
                if (next.has(path)) next.delete(path); else next.add(path);
                return next;
              })}
              onOpen={openFile}
              onRename={(path) => void renameFile(path)}
              onDelete={(path) => void deleteFile(path)}
            /> : <div className="dev-tree-loading">SCANNING PROJECT...</div>
          ) : <>
            {topLevelSandbox.map((file) => <FileRow key={file.path} path={file.path} label={file.path} active={activePath === file.path} dirty={false} open={() => openFile(file.path)} remove={() => void deleteFile(file.path)} />)}
            {sandboxFolders.map((folder) => (
              <div className="dev-folder" key={folder}>
                <b>{folder}/</b>
                {nestedSandbox(folder).map((file) => <FileRow key={file.path} path={file.path} label={file.path.slice(folder.length + 1)} active={activePath === file.path} dirty={false} open={() => openFile(file.path)} remove={() => void deleteFile(file.path)} />)}
              </div>
            ))}
          </>}
          <div className="dev-explorer-note">
            {mode === 'local'
              ? <>{projectScan?.fileCount ?? 0} FILES · {projectScan?.directoryCount ?? 0} DIRS<br/>DISK IS AUTHORITATIVE{projectScan?.truncated ? <><br/>TREE TRUNCATED FOR SAFETY</> : null}</>
              : <>INCIDENT SANDBOX<br/>AUTO-SAVED LOCALLY<br/>NODE ROOT: /workspace</>}
          </div>
        </aside>

        <section className="dev-code-pane">
          <div className="dev-tabs">
            {tabs.map((tab) => {
              const dirty = mode === 'local' && Boolean(localBuffers[tab] && localBuffers[tab].content !== localBuffers[tab].savedContent);
              return <button key={tab} className={tab === activePath ? 'active' : ''} onClick={() => openFile(tab)}>
                <FileCode2 size={11}/><span>{tab.split('/').pop()}{dirty ? ' ●' : ''}</span><i onClick={(event) => { event.stopPropagation(); closeTab(tab); }}><X size={10}/></i>
              </button>;
            })}
          </div>
          {activePath && activeContent !== undefined ? <>
            <div className="dev-editor-filebar"><span>{activePath}</span><small>{languageFor(activePath).toUpperCase()}</small>{mode === 'local' && <button onClick={() => void saveActiveLocal()} disabled={!activeDirty}><Save size={11}/> SAVE</button>}</div>
            <CodeEditor
              className="dev-code-editor"
              value={editorValue}
              resetKey={editorKey}
              language={languageFor(activePath)}
              onChange={updateActive}
            />
          </> : <div className="dev-no-file">{mode === 'local' ? 'OPEN A TEXT FILE FROM THE PROJECT TREE' : 'CREATE OR OPEN A FILE'}</div>}
        </section>

        <section className="dev-preview-pane">
          <div className="dev-pane-title"><Play size={13}/> {previewUrl ? 'LIVE DEV SERVER' : mode === 'local' ? 'PROJECT PREVIEW' : 'STATIC PREVIEW'}<span>{previewUrl ? 'LIVE' : 'IDLE'}</span></div>
          {mode === 'local' && !previewUrl
            ? <div className="dev-local-preview-empty"><b>YOUR APP RUNS HERE.</b><p>Hit RUN PROJECT. xFactor.OS mirrors the approved project into its shared runtime, launches the detected package script, and keeps the preview beside the code.</p><small>LIKELY SECRET FILES STAY OUT OF THE MIRROR BY DEFAULT.</small></div>
            : <iframe
              title="Workbench preview"
              sandbox="allow-scripts allow-forms allow-modals allow-popups allow-same-origin"
              src={previewUrl}
              srcDoc={previewUrl ? undefined : previewDoc}
            />}
          {devError && <div className="dev-error">{devError}</div>}
          {logs.length > 0 && <pre className="dev-process-log">{logs.join('').slice(-7000)}</pre>}
        </section>
      </div>

      <section className="dev-cockpit-dock">
        <div className="dev-dock-tabs">
          <button className={dockView === 'terminal' ? 'active' : ''} onClick={() => setDockView('terminal')}><TerminalSquare size={12}/> TERMINAL</button>
          <button className={dockView === 'problems' ? 'active' : ''} onClick={() => setDockView('problems')}><AlertTriangle size={12}/> PROBLEMS <i>{problems.length}</i></button>
          <button className={dockView === 'git' ? 'active' : ''} onClick={() => setDockView('git')}>SOURCE CONTROL</button>
          <button className={dockView === 'search' ? 'active' : ''} onClick={() => setDockView('search')}><Search size={12}/> PROJECT SEARCH {searchHits.length ? <i>{searchHits.length}</i> : null}</button>
          <span>CTRL/⌘+S SAVE · CTRL/⌘+SHIFT+F SEARCH · CTRL/⌘+` TERMINAL</span>
        </div>

        {dockView === 'terminal' && <div className="dev-dock-content terminal"><TerminalRoom active={active} compact /></div>}

        {dockView === 'problems' && <div className="dev-dock-content">
          {problems.length > 0 ? <div className="dev-problems-list">{problems.slice(0, 80).map((problem) => <button key={problem.id} onClick={() => { if (problem.file) openFile(problem.file); }} disabled={!problem.file}><i className={problem.severity}/><b>{problem.code ?? problem.source.toUpperCase()}</b><span>{problem.file ? `${problem.file}${problem.line ? `:${problem.line}${problem.column ? `:${problem.column}` : ''}` : ''}` : 'PROCESS'}</span><p>{problem.message}</p></button>)}</div> : <div className="dev-dock-empty">NO PARSED PROBLEMS. BUILD/RUNTIME OUTPUT WILL APPEAR HERE WHEN SOMETHING BREAKS.</div>}
        </div>}

        {dockView === 'git' && <div className="dev-dock-content">
          {mode === 'local' && binding ? <GitPanel rootPath={binding.rootPath}/> : <div className="dev-dock-empty"><b>SOURCE CONTROL NEEDS A REAL PROJECT.</b><span>Bind a desktop folder to inspect diffs, stage, unstage and commit without leaving this Incident.</span>{isTauri() && projectId && <button onClick={() => void bindFolder()}><FolderOpen size={12}/> OPEN REAL PROJECT</button>}</div>}
        </div>}

        {dockView === 'search' && <div className="dev-dock-content search">
          {mode === 'local' && binding ? <>
            <div className="dev-project-search"><Search size={13}/><input ref={searchInputRef} value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') void runProjectSearch(); }} placeholder="SEARCH ACROSS THIS PROJECT..."/><button disabled={searchBusy || !searchQuery.trim()} onClick={() => void runProjectSearch()}>{searchBusy ? 'SEARCHING' : 'SEARCH'}</button></div>
            {searchMeta && <small className="dev-search-meta">{searchMeta}</small>}
            {searchHits.length > 0 ? <div className="dev-search-results">{searchHits.slice(0, 80).map((hit, index) => <button key={`${hit.path}:${hit.line}:${hit.column}:${index}`} onClick={() => openFile(hit.path)}><b>{hit.path}</b><span>{hit.line}:{hit.column}</span><p>{hit.preview}</p></button>)}</div> : <div className="dev-dock-empty">SEARCH FILE CONTENT ACROSS THE BOUND PROJECT. LIKELY SECRET FILES ARE SKIPPED BY DEFAULT.</div>}
          </> : <div className="dev-dock-empty"><b>PROJECT SEARCH NEEDS A REAL PROJECT.</b><span>Bind a desktop folder and search the actual codebase from here.</span>{isTauri() && projectId && <button onClick={() => void bindFolder()}><FolderOpen size={12}/> OPEN REAL PROJECT</button>}</div>}
        </div>}
      </section>
    </section>
  );
}

function ProjectTree({
  entries,
  activePath,
  expanded,
  onToggleFolder,
  onOpen,
  onRename,
  onDelete,
}: {
  entries: ProjectEntry[];
  activePath: string;
  expanded: Set<string>;
  onToggleFolder: (path: string) => void;
  onOpen: (path: string) => void;
  onRename: (path: string) => void;
  onDelete: (path: string) => void;
}) {
  return <div className="dev-project-tree">{entries.map((entry) => {
    if (entry.kind === 'directory') {
      const open = expanded.has(entry.relativePath);
      return <div key={entry.relativePath} className="dev-tree-dir">
        <button className="dev-tree-folder" style={{ paddingLeft: `${6 + entry.depth * 11}px` }} onClick={() => onToggleFolder(entry.relativePath)}>
          <span>{open ? '▾' : '▸'}</span><b>{entry.name}/</b>
        </button>
        {open && entry.children && <ProjectTree entries={entry.children} activePath={activePath} expanded={expanded} onToggleFolder={onToggleFolder} onOpen={onOpen} onRename={onRename} onDelete={onDelete}/>} 
      </div>;
    }
    return <FileRow
      key={entry.relativePath}
      path={entry.relativePath}
      label={entry.name}
      active={activePath === entry.relativePath}
      dirty={false}
      indent={entry.depth}
      open={() => onOpen(entry.relativePath)}
      rename={() => onRename(entry.relativePath)}
      remove={() => onDelete(entry.relativePath)}
    />;
  })}</div>;
}

function FileRow({
  path,
  label,
  active,
  dirty,
  indent = 0,
  open,
  rename,
  remove,
}: {
  path: string;
  label: string;
  active: boolean;
  dirty: boolean;
  indent?: number;
  open: () => void;
  rename?: () => void;
  remove: () => void;
}) {
  return <div className={`dev-file ${active ? 'active' : ''}`} title={path}>
    <button style={{ paddingLeft: `${6 + indent * 11}px` }} onClick={open}><FileCode2 size={12}/><span>{label}{dirty ? ' ●' : ''}</span></button>
    {rename && <button className="rename" title="Rename file" onClick={rename}>R</button>}
    <button className="trash" title="Delete file" onClick={remove}><Trash2 size={11}/></button>
  </div>;
}
