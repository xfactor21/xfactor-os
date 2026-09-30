export type WorkbenchLayoutPreset = 'cockpit' | 'code' | 'preview' | 'debug';

export interface M6Preferences {
  fontScale: number;
  tooltips: boolean;
  reducedMotion: boolean;
  compactRail: boolean;
  browserDepth: number;
  browserMaxPages: number;
  workbenchLayout: WorkbenchLayoutPreset;
}

const KEY = 'xfactor-m6-preferences-v1';

export const DEFAULT_M6_PREFERENCES: M6Preferences = {
  fontScale: 1.14,
  tooltips: true,
  reducedMotion: false,
  compactRail: false,
  browserDepth: 1,
  browserMaxPages: 12,
  workbenchLayout: 'cockpit',
};

export function loadM6Preferences(): M6Preferences {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || '{}') as Partial<M6Preferences>;
    return {
      fontScale: typeof raw.fontScale === 'number' ? Math.max(.9, Math.min(1.45, raw.fontScale)) : DEFAULT_M6_PREFERENCES.fontScale,
      tooltips: typeof raw.tooltips === 'boolean' ? raw.tooltips : DEFAULT_M6_PREFERENCES.tooltips,
      reducedMotion: typeof raw.reducedMotion === 'boolean' ? raw.reducedMotion : DEFAULT_M6_PREFERENCES.reducedMotion,
      compactRail: typeof raw.compactRail === 'boolean' ? raw.compactRail : DEFAULT_M6_PREFERENCES.compactRail,
      browserDepth: typeof raw.browserDepth === 'number' ? Math.max(0, Math.min(2, Math.floor(raw.browserDepth))) : DEFAULT_M6_PREFERENCES.browserDepth,
      browserMaxPages: typeof raw.browserMaxPages === 'number' ? Math.max(1, Math.min(40, Math.floor(raw.browserMaxPages))) : DEFAULT_M6_PREFERENCES.browserMaxPages,
      workbenchLayout: raw.workbenchLayout === 'code' || raw.workbenchLayout === 'preview' || raw.workbenchLayout === 'debug' ? raw.workbenchLayout : 'cockpit',
    };
  } catch {
    return { ...DEFAULT_M6_PREFERENCES };
  }
}

export function saveM6Preferences(value: M6Preferences) {
  try { localStorage.setItem(KEY, JSON.stringify(value)); } catch { /* best effort */ }
}

export function applyM6Preferences(value: M6Preferences) {
  const root = document.documentElement;
  root.style.setProperty('--xf-ui-scale', String(value.fontScale));
  root.dataset.xfTooltips = value.tooltips ? 'on' : 'off';
  root.dataset.xfMotion = value.reducedMotion ? 'reduced' : 'full';
  root.dataset.xfRail = value.compactRail ? 'compact' : 'full';
}

export function resetM6Preferences() {
  try { localStorage.removeItem(KEY); } catch { /* best effort */ }
  return { ...DEFAULT_M6_PREFERENCES };
}
