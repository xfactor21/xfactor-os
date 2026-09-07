import { useEffect, useMemo, useRef, useState } from 'react';
import type { PointerEvent as RPointerEvent } from 'react';
import PolyBool from 'polybooljs';

type Tool = 'select' | 'direct' | 'pen' | 'rect' | 'ellipse';
type FillMode = 'solid' | 'linear' | 'radial' | 'none';
type AlignMode = 'left' | 'hcenter' | 'right' | 'top' | 'vcenter' | 'bottom';
type BoolMode = 'union' | 'subtract' | 'intersect' | 'exclude';

type Point = { x: number; y: number };

type VectorItem = {
  id: string;
  name: string;
  kind: 'path' | 'rect' | 'ellipse';
  points: Point[];
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  opacity: number;
  fillMode: FillMode;
  fillA: string;
  fillB: string;
  gradientAngle: number;
  stroke: string;
  strokeWidth: number;
  visible: boolean;
  locked: boolean;
  groupId?: string;
};

type VectorDoc = {
  version: 2;
  items: VectorItem[];
  grid: number;
  snap: boolean;
};

const W = 1200;
const H = 780;
const HISTORY_LIMIT = 60;
const keyFor = (boardId: string) => `xos-studio-vector2-${boardId}`;
const uid = () => `vx-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

function clamp(n: number, min: number, max: number) { return Math.max(min, Math.min(max, n)); }
function snapValue(n: number, grid: number, enabled: boolean) { return enabled ? Math.round(n / grid) * grid : n; }
function loadDoc(boardId: string): VectorDoc {
  try {
    const raw = localStorage.getItem(keyFor(boardId));
    if (raw) {
      const parsed = JSON.parse(raw) as VectorDoc;
      if (parsed?.version === 2 && Array.isArray(parsed.items)) return parsed;
    }
  } catch { /* ignore corrupt local document */ }
  return { version: 2, items: [], grid: 8, snap: true };
}

function itemBounds(item: VectorItem) {
  return { left: item.x, top: item.y, right: item.x + item.width, bottom: item.y + item.height, cx: item.x + item.width / 2, cy: item.y + item.height / 2 };
}

function pointsForItem(item: VectorItem): Point[] {
  if (item.kind === 'path') return item.points.map((p) => ({ x: item.x + p.x, y: item.y + p.y }));
  if (item.kind === 'rect') return [
    { x: item.x, y: item.y }, { x: item.x + item.width, y: item.y },
    { x: item.x + item.width, y: item.y + item.height }, { x: item.x, y: item.y + item.height },
  ];
  const pts: Point[] = [];
  for (let i = 0; i < 32; i++) {
    const a = (Math.PI * 2 * i) / 32;
    pts.push({ x: item.x + item.width / 2 + Math.cos(a) * item.width / 2, y: item.y + item.height / 2 + Math.sin(a) * item.height / 2 });
  }
  return pts;
}

function pathD(item: VectorItem) {
  if (item.kind !== 'path' || item.points.length < 2) return '';
  return item.points.map((p, i) => `${i ? 'L' : 'M'} ${p.x} ${p.y}`).join(' ') + ' Z';
}

function normalizePath(points: Point[]): Pick<VectorItem, 'points' | 'x' | 'y' | 'width' | 'height'> {
  const minX = Math.min(...points.map((p) => p.x));
  const minY = Math.min(...points.map((p) => p.y));
  const maxX = Math.max(...points.map((p) => p.x));
  const maxY = Math.max(...points.map((p) => p.y));
  return { points: points.map((p) => ({ x: p.x - minX, y: p.y - minY })), x: minX, y: minY, width: Math.max(1, maxX - minX), height: Math.max(1, maxY - minY) };
}

function makeItem(kind: VectorItem['kind'], x: number, y: number, width: number, height: number, points: Point[] = []): VectorItem {
  return {
    id: uid(), name: kind === 'path' ? 'Path' : kind === 'rect' ? 'Rectangle' : 'Ellipse', kind, points,
    x, y, width, height, rotation: 0, opacity: 1, fillMode: 'solid', fillA: '#ff2d95', fillB: '#00eaff', gradientAngle: 45,
    stroke: '#10131b', strokeWidth: 2, visible: true, locked: false,
  };
}

function fillValue(item: VectorItem) {
  if (item.fillMode === 'none') return 'none';
  if (item.fillMode === 'solid') return item.fillA;
  return `url(#fill-${item.id})`;
}

