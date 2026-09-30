import {
  createContext, createElement, useCallback, useContext, useEffect, useMemo, useState,
  type ElementType, type HTMLAttributes, type ReactNode,
} from 'react';
import { Plasma, PlasmaProvider, type Offset } from '@cruxgarden/plasma-ui';
import type { PlasmaController, SpatialMode } from './plasmaMode';

export type SpatialRoom = 'deck' | 'piles' | 'signal' | 'vault' | 'tape' | 'terminal' | 'lab' | 'files' | 'browser' | 'settings';
type MaterialName = 'plasma' | 'crystal' | 'metal' | 'wood' | 'stone' | 'cloud';
type Layout = Record<string, Offset>;

const ROOM_MATERIAL: Record<Exclude<SpatialRoom, 'signal' | 'browser' | 'files' | 'settings'>, MaterialName> = {
  deck: 'metal',
  piles: 'stone',
  vault: 'crystal',
  tape: 'wood',
  terminal: 'metal',
  lab: 'crystal',
};

const ROOM_BLEND: Partial<Record<SpatialRoom, number>> = {
  deck: 30,
  piles: 12,
  vault: 14,
  tape: 10,
  terminal: 8,
  lab: 14,
};

const NON_SPATIAL = new Set<SpatialRoom>(['signal', 'browser', 'files', 'settings']);
const PlasmaSurface = Plasma as any;
const LAYOUT_PREFIX = 'xfactor-m6-spatial-layout:';

type SpatialContextValue = {
  mode: SpatialMode;
  room: SpatialRoom;
  layout: Layout;
  setOffset: (id: string, offset: Offset) => void;
  nearest: (id: string) => string | undefined;
};

const SpatialContext = createContext<SpatialContextValue>({
  mode: 'normal',
  room: 'deck',
  layout: {},
  setOffset: () => undefined,
  nearest: () => undefined,
});

function tintFor(plasma: PlasmaController) {
  if (plasma.look === 'afterglow') return '#8b5cf6';
  if (plasma.look === 'pink-riot') return '#ff238d';
  return '#ff2aa3';
}

function loadLayout(room: SpatialRoom): Layout {
  try {
    return JSON.parse(localStorage.getItem(LAYOUT_PREFIX + room) || '{}') as Layout;
  } catch {
    return {};
  }
}

