import { useEffect, useRef, useState } from 'react';
import type { PointerEvent as RPointerEvent } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
// eslint-disable-next-line import/no-unresolved
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { PDFDocument } from 'pdf-lib';
import ToolShell from './ToolShell';
import Icon from '../../../design-system/icons/Icon';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

type Point = [number, number];
type Tool = 'arrow' | 'rect' | 'ellipse' | 'pen' | 'text';
type Annotation =
  | { id: string; kind: 'arrow'; x1: number; y1: number; x2: number; y2: number; color: string; width: number }
  | { id: string; kind: 'rect'; x: number; y: number; w: number; h: number; color: string; width: number }
  | { id: string; kind: 'ellipse'; x: number; y: number; w: number; h: number; color: string; width: number }
  | { id: string; kind: 'pen'; points: Point[]; color: string; width: number }
  | { id: string; kind: 'text'; x: number; y: number; text: string; color: string; size: number };
type AnnDoc = Record<number, Annotation[]>;
type PdfPrefs = { version: 2; fileName: string; color: string; strokeWidth: number; annotations: AnnDoc };
const KEY = 'xfactor-studio-pdfmarkup2-';

function drawAnnotation(ctx: CanvasRenderingContext2D, a: Annotation): void {
  switch (a.kind) {
    case 'arrow': {
      ctx.strokeStyle = a.color; ctx.lineWidth = a.width; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(a.x1, a.y1); ctx.lineTo(a.x2, a.y2); ctx.stroke();
      const angle = Math.atan2(a.y2 - a.y1, a.x2 - a.x1), headLen = 12, spread = (25 * Math.PI) / 180;
      ctx.beginPath(); ctx.moveTo(a.x2, a.y2); ctx.lineTo(a.x2 - headLen * Math.cos(angle - spread), a.y2 - headLen * Math.sin(angle - spread)); ctx.moveTo(a.x2, a.y2); ctx.lineTo(a.x2 - headLen * Math.cos(angle + spread), a.y2 - headLen * Math.sin(angle + spread)); ctx.stroke(); break;
    }
    case 'rect': { const x = a.w < 0 ? a.x + a.w : a.x, y = a.h < 0 ? a.y + a.h : a.y; ctx.strokeStyle = a.color; ctx.lineWidth = a.width; ctx.strokeRect(x, y, Math.abs(a.w), Math.abs(a.h)); break; }
    case 'ellipse': ctx.strokeStyle = a.color; ctx.lineWidth = a.width; ctx.beginPath(); ctx.ellipse(a.x + a.w / 2, a.y + a.h / 2, Math.abs(a.w / 2), Math.abs(a.h / 2), 0, 0, Math.PI * 2); ctx.stroke(); break;
    case 'pen': if (a.points.length) { ctx.strokeStyle = a.color; ctx.lineWidth = a.width; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath(); ctx.moveTo(a.points[0][0], a.points[0][1]); for (let i = 1; i < a.points.length; i++) ctx.lineTo(a.points[i][0], a.points[i][1]); ctx.stroke(); } break;
    case 'text': ctx.font = `${a.size}px 'Share Tech Mono', monospace`; ctx.fillStyle = a.color; ctx.fillText(a.text, a.x, a.y); break;
  }
}
function download(blob: Blob, name: string) { const url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 4000); }
function loadPrefs(boardId: string): PdfPrefs {
  const fallback: PdfPrefs = { version: 2, fileName: '', color: '#00fff2', strokeWidth: 3, annotations: {} };
  try { const raw = localStorage.getItem(KEY + boardId); if (raw) { const p = JSON.parse(raw) as Partial<PdfPrefs>; return { ...fallback, ...p, version: 2, annotations: p.annotations ?? {} }; } } catch {}
  return fallback;
}

