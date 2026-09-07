import { GIFEncoder, quantize, applyPalette } from 'gifenc';

export type AnimObjType = 'rect' | 'ellipse' | 'text' | 'bone';
export type EaseType = 'linear' | 'easeIn' | 'easeOut' | 'easeInOut';
export type AnimProp = 'x' | 'y' | 'rotation' | 'scaleX' | 'scaleY' | 'opacity';
export const ANIM_PROPS: AnimProp[] = ['x', 'y', 'rotation', 'scaleX', 'scaleY', 'opacity'];

export interface AnimKeyframe {
  frame: number;
  value: number;
  ease: EaseType;
}

export interface AnimObject {
  id: string;
  type: AnimObjType;
  name: string;
  w: number;
  h: number;
  fill: string;
  text?: string;
  fontSize?: number;
  visible: boolean;
  locked?: boolean;
  parentId?: string | null;
  length?: number;
  keys: Record<AnimProp, AnimKeyframe[]>;
}

export interface AnimDocument {
  fps: number;
  frameCount: number;
  loop: boolean;
  onionSkin: boolean;
  onionRange: number;
  objects: AnimObject[];
  width: number;
  height: number;
  workStart?: number;
  workEnd?: number;
}

export interface KeyframeClipboard {
  sourceFrame: number;
  values: Partial<Record<AnimProp, AnimKeyframe>>;
}

const DEG2RAD = Math.PI / 180;
const MAX_HISTORY = 80;

function defaultKeys(x: number, y: number): Record<AnimProp, AnimKeyframe[]> {
  return {
    x: [{ frame: 0, value: x, ease: 'linear' }],
    y: [{ frame: 0, value: y, ease: 'linear' }],
    rotation: [{ frame: 0, value: 0, ease: 'linear' }],
    scaleX: [{ frame: 0, value: 1, ease: 'linear' }],
    scaleY: [{ frame: 0, value: 1, ease: 'linear' }],
    opacity: [{ frame: 0, value: 1, ease: 'linear' }],
  };
}

function ease(t: number, type: EaseType): number {
  switch (type) {
    case 'easeIn': return t * t;
    case 'easeOut': return 1 - (1 - t) * (1 - t);
    case 'easeInOut': return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    default: return t;
  }
}

