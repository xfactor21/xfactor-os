import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export type PlasmaPolicy = 'session' | '30m' | 'remember';
export type PlasmaLook = 'neon-x' | 'pink-riot' | 'afterglow';
export type SpatialMode = 'normal' | 'plasma' | 'matter';
export type MatterMaterial = 'plasma' | 'crystal' | 'metal' | 'wood' | 'stone' | 'cloud';
export type MatterSlot = 'spark' | 'task' | 'note' | 'link' | 'doneTask';
export type MatterMap = Record<MatterSlot, MatterMaterial>;

export interface PlasmaAppearance {
  look: PlasmaLook;
  frost: number;
  blend: number;
  matterMap: MatterMap;
}

export interface PlasmaController extends PlasmaAppearance {
  active: boolean;
  mode: SpatialMode;
  policy: PlasmaPolicy;
  scopeId: string;
  transitioning: boolean;
  targetMode?: SpatialMode;
  activate: (policy?: PlasmaPolicy, mode?: Exclude<SpatialMode, 'normal'>) => void;
  deactivate: () => void;
  setMode: (mode: SpatialMode) => void;
  setPolicy: (policy: PlasmaPolicy) => void;
  setLook: (look: PlasmaLook) => void;
  setFrost: (value: number) => void;
  setBlend: (value: number) => void;
  setMatterMaterial: (slot: MatterSlot, material: MatterMaterial) => void;
  resetMatterMap: () => void;
}

const APPEARANCE_KEY = 'xfactor-plasma-appearance-v2';
const LEGACY_APPEARANCE_KEY = 'xfactor-plasma-appearance-v1';
const SESSION_PREFIX = 'xfactor-spatial-session-v2:';
const LEGACY_SESSION_PREFIX = 'xfactor-plasma-session-v1:';
const REMEMBER_PREFIX = 'xfactor-spatial-remember-v2:';
const LEGACY_REMEMBER_PREFIX = 'xfactor-plasma-remember-v1:';

export const DEFAULT_MATTER_MAP: MatterMap = {
  spark: 'cloud',
  task: 'metal',
  note: 'crystal',
  link: 'plasma',
  doneTask: 'stone',
};

const DEFAULT_APPEARANCE: PlasmaAppearance = {
  look: 'neon-x',
  frost: 0.22,
  blend: 26,
  matterMap: DEFAULT_MATTER_MAP,
};

const MATERIALS: MatterMaterial[] = ['plasma', 'crystal', 'metal', 'wood', 'stone', 'cloud'];

function isMaterial(value: unknown): value is MatterMaterial {
  return typeof value === 'string' && MATERIALS.includes(value as MatterMaterial);
}

function safeScope(scopeId?: string): string {
  return scopeId || 'global';
}

function readAppearance(): PlasmaAppearance {
  try {
    const raw = localStorage.getItem(APPEARANCE_KEY) || localStorage.getItem(LEGACY_APPEARANCE_KEY) || 'null';
    const parsed = JSON.parse(raw) as Partial<PlasmaAppearance> | null;
    const look = parsed?.look === 'pink-riot' || parsed?.look === 'afterglow' || parsed?.look === 'neon-x'
      ? parsed.look
      : DEFAULT_APPEARANCE.look;
    const frost = typeof parsed?.frost === 'number' ? Math.max(0, Math.min(0.75, parsed.frost)) : DEFAULT_APPEARANCE.frost;
    const blend = typeof parsed?.blend === 'number' ? Math.max(8, Math.min(52, parsed.blend)) : DEFAULT_APPEARANCE.blend;
    const storedMap = parsed?.matterMap as Partial<MatterMap> | undefined;
    const matterMap: MatterMap = {
      spark: isMaterial(storedMap?.spark) ? storedMap.spark : DEFAULT_MATTER_MAP.spark,
      task: isMaterial(storedMap?.task) ? storedMap.task : DEFAULT_MATTER_MAP.task,
      note: isMaterial(storedMap?.note) ? storedMap.note : DEFAULT_MATTER_MAP.note,
      link: isMaterial(storedMap?.link) ? storedMap.link : DEFAULT_MATTER_MAP.link,
      doneTask: isMaterial(storedMap?.doneTask) ? storedMap.doneTask : DEFAULT_MATTER_MAP.doneTask,
    };
    return { look, frost, blend, matterMap };
  } catch {
    return DEFAULT_APPEARANCE;
  }
}