export default function PdfMarkup({ boardId, onExit }: { boardId: string; onExit: () => void }) {
  const initial = useRef(loadPrefs(boardId)).current;
  const [fileName, setFileName] = useState(initial.fileName || null);
  const [pageImages, setPageImages] = useState<HTMLCanvasElement[]>([]);
  const [pageIdx, setPageIdx] = useState(0);
  const [annByPage, setAnnByPage] = useState<AnnDoc>(initial.annotations);
  const [history, setHistory] = useState<AnnDoc[]>([]);
  const [future, setFuture] = useState<AnnDoc[]>([]);
  const [draft, setDraft] = useState<Annotation | null>(null);
  const [tool, setTool] = useState<Tool>('arrow');
  const [color, setColor] = useState(initial.color);
  const [strokeWidth, setStrokeWidth] = useState(initial.strokeWidth);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const idCounter = useRef(0);

  useEffect(() => { try { localStorage.setItem(KEY + boardId, JSON.stringify({ version: 2, fileName: fileName ?? '', color, strokeWidth, annotations: annByPage })); } catch {} }, [boardId, fileName, color, strokeWidth, annByPage]);
  function genId() { idCounter.current += 1; return `ann-${Date.now()}-${idCounter.current}`; }
  function commit(next: AnnDoc) { setHistory((h) => [...h.slice(-39), annByPage]); setFuture([]); setAnnByPage(next); }
  function commitPage(next: Annotation[] | ((prev: Annotation[]) => Annotation[])) { const current = annByPage[pageIdx] ?? []; const page = typeof next === 'function' ? next(current) : next; commit({ ...annByPage, [pageIdx]: page }); }
  function undo() { setHistory((h) => { if (!h.length) return h; const prev = h[h.length - 1]; setFuture((f) => [annByPage, ...f]); setAnnByPage(prev); return h.slice(0, -1); }); }
  function redo() { setFuture((f) => { if (!f.length) return f; const next = f[0]; setHistory((h) => [...h, annByPage]); setAnnByPage(next); return f.slice(1); }); }

  async function onFile(file: File | null) {
    if (!file) return; setError(null); setLoading(true);
    try {
      const doc = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise, pages: HTMLCanvasElement[] = [];
      for (let i = 1; i <= doc.numPages; i++) { const page = await doc.getPage(i), viewport = page.getViewport({ scale: 1.6 }), cv = document.createElement('canvas'); cv.width = viewport.width; cv.height = viewport.height; const ctx = cv.getContext('2d')!; await page.render({ canvasContext: ctx, viewport, canvas: cv }).promise; pages.push(cv); }
      setPageImages(pages); setPageIdx(0); setFileName(file.name); setHistory([]); setFuture([]);
    } catch (err) { console.error('PdfMarkup: failed to load PDF', err); setError("Couldn't read that file as a PDF — try a different file."); }
    finally { setLoading(false); }
  }

  const annotations = annByPage[pageIdx] ?? [];
  useEffect(() => { const canvas = canvasRef.current, base = pageImages[pageIdx]; if (!canvas || !base) return; canvas.width = base.width; canvas.height = base.height; const ctx = canvas.getContext('2d'); if (!ctx) return; ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.drawImage(base, 0, 0); for (const a of draft ? [...annotations, draft] : annotations) drawAnnotation(ctx, a); }, [pageImages, pageIdx, annotations, draft]);
  function toCanvasCoords(e: RPointerEvent<HTMLCanvasElement>): Point { const canvas = canvasRef.current; if (!canvas) return [0, 0]; const rect = canvas.getBoundingClientRect(); return [(e.clientX - rect.left) * canvas.width / (rect.width || 1), (e.clientY - rect.top) * canvas.height / (rect.height || 1)]; }

  function handlePointerDown(e: RPointerEvent<HTMLCanvasElement>) {
    if (!pageImages[pageIdx]) return; const [x, y] = toCanvasCoords(e);
    if (tool === 'text') { const text = window.prompt('Annotation text:'); if (text?.trim()) commitPage((prev) => [...prev, { id: genId(), kind: 'text', x, y, text: text.trim(), color, size: 12 + strokeWidth * 2 }]); return; }
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch {}
    if (tool === 'arrow') setDraft({ id: genId(), kind: 'arrow', x1: x, y1: y, x2: x, y2: y, color, width: strokeWidth });
    else if (tool === 'rect') setDraft({ id: genId(), kind: 'rect', x, y, w: 0, h: 0, color, width: strokeWidth });
    else if (tool === 'ellipse') setDraft({ id: genId(), kind: 'ellipse', x, y, w: 0, h: 0, color, width: strokeWidth });
    else if (tool === 'pen') setDraft({ id: genId(), kind: 'pen', points: [[x, y]], color, width: strokeWidth });
  }
  function handlePointerMove(e: RPointerEvent<HTMLCanvasElement>) { if (!draft) return; const [x, y] = toCanvasCoords(e); setDraft((prev) => { if (!prev) return prev; if (prev.kind === 'arrow') return { ...prev, x2: x, y2: y }; if (prev.kind === 'rect' || prev.kind === 'ellipse') return { ...prev, w: x - prev.x, h: y - prev.y }; if (prev.kind === 'pen') return { ...prev, points: [...prev.points, [x, y] as Point] }; return prev; }); }
  function handlePointerUp(e: RPointerEvent<HTMLCanvasElement>) { if (draft) { commitPage((prev) => [...prev, draft]); setDraft(null); } try { e.currentTarget.releasePointerCapture(e.pointerId); } catch {} }

  function exportSidecar() { download(new Blob([JSON.stringify({ version: 2, fileName, color, strokeWidth, annotations: annByPage }, null, 2)], { type: 'application/json' }), `${(fileName || 'pdf').replace(/\.pdf$/i, '')}-annotations.json`); }
  async function importSidecar(file: File) { try { const p = JSON.parse(await file.text()) as PdfPrefs; if (p.version !== 2 || !p.annotations || typeof p.annotations !== 'object') throw new Error(); commit(p.annotations); if (typeof p.color === 'string') setColor(p.color); if (typeof p.strokeWidth === 'number') setStrokeWidth(p.strokeWidth); } catch { setError('That annotation sidecar is not valid xFactor.OS PDF markup JSON.'); } }

  async function exportPdf() {
    if (!pageImages.length) return; setExporting(true);
    try {
      const out = await PDFDocument.create();
      for (let i = 0; i < pageImages.length; i++) { const base = pageImages[i], merged = document.createElement('canvas'); merged.width = base.width; merged.height = base.height; const ctx = merged.getContext('2d')!; ctx.drawImage(base, 0, 0); for (const a of annByPage[i] ?? []) drawAnnotation(ctx, a); const bytes = await fetch(merged.toDataURL('image/png')).then((r) => r.arrayBuffer()), img = await out.embedPng(bytes), page = out.addPage([img.width, img.height]); page.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height }); }
      download(new Blob([await out.save() as BlobPart], { type: 'application/pdf' }), `${(fileName || 'annotated').replace(/\.pdf$/i, '')}-marked-up.pdf`);
    } catch (err) { console.error('PdfMarkup: export failed', err); setError("Couldn't export the annotated PDF."); }
    finally { setExporting(false); }
  }

  return <ToolShell title="PDF MARKUP / ANNOTATOR 2.0" onExit={onExit} actions={<><button className="wbtn ghost" onClick={exportSidecar}>ANNOTATIONS JSON</button><button className="wbtn" onClick={exportPdf} disabled={exporting || !pageImages.length}>{exporting ? 'EXPORTING…' : 'EXPORT PDF'}</button></>}>
    <div className="toolCol" data-testid="pdf-markup-2-root">
      <div className="toolRow"><label className="toolDrop"><input aria-label="PDF file" type="file" accept="application/pdf" onChange={(e) => onFile(e.target.files?.[0] ?? null)} hidden/>{fileName ? `LOADED: ${fileName} (click to replace)` : 'UPLOAD A PDF'}</label><label className="toolBtn">IMPORT ANNOTATIONS<input aria-label="PDF annotation JSON" type="file" accept="application/json" hidden onChange={(e) => e.target.files?.[0] && void importSidecar(e.target.files[0])}/></label>{loading && <span className="toolHint">Rendering pages…</span>}</div>
      {error && <div className="toolHint" style={{ color:'var(--magenta)' }}>{error}</div>}
      {pageImages.length > 0 && <><div className="toolRow" style={{ flexWrap:'wrap' }}>{(['arrow','rect','ellipse','pen','text'] as Tool[]).map((t)=><button key={t} className={tool===t?'chip on':'chip'} onClick={()=>setTool(t)}>{t.toUpperCase()}</button>)}<label className="toolField">COLOR<input aria-label="PDF annotation color" type="color" value={color} onChange={(e)=>setColor(e.target.value)}/></label><label className="toolField">WIDTH {strokeWidth}<input aria-label="PDF annotation width" type="range" min="1" max="12" value={strokeWidth} onChange={(e)=>setStrokeWidth(+e.target.value)}/></label></div>
        <div className="toolRow" style={{ alignItems:'center' }}><button className="chip small" aria-label="Previous PDF page" onClick={()=>setPageIdx((i)=>Math.max(0,i-1))}><Icon name="chevronLeft" size={11}/></button><span className="toolHint">PAGE {pageIdx+1} / {pageImages.length} · {annotations.length} annotations</span><button className="chip small" aria-label="Next PDF page" onClick={()=>setPageIdx((i)=>Math.min(pageImages.length-1,i+1))}><Icon name="chevronRight" size={11}/></button><button className="wbtn ghost" onClick={undo} disabled={!history.length}>UNDO</button><button className="wbtn ghost" onClick={redo} disabled={!future.length}>REDO</button><button className="wbtn ghost" onClick={()=>commitPage([])} disabled={!annotations.length}>CLEAR PAGE</button></div>
        <div className="toolCanvasWrap" style={{ maxWidth:700 }}><canvas ref={canvasRef} style={{ width:'100%',height:'auto',touchAction:'none',cursor:'crosshair' }} onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} onPointerLeave={handlePointerUp}/></div><div className="toolHint">Annotations auto-save per board. Export/import the JSON sidecar to keep them editable independently of the flattened PDF export.</div></>}
    </div>
  </ToolShell>;
}
