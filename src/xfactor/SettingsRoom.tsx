import { RotateCcw, Settings2, Type, MousePointer2, MonitorCog, Globe2, PanelsTopLeft } from 'lucide-react';
import type { M6Preferences, WorkbenchLayoutPreset } from './m6Prefs';
import { DEFAULT_M6_PREFERENCES } from './m6Prefs';
import { resetSpatialRoomLayouts } from './TrueSpatial';

export default function SettingsRoom({
  prefs,
  onChange,
  onReset,
}: {
  prefs: M6Preferences;
  onChange: (next: M6Preferences) => void;
  onReset: () => void;
}) {
  const patch = <K extends keyof M6Preferences>(key: K, value: M6Preferences[K]) => onChange({ ...prefs, [key]: value });
  return <section className="xf-page xf-settings-page">
    <div className="xf-section-head">
      <div><span className="kicker">SETTINGS //</span><h1>TUNE THE DAMAGE.</h1><p>Readable by default. Local-first. Change the machine without sanding off its personality.</p></div>
    </div>

    <div className="xf-settings-grid">
      <section className="xf-settings-card">
        <header><Type size={18}/><div><b>READABILITY</b><small>MAKE THE UI HUMAN-SIZED</small></div></header>
        <label><span>UI SCALE</span><strong>{Math.round(prefs.fontScale * 100)}%</strong><input type="range" min=".9" max="1.45" step=".05" value={prefs.fontScale} onChange={e=>patch('fontScale',Number(e.target.value))}/></label>
        <label className="xf-switch"><span><b>CONTEXT TOOLTIPS</b><small>Explain SIGNAL, HOT, status metrics and unfamiliar controls on hover.</small></span><input type="checkbox" checked={prefs.tooltips} onChange={e=>patch('tooltips',e.target.checked)}/></label>
        <label className="xf-switch"><span><b>REDUCED MOTION</b><small>Keep Plasma and transitions calmer without changing the data model.</small></span><input type="checkbox" checked={prefs.reducedMotion} onChange={e=>patch('reducedMotion',e.target.checked)}/></label>
      </section>

      <section className="xf-settings-card">
        <header><PanelsTopLeft size={18}/><div><b>WORKBENCH</b><small>DEFAULT COCKPIT GEOMETRY</small></div></header>
        <div className="xf-layout-choice">
          {(['cockpit','code','preview','debug'] as WorkbenchLayoutPreset[]).map(layout=><button key={layout} className={prefs.workbenchLayout===layout?'active':''} onClick={()=>patch('workbenchLayout',layout)}>{layout.toUpperCase()}</button>)}
        </div>
        <label className="xf-switch"><span><b>COMPACT RAIL</b><small>Reduce navigation chrome when you want more canvas.</small></span><input type="checkbox" checked={prefs.compactRail} onChange={e=>patch('compactRail',e.target.checked)}/></label>
      </section>

      <section className="xf-settings-card">
        <header><Globe2 size={18}/><div><b>BROWSER CAPTURE</b><small>SAFE LIMITS FOR OFFLINE SITE PACKS</small></div></header>
        <label><span>SUBPAGE DEPTH</span><strong>{prefs.browserDepth}</strong><input type="range" min="0" max="2" step="1" value={prefs.browserDepth} onChange={e=>patch('browserDepth',Number(e.target.value))}/></label>
        <label><span>MAX PAGES</span><strong>{prefs.browserMaxPages}</strong><input type="range" min="1" max="40" step="1" value={prefs.browserMaxPages} onChange={e=>patch('browserMaxPages',Number(e.target.value))}/></label>
        <p className="xf-settings-note">Offline capture is intentionally bounded. It saves public/CORS-accessible page source and metadata; it does not bypass authentication, DRM, robots rules, or reproduce server-only behavior.</p>
      </section>

      <section className="xf-settings-card danger">
        <header><MonitorCog size={18}/><div><b>LOCAL STATE</b><small>RESET PRESENTATION WITHOUT DELETING PROJECT DATA</small></div></header>
        <button onClick={()=>{resetSpatialRoomLayouts();location.reload()}}><MousePointer2 size={14}/> RESET SPATIAL LAYOUTS</button>
        <button onClick={onReset}><RotateCcw size={14}/> RESET UI PREFERENCES</button>
        <small>Defaults: {Math.round(DEFAULT_M6_PREFERENCES.fontScale*100)}% UI, tooltips on, Cockpit Workbench.</small>
      </section>
    </div>
  </section>;
}