function parseMode(value: unknown): Exclude<SpatialMode, 'normal'> {
  return value === 'matter' ? 'matter' : 'plasma';
}

function readActivation(scopeId: string): { mode: SpatialMode; policy: PlasmaPolicy } {
  try {
    const remembered = localStorage.getItem(REMEMBER_PREFIX + scopeId);
    if (remembered) {
      const parsed = remembered === '1' ? { mode: 'plasma' } : JSON.parse(remembered) as { mode?: SpatialMode };
      return { mode: parseMode(parsed.mode), policy: 'remember' };
    }
    if (localStorage.getItem(LEGACY_REMEMBER_PREFIX + scopeId) === '1') return { mode: 'plasma', policy: 'remember' };

    const raw = sessionStorage.getItem(SESSION_PREFIX + scopeId) || sessionStorage.getItem(LEGACY_SESSION_PREFIX + scopeId);
    if (!raw) return { mode: 'normal', policy: 'session' };
    const parsed = JSON.parse(raw) as { policy?: PlasmaPolicy; expiresAt?: number; mode?: SpatialMode };
    if (parsed.expiresAt && parsed.expiresAt <= Date.now()) {
      sessionStorage.removeItem(SESSION_PREFIX + scopeId);
      sessionStorage.removeItem(LEGACY_SESSION_PREFIX + scopeId);
      return { mode: 'normal', policy: 'session' };
    }
    const policy = parsed.policy === '30m' ? '30m' : 'session';
    return { mode: parseMode(parsed.mode), policy };
  } catch {
    return { mode: 'normal', policy: 'session' };
  }
}

