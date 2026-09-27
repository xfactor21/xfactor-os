import { useEffect, useMemo, useRef, useState } from 'react';
import { ExternalLink, FileCode2, FolderOpen, Play, Plus, RefreshCw, TerminalSquare, Trash2, X } from 'lucide-react';
import CodeEditor, { type EditorLanguage } from '../design-system/CodeEditor';
import TerminalRoom from '../modules/terminal';
import { getWebContainer, webContainerSupported } from '../lib/webcontainerRuntime';
import './workbench.css';

type WorkbenchFile = { path: string; content: string };
type DevStatus = 'idle' | 'booting' | 'installing' | 'starting' | 'running' | 'error';

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
    content: \`<!doctype html>
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
\`,
  },
  {
    path: 'src/main.js',
    content: \`const app = document.querySelector('#app');

app.innerHTML = \\\`
  <section class="hero">
    <small>xFactor.OS // WORKBENCH</small>
    <h1>Build something impossible to ignore.</h1>
    <p>Edit the project, run Vite, and keep the work tied to this Incident.</p>
    <button id="hit">MAKE NOISE</button>
    <strong id="count">0</strong>
  </section>
\\\`;

let count = 0;
document.querySelector('#hit').addEventListener('click', () => {
  count += 1;
  document.querySelector('#count').textContent = String(count);
});
\`,
  },
  {
    path: 'src/style.css',
    content: \`:root {
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
\`,
  },
];

function cloneStarter(): WorkbenchFile[] {
  return STARTER_FILES.map((file) => ({ ...file }));
}

function storageKey(projectId?: string) {
  return \`xfactor-workbench-v1:\${projectId || 'scratch'}\`;
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
  if (ext === 'css') return 'css';
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
  html = html.includes('</head>') ? html.replace('</head>', \`<style>\${css}</style></head>\`) : \`<style>\${css}</style>\${html}\`;
  html = html.includes('</body>') ? html.replace('</body>', \`<script type="module">\${safeJs}</script></body>\`) : \`\${html}<script type="module">\${safeJs}</script>\`;
  return html;
}

async function ensureParent(wc: Awaited<ReturnType<typeof getWebContainer>>, path: string) {
  const parts = path.split('/').filter(Boolean);
  if (parts.length <= 1) return;
  const dir = '/workspace/' + parts.slice(0, -1).join('/');
  await wc.fs.mkdir(dir, { recursive: true });
}

export default function DeveloperWorkbench({
  active,
  projectId,
  projectName,
}: {
  active: boolean;
  projectId?: string;
  projectName?: string;
}) {
  const key = storageKey(projectId);
  const [files, setFiles] = useState<WorkbenchFile[]>(() => loadFiles(key));
  const [activePath, setActivePath] = useState(() => loadFiles(key)[0]?.path ?? 'index.html');
  const [tabs, setTabs] = useState<string[]>(() => [loadFiles(key)[0]?.path ?? 'index.html']);
  const [previewDoc, setPreviewDoc] = useState(() => staticPreview(loadFiles(key)));
  const [previewUrl, setPreviewUrl] = useState<string>();
  const [devStatus, setDevStatus] = useState<DevStatus>('idle');
  const [devError, setDevError] = useState<string>();
  const [logs, setLogs] = useState<string[]>([]);
  const wcRef = useRef<Awaited<ReturnType<typeof getWebContainer>> | null>(null);
  const mountedKeyRef = useRef<string | undefined>(undefined);
  const devProcessRef = useRef<{ kill(): void } | null>(null);
  const serverOffRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const next = loadFiles(key);
    const first = next.find((file) => file.path === 'src/main.js')?.path ?? next[0]?.path ?? 'index.html';
    setFiles(next);
    setActivePath(first);
    setTabs([first]);
    setPreviewDoc(staticPreview(next));
    setPreviewUrl(undefined);
    setDevStatus('idle');
    setDevError(undefined);
    setLogs([]);
  }, [key]);

  useEffect(() => {
    localStorage.setItem(key, JSON.stringify(files));
    const timer = window.setTimeout(() => setPreviewDoc(staticPreview(files)), 180);
    return () => window.clearTimeout(timer);
  }, [files, key]);

  useEffect(() => () => {
    serverOffRef.current?.();
  }, []);

  const activeFile = useMemo(() => files.find((file) => file.path === activePath) ?? files[0], [files, activePath]);
  const folders = useMemo(() => {
    const names = new Set<string>();
    files.forEach((file) => {
      const parts = file.path.split('/');
      if (parts.length > 1) names.add(parts[0]);
    });
    return [...names];
  }, [files]);

  function openFile(path: string) {
    setActivePath(path);
    setTabs((current) => current.includes(path) ? current : [...current, path]);
  }

  async function writeToContainer(path: string, content: string) {
    const wc = wcRef.current;
    if (!wc || mountedKeyRef.current !== key) return;
    try {
      await ensureParent(wc, path);
      await wc.fs.writeFile('/workspace/' + path, content);
    } catch {
      // The local project remains authoritative; Run Dev will remount all files.
    }
  }

  function updateActive(content: string) {
    if (!activeFile) return;
    setFiles((current) => current.map((file) => file.path === activeFile.path ? { ...file, content } : file));
    void writeToContainer(activeFile.path, content);
  }

  function createFile() {
    const raw = window.prompt('New file path', 'src/new-file.js')?.trim().replace(/^\/+/, '');
    if (!raw || files.some((file) => file.path === raw)) return;
    const next = { path: raw, content: '' };
    setFiles((current) => [...current, next].sort((a, b) => a.path.localeCompare(b.path)));
    openFile(raw);
    void writeToContainer(raw, '');
  }

  async function deleteFile(path: string) {
    if (!window.confirm(\`Delete \${path} from this Workbench project?\`)) return;
    const next = files.filter((file) => file.path !== path);
    setFiles(next.length ? next : cloneStarter());
    setTabs((current) => current.filter((tab) => tab !== path));
    if (activePath === path) setActivePath(next[0]?.path ?? 'index.html');
    const wc = wcRef.current;
    if (wc && mountedKeyRef.current === key) {
      try { await wc.fs.rm('/workspace/' + path); } catch { /* local state already removed */ }
    }
  }

  function closeTab(path: string) {
    setTabs((current) => {
      const next = current.filter((tab) => tab !== path);
      if (activePath === path) setActivePath(next[next.length - 1] ?? files[0]?.path ?? '');
      return next;
    });
  }

  function resetStarter() {
    if (!window.confirm('Reset this Incident Workbench to the starter project?')) return;
    const next = cloneStarter();
    setFiles(next);
    setActivePath('src/main.js');
    setTabs(['src/main.js']);
    setPreviewUrl(undefined);
    setDevStatus('idle');
    setDevError(undefined);
  }

  async function syncAllToContainer() {
    const wc = await getWebContainer();
    wcRef.current = wc;
    if (mountedKeyRef.current !== key) {
      try { await wc.fs.rm('/workspace', { recursive: true }); } catch { /* first mount */ }
      await wc.fs.mkdir('/workspace', { recursive: true });
      mountedKeyRef.current = key;
    }
    for (const file of files) {
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
      const wc = await syncAllToContainer();
      setDevStatus('installing');
      const install = await wc.spawn('npm', ['install'], { cwd: '/workspace' });
      void install.output.pipeTo(new WritableStream({
        write(chunk) { setLogs((current) => [...current.slice(-80), chunk]); },
      }));
      const installCode = await install.exit;
      if (installCode !== 0) throw new Error(\`npm install exited with code \${installCode}\`);

      devProcessRef.current?.kill();
      serverOffRef.current?.();
      serverOffRef.current = wc.on('server-ready', (_port, url) => {
        setPreviewUrl(url);
        setDevStatus('running');
      }) as unknown as () => void;

      setDevStatus('starting');
      const process = await wc.spawn('npm', ['run', 'dev', '--', '--host', '0.0.0.0'], { cwd: '/workspace' });
      devProcessRef.current = process;
      void process.output.pipeTo(new WritableStream({
        write(chunk) { setLogs((current) => [...current.slice(-80), chunk]); },
      }));
      void process.exit.then((code) => {
        if (code !== 0) {
          setDevStatus('error');
          setDevError(\`Dev server exited with code \${code}\`);
        }
      });
    } catch (error) {
      setDevStatus('error');
      setDevError(error instanceof Error ? error.message : String(error));
    }
  }

  const topLevel = files.filter((file) => !file.path.includes('/'));
  const nestedByFolder = (folder: string) => files.filter((file) => file.path.startsWith(folder + '/'));

  return (
    <section className={\`dev-workbench \${active ? 'active' : ''}\`}>
      <div className="dev-workbench-head">
        <div>
          <span>ACTIVE INCIDENT //</span>
          <b>{projectName || 'SCRATCH PROJECT'}</b>
        </div>
        <div className="dev-workbench-actions">
          <span className={\`dev-status \${devStatus}\`}>{devStatus === 'running' ? '● LIVE' : devStatus.toUpperCase()}</span>
          <button onClick={createFile}><Plus size={13}/> FILE</button>
          <button onClick={resetStarter}><RefreshCw size={13}/> RESET</button>
          <button className="run" onClick={() => void runDev()} disabled={devStatus === 'booting' || devStatus === 'installing' || devStatus === 'starting'}>
            <Play size={13}/> {devStatus === 'installing' ? 'INSTALLING' : devStatus === 'starting' ? 'STARTING' : 'RUN DEV'}
          </button>
          {previewUrl && <button onClick={() => window.open(previewUrl, '_blank', 'noopener,noreferrer')}><ExternalLink size={13}/> OPEN</button>}
        </div>
      </div>

      <div className="dev-workbench-grid">
        <aside className="dev-explorer">
          <div className="dev-pane-title"><FolderOpen size={13}/> PROJECT</div>
          {topLevel.map((file) => <FileRow key={file.path} file={file} active={activePath === file.path} open={() => openFile(file.path)} remove={() => void deleteFile(file.path)} />)}
          {folders.map((folder) => (
            <div className="dev-folder" key={folder}>
              <b>{folder}/</b>
              {nestedByFolder(folder).map((file) => <FileRow key={file.path} file={file} label={file.path.slice(folder.length + 1)} active={activePath === file.path} open={() => openFile(file.path)} remove={() => void deleteFile(file.path)} />)}
            </div>
          ))}
          <div className="dev-explorer-note">AUTO-SAVED LOCALLY<br/>NODE ROOT: /workspace</div>
        </aside>

        <section className="dev-code-pane">
          <div className="dev-tabs">
            {tabs.map((tab) => <button key={tab} className={tab === activePath ? 'active' : ''} onClick={() => openFile(tab)}>
              <FileCode2 size={11}/><span>{tab.split('/').pop()}</span><i onClick={(event) => { event.stopPropagation(); closeTab(tab); }}><X size={10}/></i>
            </button>)}
          </div>
          {activeFile ? <CodeEditor
            className="dev-code-editor"
            value={activeFile.content}
            resetKey={key + ':' + activeFile.path}
            language={languageFor(activeFile.path)}
            onChange={updateActive}
          /> : <div className="dev-no-file">CREATE OR OPEN A FILE</div>}
        </section>

        <section className="dev-preview-pane">
          <div className="dev-pane-title"><Play size={13}/> {previewUrl ? 'LIVE DEV SERVER' : 'STATIC PREVIEW'}</div>
          <iframe
            title="Workbench preview"
            sandbox="allow-scripts allow-forms allow-modals allow-popups allow-same-origin"
            src={previewUrl}
            srcDoc={previewUrl ? undefined : previewDoc}
          />
          {devError && <div className="dev-error">{devError}</div>}
          {logs.length > 0 && <pre className="dev-process-log">{logs.join('').slice(-7000)}</pre>}
        </section>
      </div>

      <div className="dev-terminal-title"><TerminalSquare size={13}/> SHARED RUNTIME / TERMINAL</div>
      <TerminalRoom active={active} compact />
    </section>
  );
}

function FileRow({
  file,
  label,
  active,
  open,
  remove,
}: {
  file: WorkbenchFile;
  label?: string;
  active: boolean;
  open: () => void;
  remove: () => void;
}) {
  return <div className={\`dev-file \${active ? 'active' : ''}\`}>
    <button onClick={open}><FileCode2 size={12}/><span>{label || file.path}</span></button>
    <button className="trash" title="Delete file" onClick={remove}><Trash2 size={11}/></button>
  </div>;
}
