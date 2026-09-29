import { Sparkles } from 'lucide-react';
import type { PlasmaController, PlasmaLook, PlasmaPolicy, SpatialMode } from './plasmaMode';

const LOOK_LABEL: Record<PlasmaLook, string> = {
  'neon-x': 'NEON X',
  'pink-riot': 'PINK RIOT',
  afterglow: 'AFTERGLOW',
};

const POLICY_LABEL: Record<PlasmaPolicy, string> = {
  session: 'THIS SESSION',
  '30m': '30 MIN',
  remember: 'UNTIL OFF',
};

export default function GlobalSpatialToggle({ plasma }: { plasma: PlasmaController }) {
  const setMode = (mode: SpatialMode) => plasma.setMode(mode);

  return <div className="xf-global-spatial" aria-label="Global spatial display mode" aria-busy={plasma.switching}>
    <div className="xf-global-spatial-modes" role="group" aria-label="Normal, Plasma, or Matter mode">
      <button disabled={plasma.switching} className={plasma.mode === 'normal' ? 'active normal' : 'normal'} onClick={() => setMode('normal')}>NORMAL</button>
      <button disabled={plasma.switching} className={plasma.mode === 'plasma' ? 'active plasma' : 'plasma'} onClick={() => setMode('plasma')}><Sparkles size={11}/> PLASMA</button>
      <button disabled={plasma.switching} className={plasma.mode === 'matter' ? 'active matter' : 'matter'} onClick={() => setMode('matter')}>◆ MATTER</button>
    </div>
    {plasma.mode !== 'normal' && <div className="xf-global-spatial-options">
      <select disabled={plasma.switching} aria-label="Spatial look" value={plasma.look} onChange={event => plasma.setLook(event.target.value as PlasmaLook)}>
        {(Object.keys(LOOK_LABEL) as PlasmaLook[]).map(look => <option key={look} value={look}>{LOOK_LABEL[look]}</option>)}
      </select>
      <select disabled={plasma.switching} aria-label="Spatial mode duration" value={plasma.policy} onChange={event => plasma.setPolicy(event.target.value as PlasmaPolicy)}>
        {(Object.keys(POLICY_LABEL) as PlasmaPolicy[]).map(policy => <option key={policy} value={policy}>{POLICY_LABEL[policy]}</option>)}
      </select>
    </div>}
  </div>;
}
