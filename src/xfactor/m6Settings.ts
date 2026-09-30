export type SpatialFxLevel = 'full' | 'balanced' | 'reduced';
export type WorkbenchViewMode = 'cockpit' | 'code-focus' | 'preview-focus';

export interface M6Settings {
  uiScale: number;
  iconScale: number;
  spatialFx: SpatialFxLevel;
  reduceMotion: boolean;
  commandFab: boolean;
  confirmDeletes: boolean;
  browserCaptureDepth: number;
  browserMaxPages: number;
  workbenchView: WorkbenchViewMode;
}

export const M6_SETTINGS_KEY = 'xfactor-m6-settings-v1';

export const DEFAULT_M6_SETTINGS: M6Settings = {
  uiScale: 1.14,
  iconScale: 1.12,
  spatialFx: 'balanced',
  reduceMotion: false,
  commandFab: true,
  confirmDeletes: true,
  browserCaptureDepth: 1,
  browserMaxPages: 12,
  workbenchView: 'cockpit',
};

export function loadM6Settings(): M6Settings {
  try {
    const raw = localStorage.getItem(M6_SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_M6_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<M6Settings>;
    return {
      uiScale: Math.max(.95, Math.min(1.45, Number(parsed.uiScale ?? DEFAULT_M6_SETTINGS.uiScale))),
      iconScale: Math.max(.9, Math.min(1.5, Number(parsed.iconScale ?? DEFAULT_M6_SETTINGS.iconScale))),
      spatialFx: parsed.spatialFx === 'full' || parsed.spatialFx === 'reduced' ? parsed.spatialFx : 'balanced',
      reduceMotion: Boolean(parsed.reduceMotion),
      commandFab: parsed.commandFab !== false,
      confirmDeletes: parsed.confirmDeletes !== false,
      browserCaptureDepth: Math.max(0, Math.min(2, Math.floor(Number(parsed.browserCaptureDepth ?? 1)))),
      browserMaxPages: Math.max(1, Math.min(24, Math.floor(Number(parsed.browserMaxPages ?? 12)))),
      workbenchView: parsed.workbenchView === 'code-focus' || parsed.workbenchView === 'preview-focus' ? parsed.workbenchView : 'cockpit',
    };
  } catch {
    return { ...DEFAULT_M6_SETTINGS };
  }
}

export function saveM6Settings(settings: M6Settings) {
  localStorage.setItem(M6_SETTINGS_KEY, JSON.stringify(settings));
  applyM6Settings(settings);
  window.dispatchEvent(new CustomEvent('xfactor:m6-settings', { detail: settings }));
}

export function applyM6Settings(settings = loadM6Settings()) {
  const root = document.documentElement;
  root.style.setProperty('--xf-ui-scale', String(settings.uiScale));
  root.style.setProperty('--xf-icon-scale', String(settings.iconScale));
  root.dataset.xfSpatialFx = settings.spatialFx;
  root.dataset.xfMotion = settings.reduceMotion ? 'reduced' : 'full';
  return settings;
}
