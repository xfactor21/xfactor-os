import { DrawEngine } from './DrawEngine';

type Selection = NonNullable<DrawEngine['selection']>;
type InternalLayer = { meta: { id: string; name: string; opacity: number; blendMode: string; locked: boolean }; canvas: HTMLCanvasElement };
type InternalEngine = DrawEngine & {
  layers: InternalLayer[];
  pushHistory: () => void;
  onLayersChange: (() => void) | null;
  onHistoryChange: (() => void) | null;
};

const engines = new WeakMap<HTMLCanvasElement, DrawEngine>();
let installed = false;
let constructorsPatched = false;

function register(engine: DrawEngine) {
  engines.set(engine.display, engine);
  engine.display.dataset.drawProEngine = 'ready';
  return engine;
}

function patchConstructors() {
  if (constructorsPatched) return;
  constructorsPatched = true;

  const blank = DrawEngine.blank.bind(DrawEngine);
  DrawEngine.blank = ((display: HTMLCanvasElement, width: number, height: number) => register(blank(display, width, height))) as typeof DrawEngine.blank;

  const fromDocument = DrawEngine.fromDocument.bind(DrawEngine);
  DrawEngine.fromDocument = (async (display: HTMLCanvasElement, doc: Parameters<typeof DrawEngine.fromDocument>[1]) => register(await fromDocument(display, doc))) as typeof DrawEngine.fromDocument;
}

function activeEngine(): InternalEngine | null {
  const canvas = document.querySelector<HTMLCanvasElement>('#dpRoot canvas');
  return (canvas ? engines.get(canvas) : null) as InternalEngine | null;
}

function editableTarget(target: EventTarget | null) {
  const el = target as HTMLElement | null;
  return !!el?.closest('input, textarea, select, [contenteditable="true"]');
}

function clippedPixels(engine: InternalEngine, selection: Selection, layer: InternalLayer) {
  const temp = document.createElement('canvas');
  temp.width = engine.width;
  temp.height = engine.height;
  const ctx = temp.getContext('2d')!;
  ctx.drawImage(layer.canvas, 0, 0);
  ctx.globalCompositeOperation = 'destination-in';
  ctx.drawImage(selection.maskCanvas, 0, 0);
  return temp;
}

function eraseSelection(layer: InternalLayer, selection: Selection) {
  const ctx = layer.canvas.getContext('2d')!;
  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  ctx.drawImage(selection.maskCanvas, 0, 0);
  ctx.restore();
}

function shiftedMask(engine: InternalEngine, selection: Selection, dx: number, dy: number) {
  const mask = document.createElement('canvas');
  mask.width = engine.width;
  mask.height = engine.height;
  mask.getContext('2d')!.drawImage(selection.maskCanvas, dx, dy);
  return mask;
}

function nudgeSelection(dx: number, dy: number) {
  const engine = activeEngine();
  const selection = engine?.selection;
  const layer = engine?.activeLayer() as InternalLayer | null | undefined;
  if (!engine || !selection || !layer || layer.meta.locked) return false;

  const b = selection.bounds;
  const safeDx = Math.max(-b.x, Math.min(engine.width - (b.x + b.w), dx));
  const safeDy = Math.max(-b.y, Math.min(engine.height - (b.y + b.h), dy));
  if (!safeDx && !safeDy) return true;

  engine.pushHistory();
  const pixels = clippedPixels(engine, selection, layer);
  eraseSelection(layer, selection);
  layer.canvas.getContext('2d')!.drawImage(pixels, safeDx, safeDy);
  engine.selection = {
    maskCanvas: shiftedMask(engine, selection, safeDx, safeDy),
    bounds: { x: b.x + safeDx, y: b.y + safeDy, w: b.w, h: b.h },
  };
  engine.composite();
  engine.onHistoryChange?.();
  return true;
}

function flipSelection(axis: 'horizontal' | 'vertical') {
  const engine = activeEngine();
  const selection = engine?.selection;
  const layer = engine?.activeLayer() as InternalLayer | null | undefined;
  if (!engine || !selection || !layer || layer.meta.locked) return;

  engine.pushHistory();
  const pixels = clippedPixels(engine, selection, layer);
  eraseSelection(layer, selection);
  const b = selection.bounds;
  const ctx = layer.canvas.getContext('2d')!;
  ctx.save();
  if (axis === 'horizontal') {
    ctx.translate(2 * b.x + b.w, 0);
    ctx.scale(-1, 1);
  } else {
    ctx.translate(0, 2 * b.y + b.h);
    ctx.scale(1, -1);
  }
  ctx.drawImage(pixels, 0, 0);
  ctx.restore();

  const mask = document.createElement('canvas');
  mask.width = engine.width;
  mask.height = engine.height;
  const mctx = mask.getContext('2d')!;
  mctx.save();
  if (axis === 'horizontal') {
    mctx.translate(2 * b.x + b.w, 0);
    mctx.scale(-1, 1);
  } else {
    mctx.translate(0, 2 * b.y + b.h);
    mctx.scale(1, -1);
  }
  mctx.drawImage(selection.maskCanvas, 0, 0);
  mctx.restore();
  engine.selection = { maskCanvas: mask, bounds: { ...b } };
  engine.composite();
  engine.onHistoryChange?.();
}

