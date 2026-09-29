import type { Offset } from '@cruxgarden/plasma-ui';

export type PointerMomentum = {
  x: number;
  y: number;
  time: number;
  vx: number;
  vy: number;
};

export function beginMomentum(x: number, y: number, time = performance.now()): PointerMomentum {
  return { x, y, time, vx: 0, vy: 0 };
}

export function sampleMomentum(previous: PointerMomentum, x: number, y: number, time = performance.now()): PointerMomentum {
  const dt = Math.max(8, time - previous.time);
  const instantVx = (x - previous.x) / dt;
  const instantVy = (y - previous.y) / dt;
  return {
    x,
    y,
    time,
    vx: previous.vx * 0.48 + instantVx * 0.52,
    vy: previous.vy * 0.48 + instantVy * 0.52,
  };
}

export function momentumTarget(
  settled: Offset,
  momentum: PointerMomentum | undefined,
  bounds: DOMRect | undefined,
  surface: { width: number; height: number },
  strength = 430,
): Offset {
  if (!momentum) return settled;
  const speed = Math.hypot(momentum.vx, momentum.vy);
  if (speed < 0.07) return settled;

  const multiplier = Math.min(strength, 122 + speed * 148);
  let x = settled.x + momentum.vx * multiplier;
  let y = settled.y + momentum.vy * multiplier;

  if (bounds) {
    x = Math.max(0, Math.min(Math.max(0, bounds.width - surface.width), x));
    y = Math.max(0, Math.min(Math.max(0, bounds.height - surface.height), y));
  }

  return { x, y };
}

export function joinedAny(joined: boolean): boolean {
  return joined;
}
