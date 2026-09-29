import { useEffect, useState } from 'react';
import { Eye, Gauge, Monitor, RotateCcw, SlidersHorizontal } from 'lucide-react';

export type XFactorSettings={uiScale:number;tooltips:boolean;reducedSpatialMotion:boolean;highContrast:boolean};
const KEY='xfactor-settings-v1';
export const DEFAULT_SETTINGS:XFactorSettings={uiScale:1.12,tooltips:true,reducedSpatialMotion:false,highContrast:false};
export function loadXFactorSettings():XFactorSettings{try{return {...DEFAULT_SETTINGS,...JSON.parse(localStorage.getItem(KEY)||'{}')}}catch{return DEFAULT_SETTINGS}}
export function applyXFactorSettings(settings:XFactorSettings){const root=document.documentElement;root.style.setProperty('--xf-ui-scale',String(settings.uiScale));root.classList.toggle('xf-high-contrast',settings.highContrast);root.classList.toggle('xf-reduced-spatial',settings.reducedSpatialMotion);}

export default function XSettings(){
  const [settings,setSettings]=useState(loadXFactorSettings);
  function update(changes:Partial<XFactorSettings>){setSettings(current=>{const next={...current,...changes};localStorage.setItem(KEY,JSON.stringify(next));applyXFactorSettings(next);return next})}
  useEffect(()=>applyXFactorSettings(settings),[]);
  return <section className="xf-page xsettings"><div className="xf-section-head"><div><span className="kicker">SETTINGS //</span><h1>TUNE THE DAMAGE.</h1><p>Readable by default. Loud by choice. Local-first controls stay on this device.</p></div><button className="xf-big-action" onClick={()=>update(DEFAULT_SETTINGS)}><RotateCcw size={14}/> RESET</button></div>
    <div className="xsettings-grid">
      <article><SlidersHorizontal/><div><b>INTERFACE SCALE</b><p>Increase chrome, labels, rail controls and secondary text without inflating the work canvas.</p></div><input type="range" min=".95" max="1.35" step=".05" value={settings.uiScale} onChange={e=>update({uiScale:Number(e.target.value)})}/><strong>{Math.round(settings.uiScale*100)}%</strong></article>
      <article><Eye/><div><b>EXPLANATION TOOLTIPS</b><p>Keep hover explanations available for metrics, data and unusual xFactor terminology.</p></div><button className={settings.tooltips?'active':''} onClick={()=>update({tooltips:!settings.tooltips})}>{settings.tooltips?'ON':'OFF'}</button></article>
      <article><Gauge/><div><b>REDUCED SPATIAL MOTION</b><p>Shorten Plasma transitions and suppress decorative motion while keeping organization/fusion behavior.</p></div><button className={settings.reducedSpatialMotion?'active':''} onClick={()=>update({reducedSpatialMotion:!settings.reducedSpatialMotion})}>{settings.reducedSpatialMotion?'ON':'OFF'}</button></article>
      <article><Monitor/><div><b>HIGH CONTRAST</b><p>Increase text/chrome separation for long Workbench and planning sessions.</p></div><button className={settings.highContrast?'active':''} onClick={()=>update({highContrast:!settings.highContrast})}>{settings.highContrast?'ON':'OFF'}</button></article>
    </div>
  </section>;
}