function selectionToLayer() {
  const engine = activeEngine();
  const selection = engine?.selection;
  const source = engine?.activeLayer() as InternalLayer | null | undefined;
  if (!engine || !selection || !source) return;

  const pixels = clippedPixels(engine, selection, source);
  engine.addLayer(`${source.meta.name} selection`);
  const target = engine.activeLayer() as InternalLayer | null;
  if (!target) return;
  target.canvas.getContext('2d')!.drawImage(pixels, 0, 0);
  engine.composite();
  engine.onLayersChange?.();
}

function clearSelectedPixels() {
  const engine = activeEngine();
  const selection = engine?.selection;
  const layer = engine?.activeLayer() as InternalLayer | null | undefined;
  if (!engine || !selection || !layer || layer.meta.locked) return;
  engine.pushHistory();
  eraseSelection(layer, selection);
  engine.composite();
  engine.onHistoryChange?.();
}

function mergeDown() {
  const engine = activeEngine();
  if (!engine) return;
  const idx = engine.layers.findIndex((l) => l.meta.id === engine.activeLayerId);
  if (idx <= 0) return;
  const top = engine.layers[idx];
  const bottom = engine.layers[idx - 1];
  if (top.meta.locked || bottom.meta.locked) return;

  engine.pushHistory();
  const ctx = bottom.canvas.getContext('2d')!;
  ctx.save();
  ctx.globalAlpha = top.meta.opacity;
  ctx.globalCompositeOperation = (top.meta.blendMode === 'normal' ? 'source-over' : top.meta.blendMode) as GlobalCompositeOperation;
  ctx.drawImage(top.canvas, 0, 0);
  ctx.restore();
  engine.layers.splice(idx, 1);
  engine.activeLayerId = bottom.meta.id;
  engine.composite();
  engine.onLayersChange?.();
}

function duplicateActiveLayer() {
  const engine = activeEngine();
  if (!engine) return;
  engine.duplicateLayer(engine.activeLayerId);
}

function button(label: string, action: string, title: string) {
  const el = document.createElement('button');
  el.className = 'chip draw-pro-action';
  el.type = 'button';
  el.dataset.drawProAction = action;
  el.title = title;
  el.textContent = label;
  return el;
}

function mountToolbar() {
  const root = document.querySelector<HTMLElement>('#dpRoot');
  const topbar = root?.querySelector<HTMLElement>('#dpTopbar');
  if (!root || !topbar || root.querySelector('#dpProActions')) return;

  const group = document.createElement('div');
  group.id = 'dpProActions';
  group.setAttribute('aria-label', 'Selection and layer transforms');
  group.append(
    button('←', 'left', 'Nudge selection left · Arrow Left'),
    button('↑', 'up', 'Nudge selection up · Arrow Up'),
    button('↓', 'down', 'Nudge selection down · Arrow Down'),
    button('→', 'right', 'Nudge selection right · Arrow Right'),
    button('FLIP H', 'flip-h', 'Flip selected pixels horizontally'),
    button('FLIP V', 'flip-v', 'Flip selected pixels vertically'),
    button('SEL→LAYER', 'selection-layer', 'Duplicate selected pixels to a new layer'),
    button('CLEAR SEL', 'clear-selection', 'Clear pixels inside the current selection · Delete'),
    button('DUP LAYER', 'duplicate-layer', 'Duplicate active layer'),
    button('MERGE ↓', 'merge-down', 'Merge active layer into the layer below'),
  );
  topbar.append(group);
}

function runAction(action: string) {
  if (action === 'left') nudgeSelection(-1, 0);
  if (action === 'right') nudgeSelection(1, 0);
  if (action === 'up') nudgeSelection(0, -1);
  if (action === 'down') nudgeSelection(0, 1);
  if (action === 'flip-h') flipSelection('horizontal');
  if (action === 'flip-v') flipSelection('vertical');
  if (action === 'selection-layer') selectionToLayer();
  if (action === 'clear-selection') clearSelectedPixels();
  if (action === 'duplicate-layer') duplicateActiveLayer();
  if (action === 'merge-down') mergeDown();
}

export function installDrawProEnhancements() {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  patchConstructors();

  const observer = new MutationObserver(mountToolbar);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  mountToolbar();

  document.addEventListener('click', (event) => {
    const target = (event.target as Element | null)?.closest<HTMLElement>('[data-draw-pro-action]');
    if (!target) return;
    runAction(target.dataset.drawProAction ?? '');
  });

  document.addEventListener('keydown', (event) => {
    if (!document.querySelector('#dpRoot') || editableTarget(event.target)) return;
    const engine = activeEngine();
    if (!engine?.selection) return;

    const amount = event.shiftKey ? 10 : 1;
    if (event.key === 'ArrowLeft') { event.preventDefault(); nudgeSelection(-amount, 0); }
    if (event.key === 'ArrowRight') { event.preventDefault(); nudgeSelection(amount, 0); }
    if (event.key === 'ArrowUp') { event.preventDefault(); nudgeSelection(0, -amount); }
    if (event.key === 'ArrowDown') { event.preventDefault(); nudgeSelection(0, amount); }
    if (event.key === 'Delete' || event.key === 'Backspace') { event.preventDefault(); clearSelectedPixels(); }
  });
}