export function usePlasmaMode(incidentId?: string): PlasmaController {
  const scopeId = safeScope(incidentId);
  const [activation, setActivation] = useState(() => readActivation(scopeId));
  const [appearance, setAppearance] = useState<PlasmaAppearance>(readAppearance);
  const [transitioning, setTransitioning] = useState(false);
  const [targetMode, setTargetMode] = useState<SpatialMode>();
  const transitionTimers = useRef<number[]>([]);

  useEffect(() => {
    setActivation(readActivation(scopeId));
  }, [scopeId]);

  useEffect(() => () => {
    transitionTimers.current.forEach(timer => window.clearTimeout(timer));
    transitionTimers.current = [];
  }, []);

  const scheduleTransition = useCallback((fn: () => void, delay: number) => {
    const timer = window.setTimeout(fn, delay);
    transitionTimers.current.push(timer);
  }, []);

  useEffect(() => {
    try { localStorage.setItem(APPEARANCE_KEY, JSON.stringify(appearance)); } catch { /* device-local enhancement only */ }
  }, [appearance]);

  useEffect(() => {
    if (activation.mode === 'normal' || activation.policy !== '30m') return;
    let expiresAt = 0;
    try {
      const parsed = JSON.parse(sessionStorage.getItem(SESSION_PREFIX + scopeId) || '{}') as { expiresAt?: number };
      expiresAt = parsed.expiresAt || 0;
    } catch { /* handled below */ }
    if (!expiresAt) return;
    const delay = Math.max(0, expiresAt - Date.now());
    const timer = window.setTimeout(() => setActivation({ mode: 'normal', policy: 'session' }), delay);
    return () => window.clearTimeout(timer);
  }, [activation.mode, activation.policy, scopeId]);

  const activate = useCallback((requestedPolicy?: PlasmaPolicy, requestedMode?: Exclude<SpatialMode, 'normal'>) => {
    const policy = requestedPolicy ?? activation.policy;
    const mode = requestedMode ?? (activation.mode === 'normal' ? 'plasma' : activation.mode);
    try {
      localStorage.removeItem(REMEMBER_PREFIX + scopeId);
      localStorage.removeItem(LEGACY_REMEMBER_PREFIX + scopeId);
      sessionStorage.removeItem(SESSION_PREFIX + scopeId);
      sessionStorage.removeItem(LEGACY_SESSION_PREFIX + scopeId);
      if (policy === 'remember') {
        localStorage.setItem(REMEMBER_PREFIX + scopeId, JSON.stringify({ mode }));
      } else {
        sessionStorage.setItem(SESSION_PREFIX + scopeId, JSON.stringify({
          mode,
          policy,
          expiresAt: policy === '30m' ? Date.now() + 30 * 60 * 1000 : undefined,
        }));
      }
    } catch { /* in-memory mode still works */ }
    setActivation({ mode, policy });
  }, [activation.mode, activation.policy, scopeId]);

  const deactivate = useCallback(() => {
    try {
      localStorage.removeItem(REMEMBER_PREFIX + scopeId);
      localStorage.removeItem(LEGACY_REMEMBER_PREFIX + scopeId);
      sessionStorage.removeItem(SESSION_PREFIX + scopeId);
      sessionStorage.removeItem(LEGACY_SESSION_PREFIX + scopeId);
    } catch { /* in-memory mode still works */ }
    setActivation(current => ({ mode: 'normal', policy: current.policy }));
  }, [scopeId]);

  const setMode = useCallback((mode: SpatialMode) => {
    if (mode === activation.mode && !transitioning) return;
    transitionTimers.current.forEach(timer => window.clearTimeout(timer));
    transitionTimers.current = [];
    setTransitioning(true);
    setTargetMode(mode);

    const finish = () => {
      setTransitioning(false);
      setTargetMode(undefined);
    };

    // Paint a stable recast state before destroying or compiling WebGL fields.
    // Plasma -> Matter intentionally passes through NORMAL for one short frame
    // so old/new canvases never overlap or fight for the GPU in the click event.
    scheduleTransition(() => {
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          if (mode === 'normal') {
            deactivate();
            scheduleTransition(finish, 180);
            return;
          }
          if (activation.mode !== 'normal') {
            deactivate();
            scheduleTransition(() => {
              activate(undefined, mode);
              scheduleTransition(finish, 280);
            }, 120);
            return;
          }
          activate(undefined, mode);
          scheduleTransition(finish, 280);
        });
      });
    }, 16);
  }, [activation.mode, transitioning, activate, deactivate, scheduleTransition]);

  const setPolicy = useCallback((policy: PlasmaPolicy) => {
    if (activation.mode !== 'normal') activate(policy, activation.mode);
    else setActivation(current => ({ ...current, policy }));
  }, [activation.mode, activate]);

  const setLook = useCallback((look: PlasmaLook) => setAppearance(current => ({ ...current, look })), []);
  const setFrost = useCallback((frost: number) => setAppearance(current => ({ ...current, frost: Math.max(0, Math.min(0.75, frost)) })), []);
  const setBlend = useCallback((blend: number) => setAppearance(current => ({ ...current, blend: Math.max(8, Math.min(52, blend)) })), []);
  const setMatterMaterial = useCallback((slot: MatterSlot, material: MatterMaterial) => setAppearance(current => ({
    ...current,
    matterMap: { ...current.matterMap, [slot]: material },
  })), []);
  const resetMatterMap = useCallback(() => setAppearance(current => ({ ...current, matterMap: { ...DEFAULT_MATTER_MAP } })), []);

  return useMemo(() => ({
    active: activation.mode !== 'normal',
    mode: activation.mode,
    policy: activation.policy,
    scopeId,
    transitioning,
    targetMode,
    look: appearance.look,
    frost: appearance.frost,
    blend: appearance.blend,
    matterMap: appearance.matterMap,
    activate,
    deactivate,
    setMode,
    setPolicy,
    setLook,
    setFrost,
    setBlend,
    setMatterMaterial,
    resetMatterMap,
  }), [activation.mode, activation.policy, scopeId, transitioning, targetMode, appearance, activate, deactivate, setMode, setPolicy, setLook, setFrost, setBlend, setMatterMaterial, resetMatterMap]);
}
