import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent, PointerEvent as RPointerEvent } from 'react';
import Icon from '../../design-system/icons/Icon';

type Tool = 'paint' | 'erase' | 'fill' | 'picker';
type Cell = string | null;

interface IconDef {
  id: string;
  name: string;
  grid: Cell[];
}

interface IconDocument {
  version: 2;
  setName: string;
  gridSize: 16;
  palette: string[];
  icons: IconDef[];
}

const GRID = 16 as const;
const CELL = 24;
const EXPORT_SIZES = [16, 32, 48, 128, 256];
const DEFAULT_PALETTE = ['#0E0E1A', '#FFFFFF', '#FF2D78', '#7A5CFF', '#00F5FF', '#FFD166', '#3DDC97', '#FF8C42'];
let sequence = 0;
const makeId = () => `icon-${Date.now().toString(36)}-${++sequence}`;
const storageKey = (boardId: string) => `xfactor-studio-icondesign2-${boardId}`;
const legacyKey = (boardId: string) => `xos-studio-icondesign-${boardId}`;
const blankGrid = (): Cell[] => new Array(GRID * GRID).fill(null);
const blankIcon = (name = 'icon-1'): IconDef => ({ id: makeId(), name, grid: blankGrid() });
const blankDocument = (): IconDocument => ({ version: 2, setName: 'Untitled icon set', gridSize: GRID, palette: [...DEFAULT_PALETTE], icons: [blankIcon()] });

function normalizeGrid(grid: unknown): Cell[] {
  if (!Array.isArray(grid)) return blankGrid();
  return Array.from({ length: GRID * GRID }, (_, i) => typeof grid[i] === 'string' ? grid[i].toUpperCase() : null);
}

function normalizeDocument(value: unknown): IconDocument {
  const source = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const rawIcons = Array.isArray(source.icons) ? source.icons : [];
  const icons = rawIcons.map((item, index) => {
    const icon = item && typeof item === 'object' ? item as Record<string, unknown> : {};
    return {
      id: typeof icon.id === 'string' ? icon.id : makeId(),
      name: typeof icon.name === 'string' && icon.name.trim() ? icon.name : `icon-${index + 1}`,
      grid: normalizeGrid(icon.grid),
    };
  });
  return {
    version: 2,
    setName: typeof source.setName === 'string' && source.setName.trim() ? source.setName : 'Untitled icon set',
    gridSize: GRID,
    palette: Array.isArray(source.palette) ? source.palette.filter((color): color is string => typeof color === 'string').slice(0, 16) : [...DEFAULT_PALETTE],
    icons: icons.length ? icons : [blankIcon()],
  };
}

function loadDocument(boardId: string): IconDocument {
  try {
    const current = localStorage.getItem(storageKey(boardId));
    if (current) return normalizeDocument(JSON.parse(current));
    const legacy = localStorage.getItem(legacyKey(boardId));
    if (legacy) {
      const parsed = JSON.parse(legacy);
      if (Array.isArray(parsed)) return normalizeDocument({ version: 2, setName: 'Imported icon set', palette: DEFAULT_PALETTE, icons: parsed });
    }
  } catch {
    // Fall through to a truthful blank document.
  }
  return blankDocument();
}

