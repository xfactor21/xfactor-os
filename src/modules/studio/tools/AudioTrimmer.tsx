import { useEffect, useRef, useState } from 'react';
import ToolShell from './ToolShell';
import Icon from '../../../design-system/icons/Icon';

type AudioPrefs = { version: 2; start: number; end: number; exportName: string; fadeIn: number; fadeOut: number };
const KEY = 'xfactor-studio-audiotrim2-';
function loadPrefs(boardId: string): AudioPrefs {
  const fallback: AudioPrefs = { version: 2, start: 0, end: 0, exportName: '', fadeIn: 0, fadeOut: 0 };
  try { const raw = localStorage.getItem(KEY + boardId); if (raw) return { ...fallback, ...(JSON.parse(raw) as Partial<AudioPrefs>), version: 2 }; } catch {}
  return fallback;
}

export default function AudioTrimmer({ boardId, onExit }: { boardId: string; onExit: () => void }) {
  const initial = useRef(loadPrefs(boardId)).current;
  const [fileName, setFileName] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const [trimStart, setTrimStart] = useState(initial.start);
  const [trimEnd, setTrimEnd] = useState(initial.end);
  const [exportName, setExportName] = useState(initial.exportName);
  const [fadeIn, setFadeIn] = useState(initial.fadeIn);
  const [fadeOut, setFadeOut] = useState(initial.fadeOut);
  const [isPlaying, setIsPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const bufferRef = useRef<AudioBuffer | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dragHandleRef = useRef<'start' | 'end' | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  function getCtx(): AudioContext { if (!audioCtxRef.current) audioCtxRef.current = new AudioContext(); return audioCtxRef.current; }
  useEffect(() => { try { localStorage.setItem(KEY + boardId, JSON.stringify({ version: 2, start: trimStart, end: trimEnd, exportName, fadeIn, fadeOut })); } catch {} }, [boardId, trimStart, trimEnd, exportName, fadeIn, fadeOut]);
  useEffect(() => () => { sourceRef.current?.stop(); audioCtxRef.current?.close().catch(() => {}); }, []);

  function clampStart(value: number) { const max = Math.max(0, trimEnd - 0.02); setTrimStart(Math.max(0, Math.min(value, max))); }
  function clampEnd(value: number) { const min = Math.min(duration, trimStart + 0.02); setTrimEnd(Math.min(duration, Math.max(value, min))); }

  async function onFile(file: File | null) {
    if (!file) return; setError(null);
    try {
      const decoded = await getCtx().decodeAudioData(await file.arrayBuffer()); bufferRef.current = decoded;
      setDuration(decoded.duration); setFileName(file.name); if (!exportName) setExportName(file.name.replace(/\.[^.]+$/, ''));
      const savedStart = Math.max(0, Math.min(initial.start, Math.max(0, decoded.duration - 0.02)));
      const savedEnd = initial.end > savedStart ? Math.min(initial.end, decoded.duration) : decoded.duration;
      setTrimStart(savedStart); setTrimEnd(Math.max(savedStart + Math.min(0.02, decoded.duration), savedEnd));
    } catch { setError('Could not decode that file as audio — try WAV, MP3, or OGG.'); }
  }

  function drawWaveform(buffer: AudioBuffer) {
    const cv = canvasRef.current; if (!cv) return; const ctx = cv.getContext('2d'); if (!ctx) return;
    const w = cv.width, h = cv.height; ctx.clearRect(0, 0, w, h); ctx.fillStyle = 'rgba(0,245,255,.05)'; ctx.fillRect(0, 0, w, h);
    const data = buffer.getChannelData(0); const samplesPerPixel = Math.max(1, Math.floor(data.length / w)); ctx.strokeStyle = '#00F5FF'; ctx.lineWidth = 1; const mid = h / 2;
    for (let x = 0; x < w; x++) { const start = x * samplesPerPixel; let min = 1, max = -1; for (let i = 0; i < samplesPerPixel; i++) { const v = data[start + i] ?? 0; if (v < min) min = v; if (v > max) max = v; } ctx.beginPath(); ctx.moveTo(x, mid + min * mid); ctx.lineTo(x, mid + max * mid); ctx.stroke(); }
  }
  useEffect(() => { if (bufferRef.current) drawWaveform(bufferRef.current); }, [duration]);

  function timeToX(t: number, width: number) { return duration > 0 ? (t / duration) * width : 0; }
  function xToTime(x: number, width: number) { return duration > 0 ? Math.max(0, Math.min(duration, (x / width) * duration)) : 0; }
  function onOverlayPointerDown(e: React.PointerEvent<HTMLDivElement>) { const wrap = wrapRef.current; if (!wrap) return; const rect = wrap.getBoundingClientRect(), x = e.clientX - rect.left, startX = timeToX(trimStart, rect.width), endX = timeToX(trimEnd, rect.width); dragHandleRef.current = Math.abs(x - startX) < Math.abs(x - endX) ? 'start' : 'end'; (e.target as Element).setPointerCapture(e.pointerId); }
  function onOverlayPointerMove(e: React.PointerEvent<HTMLDivElement>) { if (!dragHandleRef.current) return; const wrap = wrapRef.current; if (!wrap) return; const rect = wrap.getBoundingClientRect(), t = xToTime(e.clientX - rect.left, rect.width); if (dragHandleRef.current === 'start') clampStart(t); else clampEnd(t); }
  function onOverlayPointerUp() { dragHandleRef.current = null; }

  function playTrimmed() { const buffer = bufferRef.current; if (!buffer) return; const ctx = getCtx(); sourceRef.current?.stop(); const src = ctx.createBufferSource(); src.buffer = buffer; src.connect(ctx.destination); src.start(0, trimStart, Math.max(0.01, trimEnd - trimStart)); sourceRef.current = src; setIsPlaying(true); src.onended = () => setIsPlaying(false); }
  function stopPlayback() { sourceRef.current?.stop(); setIsPlaying(false); }

  function exportTrimmedWav() {
    const buffer = bufferRef.current; if (!buffer || trimEnd <= trimStart) return;
    const sampleRate = buffer.sampleRate, startSample = Math.floor(trimStart * sampleRate), endSample = Math.floor(trimEnd * sampleRate), frameCount = Math.max(1, endSample - startSample), numChannels = buffer.numberOfChannels;
    const bytesPerSample = 2, blockAlign = numChannels * bytesPerSample, dataSize = frameCount * blockAlign, arrayBuffer = new ArrayBuffer(44 + dataSize), view = new DataView(arrayBuffer);
    const writeString = (offset: number, str: string) => { for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i)); };
    writeString(0, 'RIFF'); view.setUint32(4, 36 + dataSize, true); writeString(8, 'WAVE'); writeString(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, numChannels, true); view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * blockAlign, true); view.setUint16(32, blockAlign, true); view.setUint16(34, 16, true); writeString(36, 'data'); view.setUint32(40, dataSize, true);
    const channelData = Array.from({ length: numChannels }, (_, c) => buffer.getChannelData(c)); const fadeInFrames = Math.floor(Math.min(fadeIn, trimEnd - trimStart) * sampleRate), fadeOutFrames = Math.floor(Math.min(fadeOut, trimEnd - trimStart) * sampleRate);
    let offset = 44;
    for (let i = 0; i < frameCount; i++) {
      let gain = 1; if (fadeInFrames > 0 && i < fadeInFrames) gain *= i / fadeInFrames; if (fadeOutFrames > 0 && i >= frameCount - fadeOutFrames) gain *= Math.max(0, (frameCount - 1 - i) / fadeOutFrames);
      for (let c = 0; c < numChannels; c++) { const sample = (channelData[c][startSample + i] ?? 0) * gain, clamped = Math.max(-1, Math.min(1, sample)); view.setInt16(offset, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true); offset += 2; }
    }
    const blob = new Blob([arrayBuffer], { type: 'audio/wav' }), url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url; a.download = `${(exportName || fileName?.replace(/\.[^.]+$/, '') || 'trimmed').trim().replace(/[^a-z0-9._-]+/gi, '-')}-trimmed.wav`; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  const hasAudio = !!bufferRef.current; const selection = Math.max(0, trimEnd - trimStart); const maxFade = Math.max(0, selection / 2);
  return <ToolShell title="AUDIO WAVEFORM TRIMMER 2.0" onExit={onExit}><div data-testid="audio-trimmer-2-root">
    <label className="toolDrop" style={{ display: 'inline-block' }}>{fileName ? `LOADED: ${fileName} (click to replace)` : 'CLICK TO UPLOAD AN AUDIO FILE'}<input aria-label="Audio file" type="file" accept="audio/*" hidden onChange={(e) => onFile(e.target.files?.[0] ?? null)} /></label>
    {error && <div className="toolHint" style={{ color: 'var(--magenta)' }}>{error}</div>}
    {hasAudio && <><div ref={wrapRef} className="toolCanvasWrap" style={{ position: 'relative', width: 640 }}><canvas ref={canvasRef} width={640} height={140}/><div onPointerDown={onOverlayPointerDown} onPointerMove={onOverlayPointerMove} onPointerUp={onOverlayPointerUp} onPointerLeave={onOverlayPointerUp} style={{ position: 'absolute', inset: 0, cursor: 'ew-resize' }}><div style={{ position:'absolute',left:0,top:0,bottom:0,width:`${(trimStart/(duration||1))*100}%`,background:'rgba(5,8,13,.65)' }}/><div style={{ position:'absolute',right:0,top:0,bottom:0,width:`${100-(trimEnd/(duration||1))*100}%`,background:'rgba(5,8,13,.65)' }}/><div style={{ position:'absolute',left:`${(trimStart/(duration||1))*100}%`,top:0,bottom:0,width:3,background:'#FF2D78' }}/><div style={{ position:'absolute',left:`${(trimEnd/(duration||1))*100}%`,top:0,bottom:0,width:3,background:'#FF2D78',transform:'translateX(-3px)' }}/></div></div>
      <div className="toolRow" style={{ flexWrap:'wrap',marginTop:10 }}><label className="toolField">IN (s)<input aria-label="Audio trim start" type="number" min="0" max={duration} step="0.01" value={trimStart.toFixed(2)} onChange={(e)=>clampStart(Number(e.target.value))}/></label><label className="toolField">OUT (s)<input aria-label="Audio trim end" type="number" min="0" max={duration} step="0.01" value={trimEnd.toFixed(2)} onChange={(e)=>clampEnd(Number(e.target.value))}/></label><label className="toolField">OUTPUT NAME<input aria-label="Audio export name" value={exportName} onChange={(e)=>setExportName(e.target.value)}/></label></div>
      <div className="toolRow" style={{ flexWrap:'wrap' }}><label className="toolField">FADE IN {fadeIn.toFixed(2)}s<input aria-label="Audio fade in" type="range" min="0" max={maxFade} step="0.01" value={Math.min(fadeIn,maxFade)} onChange={(e)=>setFadeIn(Number(e.target.value))}/></label><label className="toolField">FADE OUT {fadeOut.toFixed(2)}s<input aria-label="Audio fade out" type="range" min="0" max={maxFade} step="0.01" value={Math.min(fadeOut,maxFade)} onChange={(e)=>setFadeOut(Number(e.target.value))}/></label></div>
      <div className="toolHint">Selection: {selection.toFixed(2)}s · source {duration.toFixed(2)}s. WAV export preserves channels and applies the selected fades.</div>
      <div className="toolRow" style={{ marginTop:10 }}>{!isPlaying?<button className="wbtn" onClick={playTrimmed}><Icon name="play" size={12}/> PLAY SELECTION</button>:<button className="wbtn ghost" onClick={stopPlayback}><Icon name="stop" size={12}/> STOP</button>}<button className="wbtn" onClick={exportTrimmedWav}>EXPORT WAV</button></div></>}
  </div></ToolShell>;
}
