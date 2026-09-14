import React, { useEffect, useRef, useState } from 'react';
import ToolShell from './ToolShell';

type Point = [number, number];
type Tool = 'arrow' | 'rect' | 'ellipse' | 'pen' | 'text';
type Annotation =
  | { id: string; kind: 'arrow'; x1: number; y1: number; x2: number; y2: number; color: string; width: number }
  | { id: string; kind: 'rect'; x: number; y: number; w: number; h: number; color: string; width: number }
  | { id: string; kind: 'ellipse'; x: number; y: number; w: number; h: number; color: string; width: number }
  | { id: string; kind: 'pen'; points: Point[]; color: string; width: number }
  | { id: string; kind: 'text'; x: number; y: number; text: string; color: string; size: number };
type Prefs = { version: 2; tool: Tool; color: string; width: number; outputName: string };
type Sidecar = { version: 2; sourceWidth: number; sourceHeight: number; annotations: Annotation[] };

const tools: Tool[] = ['arrow', 'rect', 'ellipse', 'pen', 'text'];
const isTool = (v: unknown): v is Tool => typeof v === 'string' && tools.includes(v as Tool);
const safeName = (v: string) => (v.trim() || 'annotated').replace(/[^a-z0-9._-]+/gi, '-');

function drawAnnotation(ctx: CanvasRenderingContext2D, a: Annotation): void {
  ctx.save();
  if (a.kind === 'arrow') {
    ctx.strokeStyle = a.color; ctx.lineWidth = a.width; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(a.x1, a.y1); ctx.lineTo(a.x2, a.y2); ctx.stroke();
    const angle = Math.atan2(a.y2 - a.y1, a.x2 - a.x1), head = 12, spread = (25 * Math.PI) / 180;
    ctx.beginPath(); ctx.moveTo(a.x2, a.y2);
    ctx.lineTo(a.x2 - head * Math.cos(angle - spread), a.y2 - head * Math.sin(angle - spread));
    ctx.moveTo(a.x2, a.y2);
    ctx.lineTo(a.x2 - head * Math.cos(angle + spread), a.y2 - head * Math.sin(angle + spread));
    ctx.stroke();
  } else if (a.kind === 'rect') {
    ctx.strokeStyle = a.color; ctx.lineWidth = a.width;
    ctx.strokeRect(a.w < 0 ? a.x + a.w : a.x, a.h < 0 ? a.y + a.h : a.y, Math.abs(a.w), Math.abs(a.h));
  } else if (a.kind === 'ellipse') {
    ctx.strokeStyle = a.color; ctx.lineWidth = a.width; ctx.beginPath();
    ctx.ellipse(a.x + a.w / 2, a.y + a.h / 2, Math.abs(a.w / 2), Math.abs(a.h / 2), 0, 0, Math.PI * 2); ctx.stroke();
  } else if (a.kind === 'pen') {
    if (!a.points.length) { ctx.restore(); return; }
    ctx.strokeStyle = a.color; ctx.lineWidth = a.width; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath();
    ctx.moveTo(a.points[0][0], a.points[0][1]); for (let i = 1; i < a.points.length; i++) ctx.lineTo(a.points[i][0], a.points[i][1]); ctx.stroke();
  } else {
    ctx.font = `${a.size}px 'Share Tech Mono', monospace`; ctx.fillStyle = a.color; ctx.fillText(a.text, a.x, a.y);
  }
  ctx.restore();
}