function safeSelector(id: string) {
  return id.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

/**
 * One provider per room stays mounted while NORMAL / PLASMA / MATTER changes.
 * That intentionally keeps the WebGL renderer warm instead of tearing down and
 * recompiling the entire room every time the user changes spatial state.
 */
export function SpatialRoomProvider({
  plasma,
  room,
  children,
}: {
  plasma: PlasmaController;
  room: SpatialRoom;
  children: ReactNode;
}) {
  const [layout, setLayout] = useState<Layout>(() => loadLayout(room));

  useEffect(() => setLayout(loadLayout(room)), [room]);
  useEffect(() => {
    try { localStorage.setItem(LAYOUT_PREFIX + room, JSON.stringify(layout)); } catch { /* device-local enhancement */ }
  }, [layout, room]);

  const setOffset = useCallback((id: string, offset: Offset) => {
    setLayout(current => ({ ...current, [id]: offset }));
  }, []);

  const nearest = useCallback((id: string) => {
    if (typeof document === 'undefined') return undefined;
    const node = document.querySelector<HTMLElement>(`[data-spatial-id="${safeSelector(id)}"]`);
    if (!node) return undefined;
    const rect = node.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    let winner: { id: string; distance: number } | undefined;
    document.querySelectorAll<HTMLElement>('[data-spatial-id]').forEach(other => {
      const otherId = other.dataset.spatialId;
      if (!otherId || otherId === id) return;
      const r = other.getBoundingClientRect();
      const dx = cx - (r.left + r.width / 2);
      const dy = cy - (r.top + r.height / 2);
      const distance = Math.hypot(dx, dy);
      if (!winner || distance < winner.distance) winner = { id: otherId, distance };
    });
    return winner?.id;
  }, []);

  const value = useMemo<SpatialContextValue>(
    () => ({ mode: plasma.mode, room, layout, setOffset, nearest }),
    [plasma.mode, room, layout, setOffset, nearest],
  );

  if (NON_SPATIAL.has(room)) {
    return <SpatialContext.Provider value={value}>{children}</SpatialContext.Provider>;
  }

  const matter = plasma.mode === 'matter';
  const material: MaterialName = matter ? ROOM_MATERIAL[room as keyof typeof ROOM_MATERIAL] : 'plasma';
  const roomBlend = ROOM_BLEND[room] ?? 14;

  return <SpatialContext.Provider value={value}>
    <PlasmaProvider
      mood={plasma.look === 'afterglow' ? 'tidal' : plasma.look === 'pink-riot' ? 'ember' : 'aurora'}
      theme="dark"
      material={material}
      tint={tintFor(plasma)}
      opacity={matter ? 0.74 : 0.68}
      frost={matter ? (material === 'crystal' ? 0.2 : 0.03) : 0.035}
      blend={matter ? Math.max(8, roomBlend - 3) : roomBlend}
      viscosity={matter ? 0.45 : 0.11}
      stretch={matter ? 0.5 : 3.0}
      flow={matter ? 0.1 : 0.78}
      tension={matter ? 0.09 : 0.25}
      refraction={matter ? 1.3 : 1.72}
      dispersion={matter ? 1.16 : 1.54}
      rimColor="iridescent"
      rimWidth={matter ? 1.1 : 2.15}
      highlight={matter ? 1.25 : 1.75}
      edgeLine={matter ? 0.8 : 1.15}
      shimmer={matter ? 0.5 : 1.72}
      shimmerSpeed={matter ? 0.8 : 1.35}
      glow={matter ? 1.05 : 1.8}
      wash={matter ? 0.68 : 0.86}
      grain={0.1}
      grid={24}
      magnet={matter ? 34 : 52}
      quality={1}
      maxSurfaces={28}
      pointerDrop={false}
      pointerPull
      ambientDrops={false}
      ground="clear"
      zIndex={18}
      formIn={false}
      formOut={false}
    >
      {children}
    </PlasmaProvider>
  </SpatialContext.Provider>;
}

export function resetSpatialRoomLayouts() {
  if (typeof localStorage === 'undefined') return;
  for (const room of ['deck', 'piles', 'vault', 'tape', 'terminal', 'lab']) {
    localStorage.removeItem(LAYOUT_PREFIX + room);
  }
}

export function SpatialSurface({
  as = 'div',
  className,
  children,
  fuse,
  group,
  radius,
  tint,
  elevation,
  spatialId,
  movable = false,
  onSpatialJoin,
  ...rest
}: HTMLAttributes<HTMLElement> & {
  as?: ElementType;
  children?: ReactNode;
  fuse?: boolean;
  group?: string;
  radius?: number;
  tint?: string;
  elevation?: number;
  spatialId?: string;
  movable?: boolean;
  onSpatialJoin?: (selfId: string, otherId: string) => void;
}) {
  const { mode, layout, setOffset, nearest } = useContext(SpatialContext);
  const classes = ['xf-true-spatial', movable ? 'xf-spatial-movable' : '', className].filter(Boolean).join(' ');

  if (mode === 'normal') {
    return createElement(as, { ...rest, className, 'data-spatial-id': spatialId }, children);
  }

  const offset = spatialId ? layout[spatialId] : undefined;

  return <PlasmaSurface
    as={as}
    className={classes}
    data-spatial-id={spatialId}
    fuse={fuse ?? true}
    group={group}
    lean={mode === 'plasma' ? 15 : 5}
    radius={radius ?? (mode === 'plasma' ? 28 : 10)}
    padding={0}
    tint={tint}
    elevation={elevation ?? (mode === 'plasma' ? 0.56 : 0.42)}
    draggable={movable}
    snap={movable}
    offset={movable ? offset : undefined}
    onDragEnd={movable && spatialId ? (next: Offset) => setOffset(spatialId, next) : undefined}
    onJoinChange={spatialId && onSpatialJoin ? (joined: boolean) => {
      if (!joined) return;
      window.setTimeout(() => {
        const otherId = nearest(spatialId);
        if (otherId) onSpatialJoin(spatialId, otherId);
      }, 0);
    } : undefined}
    {...rest}
  >
    <div className="xf-spatial-content">{children}</div>
  </PlasmaSurface>;
}
