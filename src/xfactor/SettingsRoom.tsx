import { useEffect, useState } from 'react';
import { Command, Gauge, MonitorCog, RotateCcw, Settings2, Sparkles, Type } from 'lucide-react';
import { DEFAULT_M6_SETTINGS, loadM6Settings, saveM6Settings, type M6Settings } from './m6Settings';

export default function SettingsRoom() {
  const [settings, setSettings] = useState<M6Settings>(loadM6Settings);

  useEffect(() => { saveM6Settings(settings); }, [settings]);

  const patch = <K extends keyof M6Settings>(key: K, value: M6Settings[K]) =>
    setSettings(current => ({ ...current, [key]: value }));

  return <section className="xf-page m6-settings-room">
    <div className="xf-section-head">
      <div><span className="kicker">SYSTEM SETTINGS //</span><h1>TUNE THE CHAOS.</h1><p>Device-local behavior, readability, spatial intensity, browser capture limits, and Workbench defaults.</p></div>
      <button className="xf-big-action" onClick={() => setSettings({ ...DEFAULT_M6_SETTINGS })}><RotateCcw size={16}/> RESET DEFAULTS</button>
    </div>

    <div className="m6-settings-grid">
      <section className="m6-setting-card">
        <div className="m6-setting-title"><Type/><div><b>READABILITY</b><span>Stop making users squint.</span></div></div>
        <label>UI SCALE <strong>{Math.round(settings.uiScale * 100)}%</strong><input type="range" min=".95" max="1.45" step=".05" value={settings.uiScale} onChange={e => patch('uiScale', Number(e.target.value))}/></label>
        <label>ICON SCALE <strong>{Math.round(settings.iconScale * 100)}%</strong><input type="range" min=".9" max="1.5" step=".05" value={settings.iconScale} onChange={e => patch('iconScale', Number(e.target.value))}/></label>
      </section>

      <section className="m6-setting-card">
        <div className="m6-setting-title"><Sparkles/><div><b>SPATIAL ENGINE</b><span>How hard Plasma/Matter hits the GPU.</span></div></div>
        <div className="m6-seg">{(['full','balanced','reduced'] as const).map(v => <button className={settings.spatialFx===v?'active':''} key={v} onClick={() => patch('spatialFx', v)}>{v.toUpperCase()}</button>)}</div>
        <label className="m6-toggle"><input type="checkbox" checked={settings.reduceMotion} onChange={e => patch('reduceMotion', e.target.checked)}/><span>REDUCE MOTION</span></label>
      </section>

      <section className="m6-setting-card">
        <div className="m6-setting-title"><Command/><div><b>COMMAND DECK</b><span>Fast access should always be obvious.</span></div></div>
        <label className="m6-toggle"><input type="checkbox" checked={settings.commandFab} onChange={e => patch('commandFab', e.target.checked)}/><span>SHOW COMMAND FAB</span></label>
        <label className="m6-toggle"><input type="checkbox" checked={settings.confirmDeletes} onChange={e => patch('confirmDeletes', e.target.checked)}/><span>CONFIRM DESTRUCTIVE ACTIONS</span></label>
      </section>

      <section className="m6-setting-card">
        <div className="m6-setting-title"><Gauge/><div><b>BROWSER CAPTURE</b><span>Bounded on purpose. No runaway crawlers.</span></div></div>
        <label>SUBPAGE DEPTH <strong>{settings.browserCaptureDepth}</strong><input type="range" min="0" max="2" step="1" value={settings.browserCaptureDepth} onChange={e => patch('browserCaptureDepth', Number(e.target.value))}/></label>
        <label>PAGE CAP <strong>{settings.browserMaxPages}</strong><input type="range" min="4" max="24" step="2" value={settings.browserMaxPages} onChange={e => patch('browserMaxPages', Number(e.target.value))}/></label>
      </section>

      <section className="m6-setting-card wide">
        <div className="m6-setting-title"><MonitorCog/><div><b>WORKBENCH DEFAULT VIEW</b><span>The cockpit remains resizable; this chooses the opening emphasis.</span></div></div>
        <div className="m6-seg">{([
          ['cockpit','COCKPIT'],
          ['code-focus','CODE FOCUS'],
          ['preview-focus','PREVIEW FOCUS'],
        ] as const).map(([value,label]) => <button className={settings.workbenchView===value?'active':''} key={value} onClick={() => patch('workbenchView', value)}>{label}</button>)}</div>
      </section>

      <section className="m6-setting-card wide m6-settings-note">
        <Settings2/><div><b>LOCAL-FIRST SETTINGS</b><p>These preferences stay on this device. Project content and workspace data keep their existing sync rules.</p></div>
      </section>
    </div>
  </section>;
}
