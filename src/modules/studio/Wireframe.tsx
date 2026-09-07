import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, MouseEvent as ReactMouseEvent, WheelEvent as ReactWheelEvent } from 'react';
import type { ComponentVariantName, PrototypeLink, StudioComponent, StudioItem, StudioItemType, StudioSnapshot } from './types';
import { SEED_STUDIO } from './seed';

type Tool = 'select' | 'frame' | 'rect' | 'circle' | 'sticky' | 'component' | 'link';
type HConstraint = 'left' | 'right' | 'left-right' | 'center' | 'scale';
type VConstraint = 'top' | 'bottom' | 'top-bottom' | 'center' | 'scale';
type WireItem = StudioItem & {
  parentFrameId?: string;
  hConstraint?: HConstraint;
  vConstraint?: VConstraint;
  radius?: number;
  locked?: boolean;
};
type WireSnapshot = Omit<StudioSnapshot, 'items'> & { items: WireItem[] };
type DragState = {
  kind: 'move' | 'resize' | 'pan' | 'marquee';
  startClientX: number;
  startClientY: number;
  startWorldX: number;
  startWorldY: number;
  itemStarts?: Record<string, { x: number; y: number; w: number; h: number }>;
  resizeId?: string;
  cameraStart?: { x: number; y: number };
  marqueeStart?: { x: number; y: number };
};

type GuideState = { x: number | null; y: number | null };

const WORLD_W = 6000;
const WORLD_H = 4200;
const GRID = 8;
const SNAP_DISTANCE = 7;
const HISTORY_LIMIT = 80;
const DEFAULT_COMPONENTS: StudioComponent[] = [
  {
    id: 'component-primary-button',
    name: 'Primary Button',
    variants: {
      default: { bg: 'linear-gradient(135deg,#ff2aa1,#8d5cff,#00e5ff)', fg: '#07070b', label: 'Continue' },
      hover: { bg: 'linear-gradient(135deg,#ff55b9,#a879ff,#44ecff)', fg: '#07070b', label: 'Continue' },
      pressed: { bg: '#00e5ff', fg: '#07070b', label: 'Working…' },
    },
  },
];