export default function ScreenshotAnnotator({ boardId, onExit }: { boardId: string; onExit: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const urlRef = useRef<string | null>(null);
  const idRef = useRef(0);
  const key = `xfactor-studio-annotate2-${boardId}`;
  const legacyKey = `xos-studio-annotate-${boardId}`;

  const [dims, setDims] = useState<{ width: number; height: number } | null>(null);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [draft, setDraft] = useState<Annotation | null>(null);
  const [past, setPast] = useState<Annotation[][]>([]);
  const [future, setFuture] = useState<Annotation[][]>([]);
  const [tool, setTool] = useState<Tool>('arrow');
  const [color, setColor] = useState('#00fff2');
  const [strokeWidth, setStrokeWidth] = useState(3);
  const [outputName, setOutputName] = useState('annotated');
  const [status, setStatus] = useState('UPLOAD AN IMAGE TO BEGIN');

  useEffect(() => {
    try {
      const raw = localStorage.getItem(key) ?? localStorage.getItem(legacyKey);
      if (!raw) return;
      const p = JSON.parse(raw) as Partial<Prefs>;
      if (isTool(p.tool)) setTool(p.tool);
      if (typeof p.color === 'string') setColor(p.color);
      if (typeof p.width === 'number') setStrokeWidth(Math.max(1, Math.min(12, p.width)));
      if (typeof p.outputName === 'string') setOutputName(p.outputName);
    } catch { /* use defaults */ }
  }, [key, legacyKey]);

  useEffect(() => {
    try { localStorage.setItem(key, JSON.stringify({ version: 2, tool, color, width: strokeWidth, outputName } satisfies Prefs)); } catch { /* preferences are non-critical */ }
  }, [key, tool, color, strokeWidth, outputName]);

  useEffect(() => () => { if (urlRef.current) URL.revokeObjectURL(urlRef.current); }, []);
  useEffect(() => {
    const canvas = canvasRef.current, img = imageRef.current;
    if (!canvas || !img || !dims) return;
    canvas.width = dims.width; canvas.height = dims.height;
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.drawImage(img, 0, 0, dims.width, dims.height);
    for (const a of draft ? [...annotations, draft] : annotations) drawAnnotation(ctx, a);
  }, [annotations, draft, dims]);

  const id = () => typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `ann-${++idRef.current}`;
  const checkpoint = () => { setPast(p => [...p.slice(-39), annotations]); setFuture([]); };
  const commit = (next: Annotation[]) => { checkpoint(); setAnnotations(next); };

  function loadImage(file: File) {
    const url = URL.createObjectURL(file), img = new Image();
    img.onload = () => {
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
      urlRef.current = url; imageRef.current = img; setDims({ width: img.naturalWidth, height: img.naturalHeight });
      setAnnotations([]); setPast([]); setFuture([]); setDraft(null); setStatus(`LOADED ${file.name} — ${img.naturalWidth}×${img.naturalHeight}`);
    };
    img.onerror = () => { URL.revokeObjectURL(url); setStatus('IMAGE COULD NOT BE LOADED'); };
    img.src = url;
  }

  function coords(e: React.PointerEvent<HTMLCanvasElement>): Point {
    const c = canvasRef.current!; const r = c.getBoundingClientRect();
    return [(e.clientX - r.left) * c.width / (r.width || 1), (e.clientY - r.top) * c.height / (r.height || 1)];
  }
  function pointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!imageRef.current) return; const [x, y] = coords(e);
    if (tool === 'text') {
      const text = window.prompt('Annotation text:'); if (text?.trim()) commit([...annotations, { id: id(), kind: 'text', x, y, text: text.trim(), color, size: 12 + strokeWidth * 2 }]); return;
    }
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* optional */ }
    if (tool === 'arrow') setDraft({ id: id(), kind: 'arrow', x1: x, y1: y, x2: x, y2: y, color, width: strokeWidth });
    if (tool === 'rect') setDraft({ id: id(), kind: 'rect', x, y, w: 0, h: 0, color, width: strokeWidth });
    if (tool === 'ellipse') setDraft({ id: id(), kind: 'ellipse', x, y, w: 0, h: 0, color, width: strokeWidth });
    if (tool === 'pen') setDraft({ id: id(), kind: 'pen', points: [[x, y]], color, width: strokeWidth });
  }
  function pointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!draft) return; const [x, y] = coords(e);
    setDraft(a => !a ? null : a.kind === 'arrow' ? { ...a, x2: x, y2: y } : a.kind === 'rect' || a.kind === 'ellipse' ? { ...a, w: x - a.x, h: y - a.y } : a.kind === 'pen' ? { ...a, points: [...a.points, [x, y]] } : a);
  }
  function pointerUp(e: React.PointerEvent<HTMLCanvasElement>) {
    if (draft) { commit([...annotations, draft]); setDraft(null); }
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* optional */ }
  }
  function undo() { if (!past.length) return; const prev = past[past.length - 1]; setFuture(f => [annotations, ...f].slice(0, 40)); setPast(p => p.slice(0, -1)); setAnnotations(prev); }
  function redo() { if (!future.length) return; const next = future[0]; setPast(p => [...p.slice(-39), annotations]); setFuture(f => f.slice(1)); setAnnotations(next); }
  function download(blob: Blob, name: string) { const u = URL.createObjectURL(blob), a = document.createElement('a'); a.href = u; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(u), 1500); }
  function exportPng() { canvasRef.current?.toBlob(b => b && download(b, `${safeName(outputName)}.png`), 'image/png'); }
  function exportJson() {
    if (!dims) return; const sidecar: Sidecar = { version: 2, sourceWidth: dims.width, sourceHeight: dims.height, annotations };
    download(new Blob([JSON.stringify(sidecar, null, 2)], { type: 'application/json' }), `${safeName(outputName)}.annotations.json`);
  }
  async function importJson(file: File) {
    try {
      const p = JSON.parse(await file.text()) as Partial<Sidecar>;
      if (p.version !== 2 || !Array.isArray(p.annotations) || typeof p.sourceWidth !== 'number' || typeof p.sourceHeight !== 'number') throw new Error();
      if (dims && (dims.width !== p.sourceWidth || dims.height !== p.sourceHeight)) { setStatus(`PROJECT IS ${p.sourceWidth}×${p.sourceHeight}; CURRENT IMAGE IS ${dims.width}×${dims.height}`); return; }
      checkpoint(); setAnnotations(p.annotations as Annotation[]); setFuture([]); setStatus(`IMPORTED ${p.annotations.length} ANNOTATIONS`);
    } catch { setStatus('INVALID ANNOTATION PROJECT'); }
  }

  return <ToolShell title="SCREENSHOT ANNOTATOR 2.0" onExit={onExit}>
    <div data-testid="screenshot-annotator-2-root" className="toolCol">
      <div className="toolRow">
        <label className="toolDrop"><input type="file" accept="image/*" hidden onChange={e => { const f=e.target.files?.[0]; if(f) loadImage(f); e.target.value=''; }} />UPLOAD / REPLACE IMAGE</label>
        <label className="toolDrop"><input type="file" accept="application/json" hidden onChange={e => { const f=e.target.files?.[0]; if(f) void importJson(f); e.target.value=''; }} />IMPORT PROJECT</label>
        <span className="toolHint">{status}</span>
      </div>
      <div className="toolRow">{tools.map(t => <button key={t} className={tool===t?'chip on':'chip'} onClick={() => setTool(t)}>{t.toUpperCase()}</button>)}</div>
      <div className="toolRow">
        <label className="toolField">COLOR<input type="color" value={color} onChange={e=>setColor(e.target.value)} /></label>
        <label className="toolField">WIDTH: {strokeWidth}<input type="range" min={1} max={12} value={strokeWidth} onChange={e=>setStrokeWidth(+e.target.value)} /></label>
        <label className="toolField">OUTPUT<input value={outputName} onChange={e=>setOutputName(e.target.value)} /></label>
      </div>
      <div className="toolCanvasWrap" style={{maxWidth:700}}>{dims ? <canvas ref={canvasRef} style={{width:'100%',height:'auto',touchAction:'none',cursor:'crosshair'}} onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerLeave={pointerUp}/> : <span className="toolHint">No image loaded.</span>}</div>
      <div className="toolRow">
        <button className="wbtn ghost" onClick={undo} disabled={!past.length}>UNDO</button><button className="wbtn ghost" onClick={redo} disabled={!future.length}>REDO</button>
        <button className="wbtn ghost" onClick={()=>annotations.length && commit([])} disabled={!annotations.length}>CLEAR</button>
        <button className="wbtn ghost" onClick={exportJson} disabled={!dims}>EXPORT PROJECT</button><button className="wbtn" onClick={exportPng} disabled={!dims}>EXPORT PNG</button>
      </div>
    </div>
  </ToolShell>;
}
