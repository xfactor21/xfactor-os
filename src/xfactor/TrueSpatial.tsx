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

const PlasmaSurface = Plasma as any;

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
      background={matter ? '#05070a' : '#07020a'}
      opacity={matter ? 0.84 : 0.86}
      frost={matter ? (material === 'crystal' ? 0.2 : 0.02) : 0.015}
      blend={matter ? 34 : Math.max(78, plasma.blend)}
      viscosity={matter ? 0.38 : 0.065}
      stretch={matter ? 0.72 : 4.35}
      flow={matter ? 0.18 : 1.18}
      tension={matter ? 0.1 : 0.36}
      refraction={matter ? 1.42 : 2.08}
      dispersion={matter ? 1.28 : 1.86}
      rimColor="iridescent"
      rimWidth={matter ? 0.9 : 0.82}
      highlight={matter ? 1.38 : 1.95}
      edgeLine={matter ? 0.62 : 0.34}
      shimmer={matter ? 0.72 : 2.15}
      shimmerSpeed={matter ? 0.95 : 1.55}
      glow={matter ? 1.22 : 2.2}
      wash={matter ? 0.82 : 1.08}
      grain={0.08}
      formIn
      formSpeed={1.5}
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

  return <PlasmaSurface
    as={as}
    className={classes}
    fuse={fuse ?? true}
    group={group}
    lean={mode === 'plasma' ? 18 : 6}
    radius={radius ?? (mode === 'plasma' ? 30 : 10)}
    padding={0}
    tint={tint}
    opacity={mode === 'plasma' ? 0.9 : undefined}
    frost={mode === 'plasma' ? 0.01 : undefined}
    elevation={elevation ?? (mode === 'plasma' ? 0.58 : 0.46)}
    {...rest}
  >
    {children}
  </PlasmaSurface>;
}
