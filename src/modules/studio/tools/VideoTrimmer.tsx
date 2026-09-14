import { useEffect, useRef, useState } from 'react';
import ToolShell from './ToolShell';
import Icon from '../../../design-system/icons/Icon';

type VideoPrefs = { version: 2; start: number; end: number; exportName: string };
const KEY = 'xfactor-studio-videotrim2-';

function loadPrefs(boardId: string): VideoPrefs {
  const fallback: VideoPrefs = { version: 2, start: 0, end: 0, exportName: '' };
  try {
    const raw = localStorage.getItem(KEY + boardId);
    if (raw) return { ...fallback, ...(JSON.parse(raw) as Partial<VideoPrefs>), version: 2 };
  } catch {}
  return fallback;
}

export default function VideoTrimmer({ boardId, onExit }: { boardId: string; onExit: () => void }) {
  const initial = useRef(loadPrefs(boardId)).current;
  const [fileName, setFileName] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const [trimStart, setTrimStart] = useState(initial.start);
  const [trimEnd, setTrimEnd] = useState(initial.end);
  const [exportName, setExportName] = useState(initial.exportName);
  const [isPlaying, setIsPlaying] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [supported] = useState(() => typeof HTMLVideoElement !== 'undefined' && 'captureStream' in HTMLVideoElement.prototype);
  const videoRef = useRef<HTMLVideoElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const dragHandleRef = useRef<'start' | 'end' | null>(null);
  const objectUrlRef = useRef<string | null>(null);

  useEffect(() => {
    try { localStorage.setItem(KEY + boardId, JSON.stringify({ version: 2, start: trimStart, end: trimEnd, exportName })); } catch {}
  }, [boardId, trimStart, trimEnd, exportName]);

  useEffect(() => () => { if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current); }, []);

  function clampStart(value: number) {
    const max = Math.max(0, trimEnd - 0.05);
    setTrimStart(Math.max(0, Math.min(value, max)));
  }
  function clampEnd(value: number) {
    const min = Math.min(duration, trimStart + 0.05);
    setTrimEnd(Math.min(duration, Math.max(value, min)));
  }

  function onFile(file: File | null) {
    if (!file) return;
    setError(null);
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    const url = URL.createObjectURL(file);
    objectUrlRef.current = url;
    setFileName(file.name);
    if (!exportName) setExportName(file.name.replace(/\.[^.]+$/, ''));
    const v = videoRef.current;
    if (!v) return;
    v.src = url;
    v.onloadedmetadata = () => {
      setDuration(v.duration);
      const savedStart = Math.max(0, Math.min(initial.start, Math.max(0, v.duration - 0.05)));
      const savedEnd = initial.end > savedStart ? Math.min(initial.end, v.duration) : v.duration;
      setTrimStart(savedStart);
      setTrimEnd(Math.max(savedStart + Math.min(0.05, v.duration), savedEnd));
    };
  }

  function timeToPct(t: number) { return duration > 0 ? (t / duration) * 100 : 0; }
  function xToTime(x: number, width: number) { return duration > 0 ? Math.max(0, Math.min(duration, (x / width) * duration)) : 0; }

  function onOverlayPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    const wrap = wrapRef.current; if (!wrap) return;
    const rect = wrap.getBoundingClientRect(); const x = e.clientX - rect.left;
    const startX = (timeToPct(trimStart) / 100) * rect.width; const endX = (timeToPct(trimEnd) / 100) * rect.width;
    dragHandleRef.current = Math.abs(x - startX) < Math.abs(x - endX) ? 'start' : 'end';
    (e.target as Element).setPointerCapture(e.pointerId);
  }
  function onOverlayPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!dragHandleRef.current) return; const wrap = wrapRef.current; if (!wrap) return;
    const rect = wrap.getBoundingClientRect(); const t = xToTime(e.clientX - rect.left, rect.width);
    if (dragHandleRef.current === 'start') clampStart(t); else clampEnd(t);
  }
  function onOverlayPointerUp() { dragHandleRef.current = null; }

  function playTrimmed() {
    const v = videoRef.current; if (!v) return;
    v.currentTime = trimStart; void v.play(); setIsPlaying(true);
    const onTime = () => { if (v.currentTime >= trimEnd) { v.pause(); v.removeEventListener('timeupdate', onTime); setIsPlaying(false); } };
    v.addEventListener('timeupdate', onTime);
  }
  function stopPlayback() { videoRef.current?.pause(); setIsPlaying(false); }

  async function exportTrimmed() {
    const v = videoRef.current; if (!v || !supported || trimEnd <= trimStart) return;
    setError(null); setBusy(true); setProgress(0);
    try {
      await new Promise<void>((resolve) => { v.currentTime = trimStart; const onSeeked = () => { v.removeEventListener('seeked', onSeeked); resolve(); }; v.addEventListener('seeked', onSeeked); });
      type CaptureVideo = HTMLVideoElement & { captureStream: () => MediaStream };
      const stream = (v as CaptureVideo).captureStream();
      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus') ? 'video/webm;codecs=vp9,opus' : 'video/webm';
      const recorder = new MediaRecorder(stream, { mimeType }); const chunks: BlobPart[] = [];
      recorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
      const finished = new Promise<Blob>((resolve) => { recorder.onstop = () => resolve(new Blob(chunks, { type: 'video/webm' })); });
      recorder.start(); await v.play(); const total = trimEnd - trimStart;
      const onTime = () => { setProgress(Math.min(1, (v.currentTime - trimStart) / Math.max(0.01, total))); if (v.currentTime >= trimEnd) { v.pause(); v.removeEventListener('timeupdate', onTime); recorder.stop(); } };
      v.addEventListener('timeupdate', onTime);
      const blob = await finished; const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url;
      a.download = `${(exportName || fileName?.replace(/\.[^.]+$/, '') || 'trimmed').trim().replace(/[^a-z0-9._-]+/gi, '-')}-trimmed.webm`;
      document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 4000);
    } catch (err) { console.error('VideoTrimmer export failed', err); setError("Couldn't export that clip — your browser may not support recording this video's codec."); }
    finally { setBusy(false); setProgress(0); }
  }

  const hasVideo = !!fileName;
  return <ToolShell title="VIDEO TRIMMER 2.0" onExit={onExit}>
    <div data-testid="video-trimmer-2-root">
      <label className="toolDrop" style={{ display: 'inline-block' }}>{fileName ? `LOADED: ${fileName} (click to replace)` : 'CLICK TO UPLOAD A VIDEO FILE'}
        <input aria-label="Video file" type="file" accept="video/*" hidden onChange={(e) => onFile(e.target.files?.[0] ?? null)} />
      </label>
      {!supported && <div className="toolHint" style={{ color: 'var(--amber)' }}>This browser cannot capture/re-record video. Trim preview still works, but export is unavailable here.</div>}
      {error && <div className="toolHint" style={{ color: 'var(--magenta)' }}>{error}</div>}
      <div style={{ marginTop: 10, display: hasVideo ? 'block' : 'none' }}>
        <video ref={videoRef} style={{ width: '100%', maxWidth: 640, borderRadius: 8, background: '#000' }} controls={false} />
        <div ref={wrapRef} style={{ position: 'relative', width: '100%', maxWidth: 640, height: 28, marginTop: 10, background: 'rgba(0,245,255,.06)', borderRadius: 6 }}>
          <div onPointerDown={onOverlayPointerDown} onPointerMove={onOverlayPointerMove} onPointerUp={onOverlayPointerUp} onPointerLeave={onOverlayPointerUp} style={{ position: 'absolute', inset: 0, cursor: 'ew-resize' }}>
            <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${timeToPct(trimStart)}%`, background: 'rgba(5,8,13,.65)' }} />
            <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: `${100 - timeToPct(trimEnd)}%`, background: 'rgba(5,8,13,.65)' }} />
            <div style={{ position: 'absolute', left: `${timeToPct(trimStart)}%`, top: 0, bottom: 0, width: 3, background: '#FF2D78' }} />
            <div style={{ position: 'absolute', left: `${timeToPct(trimEnd)}%`, top: 0, bottom: 0, width: 3, background: '#FF2D78', transform: 'translateX(-3px)' }} />
          </div>
        </div>
        <div className="toolRow" style={{ marginTop: 10, flexWrap: 'wrap' }}>
          <label className="toolField">IN (s)<input aria-label="Video trim start" type="number" min="0" max={duration} step="0.01" value={trimStart.toFixed(2)} onChange={(e) => clampStart(Number(e.target.value))} /></label>
          <label className="toolField">OUT (s)<input aria-label="Video trim end" type="number" min="0" max={duration} step="0.01" value={trimEnd.toFixed(2)} onChange={(e) => clampEnd(Number(e.target.value))} /></label>
          <label className="toolField">OUTPUT NAME<input aria-label="Video export name" value={exportName} onChange={(e) => setExportName(e.target.value)} /></label>
        </div>
        <div className="toolHint">Selection: {(trimEnd - trimStart).toFixed(2)}s · source {duration.toFixed(2)}s. Drag handles or enter exact in/out values.</div>
        <div className="toolRow" style={{ marginTop: 10 }}>
          {!isPlaying ? <button className="wbtn" onClick={playTrimmed}><Icon name="play" size={12} /> PLAY SELECTION</button> : <button className="wbtn ghost" onClick={stopPlayback}><Icon name="stop" size={12} /> STOP</button>}
          <button className="wbtn" onClick={exportTrimmed} disabled={busy || !supported}>{busy ? `EXPORTING… ${Math.round(progress * 100)}%` : 'EXPORT WEBM'}</button>
        </div>
      </div>
    </div>
  </ToolShell>;
}