let serial = 0;
const id = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${++serial}`;
const storageKey = (boardId: string) => `xos-studio-wf-${boardId}`;

function normalize(raw: Partial<StudioSnapshot> | null, seed: boolean): WireSnapshot {
  const source = raw ?? (seed ? SEED_STUDIO : null);
  return {
    items: ((source?.items ?? []) as WireItem[]).map((item) => ({
      ...item,
      hConstraint: item.hConstraint ?? 'left',
      vConstraint: item.vConstraint ?? 'top',
      locked: item.locked ?? false,
    })),
    arrows: source?.arrows ?? [],
    ink: source?.ink ?? [],
    comments: source?.comments ?? [],
    links: source?.links ?? [],
    components: source?.components?.length ? source.components : DEFAULT_COMPONENTS,
  };
}

function load(boardId: string, seed: boolean): WireSnapshot {
  try {
    const raw = localStorage.getItem(storageKey(boardId));
    if (raw) return normalize(JSON.parse(raw) as Partial<StudioSnapshot>, seed);
  } catch {
    // Corrupt local data should never stop the editor from opening.
  }
  return normalize(null, seed);
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function itemLabel(type: StudioItemType) {
  const labels: Record<StudioItemType, string> = {
    frame: 'Frame',
    sticky: 'Text',
    stickyM: 'Text',
    rect: 'Rectangle',
    circle: 'Ellipse',
    mood: 'Swatch',
    image: 'Image',
    component: 'Component',
  };
  return labels[type];
}

function bounds(items: WireItem[]) {
  if (!items.length) return null;
  const left = Math.min(...items.map((item) => item.x));
  const top = Math.min(...items.map((item) => item.y));
  const right = Math.max(...items.map((item) => item.x + item.w));
  const bottom = Math.max(...items.map((item) => item.y + item.h));
  return { left, top, right, bottom, width: right - left, height: bottom - top };
}

function defaultFrame(name: string, x: number, y: number, w: number, h: number): WireItem {
  return {
    id: id('frame'),
    type: 'frame',
    name,
    x,
    y,
    w,
    h,
    visible: true,
    variant: 'blank',
    hConstraint: 'left',
    vConstraint: 'top',
  };
}

function spawn(type: StudioItemType, x: number, y: number): WireItem {
  const isCircle = type === 'circle';
  const isSticky = type === 'sticky' || type === 'stickyM';
  return {
    id: id('item'),
    type,
    name: itemLabel(type),
    x,
    y,
    w: isCircle ? 120 : isSticky ? 180 : type === 'component' ? 160 : 180,
    h: isCircle ? 120 : isSticky ? 92 : type === 'component' ? 46 : 120,
    text: isSticky ? 'Type something…' : undefined,
    visible: true,
    hConstraint: 'left',
    vConstraint: 'top',
  };
}

export default function Wireframe({ boardId, isSeed, onExit }: { boardId: string; isSeed: boolean; onExit: () => void }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [doc, setDoc] = useState<WireSnapshot>(() => load(boardId, isSeed));
  const [selected, setSelected] = useState<string[]>([]);
  const [tool, setTool] = useState<Tool>('select');
  const [camera, setCamera] = useState({ x: -80, y: -20, zoom: 0.92 });
  const [guides, setGuides] = useState<GuideState>({ x: null, y: null });
  const [marquee, setMarquee] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [linkSource, setLinkSource] = useState<string | null>(null);
  const [playing, setPlaying] = useState<string | null>(null);
  const [playStack, setPlayStack] = useState<string[]>([]);
  const [componentPanel, setComponentPanel] = useState(false);
  const [inspectorOpen, setInspectorOpen] = useState(true);
  const [gridSnap, setGridSnap] = useState(true);
  const dragRef = useRef<DragState | null>(null);
  const past = useRef<WireSnapshot[]>([]);
  const future = useRef<WireSnapshot[]>([]);

  const selectedItems = useMemo(() => selected.map((sid) => doc.items.find((item) => item.id === sid)).filter(Boolean) as WireItem[], [doc.items, selected]);
  const selectedOne = selectedItems.length === 1 ? selectedItems[0] : null;
  const frames = useMemo(() => doc.items.filter((item) => item.type === 'frame'), [doc.items]);

  useEffect(() => {
    const timer = window.setTimeout(() => localStorage.setItem(storageKey(boardId), JSON.stringify(doc)), 180);
    return () => window.clearTimeout(timer);
  }, [boardId, doc]);

  function commit(next: WireSnapshot, record = true) {
    if (record) {
      past.current.push(doc);
      if (past.current.length > HISTORY_LIMIT) past.current.shift();
      future.current = [];
    }
    setDoc(next);
  }

  function patchItems(updater: (items: WireItem[]) => WireItem[], record = true) {
    commit({ ...doc, items: updater(doc.items) }, record);
  }

  function undo() {
    const previous = past.current.pop();
    if (!previous) return;
    future.current.push(doc);
    setDoc(previous);
    setSelected([]);
  }

  function redo() {
    const next = future.current.pop();
    if (!next) return;
    past.current.push(doc);
    setDoc(next);
    setSelected([]);
  }

  function screenToWorld(clientX: number, clientY: number) {
    const rect = rootRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: (clientX - rect.left - camera.x) / camera.zoom,
      y: (clientY - rect.top - camera.y) / camera.zoom,
    };
  }

  function snapValue(value: number) {
    return gridSnap ? Math.round(value / GRID) * GRID : value;
  }

  function findParentFrame(item: WireItem) {
    if (item.type === 'frame') return undefined;
    return frames
      .filter((frame) => item.x >= frame.x && item.y >= frame.y && item.x + item.w <= frame.x + frame.w && item.y + item.h <= frame.y + frame.h)
      .sort((a, b) => a.w * a.h - b.w * b.h)[0];
  }

  function addItem(type: StudioItemType, x: number, y: number, extra: Partial<WireItem> = {}) {
    const nextItem = { ...spawn(type, snapValue(x), snapValue(y)), ...extra };
    const parent = findParentFrame(nextItem);
    if (parent) nextItem.parentFrameId = parent.id;
    commit({ ...doc, items: [...doc.items, nextItem] });
    setSelected([nextItem.id]);
    setTool('select');
  }

  function addFramePreset(kind: 'mobile' | 'tablet' | 'desktop') {
    const preset = kind === 'mobile' ? { w: 390, h: 844 } : kind === 'tablet' ? { w: 768, h: 1024 } : { w: 1440, h: 900 };
    const origin = screenToWorld((rootRef.current?.getBoundingClientRect().left ?? 0) + 260, (rootRef.current?.getBoundingClientRect().top ?? 0) + 150);
    const frame = defaultFrame(`${kind[0].toUpperCase()}${kind.slice(1)} ${preset.w}`, snapValue(origin.x), snapValue(origin.y), preset.w, preset.h);
    commit({ ...doc, items: [...doc.items, frame] });
    setSelected([frame.id]);
  }

  function addComponentInstance(componentId: string) {
    const comp = doc.components.find((c) => c.id === componentId);
    if (!comp) return;
    const point = screenToWorld((rootRef.current?.getBoundingClientRect().left ?? 0) + 360, (rootRef.current?.getBoundingClientRect().top ?? 0) + 180);
    addItem('component', point.x, point.y, { componentId, activeVariant: 'default', name: comp.name });
  }

  function duplicateSelection() {
    if (!selectedItems.length) return;
    const clones = selectedItems.map((item) => ({ ...item, id: id('item'), x: item.x + 24, y: item.y + 24, name: `${item.name} copy` }));
    commit({ ...doc, items: [...doc.items, ...clones] });
    setSelected(clones.map((item) => item.id));
  }

  function deleteSelection() {
    if (!selected.length) return;
    commit({
      ...doc,
      items: doc.items.filter((item) => !selected.includes(item.id)),
      links: doc.links.filter((link) => !selected.includes(link.sourceItemId) && !selected.includes(link.targetItemId)),
    });
    setSelected([]);
  }

  function align(axis: 'left' | 'centerX' | 'right' | 'top' | 'centerY' | 'bottom') {
    if (selectedItems.length < 2) return;
    const box = bounds(selectedItems);
    if (!box) return;
    patchItems((items) => items.map((item) => {
      if (!selected.includes(item.id)) return item;
      if (axis === 'left') return { ...item, x: box.left };
      if (axis === 'centerX') return { ...item, x: box.left + (box.width - item.w) / 2 };
      if (axis === 'right') return { ...item, x: box.right - item.w };
      if (axis === 'top') return { ...item, y: box.top };
      if (axis === 'centerY') return { ...item, y: box.top + (box.height - item.h) / 2 };
      return { ...item, y: box.bottom - item.h };
    }));
  }

  function distribute(direction: 'h' | 'v') {
    if (selectedItems.length < 3) return;
    const ordered = [...selectedItems].sort((a, b) => direction === 'h' ? a.x - b.x : a.y - b.y);
    const first = ordered[0];
    const last = ordered[ordered.length - 1];
    if (direction === 'h') {
      const used = ordered.reduce((sum, item) => sum + item.w, 0);
      const gap = ((last.x + last.w) - first.x - used) / (ordered.length - 1);
      let cursor = first.x;
      const positions = new Map<string, number>();
      ordered.forEach((item) => { positions.set(item.id, cursor); cursor += item.w + gap; });
      patchItems((items) => items.map((item) => positions.has(item.id) ? { ...item, x: positions.get(item.id)! } : item));
    } else {
      const used = ordered.reduce((sum, item) => sum + item.h, 0);
      const gap = ((last.y + last.h) - first.y - used) / (ordered.length - 1);
      let cursor = first.y;
      const positions = new Map<string, number>();
      ordered.forEach((item) => { positions.set(item.id, cursor); cursor += item.h + gap; });
      patchItems((items) => items.map((item) => positions.has(item.id) ? { ...item, y: positions.get(item.id)! } : item));
    }
  }

  function resizeFrameWithConstraints(frameId: string, oldFrame: WireItem, newW: number, newH: number, source: WireItem[]) {
    const dx = newW - oldFrame.w;
    const dy = newH - oldFrame.h;
    return source.map((item) => {
      if (item.id === frameId) return { ...item, w: newW, h: newH };
      if (item.parentFrameId !== frameId) return item;
      let x = item.x;
      let y = item.y;
      let w = item.w;
      let h = item.h;
      if (item.hConstraint === 'right') x += dx;
      if (item.hConstraint === 'left-right') w = Math.max(24, w + dx);
      if (item.hConstraint === 'center') x += dx / 2;
      if (item.hConstraint === 'scale' && oldFrame.w > 0) {
        const ratio = newW / oldFrame.w;
        x = oldFrame.x + (item.x - oldFrame.x) * ratio;
        w *= ratio;
      }
      if (item.vConstraint === 'bottom') y += dy;
      if (item.vConstraint === 'top-bottom') h = Math.max(24, h + dy);
      if (item.vConstraint === 'center') y += dy / 2;
      if (item.vConstraint === 'scale' && oldFrame.h > 0) {
        const ratio = newH / oldFrame.h;
        y = oldFrame.y + (item.y - oldFrame.y) * ratio;
        h *= ratio;
      }
      return { ...item, x, y, w, h };
    });
  }

  function fitSelection() {
    const target = selectedItems.length ? bounds(selectedItems) : bounds(doc.items.filter((item) => item.visible));
    const rect = rootRef.current?.getBoundingClientRect();
    if (!target || !rect) return;
    const availableW = Math.max(300, rect.width - 420);
    const availableH = Math.max(240, rect.height - 160);
    const zoom = clamp(Math.min(availableW / Math.max(1, target.width), availableH / Math.max(1, target.height)), 0.2, 2.4);
    setCamera({
      zoom,
      x: 110 + (availableW - target.width * zoom) / 2 - target.left * zoom,
      y: 80 + (availableH - target.height * zoom) / 2 - target.top * zoom,
    });
  }

  function createLink(targetFrameId: string) {
    if (!linkSource || linkSource === targetFrameId) return;
    const target = doc.items.find((item) => item.id === targetFrameId);
    if (!target || target.type !== 'frame') return;
    const nextLink: PrototypeLink = { id: id('link'), sourceItemId: linkSource, hotspotKey: 'self', targetItemId: targetFrameId };
    commit({ ...doc, links: [...doc.links.filter((link) => !(link.sourceItemId === linkSource && link.hotspotKey === 'self')), nextLink] });
    setLinkSource(null);
    setTool('select');
  }

  function startPlay() {
    const start = selectedItems.find((item) => item.type === 'frame') ?? frames[0];
    if (!start) return;
    setPlaying(start.id);
    setPlayStack([]);
  }

  function playNavigate(sourceId: string) {
    const link = doc.links.find((candidate) => candidate.sourceItemId === sourceId && candidate.hotspotKey === 'self');
    if (!link || !playing) return;
    setPlayStack((stack) => [...stack, playing]);
    setPlaying(link.targetItemId);
  }

  function exportJson() {
    const blob = new Blob([JSON.stringify(doc, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `xfactor-wireframe-${boardId}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function updateSelected(patch: Partial<WireItem>) {
    if (!selectedOne) return;
    patchItems((items) => items.map((item) => item.id === selectedOne.id ? { ...item, ...patch } : item));
  }

  function onRootDown(event: ReactMouseEvent<HTMLDivElement>) {
    const target = event.target as HTMLElement;
    if (target.closest('.wf2-ui')) return;
    const point = screenToWorld(event.clientX, event.clientY);
    if (tool !== 'select' && tool !== 'link') {
      const map: Partial<Record<Tool, StudioItemType>> = { frame: 'frame', rect: 'rect', circle: 'circle', sticky: 'sticky', component: 'component' };
      const type = map[tool];
      if (type === 'frame') {
        const frame = defaultFrame('Frame', snapValue(point.x), snapValue(point.y), 390, 844);
        commit({ ...doc, items: [...doc.items, frame] });
        setSelected([frame.id]);
        setTool('select');
      } else if (type) {
        addItem(type, point.x, point.y, type === 'component' ? { componentId: doc.components[0]?.id, activeVariant: 'default' } : {});
      }
      return;
    }
    if (tool === 'link') {
      setLinkSource(null);
      return;
    }
    if (event.button === 1 || event.altKey || event.spaceKey) return;
    dragRef.current = {
      kind: event.shiftKey ? 'marquee' : 'pan',
      startClientX: event.clientX,
      startClientY: event.clientY,
      startWorldX: point.x,
      startWorldY: point.y,
      cameraStart: { x: camera.x, y: camera.y },
      marqueeStart: point,
    };
    if (!event.shiftKey) setSelected([]);
    if (event.shiftKey) setMarquee({ x: point.x, y: point.y, w: 0, h: 0 });
  }

  function onItemDown(event: ReactMouseEvent<HTMLDivElement>, item: WireItem) {
    if (item.locked) return;
    event.stopPropagation();
    if (tool === 'link') {
      if (!linkSource) setLinkSource(item.id);
      else if (item.type === 'frame') createLink(item.id);
      return;
    }
    if (tool !== 'select') return;
    const next = event.shiftKey
      ? selected.includes(item.id) ? selected.filter((sid) => sid !== item.id) : [...selected, item.id]
      : selected.includes(item.id) ? selected : [item.id];
    setSelected(next);
    const point = screenToWorld(event.clientX, event.clientY);
    const starts: DragState['itemStarts'] = {};
    next.forEach((sid) => {
      const current = doc.items.find((candidate) => candidate.id === sid);
      if (current) starts![sid] = { x: current.x, y: current.y, w: current.w, h: current.h };
    });
    dragRef.current = {
      kind: 'move',
      startClientX: event.clientX,
      startClientY: event.clientY,
      startWorldX: point.x,
      startWorldY: point.y,
      itemStarts: starts,
    };
  }

  function onResizeDown(event: ReactMouseEvent<HTMLDivElement>, item: WireItem) {
    event.stopPropagation();
    const point = screenToWorld(event.clientX, event.clientY);
    dragRef.current = {
      kind: 'resize',
      startClientX: event.clientX,
      startClientY: event.clientY,
      startWorldX: point.x,
      startWorldY: point.y,
      resizeId: item.id,
      itemStarts: { [item.id]: { x: item.x, y: item.y, w: item.w, h: item.h } },
    };
  }

  function onRootMove(event: ReactMouseEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag) return;
    const point = screenToWorld(event.clientX, event.clientY);
    if (drag.kind === 'pan' && drag.cameraStart) {
      setCamera((current) => ({ ...current, x: drag.cameraStart!.x + event.clientX - drag.startClientX, y: drag.cameraStart!.y + event.clientY - drag.startClientY }));
      return;
    }
    if (drag.kind === 'marquee' && drag.marqueeStart) {
      const x = Math.min(drag.marqueeStart.x, point.x);
      const y = Math.min(drag.marqueeStart.y, point.y);
      setMarquee({ x, y, w: Math.abs(point.x - drag.marqueeStart.x), h: Math.abs(point.y - drag.marqueeStart.y) });
      return;
    }
    if (drag.kind === 'move' && drag.itemStarts) {
      let dx = point.x - drag.startWorldX;
      let dy = point.y - drag.startWorldY;
      const primary = selectedItems[0];
      if (primary) {
        const start = drag.itemStarts[primary.id];
        if (start) {
          let gx: number | null = null;
          let gy: number | null = null;
          const candidateX = start.x + dx;
          const candidateY = start.y + dy;
          const candidateCX = candidateX + primary.w / 2;
          const candidateCY = candidateY + primary.h / 2;
          doc.items.forEach((other) => {
            if (selected.includes(other.id)) return;
            const xs = [other.x, other.x + other.w / 2, other.x + other.w];
            const ys = [other.y, other.y + other.h / 2, other.y + other.h];
            for (const x of xs) {
              if (Math.abs(candidateX - x) < SNAP_DISTANCE) { dx += x - candidateX; gx = x; break; }
              if (Math.abs(candidateCX - x) < SNAP_DISTANCE) { dx += x - candidateCX; gx = x; break; }
            }
            for (const y of ys) {
              if (Math.abs(candidateY - y) < SNAP_DISTANCE) { dy += y - candidateY; gy = y; break; }
              if (Math.abs(candidateCY - y) < SNAP_DISTANCE) { dy += y - candidateCY; gy = y; break; }
            }
          });
          setGuides({ x: gx, y: gy });
        }
      }
      const finalDx = gridSnap ? Math.round(dx / GRID) * GRID : dx;
      const finalDy = gridSnap ? Math.round(dy / GRID) * GRID : dy;
      setDoc((current) => ({
        ...current,
        items: current.items.map((item) => {
          const start = drag.itemStarts?.[item.id];
          return start ? { ...item, x: start.x + finalDx, y: start.y + finalDy } : item;
        }),
      }));
      return;
    }
    if (drag.kind === 'resize' && drag.resizeId && drag.itemStarts?.[drag.resizeId]) {
      const start = drag.itemStarts[drag.resizeId];
      const current = doc.items.find((item) => item.id === drag.resizeId);
      if (!current) return;
      const newW = Math.max(40, snapValue(start.w + point.x - drag.startWorldX));
      const newH = Math.max(32, snapValue(start.h + point.y - drag.startWorldY));
      setDoc((state) => ({
        ...state,
        items: current.type === 'frame'
          ? resizeFrameWithConstraints(current.id, { ...current, w: start.w, h: start.h }, newW, newH, state.items)
          : state.items.map((item) => item.id === current.id ? { ...item, w: newW, h: newH } : item),
      }));
    }
  }

  function onRootUp() {
    const drag = dragRef.current;
    if (!drag) return;
    if (drag.kind === 'marquee' && marquee) {
      const hit = doc.items.filter((item) => item.visible && item.x < marquee.x + marquee.w && item.x + item.w > marquee.x && item.y < marquee.y + marquee.h && item.y + item.h > marquee.y).map((item) => item.id);
      setSelected(hit);
      setMarquee(null);
    }
    if (drag.kind === 'move' || drag.kind === 'resize') {
      // Record the already-applied drag result as one undo step by reconstructing its start state.
      const beforeItems = doc.items.map((item) => {
        const start = drag.itemStarts?.[item.id];
        return start ? { ...item, ...start } : item;
      });
      past.current.push({ ...doc, items: beforeItems });
      if (past.current.length > HISTORY_LIMIT) past.current.shift();
      future.current = [];
      const reparented = doc.items.map((item) => {
        if (!selected.includes(item.id) || item.type === 'frame') return item;
        const parent = findParentFrame(item);
        return { ...item, parentFrameId: parent?.id };
      });
      setDoc((current) => ({ ...current, items: reparented }));
    }
    dragRef.current = null;
    setGuides({ x: null, y: null });
  }

  function onWheel(event: ReactWheelEvent<HTMLDivElement>) {
    if (!event.ctrlKey && !event.metaKey) return;
    event.preventDefault();
    const rect = rootRef.current?.getBoundingClientRect();
    if (!rect) return;
    const oldZoom = camera.zoom;
    const nextZoom = clamp(oldZoom * (event.deltaY < 0 ? 1.1 : 0.9), 0.2, 2.5);
    const px = event.clientX - rect.left;
    const py = event.clientY - rect.top;
    const worldX = (px - camera.x) / oldZoom;
    const worldY = (py - camera.y) / oldZoom;
    setCamera({ zoom: nextZoom, x: px - worldX * nextZoom, y: py - worldY * nextZoom });
  }

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement;
      if (target.closest('input,textarea,[contenteditable=true]')) return;
      const mod = event.metaKey || event.ctrlKey;
      if (mod && event.key.toLowerCase() === 'z') { event.preventDefault(); event.shiftKey ? redo() : undo(); return; }
      if (mod && event.key.toLowerCase() === 'd') { event.preventDefault(); duplicateSelection(); return; }
      if (mod && event.key === '0') { event.preventDefault(); fitSelection(); return; }
      if (event.key === 'Delete' || event.key === 'Backspace') { event.preventDefault(); deleteSelection(); return; }
      if (event.key === 'Escape') { setPlaying(null); setLinkSource(null); setTool('select'); setSelected([]); return; }
      if (event.key.toLowerCase() === 'v') setTool('select');
      if (event.key.toLowerCase() === 'f') setTool('frame');
      if (event.key.toLowerCase() === 'r') setTool('rect');
      if (event.key.toLowerCase() === 'o') setTool('circle');
      if (event.key.toLowerCase() === 't') setTool('sticky');
      if (event.key.toLowerCase() === 'p') startPlay();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const playingFrame = playing ? doc.items.find((item) => item.id === playing && item.type === 'frame') : null;
  const frameChildren = playingFrame ? doc.items.filter((item) => item.parentFrameId === playingFrame.id && item.visible) : [];

  return (
    <div className="wf2" ref={rootRef} onMouseDown={onRootDown} onMouseMove={onRootMove} onMouseUp={onRootUp} onMouseLeave={onRootUp} onWheel={onWheel}>
      <header className="wf2-ui wf2-topbar">
        <button onClick={onExit}>← BOARDS</button>
        <div className="wf2-divider" />
        {(['select', 'frame', 'rect', 'circle', 'sticky', 'component', 'link'] as Tool[]).map((entry) => (
          <button key={entry} className={tool === entry ? 'active' : ''} onClick={() => { setTool(entry); setLinkSource(null); }} title={entry}>{entry.toUpperCase()}</button>
        ))}
        <div className="wf2-divider" />
        <button onClick={() => addFramePreset('mobile')}>MOBILE</button>
        <button onClick={() => addFramePreset('tablet')}>TABLET</button>
        <button onClick={() => addFramePreset('desktop')}>DESKTOP</button>
        <div className="wf2-grow" />
        <button onClick={() => setGridSnap((value) => !value)} className={gridSnap ? 'active subtle' : ''}>SNAP {gridSnap ? 'ON' : 'OFF'}</button>
        <button onClick={fitSelection}>FIT</button>
        <button onClick={() => setCamera((value) => ({ ...value, zoom: clamp(value.zoom - 0.1, 0.2, 2.5) }))}>−</button>
        <span className="wf2-zoom">{Math.round(camera.zoom * 100)}%</span>
        <button onClick={() => setCamera((value) => ({ ...value, zoom: clamp(value.zoom + 0.1, 0.2, 2.5) }))}>+</button>
        <button className="wf2-play" onClick={startPlay} disabled={!frames.length}>▶ PLAY</button>
      </header>

      <aside className="wf2-ui wf2-leftpanel">
        <div className="wf2-paneltitle">LAYERS <span>{doc.items.length}</span></div>
        {[...doc.items].reverse().map((item) => (
          <div key={item.id} className={`wf2-layer ${selected.includes(item.id) ? 'selected' : ''}`} onClick={() => setSelected([item.id])}>
            <button onClick={(event) => { event.stopPropagation(); patchItems((items) => items.map((entry) => entry.id === item.id ? { ...entry, visible: !entry.visible } : entry)); }}>{item.visible ? '◉' : '○'}</button>
            <span>{item.type === 'frame' ? '▣' : item.type === 'component' ? '◆' : '◇'} {item.name}</span>
            <button onClick={(event) => { event.stopPropagation(); patchItems((items) => items.map((entry) => entry.id === item.id ? { ...entry, locked: !entry.locked } : entry)); }}>{item.locked ? '🔒' : '·'}</button>
          </div>
        ))}
        <div className="wf2-paneltitle wf2-components-title">COMPONENTS</div>
        <button className="wf2-wide" onClick={() => setComponentPanel((value) => !value)}>COMPONENT LIBRARY</button>
        {doc.components.map((component) => (
          <button className="wf2-componentquick" key={component.id} onClick={() => addComponentInstance(component.id)}>＋ {component.name}</button>
        ))}
      </aside>

      <section className="wf2-canvas">
        <div className="wf2-world" style={{ width: WORLD_W, height: WORLD_H, transform: `translate(${camera.x}px, ${camera.y}px) scale(${camera.zoom})` }}>
          {guides.x !== null && <div className="wf2-guide-v" style={{ left: guides.x }} />}
          {guides.y !== null && <div className="wf2-guide-h" style={{ top: guides.y }} />}
          {marquee && <div className="wf2-marquee" style={{ left: marquee.x, top: marquee.y, width: marquee.w, height: marquee.h }} />}
          {doc.links.map((link) => {
            const source = doc.items.find((item) => item.id === link.sourceItemId);
            const target = doc.items.find((item) => item.id === link.targetItemId);
            if (!source || !target) return null;
            const x1 = source.x + source.w / 2;
            const y1 = source.y + source.h / 2;
            const x2 = target.x + target.w / 2;
            const y2 = target.y + target.h / 2;
            const width = Math.hypot(x2 - x1, y2 - y1);
            const angle = Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI;
            return <div className="wf2-protolink" key={link.id} style={{ left: x1, top: y1, width, transform: `rotate(${angle}deg)` }} />;
          })}
          {doc.items.filter((item) => item.visible).map((item) => {
            const comp = item.type === 'component' ? doc.components.find((entry) => entry.id === item.componentId) : undefined;
            const variant = comp?.variants[item.activeVariant ?? 'default'];
            const style: CSSProperties = {
              left: item.x,
              top: item.y,
              width: item.w,
              height: item.h,
              borderRadius: item.type === 'circle' ? '50%' : item.radius ?? undefined,
              background: item.type === 'component' ? variant?.bg : undefined,
              color: item.type === 'component' ? variant?.fg : undefined,
            };
            return (
              <div key={item.id} className={`wf2-item wf2-${item.type} ${selected.includes(item.id) ? 'selected' : ''} ${linkSource === item.id ? 'link-source' : ''}`} style={style} onMouseDown={(event) => onItemDown(event, item)}>
                {item.type === 'frame' && <div className="wf2-frame-label">{item.name} · {Math.round(item.w)}×{Math.round(item.h)}</div>}
                {(item.type === 'sticky' || item.type === 'stickyM') && <div className="wf2-text" contentEditable suppressContentEditableWarning onMouseDown={(event) => event.stopPropagation()} onBlur={(event) => updateSelected({ text: event.currentTarget.textContent ?? '' })}>{item.text}</div>}
                {item.type === 'component' && <span className="wf2-component-label">{variant?.label ?? item.name}</span>}
                {item.type !== 'frame' && item.type !== 'sticky' && item.type !== 'stickyM' && item.type !== 'component' && <span className="wf2-shape-label">{item.name}</span>}
                {selected.includes(item.id) && tool === 'select' && !item.locked && <div className="wf2-resize" onMouseDown={(event) => onResizeDown(event, item)} />}
              </div>
            );
          })}
        </div>
      </section>

      {tool === 'link' && <div className="wf2-ui wf2-linkhint">{linkSource ? 'Now click a destination frame' : 'Click any object to set the interaction source'}</div>}

      <aside className={`wf2-ui wf2-inspector ${inspectorOpen ? '' : 'collapsed'}`}>
        <button className="wf2-inspector-toggle" onClick={() => setInspectorOpen((value) => !value)}>{inspectorOpen ? '→' : '←'}</button>
        {inspectorOpen && (
          <>
            <div className="wf2-paneltitle">INSPECTOR</div>
            {!selectedOne && <div className="wf2-muted">Select one layer to edit exact geometry and responsive behavior.</div>}
            {selectedOne && (
              <>
                <label>NAME<input value={selectedOne.name} onChange={(event) => updateSelected({ name: event.target.value })} /></label>
                <div className="wf2-grid2">
                  <label>X<input type="number" value={Math.round(selectedOne.x)} onChange={(event) => updateSelected({ x: Number(event.target.value) })} /></label>
                  <label>Y<input type="number" value={Math.round(selectedOne.y)} onChange={(event) => updateSelected({ y: Number(event.target.value) })} /></label>
                  <label>W<input type="number" value={Math.round(selectedOne.w)} onChange={(event) => updateSelected({ w: Math.max(20, Number(event.target.value)) })} /></label>
                  <label>H<input type="number" value={Math.round(selectedOne.h)} onChange={(event) => updateSelected({ h: Math.max(20, Number(event.target.value)) })} /></label>
                </div>
                {selectedOne.type !== 'frame' && (
                  <>
                    <div className="wf2-paneltitle small">RESPONSIVE CONSTRAINTS</div>
                    <label>HORIZONTAL<select value={selectedOne.hConstraint ?? 'left'} onChange={(event) => updateSelected({ hConstraint: event.target.value as HConstraint })}><option value="left">Left</option><option value="right">Right</option><option value="left-right">Left + Right</option><option value="center">Center</option><option value="scale">Scale</option></select></label>
                    <label>VERTICAL<select value={selectedOne.vConstraint ?? 'top'} onChange={(event) => updateSelected({ vConstraint: event.target.value as VConstraint })}><option value="top">Top</option><option value="bottom">Bottom</option><option value="top-bottom">Top + Bottom</option><option value="center">Center</option><option value="scale">Scale</option></select></label>
                    <label>PARENT FRAME<select value={selectedOne.parentFrameId ?? ''} onChange={(event) => updateSelected({ parentFrameId: event.target.value || undefined })}><option value="">Auto / none</option>{frames.map((frame) => <option key={frame.id} value={frame.id}>{frame.name}</option>)}</select></label>
                  </>
                )}
                {selectedOne.type === 'component' && (
                  <label>STATE<select value={selectedOne.activeVariant ?? 'default'} onChange={(event) => updateSelected({ activeVariant: event.target.value as ComponentVariantName })}><option value="default">Default</option><option value="hover">Hover</option><option value="pressed">Pressed</option></select></label>
                )}
                <div className="wf2-actions"><button onClick={duplicateSelection}>DUPLICATE</button><button onClick={deleteSelection}>DELETE</button></div>
              </>
            )}
            <div className="wf2-paneltitle small">ALIGN / DISTRIBUTE</div>
            <div className="wf2-aligngrid">
              <button disabled={selectedItems.length < 2} onClick={() => align('left')}>L</button><button disabled={selectedItems.length < 2} onClick={() => align('centerX')}>CX</button><button disabled={selectedItems.length < 2} onClick={() => align('right')}>R</button>
              <button disabled={selectedItems.length < 2} onClick={() => align('top')}>T</button><button disabled={selectedItems.length < 2} onClick={() => align('centerY')}>CY</button><button disabled={selectedItems.length < 2} onClick={() => align('bottom')}>B</button>
              <button disabled={selectedItems.length < 3} onClick={() => distribute('h')}>DIST H</button><button disabled={selectedItems.length < 3} onClick={() => distribute('v')}>DIST V</button>
            </div>
            <div className="wf2-paneltitle small">DOCUMENT</div>
            <button className="wf2-wide" onClick={exportJson}>EXPORT PROTOTYPE JSON</button>
            <div className="wf2-shortcuts">V select · F frame · R rect · O ellipse · T text · P play · ⌘/Ctrl+D duplicate · ⌘/Ctrl+0 fit</div>
          </>
        )}
      </aside>

      <div className="wf2-ui wf2-history"><button onClick={undo} disabled={!past.current.length}>UNDO</button><button onClick={redo} disabled={!future.current.length}>REDO</button></div>

      {componentPanel && (
        <div className="wf2-ui wf2-componentpanel">
          <div className="wf2-paneltitle">COMPONENT LIBRARY <button onClick={() => setComponentPanel(false)}>×</button></div>
          {doc.components.map((component) => (
            <div className="wf2-componentcard" key={component.id}>
              <strong>{component.name}</strong>
              <div className="wf2-variantrow">{(['default', 'hover', 'pressed'] as ComponentVariantName[]).map((variantName) => <span key={variantName} style={{ background: component.variants[variantName].bg, color: component.variants[variantName].fg }}>{component.variants[variantName].label}</span>)}</div>
              <button onClick={() => addComponentInstance(component.id)}>ADD INSTANCE</button>
            </div>
          ))}
        </div>
      )}

      {playingFrame && (
        <div className="wf2-playoverlay wf2-ui">
          <div className="wf2-playbar"><button onClick={() => { const previous = playStack.at(-1); if (previous) { setPlaying(previous); setPlayStack((stack) => stack.slice(0, -1)); } }} disabled={!playStack.length}>← BACK</button><span>{playingFrame.name}</span><button onClick={() => setPlaying(null)}>EXIT PREVIEW</button></div>
          <div className="wf2-device" style={{ width: Math.min(playingFrame.w, 900), aspectRatio: `${playingFrame.w}/${playingFrame.h}` }}>
            {frameChildren.map((child) => {
              const left = ((child.x - playingFrame.x) / playingFrame.w) * 100;
              const top = ((child.y - playingFrame.y) / playingFrame.h) * 100;
              const width = (child.w / playingFrame.w) * 100;
              const height = (child.h / playingFrame.h) * 100;
              const comp = child.type === 'component' ? doc.components.find((entry) => entry.id === child.componentId) : undefined;
              const variant = comp?.variants[child.activeVariant ?? 'default'];
              return <button key={child.id} className={`wf2-previewitem ${child.type}`} style={{ left: `${left}%`, top: `${top}%`, width: `${width}%`, height: `${height}%`, background: variant?.bg, color: variant?.fg }} onClick={() => playNavigate(child.id)}>{child.type === 'component' ? variant?.label : child.text ?? child.name}</button>;
            })}
            <button className="wf2-previewframeclick" onClick={() => playNavigate(playingFrame.id)}>FRAME HOTSPOT</button>
          </div>
        </div>
      )}
    </div>
  );
}