function iconToSvg(def: IconDef): string {
  let rects = '';
  for (let y = 0; y < GRID; y += 1) {
    for (let x = 0; x < GRID; x += 1) {
      const color = def.grid[y * GRID + x];
      if (color) rects += `<rect x="${x}" y="${y}" width="1" height="1" fill="${color}"/>`;
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${GRID} ${GRID}" shape-rendering="crispEdges">${rects}</svg>`;
}

function renderCanvas(def: IconDef, size: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  ctx.imageSmoothingEnabled = false;
  const cell = size / GRID;
  def.grid.forEach((color, index) => {
    if (!color) return;
    ctx.fillStyle = color;
    ctx.fillRect((index % GRID) * cell, Math.floor(index / GRID) * cell, cell, cell);
  });
  return canvas;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 3000);
}

function safeName(value: string) {
  return value.trim().replace(/[^a-z0-9._-]+/gi, '-').replace(/^-+|-+$/g, '') || 'icon';
}

function hexFromPixel(data: Uint8ClampedArray, offset: number): Cell {
  if (data[offset + 3] < 24) return null;
  return `#${[data[offset], data[offset + 1], data[offset + 2]].map((n) => n.toString(16).padStart(2, '0')).join('').toUpperCase()}`;
}

export default function IconDesignEditor2({ boardId, onExit }: { boardId: string; onExit: () => void }) {
  const [doc, setDoc] = useState<IconDocument>(() => loadDocument(boardId));
  const [activeId, setActiveId] = useState(() => loadDocument(boardId).icons[0].id);
  const [tool, setTool] = useState<Tool>('paint');
  const [color, setColor] = useState('#FFFFFF');
  const [symmetryX, setSymmetryX] = useState(false);
  const [symmetryY, setSymmetryY] = useState(false);
  const [history, setHistory] = useState<IconDocument[]>([]);
  const [future, setFuture] = useState<IconDocument[]>([]);
  const painting = useRef(false);
  const gestureRecorded = useRef(false);
  const imageInput = useRef<HTMLInputElement>(null);
  const jsonInput = useRef<HTMLInputElement>(null);

  const active = doc.icons.find((item) => item.id === activeId) ?? doc.icons[0];

  useEffect(() => {
    localStorage.setItem(storageKey(boardId), JSON.stringify(doc));
  }, [doc, boardId]);

  useEffect(() => {
    const stop = () => {
      painting.current = false;
      gestureRecorded.current = false;
    };
    window.addEventListener('pointerup', stop);
    return () => window.removeEventListener('pointerup', stop);
  }, []);

  function commit(mutator: (value: IconDocument) => IconDocument) {
    setDoc((current) => {
      setHistory((items) => [...items.slice(-49), current]);
      setFuture([]);
      return mutator(current);
    });
  }

  function mutateGrid(mutator: (grid: Cell[]) => Cell[]) {
    setDoc((current) => ({ ...current, icons: current.icons.map((item) => item.id === active.id ? { ...item, grid: mutator(item.grid) } : item) }));
  }

  function recordGesture() {
    if (gestureRecorded.current) return;
    gestureRecorded.current = true;
    setHistory((items) => [...items.slice(-49), doc]);
    setFuture([]);
  }

  function undo() {
    setHistory((items) => {
      if (!items.length) return items;
      const previous = items[items.length - 1];
      setFuture((next) => [doc, ...next]);
      setDoc(previous);
      return items.slice(0, -1);
    });
  }

  function redo() {
    setFuture((items) => {
      if (!items.length) return items;
      const next = items[0];
      setHistory((previous) => [...previous, doc]);
      setDoc(next);
      return items.slice(1);
    });
  }

  function mirroredIndexes(index: number) {
    const x = index % GRID;
    const y = Math.floor(index / GRID);
    const xs = symmetryX ? [x, GRID - 1 - x] : [x];
    const ys = symmetryY ? [y, GRID - 1 - y] : [y];
    return [...new Set(ys.flatMap((yy) => xs.map((xx) => yy * GRID + xx)))];
  }

  function applyCell(index: number) {
    if (tool === 'picker') {
      const picked = active.grid[index];
      if (picked) setColor(picked);
      setTool('paint');
      return;
    }
    if (tool === 'fill') {
      const target = active.grid[index];
      const replacement = color;
      if (target === replacement) return;
      commit((current) => ({
        ...current,
        icons: current.icons.map((item) => {
          if (item.id !== active.id) return item;
          const grid = [...item.grid];
          const queue = [index];
          const seen = new Set<number>();
          while (queue.length) {
            const cursor = queue.pop()!;
            if (seen.has(cursor) || grid[cursor] !== target) continue;
            seen.add(cursor);
            grid[cursor] = replacement;
            const x = cursor % GRID;
            const y = Math.floor(cursor / GRID);
            if (x > 0) queue.push(cursor - 1);
            if (x < GRID - 1) queue.push(cursor + 1);
            if (y > 0) queue.push(cursor - GRID);
            if (y < GRID - 1) queue.push(cursor + GRID);
          }
          return { ...item, grid };
        }),
      }));
      return;
    }
    recordGesture();
    const value = tool === 'erase' ? null : color;
    const indexes = mirroredIndexes(index);
    mutateGrid((grid) => grid.map((cell, cursor) => indexes.includes(cursor) ? value : cell));
  }

  function onCellPointerDown(event: RPointerEvent, index: number) {
    event.preventDefault();
    painting.current = tool === 'paint' || tool === 'erase';
    applyCell(index);
  }

  function onCellPointerEnter(index: number) {
    if (painting.current) applyCell(index);
  }

  function updateActive(patch: Partial<IconDef>) {
    commit((current) => ({ ...current, icons: current.icons.map((item) => item.id === active.id ? { ...item, ...patch } : item) }));
  }

  function addIcon() {
    const created = blankIcon(`icon-${doc.icons.length + 1}`);
    commit((current) => ({ ...current, icons: [...current.icons, created] }));
    setActiveId(created.id);
  }

  function duplicateIcon() {
    const copy = { ...active, id: makeId(), name: `${active.name}-copy`, grid: [...active.grid] };
    commit((current) => {
      const index = current.icons.findIndex((item) => item.id === active.id);
      const icons = [...current.icons];
      icons.splice(index + 1, 0, copy);
      return { ...current, icons };
    });
    setActiveId(copy.id);
  }

  function deleteIcon(id: string) {
    if (doc.icons.length <= 1) return;
    const remaining = doc.icons.filter((item) => item.id !== id);
    commit((current) => ({ ...current, icons: current.icons.filter((item) => item.id !== id) }));
    if (activeId === id) setActiveId(remaining[0].id);
  }

  function moveIcon(direction: -1 | 1) {
    const index = doc.icons.findIndex((item) => item.id === active.id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= doc.icons.length) return;
    commit((current) => {
      const icons = [...current.icons];
      [icons[index], icons[target]] = [icons[target], icons[index]];
      return { ...current, icons };
    });
  }

  function transformGrid(kind: 'flip-x' | 'flip-y' | 'rotate' | 'left' | 'right' | 'up' | 'down') {
    updateActive({
      grid: Array.from({ length: GRID * GRID }, (_, destination) => {
        const x = destination % GRID;
        const y = Math.floor(destination / GRID);
        let sx = x;
        let sy = y;
        if (kind === 'flip-x') sx = GRID - 1 - x;
        if (kind === 'flip-y') sy = GRID - 1 - y;
        if (kind === 'rotate') { sx = y; sy = GRID - 1 - x; }
        if (kind === 'left') sx = x + 1;
        if (kind === 'right') sx = x - 1;
        if (kind === 'up') sy = y + 1;
        if (kind === 'down') sy = y - 1;
        if (sx < 0 || sy < 0 || sx >= GRID || sy >= GRID) return null;
        return active.grid[sy * GRID + sx];
      }),
    });
  }

  function exportSvg(def = active) {
    downloadBlob(new Blob([iconToSvg(def)], { type: 'image/svg+xml' }), `${safeName(def.name)}.svg`);
  }

  function exportPngs() {
    EXPORT_SIZES.forEach((size, index) => {
      setTimeout(() => renderCanvas(active, size).toBlob((blob) => blob && downloadBlob(blob, `${safeName(active.name)}-${size}.png`), 'image/png'), index * 120);
    });
  }

  function exportAllSvgs() {
    doc.icons.forEach((item, index) => setTimeout(() => exportSvg(item), index * 120));
  }

  function exportJson() {
    downloadBlob(new Blob([JSON.stringify(doc, null, 2)], { type: 'application/json' }), `${safeName(doc.setName)}.json`);
  }

  function importJson(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    file.text().then((text) => {
      const imported = normalizeDocument(JSON.parse(text));
      commit(() => imported);
      setActiveId(imported.icons[0].id);
    }).catch((error) => console.error('Icon set import failed', error));
  }

  function importImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const image = new Image();
      image.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = GRID;
        canvas.height = GRID;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.clearRect(0, 0, GRID, GRID);
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(image, 0, 0, GRID, GRID);
        const pixels = ctx.getImageData(0, 0, GRID, GRID).data;
        const grid = Array.from({ length: GRID * GRID }, (_, index) => hexFromPixel(pixels, index * 4));
        updateActive({ grid });
      };
      image.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  }

  return (
    <div className="toolShell" data-testid="icon-design-2-root">
      <div className="toolShellBar">
        <button className="toolBtn" onClick={onExit}><Icon name="chevronLeft" size={16} /> Boards</button>
        <input aria-label="Icon set name" value={doc.setName} onChange={(event) => commit((current) => ({ ...current, setName: event.target.value }))} style={{ width: 180 }} />
        <div className="toolRow" style={{ gap: 6 }}>
          {(['paint', 'erase', 'fill', 'picker'] as Tool[]).map((item) => <button key={item} className={`toolBtn ${tool === item ? 'toolBtnActive' : ''}`} onClick={() => setTool(item)}>{item}</button>)}
          <button className={`toolBtn ${symmetryX ? 'toolBtnActive' : ''}`} onClick={() => setSymmetryX((value) => !value)}>Mirror X</button>
          <button className={`toolBtn ${symmetryY ? 'toolBtnActive' : ''}`} onClick={() => setSymmetryY((value) => !value)}>Mirror Y</button>
        </div>
        <div className="toolRow" style={{ marginLeft: 'auto', gap: 6 }}>
          <button className="toolBtn" disabled={!history.length} onClick={undo}>Undo</button>
          <button className="toolBtn" disabled={!future.length} onClick={redo}>Redo</button>
          <button className="toolBtn" onClick={exportJson}>JSON</button>
          <button className="toolBtn" onClick={() => jsonInput.current?.click()}>Import JSON</button>
          <input ref={jsonInput} type="file" accept="application/json,.json" hidden onChange={importJson} />
          <button className="toolBtn" onClick={exportAllSvgs}>All SVG</button>
        </div>
      </div>

      <div className="toolShellBody" style={{ display: 'grid', gridTemplateColumns: '190px minmax(420px,1fr) 240px', gap: 16 }}>
        <aside className="toolCol" style={{ gap: 8, overflowY: 'auto' }}>
          <div className="toolHint">ICON SET · {doc.icons.length}</div>
          {doc.icons.map((item) => (
            <div key={item.id} className="toolRow" onClick={() => setActiveId(item.id)} style={{ gap: 8, alignItems: 'center', border: item.id === active.id ? '1px solid #00F5FF' : '1px solid rgba(255,255,255,.12)', borderRadius: 6, padding: 6, cursor: 'pointer' }}>
              <PreviewCanvas def={item} size={24} />
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', fontSize: 12 }}>{item.name}</span>
              {doc.icons.length > 1 && <button onClick={(event) => { event.stopPropagation(); deleteIcon(item.id); }}>×</button>}
            </div>
          ))}
          <button className="toolBtn" onClick={addIcon}>+ New Icon</button>
          <button className="toolBtn" onClick={duplicateIcon}>Duplicate Icon</button>
          <div className="toolRow"><button className="toolBtn" onClick={() => moveIcon(-1)}>↑</button><button className="toolBtn" onClick={() => moveIcon(1)}>↓</button></div>
        </aside>

        <main className="toolCol" style={{ alignItems: 'center', gap: 10 }}>
          <input aria-label="Icon name" value={active.name} onChange={(event) => updateActive({ name: event.target.value })} style={{ width: GRID * CELL, textAlign: 'center' }} />
          <div data-testid="icon-design-grid" style={{ display: 'grid', gridTemplateColumns: `repeat(${GRID}, ${CELL}px)`, gridTemplateRows: `repeat(${GRID}, ${CELL}px)`, border: '1px solid rgba(255,255,255,.24)', background: '#05080d', userSelect: 'none', touchAction: 'none' }} onPointerLeave={() => { painting.current = false; gestureRecorded.current = false; }}>
            {active.grid.map((cell, index) => <div key={index} data-cell-index={index} onPointerDown={(event) => onCellPointerDown(event, index)} onPointerEnter={() => onCellPointerEnter(index)} style={{ width: CELL, height: CELL, background: cell ?? 'transparent', borderRight: '1px solid rgba(255,255,255,.07)', borderBottom: '1px solid rgba(255,255,255,.07)', cursor: tool === 'picker' ? 'copy' : 'crosshair' }} />)}
          </div>
          <div className="toolRow" style={{ gap: 6, flexWrap: 'wrap', justifyContent: 'center' }}>
            {doc.palette.map((item) => <button key={item} aria-label={`color ${item}`} onClick={() => { setColor(item); setTool('paint'); }} style={{ width: 26, height: 26, background: item, borderRadius: 4, border: color === item ? '2px solid #00F5FF' : '1px solid rgba(255,255,255,.25)' }} />)}
            <input aria-label="Custom color" type="color" value={color} onChange={(event) => setColor(event.target.value.toUpperCase())} />
            <button className="toolBtn" onClick={() => !doc.palette.includes(color) && commit((current) => ({ ...current, palette: [...current.palette.slice(-15), color] }))}>+ Palette</button>
          </div>
          <div className="toolRow" style={{ gap: 6, flexWrap: 'wrap', justifyContent: 'center' }}>
            <button className="toolBtn" onClick={() => transformGrid('flip-x')}>Flip H</button>
            <button className="toolBtn" onClick={() => transformGrid('flip-y')}>Flip V</button>
            <button className="toolBtn" onClick={() => transformGrid('rotate')}>Rotate 90°</button>
            <button className="toolBtn" onClick={() => transformGrid('left')}>←</button>
            <button className="toolBtn" onClick={() => transformGrid('up')}>↑</button>
            <button className="toolBtn" onClick={() => transformGrid('down')}>↓</button>
            <button className="toolBtn" onClick={() => transformGrid('right')}>→</button>
            <button className="toolBtn" onClick={() => updateActive({ grid: blankGrid() })}>Clear</button>
          </div>
        </main>

        <aside className="toolCol" style={{ gap: 12 }}>
          <div className="toolHint">REAL-SIZE PREVIEW</div>
          {EXPORT_SIZES.map((size) => <div key={size} className="toolRow" style={{ gap: 10, alignItems: 'center' }}><PreviewCanvas def={active} size={size > 128 ? 128 : size} renderSize={size} /><span className="toolHint">{size}px</span></div>)}
          <button className="toolBtn" onClick={() => exportSvg()}>Export SVG</button>
          <button className="toolBtn" onClick={exportPngs}>Export PNGs · 16/32/48/128/256</button>
          <button className="toolBtn" onClick={() => imageInput.current?.click()}>Import Image → 16×16</button>
          <input ref={imageInput} type="file" accept="image/*" hidden onChange={importImage} />
          <div className="toolHint">Transparent cells stay transparent in SVG/PNG. Image import downsamples to the same editable 16×16 source grid.</div>
        </aside>
      </div>
    </div>
  );
}

function PreviewCanvas({ def, size, renderSize = size }: { def: IconDef; size: number; renderSize?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const rendered = renderCanvas(def, renderSize);
    canvas.width = renderSize;
    canvas.height = renderSize;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, renderSize, renderSize);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(rendered, 0, 0);
  }, [def, renderSize]);
  return <canvas ref={ref} style={{ width: size, height: size, maxWidth: 128, maxHeight: 128, background: '#05080d', borderRadius: 4 }} />;
}
