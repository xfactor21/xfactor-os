import { useCallback, useEffect, useState } from 'react';

export type WorkbenchPreset = 'cockpit' | 'code' | 'preview' | 'debug';
export type UiDensity = 'comfortable' | 'dense' | 'wide';

export interface M6Settings {
  uiScale: number;
  density: UiDensity;
  reducedMotion: boolean;
  plasmaQuality: number;
  browserCaptureDepth: 0 | 1 | 2;
  confirmDestructive: boolean;
  defaultWorkbenchPreset: WorkbenchPreset;
  spatialGap: number;
}

const KEY='xfactor-m6-settings-v1';
export const DEFAULT_M6_SETTINGS:M6Settings={
  uiScale:1,
  density:'comfortable',
  reducedMotion:false,
  plasmaQuality:0.92,
  browserCaptureDepth:1,
  confirmDestructive:true,
  defaultWorkbenchPreset:'cockpit',
  spatialGap:72,
};

function read():M6Settings{
  try{
    const parsed=JSON.parse(localStorage.getItem(KEY)||'{}') as Partial<M6Settings>;
    return {
      uiScale:typeof parsed.uiScale==='number'?Math.max(.9,Math.min(1.4,parsed.uiScale)):DEFAULT_M6_SETTINGS.uiScale,
      density:parsed.density==='dense'||parsed.density==='wide'||parsed.density==='comfortable'?parsed.density:DEFAULT_M6_SETTINGS.density,
      reducedMotion:Boolean(parsed.reducedMotion),
      plasmaQuality:typeof parsed.plasmaQuality==='number'?Math.max(.55,Math.min(1.15,parsed.plasmaQuality)):DEFAULT_M6_SETTINGS.plasmaQuality,
      browserCaptureDepth:parsed.browserCaptureDepth===0||parsed.browserCaptureDepth===2?parsed.browserCaptureDepth:1,
      confirmDestructive:parsed.confirmDestructive!==false,
      defaultWorkbenchPreset:parsed.defaultWorkbenchPreset==='code'||parsed.defaultWorkbenchPreset==='preview'||parsed.defaultWorkbenchPreset==='debug'||parsed.defaultWorkbenchPreset==='cockpit'?parsed.defaultWorkbenchPreset:'cockpit',
      spatialGap:typeof parsed.spatialGap==='number'?Math.max(32,Math.min(150,parsed.spatialGap)):DEFAULT_M6_SETTINGS.spatialGap,
    };
  }catch{return DEFAULT_M6_SETTINGS;}
}

export function useM6Settings(){
  const [settings,setSettings]=useState<M6Settings>(read);
  useEffect(()=>{try{localStorage.setItem(KEY,JSON.stringify(settings));}catch{/* local enhancement */}},[settings]);
  const patch=useCallback((changes:Partial<M6Settings>)=>setSettings(current=>({...current,...changes})),[]);
  const reset=useCallback(()=>setSettings(DEFAULT_M6_SETTINGS),[]);
  return {settings,patch,reset};
}
