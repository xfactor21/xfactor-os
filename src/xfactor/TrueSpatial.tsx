import { createContext, createElement, useContext, type ElementType, type HTMLAttributes, type ReactNode } from 'react';
import { Plasma, PlasmaProvider } from '@cruxgarden/plasma-ui';
import type { PlasmaController, SpatialMode } from './plasmaMode';

export type SpatialRoom = 'deck' | 'piles' | 'signal' | 'vault' | 'tape' | 'terminal';

type MaterialName = 'plasma' | 'crystal' | 'metal' | 'wood' | 'stone' | 'cloud';

const ROOM_MATERIAL: Record<Exclude<SpatialRoom, 'signal'>, MaterialName> = {
  deck: 'metal',
  piles: 'stone',
  vault: 'crystal',
  tape: 'wood',
  terminal: 'metal',
};

const SpatialContext = createContext<{ mode: SpatialMode; room: SpatialRoom }>({ mode: 'normal', room: 'deck' });

function tintFor(plasma: PlasmaController) {
  if (plasma.look === 'afterglow') return '#8b5cf6';
  if (plasma.look === 'pink-riot') return '#ff238d';
  return '#ff2aa3';
}

export function SpatialRoomProvider({
  plasma,
  room,
  children,
}: {
  plasma: PlasmaController;
  room: SpatialRoom;
  children: ReactNode;
}) {
  const value = { mode: plasma.mode, room };

  if (plasma.mode === 'normal' || room === 'signal') {
    return <SpatialContext.Provider value={value}>{children}</SpatialContext.Provider>;
  }

  const material: MaterialName = plasma.mode === 'matter' ? ROOM_MATERIAL[room] : 'plasma';
  const matter = plasma.mode === 'matter';

  return <SpatialContext.Provider value={value}>
    <PlasmaProvider
      key={`${plasma.mode}:${room}:${plasma.look}`}
      mood={plasma.look === 'afterglow' ? 'tidal' : plasma.look === 'pink-riot' ? 'ember' : 'aurora'}
      theme="dark"
      material={material}
      tint={tintFor(plasma)}
      opacity={matter ? 0.72 : 0.64}
      frost={matter ? (material === 'crystal' ? 0.24 : 0.04) : 0.05}
      blend={matter ? 28 : Math.max(48, plasma.blend)}
      viscosity={matter ? 0.42 : 0.12}
      stretch={matter ? 0.55 : 2.8}
      flow={matter ? 0.12 : 0.72}
      tension={matter ? 0.08 : 0.22}
      refraction={matter ? 1.28 : 1.7}
      dispersion={matter ? 1.16 : 1.52}
      rimColor="iridescent"
      rimWidth={matter ? 1.15 : 2.1}
      highlight={matter ? 1.25 : 1.7}
      edgeLine={matter ? 0.8 : 1.2}
      shimmer={matter ? 0.55 : 1.65}
      shimmerSpeed={matter ? 0.8 : 1.35}
      glow={matter ? 1.05 : 1.75}
      wash={matter ? 0.7 : 0.86}
      grain={0.14}
      grid={24}
      magnet={matter ? 42 : 62}
      quality={1}
      maxSurfaces={24}
      pointerDrop={false}
      pointerPull
      ambientDrops={false}
      ground="clear"
      zIndex={18}
    >
      {children}
    </PlasmaProvider>
  </SpatialContext.Provider>;
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
  ...rest
}: HTMLAttributes<HTMLElement> & {
  as?: ElementType;
  children?: ReactNode;
  fuse?: boolean;
  group?: string;
  radius?: number;
  tint?: string;
  elevation?: number;
}) {
  const { mode } = useContext(SpatialContext);
  const classes = ['xf-true-spatial', className].filter(Boolean).join(' ');

  if (mode === 'normal') {
    return createElement(as, { ...rest, className }, children);
  }

  return <Plasma
    as={as as never}
    className={classes}
    fuse={fuse ?? true}
    group={group}
    lean={mode === 'plasma' ? 14 : 5}
    radius={radius ?? (mode === 'plasma' ? 26 : 10)}
    padding={0}
    tint={tint}
    elevation={elevation ?? (mode === 'plasma' ? 0.52 : 0.42)}
    {...rest}
  >
    {children}
  </Plasma>;
}
