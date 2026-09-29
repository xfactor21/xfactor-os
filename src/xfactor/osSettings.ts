import { useCallback, useEffect, useMemo, useState } from 'react';

export type WorkbenchLayoutPreset = 'balanced' | 'code' | 'preview' | 'terminal';
export interface OsSettings {
  uiScale: number;
  iconScale: number;
  motion: 'full' | 'reduced';
  spatialQuality: 'balanced' | 'high' | 'performance';
  hoverHelp: boolean;
  workbenchPreset: WorkbenchLayoutPreset;
  browserCaptureDepth: 0 | 1 | 2 | 3;
  compactRail: boolean;
}

const KEY='xfactor-os-settings-v1';
export const DEFAULT_SETTINGS:OsSettings={
  uiScale:1.24,
  iconScale:1.18,
  motion:'full',
  spatialQuality:'balanced',
  hoverHelp:true,
  workbenchPreset:'balanced',
  browserCaptureDepth:1,
  compactRail:false,
};

function read():OsSettings{
  try{
    const parsed=JSON.parse(localStorage.getItem(KEY)||'null') as Partial<OsSettings>|null;
    if(!parsed)return DEFAULT_SETTINGS;
    return {
      uiScale:typeof parsed.uiScale==='number'?Math.max(.9,Math.min(1.5,parsed.uiScale)):DEFAULT_SETTINGS.uiScale,
      iconScale:typeof parsed.iconScale==='number'?Math.max(.9,Math.min(1.5,parsed.iconScale)):DEFAULT_SETTINGS.iconScale,
      motion:parsed.motion==='reduced'?'reduced':'full',
      spatialQuality:parsed.spatialQuality==='high'||parsed.spatialQuality==='performance'?parsed.spatialQuality:'balanced',
      hoverHelp:parsed.hoverHelp!==false,
      workbenchPreset:parsed.workbenchPreset==='code'||parsed.workbenchPreset==='preview'||parsed.workbenchPreset==='terminal'?parsed.workbenchPreset:'balanced',
      browserCaptureDepth:parsed.browserCaptureDepth===0||parsed.browserCaptureDepth===2||parsed.browserCaptureDepth===3?parsed.browserCaptureDepth:1,
      compactRail:Boolean(parsed.compactRail),
    };
  }catch{return DEFAULT_SETTINGS;}
}

export function useOsSettings(){
  const [settings,setSettings]=useState<OsSettings>(read);
  useEffect(()=>{
    try{localStorage.setItem(KEY,JSON.stringify(settings));}catch{/* device-local */}
    const root=document.documentElement;
    root.style.setProperty('--xf-ui-scale',String(settings.uiScale));
    root.style.setProperty('--xf-icon-scale',String(settings.iconScale));
    root.dataset.xfMotion=settings.motion;
    root.dataset.xfSpatialQuality=settings.spatialQuality;
    root.dataset.xfCompactRail=settings.compactRail?'1':'0';
  },[settings]);
  const patch=useCallback((changes:Partial<OsSettings>)=>setSettings(current=>({...current,...changes})),[]);
  const reset=useCallback(()=>setSettings(DEFAULT_SETTINGS),[]);
  return useMemo(()=>({settings,patch,reset}),[settings,patch,reset]);
}