let idc = 0;
function nid(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${++idc}`;
}

export function docKey(boardId: string) {
  return `xos-studio-anim-${boardId}`;
}

export function defaultDocument(): AnimDocument {
  return { fps: 24, frameCount: 60, loop: true, onionSkin: false, onionRange: 1, objects: [], width: 900, height: 560, workStart: 0, workEnd: 59 };
}

function normalizeDocument(input: AnimDocument): AnimDocument {
  const doc: AnimDocument = {
    ...defaultDocument(),
    ...input,
    objects: Array.isArray(input.objects) ? input.objects.map((o) => ({ ...o, visible: o.visible !== false, locked: !!o.locked })) : [],
  };
  doc.frameCount = Math.max(2, Math.round(doc.frameCount || 60));
  doc.fps = Math.max(1, Math.min(60, Math.round(doc.fps || 24)));
  doc.workStart = Math.max(0, Math.min(doc.frameCount - 1, Math.round(doc.workStart ?? 0)));
  doc.workEnd = Math.max(doc.workStart, Math.min(doc.frameCount - 1, Math.round(doc.workEnd ?? doc.frameCount - 1)));
  return doc;
}

export class AnimationEngine {
  doc: AnimDocument;
  private history: string[] = [];
  private future: string[] = [];
  private boardId: string;

  constructor(boardId: string, doc?: AnimDocument) {
    this.boardId = boardId;
    this.doc = normalizeDocument(doc ?? defaultDocument());
  }

  static load(boardId: string): AnimationEngine {
    try {
      const raw = localStorage.getItem(docKey(boardId));
      if (raw) return new AnimationEngine(boardId, JSON.parse(raw) as AnimDocument);
    } catch {
      /* ignore corrupt storage */
    }
    return new AnimationEngine(boardId);
  }

  persist() {
    try { localStorage.setItem(docKey(this.boardId), JSON.stringify(this.doc)); } catch { /* best effort */ }
  }

  private snapshot() {
    this.history.push(JSON.stringify(this.doc));
    if (this.history.length > MAX_HISTORY) this.history.shift();
    this.future = [];
  }

  checkpoint(mutator: () => void) {
    this.snapshot();
    mutator();
    this.doc = normalizeDocument(this.doc);
    this.persist();
  }

  canUndo() { return this.history.length > 0; }
  canRedo() { return this.future.length > 0; }
  undo() {
    if (!this.history.length) return;
    this.future.push(JSON.stringify(this.doc));
    this.doc = normalizeDocument(JSON.parse(this.history.pop()!) as AnimDocument);
    this.persist();
  }
  redo() {
    if (!this.future.length) return;
    this.history.push(JSON.stringify(this.doc));
    this.doc = normalizeDocument(JSON.parse(this.future.pop()!) as AnimDocument);
    this.persist();
  }

  addShape(type: 'rect' | 'ellipse' | 'text', x: number, y: number): AnimObject {
    this.snapshot();
    const obj: AnimObject = {
      id: nid('ao'), type, name: `${type[0].toUpperCase()}${type.slice(1)} ${this.doc.objects.length + 1}`,
      w: type === 'text' ? 160 : 90, h: type === 'text' ? 30 : 90,
      fill: type === 'text' ? '#00F5FF' : ['#00F5FF', '#FF2D78', '#9D4EDD', '#FFB000'][this.doc.objects.length % 4],
      text: type === 'text' ? 'Text' : undefined, fontSize: 22, visible: true, locked: false, keys: defaultKeys(x, y),
    };
    this.doc.objects.push(obj); this.persist(); return obj;
  }

  addBone(x: number, y: number, parentId: string | null = null): AnimObject {
    this.snapshot();
    let originX = x, originY = y, length = 90;
    if (parentId) {
      const parent = this.find(parentId);
      if (parent) { const w = this.boneWorld(parent, 0); originX = w.tipX; originY = w.tipY; length = parent.length ?? 90; }
    }
    const obj: AnimObject = {
      id: nid('bone'), type: 'bone', name: `Bone ${this.doc.objects.filter((o) => o.type === 'bone').length + 1}`,
      w: 0, h: 0, fill: '#FFB000', visible: true, locked: false, parentId, length, keys: defaultKeys(originX, originY),
    };
    this.doc.objects.push(obj); this.persist(); return obj;
  }

  find(id: string) { return this.doc.objects.find((o) => o.id === id); }

  removeObject(id: string) {
    this.snapshot();
    const removed = this.find(id);
    const removedParent = removed?.parentId ?? null;
    this.doc.objects = this.doc.objects.filter((o) => o.id !== id).map((o) => (o.parentId === id ? { ...o, parentId: removedParent } : o));
    this.persist();
  }

  duplicateObject(id: string): AnimObject | null {
    const source = this.find(id); if (!source) return null;
    this.snapshot();
    const copy = JSON.parse(JSON.stringify(source)) as AnimObject;
    copy.id = nid(source.type === 'bone' ? 'bone' : 'ao');
    copy.name = `${source.name} copy`;
    if (!copy.parentId) {
      for (const p of ['x', 'y'] as AnimProp[]) copy.keys[p] = copy.keys[p].map((k) => ({ ...k, value: k.value + 20 }));
    }
    this.doc.objects.push(copy); this.persist(); return copy;
  }

  renameObject(id: string, name: string) { this.checkpoint(() => { const o = this.find(id); if (o) o.name = name.trim() || o.name; }); }
  setObjectVisible(id: string, visible: boolean) { this.checkpoint(() => { const o = this.find(id); if (o) o.visible = visible; }); }
  setObjectLocked(id: string, locked: boolean) { this.checkpoint(() => { const o = this.find(id); if (o) o.locked = locked; }); }
  moveObjectLayer(id: string, delta: -1 | 1) {
    this.checkpoint(() => {
      const i = this.doc.objects.findIndex((o) => o.id === id); const j = i + delta;
      if (i < 0 || j < 0 || j >= this.doc.objects.length) return;
      [this.doc.objects[i], this.doc.objects[j]] = [this.doc.objects[j], this.doc.objects[i]];
    });
  }

  setDuration(frameCount: number) {
    const next = Math.max(2, Math.min(3600, Math.round(frameCount)));
    this.checkpoint(() => {
      this.doc.frameCount = next;
      for (const o of this.doc.objects) for (const p of ANIM_PROPS) o.keys[p] = o.keys[p].filter((k) => k.frame < next);
      this.doc.workStart = Math.min(this.doc.workStart ?? 0, next - 1);
      this.doc.workEnd = Math.min(this.doc.workEnd ?? next - 1, next - 1);
      if ((this.doc.workEnd ?? 0) < (this.doc.workStart ?? 0)) this.doc.workStart = this.doc.workEnd;
    });
  }

  setWorkArea(start: number, end: number) {
    this.checkpoint(() => {
      const a = Math.max(0, Math.min(this.doc.frameCount - 1, Math.round(start)));
      const b = Math.max(a, Math.min(this.doc.frameCount - 1, Math.round(end)));
      this.doc.workStart = a; this.doc.workEnd = b;
    });
  }

  getValue(obj: AnimObject, prop: AnimProp, frame: number): number {
    const kfs = obj.keys[prop];
    if (!kfs?.length) return prop === 'scaleX' || prop === 'scaleY' || prop === 'opacity' ? 1 : 0;
    if (frame <= kfs[0].frame) return kfs[0].value;
    const last = kfs[kfs.length - 1]; if (frame >= last.frame) return last.value;
    for (let i = 0; i < kfs.length - 1; i++) {
      const a = kfs[i], b = kfs[i + 1];
      if (frame >= a.frame && frame <= b.frame) {
        const t = (frame - a.frame) / Math.max(1, b.frame - a.frame);
        return a.value + (b.value - a.value) * ease(t, b.ease);
      }
    }
    return last.value;
  }

  hasKeyAt(obj: AnimObject, prop: AnimProp, frame: number) { return !!obj.keys[prop]?.some((k) => k.frame === frame); }
  hasAnyKeyAt(obj: AnimObject, frame: number) { return ANIM_PROPS.some((p) => this.hasKeyAt(obj, p, frame)); }
  allKeyframedFrames(obj: AnimObject) {
    const set = new Set<number>(); for (const p of ANIM_PROPS) for (const k of obj.keys[p] ?? []) set.add(k.frame);
    return Array.from(set).sort((a, b) => a - b);
  }

  setKeyframe(objId: string, prop: AnimProp, frame: number, value: number, easeType: EaseType = 'linear') {
    const obj = this.find(objId); if (!obj) return;
    this.snapshot();
    const kfs = obj.keys[prop], idx = kfs.findIndex((k) => k.frame === frame);
    if (idx >= 0) kfs[idx] = { frame, value, ease: easeType }; else { kfs.push({ frame, value, ease: easeType }); kfs.sort((a, b) => a.frame - b.frame); }
    this.persist();
  }

  setAllKeyframes(objId: string, frame: number, easeType: EaseType = 'linear') {
    const obj = this.find(objId); if (!obj) return;
    this.snapshot();
    for (const prop of ANIM_PROPS) {
      const value = this.getValue(obj, prop, frame), kfs = obj.keys[prop], idx = kfs.findIndex((k) => k.frame === frame);
      if (idx >= 0) kfs[idx] = { frame, value, ease: easeType }; else kfs.push({ frame, value, ease: easeType });
      kfs.sort((a, b) => a.frame - b.frame);
    }
    this.persist();
  }

  removeKeyframe(objId: string, prop: AnimProp, frame: number) {
    const obj = this.find(objId); if (!obj || obj.keys[prop].length <= 1) return;
    this.snapshot(); obj.keys[prop] = obj.keys[prop].filter((k) => k.frame !== frame); this.persist();
  }

  removeAllKeyframesAt(objId: string, frame: number) {
    const obj = this.find(objId); if (!obj) return;
    this.snapshot();
    for (const p of ANIM_PROPS) if (obj.keys[p].length > 1) obj.keys[p] = obj.keys[p].filter((k) => k.frame !== frame);
    this.persist();
  }

  copyKeyframesAt(objId: string, frame: number): KeyframeClipboard | null {
    const obj = this.find(objId); if (!obj) return null;
    const values: KeyframeClipboard['values'] = {};
    for (const p of ANIM_PROPS) { const k = obj.keys[p].find((x) => x.frame === frame); if (k) values[p] = { ...k }; }
    return Object.keys(values).length ? { sourceFrame: frame, values } : null;
  }

  pasteKeyframesAt(objId: string, frame: number, clip: KeyframeClipboard) {
    const obj = this.find(objId); if (!obj) return;
    this.snapshot();
    for (const p of ANIM_PROPS) {
      const src = clip.values[p]; if (!src) continue;
      const kfs = obj.keys[p], idx = kfs.findIndex((k) => k.frame === frame), next = { frame, value: src.value, ease: src.ease };
      if (idx >= 0) kfs[idx] = next; else kfs.push(next);
      kfs.sort((a, b) => a.frame - b.frame);
    }
    this.persist();
  }

  moveKeyframesAt(objId: string, fromFrame: number, toFrame: number) {
    const obj = this.find(objId); if (!obj || fromFrame === toFrame) return;
    const target = Math.max(0, Math.min(this.doc.frameCount - 1, Math.round(toFrame)));
    if (!this.hasAnyKeyAt(obj, fromFrame)) return;
    this.snapshot();
    for (const p of ANIM_PROPS) {
      const moving = obj.keys[p].find((k) => k.frame === fromFrame); if (!moving) continue;
      obj.keys[p] = obj.keys[p].filter((k) => k.frame !== fromFrame && k.frame !== target);
      obj.keys[p].push({ ...moving, frame: target }); obj.keys[p].sort((a, b) => a.frame - b.frame);
    }
    this.persist();
  }

  setEaseAt(objId: string, frame: number, easeType: EaseType) {
    const obj = this.find(objId); if (!obj) return;
    this.snapshot();
    for (const p of ANIM_PROPS) obj.keys[p] = obj.keys[p].map((k) => k.frame === frame ? { ...k, ease: easeType } : k);
    this.persist();
  }

  beginLiveEdit() { this.snapshot(); }
  pokeValue(objId: string, prop: AnimProp, frame: number, value: number) {
    const obj = this.find(objId); if (!obj) return;
    const kfs = obj.keys[prop], idx = kfs.findIndex((k) => k.frame === frame);
    if (idx >= 0) kfs[idx] = { ...kfs[idx], value }; else { kfs.push({ frame, value, ease: 'linear' }); kfs.sort((a, b) => a.frame - b.frame); }
  }
  commitLiveEdit() { this.persist(); }

  boneWorld(obj: AnimObject, frame: number): { originX: number; originY: number; angle: number; tipX: number; tipY: number } {
    const localAngle = this.getValue(obj, 'rotation', frame), length = obj.length ?? 90;
    if (!obj.parentId) {
      const originX = this.getValue(obj, 'x', frame), originY = this.getValue(obj, 'y', frame);
      return { originX, originY, angle: localAngle, tipX: originX + Math.cos(localAngle * DEG2RAD) * length, tipY: originY + Math.sin(localAngle * DEG2RAD) * length };
    }
    const parent = this.find(obj.parentId);
    if (!parent) {
      const originX = this.getValue(obj, 'x', frame), originY = this.getValue(obj, 'y', frame);
      return { originX, originY, angle: localAngle, tipX: originX + Math.cos(localAngle * DEG2RAD) * length, tipY: originY + Math.sin(localAngle * DEG2RAD) * length };
    }
    const pw = this.boneWorld(parent, frame), angle = pw.angle + localAngle;
    return { originX: pw.tipX, originY: pw.tipY, angle, tipX: pw.tipX + Math.cos(angle * DEG2RAD) * length, tipY: pw.tipY + Math.sin(angle * DEG2RAD) * length };
  }

  renderFrame(ctx: CanvasRenderingContext2D, frame: number, opts?: { tint?: string; alphaMul?: number }) {
    const alphaMul = opts?.alphaMul ?? 1;
    for (const obj of this.doc.objects) {
      if (!obj.visible) continue;
      const opacity = Math.max(0, Math.min(1, this.getValue(obj, 'opacity', frame))) * alphaMul; if (opacity <= 0.002) continue;
      ctx.save(); ctx.globalAlpha = opacity;
      if (obj.type === 'bone') {
        const w = this.boneWorld(obj, frame); ctx.strokeStyle = opts?.tint ?? obj.fill; ctx.lineWidth = 7; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(w.originX, w.originY); ctx.lineTo(w.tipX, w.tipY); ctx.stroke();
        ctx.fillStyle = opts?.tint ?? '#fff'; ctx.beginPath(); ctx.arc(w.originX, w.originY, 5, 0, Math.PI * 2); ctx.fill();
      } else {
        const x = this.getValue(obj, 'x', frame), y = this.getValue(obj, 'y', frame), rotation = this.getValue(obj, 'rotation', frame);
        const scaleX = this.getValue(obj, 'scaleX', frame), scaleY = this.getValue(obj, 'scaleY', frame);
        ctx.translate(x, y); ctx.rotate(rotation * DEG2RAD); ctx.scale(scaleX || 0.001, scaleY || 0.001); ctx.fillStyle = opts?.tint ?? obj.fill;
        if (obj.type === 'rect') ctx.fillRect(-obj.w / 2, -obj.h / 2, obj.w, obj.h);
        else if (obj.type === 'ellipse') { ctx.beginPath(); ctx.ellipse(0, 0, obj.w / 2, obj.h / 2, 0, 0, Math.PI * 2); ctx.fill(); }
        else { ctx.font = `${obj.fontSize ?? 22}px 'Share Tech Mono', monospace`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(obj.text || 'Text', 0, 0); }
      }
      ctx.restore();
    }
  }

  hitTest(px: number, py: number, frame: number): AnimObject | null {
    for (let i = this.doc.objects.length - 1; i >= 0; i--) {
      const obj = this.doc.objects[i]; if (!obj.visible || obj.locked) continue;
      if (obj.type === 'bone') { const w = this.boneWorld(obj, frame); if (distToSegment(px, py, w.originX, w.originY, w.tipX, w.tipY) < 14) return obj; }
      else {
        const x = this.getValue(obj, 'x', frame), y = this.getValue(obj, 'y', frame), rotation = this.getValue(obj, 'rotation', frame) * DEG2RAD;
        const scaleX = this.getValue(obj, 'scaleX', frame) || 0.001, scaleY = this.getValue(obj, 'scaleY', frame) || 0.001;
        const dx = px - x, dy = py - y, cos = Math.cos(-rotation), sin = Math.sin(-rotation);
        const lx = (dx * cos - dy * sin) / scaleX, ly = (dx * sin + dy * cos) / scaleY;
        if (Math.abs(lx) <= obj.w / 2 && Math.abs(ly) <= obj.h / 2) return obj;
      }
    }
    return null;
  }

  exportDocument(): Blob {
    return new Blob([JSON.stringify({ version: 2, boardId: this.boardId, document: this.doc }, null, 2)], { type: 'application/json' });
  }

  exportGif(): Blob {
    const { width, height, fps, loop } = this.doc, start = this.doc.workStart ?? 0, end = this.doc.workEnd ?? this.doc.frameCount - 1;
    const off = document.createElement('canvas'); off.width = width; off.height = height; const octx = off.getContext('2d')!;
    const gif = GIFEncoder(), delayMs = Math.round(1000 / fps);
    for (let f = start; f <= end; f++) {
      octx.clearRect(0, 0, width, height); octx.fillStyle = '#05080d'; octx.fillRect(0, 0, width, height); this.renderFrame(octx, f);
      const { data } = octx.getImageData(0, 0, width, height), palette = quantize(data, 256), index = applyPalette(data, palette);
      gif.writeFrame(index, width, height, { palette, delay: delayMs, repeat: loop ? 0 : -1 });
    }
    gif.finish(); return new Blob([gif.bytes() as BlobPart], { type: 'image/gif' });
  }

  exportSpriteSheet(): Promise<Blob> {
    const { width, height } = this.doc, start = this.doc.workStart ?? 0, end = this.doc.workEnd ?? this.doc.frameCount - 1, frameCount = end - start + 1;
    const cols = Math.ceil(Math.sqrt(frameCount)), rows = Math.ceil(frameCount / cols), sheet = document.createElement('canvas');
    sheet.width = width * cols; sheet.height = height * rows; const sctx = sheet.getContext('2d')!; sctx.fillStyle = '#05080d'; sctx.fillRect(0, 0, sheet.width, sheet.height);
    const off = document.createElement('canvas'); off.width = width; off.height = height; const octx = off.getContext('2d')!;
    for (let i = 0, f = start; f <= end; f++, i++) { octx.clearRect(0, 0, width, height); this.renderFrame(octx, f); sctx.drawImage(off, (i % cols) * width, Math.floor(i / cols) * height); }
    return new Promise((resolve, reject) => sheet.toBlob((blob) => blob ? resolve(blob) : reject(new Error('toBlob failed')), 'image/png'));
  }
}

function distToSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number) {
  const dx = x2 - x1, dy = y2 - y1, lenSq = dx * dx + dy * dy;
  let t = lenSq === 0 ? 0 : ((px - x1) * dx + (py - y1) * dy) / lenSq; t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}
