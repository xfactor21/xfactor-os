import { useEffect, useMemo, useState } from 'react';
import { Check, GitBranch, RefreshCw } from 'lucide-react';
import {
  commitGit,
  getGitDiff,
  getGitStatus,
  stageGitPaths,
  unstageGitPaths,
  type GitFileStatus,
  type GitStatus,
} from '../lib/gitBridge';

export default function GitPanel({ rootPath, onCommitted }: { rootPath: string; onCommitted?: (message: string) => void }) {
  const [status, setStatus] = useState<GitStatus>();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [selectedPath, setSelectedPath] = useState<string>();
  const [diff, setDiff] = useState('');
  const [commitMessage, setCommitMessage] = useState('');

  async function refresh() {
    setBusy(true);
    setError(undefined);
    try {
      const next = await getGitStatus(rootPath);
      setStatus(next);
      if (selectedPath && !next.files.some((file) => file.path === selectedPath)) {
        setSelectedPath(undefined);
        setDiff('');
      }
    } catch (cause) {
      setStatus(undefined);
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => { void refresh(); }, [rootPath]);

  async function selectFile(file: GitFileStatus) {
    setSelectedPath(file.path);
    setError(undefined);
    try {
      const staged = file.indexStatus !== ' ' && file.indexStatus !== '?';
      setDiff(await getGitDiff(rootPath, file.path, staged));
    } catch (cause) {
      setDiff('');
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  }

  async function toggleStage(file: GitFileStatus) {
    setBusy(true);
    try {
      const staged = file.indexStatus !== ' ' && file.indexStatus !== '?';
      if (staged) await unstageGitPaths(rootPath, [file.path]);
      else await stageGitPaths(rootPath, [file.path]);
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
      setBusy(false);
    }
  }

  async function commit() {
    const message = commitMessage.trim();
    if (!message) return;
    setBusy(true);
    setError(undefined);
    try {
      await commitGit(rootPath, message);
      setCommitMessage('');
      onCommitted?.(message);
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
      setBusy(false);
    }
  }

  const stagedCount = useMemo(() => status?.files.filter((file) => file.indexStatus !== ' ' && file.indexStatus !== '?').length ?? 0, [status]);

  return <section className="dev-git-panel">
    <div className="dev-git-head">
      <div><GitBranch size={13}/><b>{status?.detached ? 'DETACHED HEAD' : status?.branch ?? 'GIT'}</b>{status?.upstream && <small>{status.ahead ? `↑${status.ahead}` : ''}{status.behind ? ` ↓${status.behind}` : ''}</small>}</div>
      <button onClick={() => void refresh()} disabled={busy}><RefreshCw size={11}/> REFRESH</button>
    </div>
    {error && <div className="dev-git-error">{error}</div>}
    {status && <div className="dev-git-body">
      <div className="dev-git-files">
        {status.files.length === 0 ? <div className="dev-git-clean"><Check size={13}/> WORKTREE CLEAN</div> : status.files.map((file) => {
          const staged = file.indexStatus !== ' ' && file.indexStatus !== '?';
          return <div className={`dev-git-file ${selectedPath === file.path ? 'active' : ''}`} key={file.path}>
            <button className="dev-git-file-main" onClick={() => void selectFile(file)}><code>{file.indexStatus}{file.worktreeStatus}</code><span>{file.path}</span></button>
            <button onClick={() => void toggleStage(file)}>{staged ? 'UNSTAGE' : 'STAGE'}</button>
          </div>;
        })}
      </div>
      <pre className="dev-git-diff">{diff || 'SELECT A CHANGED FILE TO INSPECT ITS DIFF.'}</pre>
    </div>}
    {status && <div className="dev-git-commit"><input value={commitMessage} onChange={(event) => setCommitMessage(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') void commit(); }} placeholder={`COMMIT MESSAGE · ${stagedCount} STAGED`}/><button disabled={busy || stagedCount === 0 || !commitMessage.trim()} onClick={() => void commit()}>COMMIT</button></div>}
    <div className="dev-git-foot">NO PUSH COMMAND EXISTS IN WORKBENCH.</div>
  </section>;
}