export default function VectorEditor2({ boardId, onExit }: { boardId: string; onExit: () => void }) {
  const [doc, setDoc] = useState<VectorDoc>(() => loadDoc(boardId));
  const [tool, setTool] = useState<Tool>('select');
  const [selected, setSelected] = useState<string[]>([]);
  const [directNode, setDirectNode] = useState<{ id: string; index: number } | null>(null);
  const [draft, setDraft] = useState<Point[]>([]);
  const [history, setHistory] = useState<VectorDoc[]>([]);
  const [future, setFuture] = useState<VectorDoc[]>([]);
  const [status, setStatus] = useState('VECTOR 2.0 READY');
  const svgRef = useRef<SVGSVGElement>(null);
  const dragRef = useRef<{ type: 'move' | 'draw' | 'node'; start: Point; before: VectorDoc; id?: string; node?: number; kind?: 'rect' | 'ellipse' } | null>(null);

  useEffect(() => {
    const t = window.setTimeout(() => localStorage.setItem(keyFor(boardId), JSON.stringify(doc)), 180);
    return () => window.clearTimeout(t);
  }, [boardId, doc]);

  const selectedItems = useMemo(() => doc.items.filter((i) => selected.includes(i.id)), [doc.items, selected]);
  const primary = selectedItems[selectedItems.length - 1] || null;

  function commit(next: VectorDoc, before = doc) {
    setHistory((h) => [...h.slice(-(HISTORY_LIMIT - 1)), before]);
    setFuture([]);
    setDoc(next);
  }
  function patchItems(mutator: (items: VectorItem[]) => VectorItem[]) { commit({ ...doc, items: mutator(doc.items) }); }
  function undo() {
    const previous = history[history.length - 1]; if (!previous) return;
    setFuture((f) => [doc, ...f].slice(0, HISTORY_LIMIT)); setHistory((h) => h.slice(0, -1)); setDoc(previous); setStatus('UNDO');
  }
  function redo() {
    const next = future[0]; if (!next) return;
    setHistory((h) => [...h, doc].slice(-HISTORY_LIMIT)); setFuture((f) => f.slice(1)); setDoc(next); setStatus('REDO');
  }

  function pointFromEvent(e: RPointerEvent<SVGSVGElement | SVGElement>): Point {
    const svg = svgRef.current; if (!svg) return { x: 0, y: 0 };
    const r = svg.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H };
  }

  function selectItem(e: RPointerEvent<SVGElement>, item: VectorItem) {
    if (tool === 'direct' && item.kind === 'path') { e.stopPropagation(); setSelected([item.id]); return; }
    if (tool !== 'select' || item.locked) return;
    e.stopPropagation();
    setSelected((s) => e.shiftKey ? (s.includes(item.id) ? s.filter((id) => id !== item.id) : [...s, item.id]) : [item.id]);
    dragRef.current = { type: 'move', start: pointFromEvent(e), before: doc, id: item.id };
  }

  function stageDown(e: RPointerEvent<SVGSVGElement>) {
    const p = pointFromEvent(e);
    if (tool === 'pen') {
      const q = { x: snapValue(p.x, doc.grid, doc.snap), y: snapValue(p.y, doc.grid, doc.snap) };
      if (draft.length >= 3 && Math.hypot(q.x - draft[0].x, q.y - draft[0].y) < 14) finishPath();
      else setDraft((d) => [...d, q]);
      return;
    }
    if (tool === 'rect' || tool === 'ellipse') {
      dragRef.current = { type: 'draw', start: p, before: doc, kind: tool };
      return;
    }
    if (tool === 'select') setSelected([]);
  }

  function stageMove(e: RPointerEvent<SVGSVGElement>) {
    const d = dragRef.current; if (!d) return;
    const p = pointFromEvent(e);
    if (d.type === 'move') {
      const dx = snapValue(p.x - d.start.x, doc.grid, doc.snap);
      const dy = snapValue(p.y - d.start.y, doc.grid, doc.snap);
      const ids = selected.includes(d.id || '') ? selected : d.id ? [d.id] : selected;
      setDoc({ ...d.before, items: d.before.items.map((item) => ids.includes(item.id) && !item.locked ? { ...item, x: clamp(item.x + dx, -W, W * 2), y: clamp(item.y + dy, -H, H * 2) } : item) });
    }
    if (d.type === 'node' && d.id != null && d.node != null) {
      const item = d.before.items.find((i) => i.id === d.id); if (!item) return;
      const local = { x: snapValue(p.x - item.x, doc.grid, doc.snap), y: snapValue(p.y - item.y, doc.grid, doc.snap) };
      setDoc({ ...d.before, items: d.before.items.map((i) => i.id === d.id ? { ...i, points: i.points.map((pt, idx) => idx === d.node ? local : pt) } : i) });
    }
  }

  function stageUp(e: RPointerEvent<SVGSVGElement>) {
    const d = dragRef.current; if (!d) return;
    if (d.type === 'draw' && d.kind) {
      const p = pointFromEvent(e);
      const x = snapValue(Math.min(d.start.x, p.x), doc.grid, doc.snap);
      const y = snapValue(Math.min(d.start.y, p.y), doc.grid, doc.snap);
      const width = Math.max(doc.grid, snapValue(Math.abs(p.x - d.start.x), doc.grid, doc.snap));
      const height = Math.max(doc.grid, snapValue(Math.abs(p.y - d.start.y), doc.grid, doc.snap));
      const item = makeItem(d.kind, x, y, width, height);
      commit({ ...d.before, items: [...d.before.items, item] }, d.before); setSelected([item.id]);
    } else if (JSON.stringify(d.before) !== JSON.stringify(doc)) {
      setHistory((h) => [...h.slice(-(HISTORY_LIMIT - 1)), d.before]); setFuture([]);
    }
    dragRef.current = null;
  }

  function finishPath() {
    if (draft.length < 3) { setDraft([]); return; }
    const n = normalizePath(draft);
    const item = makeItem('path', n.x, n.y, n.width, n.height, n.points);
    commit({ ...doc, items: [...doc.items, item] }); setSelected([item.id]); setDraft([]); setTool('select'); setStatus('PATH CREATED');
  }

  function nodeDown(e: RPointerEvent<SVGCircleElement>, item: VectorItem, index: number) {
    if (item.locked) return; e.stopPropagation(); setSelected([item.id]); setDirectNode({ id: item.id, index });
    dragRef.current = { type: 'node', start: pointFromEvent(e), before: doc, id: item.id, node: index };
  }

  function duplicate() {
    if (!selectedItems.length) return;
    const copies = selectedItems.map((i) => ({ ...i, id: uid(), name: `${i.name} copy`, x: i.x + 24, y: i.y + 24, groupId: undefined }));
    commit({ ...doc, items: [...doc.items, ...copies] }); setSelected(copies.map((i) => i.id)); setStatus('DUPLICATED');
  }
  function removeSelected() { if (!selected.length) return; patchItems((items) => items.filter((i) => !selected.includes(i.id))); setSelected([]); setStatus('DELETED'); }
  function groupSelected() {
    if (selected.length < 2) return; const gid = uid(); patchItems((items) => items.map((i) => selected.includes(i.id) ? { ...i, groupId: gid } : i)); setStatus('GROUPED');
  }
  function ungroupSelected() { patchItems((items) => items.map((i) => selected.includes(i.id) ? { ...i, groupId: undefined } : i)); setStatus('UNGROUPED'); }

  function align(mode: AlignMode) {
    if (selectedItems.length < 2) return;
    const bounds = selectedItems.map(itemBounds);
    const left = Math.min(...bounds.map((b) => b.left)), right = Math.max(...bounds.map((b) => b.right));
    const top = Math.min(...bounds.map((b) => b.top)), bottom = Math.max(...bounds.map((b) => b.bottom));
    patchItems((items) => items.map((i) => {
      if (!selected.includes(i.id) || i.locked) return i;
      if (mode === 'left') return { ...i, x: left };
      if (mode === 'right') return { ...i, x: right - i.width };
      if (mode === 'hcenter') return { ...i, x: (left + right - i.width) / 2 };
      if (mode === 'top') return { ...i, y: top };
      if (mode === 'bottom') return { ...i, y: bottom - i.height };
      return { ...i, y: (top + bottom - i.height) / 2 };
    }));
    setStatus(`ALIGN ${mode.toUpperCase()}`);
  }

  function distribute(axis: 'x' | 'y') {
    if (selectedItems.length < 3) return;
    const sorted = [...selectedItems].sort((a, b) => axis === 'x' ? a.x - b.x : a.y - b.y);
    const first = sorted[0], last = sorted[sorted.length - 1];
    const span = axis === 'x' ? last.x - first.x : last.y - first.y;
    const step = span / (sorted.length - 1);
    const pos = new Map(sorted.map((i, idx) => [i.id, (axis === 'x' ? first.x : first.y) + step * idx]));
    patchItems((items) => items.map((i) => pos.has(i.id) ? { ...i, [axis]: pos.get(i.id)! } : i));
    setStatus(`DISTRIBUTE ${axis.toUpperCase()}`);
  }

  function patchPrimary(patch: Partial<VectorItem>) { if (!primary) return; patchItems((items) => items.map((i) => i.id === primary.id ? { ...i, ...patch } : i)); }
  function reorder(id: string, dir: -1 | 1) {
    patchItems((items) => { const idx = items.findIndex((i) => i.id === id); const next = idx + dir; if (idx < 0 || next < 0 || next >= items.length) return items; const copy = [...items]; [copy[idx], copy[next]] = [copy[next], copy[idx]]; return copy; });
  }

  function booleanOp(mode: BoolMode) {
    if (selectedItems.length !== 2) return;
    const [a, b] = selectedItems;
    try {
      const pa = { regions: [pointsForItem(a).map((p) => [p.x, p.y])], inverted: false } as any;
      const pb = { regions: [pointsForItem(b).map((p) => [p.x, p.y])], inverted: false } as any;
      const result = mode === 'union' ? PolyBool.union(pa, pb) : mode === 'subtract' ? PolyBool.difference(pa, pb) : mode === 'intersect' ? PolyBool.intersect(pa, pb) : PolyBool.xor(pa, pb);
      const made: VectorItem[] = (result.regions || []).filter((r: number[][]) => r.length >= 3).map((r: number[][]) => {
        const n = normalizePath(r.map(([x, y]) => ({ x, y })));
        return { ...makeItem('path', n.x, n.y, n.width, n.height, n.points), fillMode: a.fillMode, fillA: a.fillA, fillB: a.fillB, stroke: a.stroke, strokeWidth: a.strokeWidth, name: `${mode} result` };
      });
      commit({ ...doc, items: [...doc.items.filter((i) => i.id !== a.id && i.id !== b.id), ...made] }); setSelected(made.map((i) => i.id)); setStatus(`BOOLEAN ${mode.toUpperCase()}`);
    } catch { setStatus('BOOLEAN OP FAILED'); }
  }

  function exportSvg() {
    const defs = doc.items.map((i) => i.fillMode === 'linear'
      ? `<linearGradient id="fill-${i.id}" gradientTransform="rotate(${i.gradientAngle} .5 .5)"><stop stop-color="${i.fillA}"/><stop offset="1" stop-color="${i.fillB}"/></linearGradient>`
      : i.fillMode === 'radial' ? `<radialGradient id="fill-${i.id}"><stop stop-color="${i.fillA}"/><stop offset="1" stop-color="${i.fillB}"/></radialGradient>` : '').join('');
    const body = doc.items.filter((i) => i.visible).map((i) => {
      const transform = `translate(${i.x} ${i.y}) rotate(${i.rotation} ${i.width / 2} ${i.height / 2})`;
      const attrs = `fill="${fillValue(i)}" stroke="${i.stroke}" stroke-width="${i.strokeWidth}" opacity="${i.opacity}"`;
      if (i.kind === 'rect') return `<rect x="0" y="0" width="${i.width}" height="${i.height}" transform="${transform}" ${attrs}/>`;
      if (i.kind === 'ellipse') return `<ellipse cx="${i.width / 2}" cy="${i.height / 2}" rx="${i.width / 2}" ry="${i.height / 2}" transform="${transform}" ${attrs}/>`;
      return `<path d="${pathD(i)}" transform="${transform}" ${attrs}/>`;
    }).join('\n');
    download(`vector-${boardId}.svg`, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}"><defs>${defs}</defs>${body}</svg>`, 'image/svg+xml'); setStatus('SVG EXPORTED');
  }
  function exportJson() { download(`vector-${boardId}.json`, JSON.stringify(doc, null, 2), 'application/json'); setStatus('DOCUMENT EXPORTED'); }
  function download(name: string, content: string, type: string) { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([content], { type })); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1200); }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null; if (target && /INPUT|TEXTAREA|SELECT/.test(target.tagName)) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') { e.preventDefault(); duplicate(); return; }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'g') { e.preventDefault(); e.shiftKey ? ungroupSelected() : groupSelected(); return; }
      if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); removeSelected(); return; }
      if (e.key === 'Escape') { setDraft([]); setSelected([]); setDirectNode(null); return; }
      if (e.key === 'Enter' && tool === 'pen') { finishPath(); return; }
      const k = e.key.toLowerCase(); if (k === 'v') setTool('select'); else if (k === 'a') setTool('direct'); else if (k === 'p') setTool('pen'); else if (k === 'r') setTool('rect'); else if (k === 'e') setTool('ellipse');
      if (selected.length && ['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)) {
        e.preventDefault(); const n = e.shiftKey ? 10 : 1; const dx = e.key === 'ArrowLeft' ? -n : e.key === 'ArrowRight' ? n : 0; const dy = e.key === 'ArrowUp' ? -n : e.key === 'ArrowDown' ? n : 0;
        patchItems((items) => items.map((i) => selected.includes(i.id) && !i.locked ? { ...i, x: i.x + dx, y: i.y + dy } : i));
      }
    };
    window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey);
  });

  return <div className="toolShell vector2" style={{ minHeight: 760 }}>
    <div className="toolShellBar" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
      <button className="chip" onClick={onExit}>‹ ALL BOARDS</button>
      <strong style={{ marginRight: 8 }}>VECTOR / ILLUSTRATION 2.0</strong>
      {(['select','direct','pen','rect','ellipse'] as Tool[]).map((t) => <button key={t} className={`chip small ${tool === t ? 'on' : ''}`} onClick={() => setTool(t)}>{t.toUpperCase()}</button>)}
      <span style={{ width: 1, height: 20, background: 'var(--edge)' }} />
      <button className="wbtn ghost" onClick={undo} disabled={!history.length}>UNDO</button><button className="wbtn ghost" onClick={redo} disabled={!future.length}>REDO</button>
      <button className="wbtn ghost" onClick={duplicate} disabled={!selected.length}>DUPLICATE</button>
      <button className="wbtn ghost" onClick={groupSelected} disabled={selected.length < 2}>GROUP</button>
      <button className="wbtn ghost" onClick={ungroupSelected} disabled={!selectedItems.some((i) => i.groupId)}>UNGROUP</button>
      <button className="wbtn" onClick={exportSvg}>EXPORT SVG</button><button className="wbtn ghost" onClick={exportJson}>EXPORT DOC</button>
    </div>

    <div style={{ display: 'grid', gridTemplateColumns: '220px minmax(0,1fr) 260px', gap: 10, marginTop: 10 }}>
      <aside className="gpanel" style={{ padding: 10, minHeight: 650 }}>
        <div className="rsub">LAYERS</div>
        {[...doc.items].reverse().map((item) => <div key={item.id} style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto', gap: 4, alignItems: 'center', padding: '5px 0', opacity: item.visible ? 1 : .45 }}>
          <button className={`chip small ${selected.includes(item.id) ? 'on' : ''}`} onClick={() => setSelected([item.id])} style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.groupId ? '◇ ' : ''}{item.name}</button>
          <button className="chip small" title="visibility" onClick={() => patchItems((items) => items.map((i) => i.id === item.id ? { ...i, visible: !i.visible } : i))}>{item.visible ? '●' : '○'}</button>
          <button className="chip small" title="lock" onClick={() => patchItems((items) => items.map((i) => i.id === item.id ? { ...i, locked: !i.locked } : i))}>{item.locked ? '🔒' : '·'}</button>
          <span style={{ display: 'flex' }}><button className="chip small" onClick={() => reorder(item.id, 1)}>↑</button><button className="chip small" onClick={() => reorder(item.id, -1)}>↓</button></span>
        </div>)}
        {!doc.items.length && <div className="toolHint">Draw a rectangle, ellipse, or polygon path to begin.</div>}
      </aside>

      <main className="gpanel" style={{ padding: 8, overflow: 'auto' }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
          <label className="toolHint">GRID <input type="number" min={2} max={64} value={doc.grid} onChange={(e) => setDoc({ ...doc, grid: clamp(+e.target.value || 8, 2, 64) })} style={{ width: 50 }} /></label>
          <label className="toolHint"><input type="checkbox" checked={doc.snap} onChange={(e) => setDoc({ ...doc, snap: e.target.checked })} /> SNAP</label>
          <span className="toolHint">{status}</span>
        </div>
        <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', minWidth: 760, backgroundColor: '#f7f8fb', backgroundImage: `linear-gradient(#d8dbe3 1px, transparent 1px),linear-gradient(90deg,#d8dbe3 1px,transparent 1px)`, backgroundSize: `${doc.grid}px ${doc.grid}px`, touchAction: 'none' }} onPointerDown={stageDown} onPointerMove={stageMove} onPointerUp={stageUp} onPointerLeave={stageUp}>
          <defs>{doc.items.map((i) => i.fillMode === 'linear' ? <linearGradient key={i.id} id={`fill-${i.id}`} gradientTransform={`rotate(${i.gradientAngle} .5 .5)`}><stop stopColor={i.fillA}/><stop offset="1" stopColor={i.fillB}/></linearGradient> : i.fillMode === 'radial' ? <radialGradient key={i.id} id={`fill-${i.id}`}><stop stopColor={i.fillA}/><stop offset="1" stopColor={i.fillB}/></radialGradient> : null)}</defs>
          {doc.items.filter((i) => i.visible).map((i) => <g key={i.id} transform={`translate(${i.x} ${i.y}) rotate(${i.rotation} ${i.width/2} ${i.height/2})`} opacity={i.opacity} onPointerDown={(e) => selectItem(e, i)} style={{ cursor: i.locked ? 'not-allowed' : tool === 'select' ? 'move' : 'default' }}>
            {i.kind === 'rect' ? <rect width={i.width} height={i.height} fill={fillValue(i)} stroke={selected.includes(i.id) ? '#00eaff' : i.stroke} strokeWidth={selected.includes(i.id) ? Math.max(2, i.strokeWidth) : i.strokeWidth}/>
              : i.kind === 'ellipse' ? <ellipse cx={i.width/2} cy={i.height/2} rx={i.width/2} ry={i.height/2} fill={fillValue(i)} stroke={selected.includes(i.id) ? '#00eaff' : i.stroke} strokeWidth={selected.includes(i.id) ? Math.max(2, i.strokeWidth) : i.strokeWidth}/>
              : <path d={pathD(i)} fill={fillValue(i)} stroke={selected.includes(i.id) ? '#00eaff' : i.stroke} strokeWidth={selected.includes(i.id) ? Math.max(2, i.strokeWidth) : i.strokeWidth}/>} 
            {selected.includes(i.id) && <rect x={-4} y={-4} width={i.width+8} height={i.height+8} fill="none" stroke="#ff2d95" strokeDasharray="5 4" pointerEvents="none"/>}
            {tool === 'direct' && selected.includes(i.id) && i.kind === 'path' && i.points.map((p, idx) => <circle key={idx} cx={p.x} cy={p.y} r={directNode?.id === i.id && directNode.index === idx ? 7 : 5} fill="#fff" stroke="#ff2d95" strokeWidth={2} onPointerDown={(e) => nodeDown(e, i, idx)} />)}
          </g>)}
          {draft.length > 0 && <g><polyline points={draft.map((p) => `${p.x},${p.y}`).join(' ')} fill="rgba(255,45,149,.12)" stroke="#ff2d95" strokeWidth={2}/>{draft.map((p, idx) => <circle key={idx} cx={p.x} cy={p.y} r={5} fill="#00eaff"/>)}</g>}
        </svg>
        <div className="toolHint" style={{ marginTop: 6 }}>V/A/P/R/E tools · Shift-click multi-select · arrows nudge · Shift+arrows 10px · Ctrl/Cmd+D duplicate · Ctrl/Cmd+G group · Enter closes pen path.</div>
      </main>

      <aside className="gpanel" style={{ padding: 10 }}>
        <div className="rsub">INSPECTOR</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 10 }}>
          {(['left','hcenter','right','top','vcenter','bottom'] as AlignMode[]).map((m) => <button key={m} className="chip small" disabled={selected.length < 2} onClick={() => align(m)}>{m.toUpperCase()}</button>)}
          <button className="chip small" disabled={selected.length < 3} onClick={() => distribute('x')}>DIST X</button><button className="chip small" disabled={selected.length < 3} onClick={() => distribute('y')}>DIST Y</button>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 12 }}>
          {(['union','subtract','intersect','exclude'] as BoolMode[]).map((m) => <button key={m} className="chip small" disabled={selected.length !== 2} onClick={() => booleanOp(m)}>{m.toUpperCase()}</button>)}
        </div>
        {primary ? <div style={{ display: 'grid', gap: 8 }}>
          <label className="toolHint">NAME<input value={primary.name} onChange={(e) => patchPrimary({ name: e.target.value })}/></label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            <label className="toolHint">X<input type="number" value={Math.round(primary.x)} onChange={(e) => patchPrimary({ x: +e.target.value })}/></label><label className="toolHint">Y<input type="number" value={Math.round(primary.y)} onChange={(e) => patchPrimary({ y: +e.target.value })}/></label>
            <label className="toolHint">W<input type="number" min={1} value={Math.round(primary.width)} onChange={(e) => patchPrimary({ width: Math.max(1,+e.target.value) })}/></label><label className="toolHint">H<input type="number" min={1} value={Math.round(primary.height)} onChange={(e) => patchPrimary({ height: Math.max(1,+e.target.value) })}/></label>
          </div>
          <label className="toolHint">ROTATION<input type="number" value={primary.rotation} onChange={(e) => patchPrimary({ rotation: +e.target.value })}/></label>
          <label className="toolHint">OPACITY<input type="range" min={0} max={1} step={0.01} value={primary.opacity} onChange={(e) => patchPrimary({ opacity: +e.target.value })}/></label>
          <label className="toolHint">FILL MODE<select value={primary.fillMode} onChange={(e) => patchPrimary({ fillMode: e.target.value as FillMode })}><option value="solid">SOLID</option><option value="linear">LINEAR GRADIENT</option><option value="radial">RADIAL GRADIENT</option><option value="none">NONE</option></select></label>
          {primary.fillMode !== 'none' && <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}><label className="toolHint">COLOR A<input type="color" value={primary.fillA} onChange={(e) => patchPrimary({ fillA: e.target.value })}/></label>{primary.fillMode !== 'solid' && <label className="toolHint">COLOR B<input type="color" value={primary.fillB} onChange={(e) => patchPrimary({ fillB: e.target.value })}/></label>}</div>}
          {primary.fillMode === 'linear' && <label className="toolHint">GRADIENT ANGLE<input type="number" value={primary.gradientAngle} onChange={(e) => patchPrimary({ gradientAngle: +e.target.value })}/></label>}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}><label className="toolHint">STROKE<input type="color" value={primary.stroke} onChange={(e) => patchPrimary({ stroke: e.target.value })}/></label><label className="toolHint">WIDTH<input type="number" min={0} max={64} value={primary.strokeWidth} onChange={(e) => patchPrimary({ strokeWidth: clamp(+e.target.value,0,64) })}/></label></div>
          <label className="toolHint"><input type="checkbox" checked={primary.locked} onChange={(e) => patchPrimary({ locked: e.target.checked })}/> LOCKED</label>
        </div> : <div className="toolHint">Select an object to edit geometry, transforms, gradients, stroke, opacity and locking.</div>}
      </aside>
    </div>
  </div>;
}
