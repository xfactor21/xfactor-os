const KEY = 'xfactor-os-workspace-v2';

type Workspace = {
  selectedIncidentId?: string;
  incidents: Array<{id:string;name:string}>;
  signals: Array<{id:string;text:string;type:string;incidentId?:string;done?:boolean}>;
  assets: Array<{id:string;name:string;kind:string;source:string;incidentId?:string;archived?:boolean}>;
  activity: Array<{id:string;type:string;label:string;incidentId?:string;createdAt:number}>;
};

let installed = false;
let host: HTMLElement | null = null;
let selectedIncidentId: string | undefined;

function readWorkspace(): Workspace | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Workspace;
    return parsed && Array.isArray(parsed.incidents) ? parsed : null;
  } catch { return null; }
}

function writeWorkspace(ws: Workspace) {
  localStorage.setItem(KEY, JSON.stringify(ws));
  try { new BroadcastChannel('xfactor-os-workspace').postMessage({type:'incident-context-update'}); } catch { /* enhancement only */ }
}

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c] ?? c));
}

function clickRail(label: string) {
  const button = Array.from(document.querySelectorAll<HTMLButtonElement>('.rail-x')).find(b => b.textContent?.toUpperCase().includes(label));
  button?.click();
}

function ensureHost() {
  const blackbox = document.querySelector<HTMLElement>('.xf-blackbox');
  if (!blackbox) { host = null; return; }
  if (host?.isConnected && host.parentElement === blackbox) return;
  host = document.createElement('section');
  host.className = 'incident-context-panel';
  host.setAttribute('aria-label', 'Connected incident context');
  blackbox.appendChild(host);
  host.addEventListener('click', onClick);
  host.addEventListener('change', onChange);
}

function render() {
  ensureHost();
  if (!host) return;
  const ws = readWorkspace();
  const id = selectedIncidentId ?? ws?.selectedIncidentId;
  const incident = ws?.incidents.find(i => i.id === id);
  if (!ws || !incident) { host.innerHTML = ''; return; }

  const signals = ws.signals.filter(s => s.incidentId === incident.id);
  const openTasks = signals.filter(s => s.type === 'task' && !s.done).length;
  const assets = ws.assets.filter(a => a.incidentId === incident.id && !a.archived);
  const studio = assets.filter(a => a.source === 'studio');
  const unassigned = ws.assets.filter(a => !a.incidentId && !a.archived).slice(0,80);
  const recent = ws.activity.filter(a => a.incidentId === incident.id).slice(0,4);

  host.innerHTML = `
    <div class="incident-context-head">
      <div><small>CONNECTED CONTEXT //</small><b>${escapeHtml(incident.name)}</b></div>
      <div class="incident-context-counts"><span>${openTasks} OPEN</span><span>${assets.length} ASSETS</span><span>${studio.length} LAB</span></div>
    </div>
    <div class="incident-context-actions">
      <button data-context-action="vault">OPEN VAULT</button>
      <button data-context-action="lab">OPEN DESIGN LAB</button>
      <button data-context-action="signal">OPEN SIGNAL</button>
    </div>
    <div class="incident-context-assets">
      <div class="incident-context-label">ATTACHED MATERIAL</div>
      ${assets.length ? assets.slice(0,8).map(a => `<div class="incident-context-asset"><span><i>${escapeHtml(a.kind.toUpperCase())}</i>${escapeHtml(a.name)}</span><button data-detach-asset="${a.id}" title="Detach from Incident">DETACH</button></div>`).join('') : '<p>Nothing attached yet. Vault files, links, and Design Lab documents can live here.</p>'}
    </div>
    <div class="incident-context-attach">
      <select data-context-select ${unassigned.length ? '' : 'disabled'}>
        <option value="">${unassigned.length ? 'ATTACH EXISTING MATERIAL…' : 'NO UNASSIGNED MATERIAL'}</option>
        ${unassigned.map(a => `<option value="${a.id}">${escapeHtml(a.name)} · ${escapeHtml(a.kind.toUpperCase())}</option>`).join('')}
      </select>
      <button data-context-action="attach" ${unassigned.length ? '' : 'disabled'}>ATTACH</button>
    </div>
    ${recent.length ? `<div class="incident-context-recent">${recent.map(a => `<span>${escapeHtml(a.type.toUpperCase())} // ${escapeHtml(a.label)}</span>`).join('')}</div>` : ''}
  `;
}

function onClick(event: Event) {
  const target = event.target as HTMLElement;
  const action = target.closest<HTMLButtonElement>('[data-context-action]')?.dataset.contextAction;
  if (action === 'vault') return clickRail('VAULT');
  if (action === 'lab') return clickRail('LAB');
  if (action === 'signal') return clickRail('SIGNAL');
  if (action === 'attach') {
    const select = host?.querySelector<HTMLSelectElement>('[data-context-select]');
    if (!select?.value) return;
    const ws = readWorkspace(); const id = selectedIncidentId ?? ws?.selectedIncidentId;
    if (!ws || !id) return;
    ws.assets = ws.assets.map(a => a.id === select.value ? {...a, incidentId:id} : a);
    writeWorkspace(ws); render(); return;
  }
  const detach = target.closest<HTMLButtonElement>('[data-detach-asset]')?.dataset.detachAsset;
  if (detach) {
    const ws = readWorkspace();
    if (!ws) return;
    ws.assets = ws.assets.map(a => a.id === detach ? {...a, incidentId:undefined} : a);
    writeWorkspace(ws); render();
  }
}

function onChange(event: Event) {
  const select = (event.target as HTMLElement).closest<HTMLSelectElement>('[data-context-select]');
  const attach = host?.querySelector<HTMLButtonElement>('[data-context-action="attach"]');
  if (select && attach) attach.disabled = !select.value;
}

export function installIncidentContextUx() {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  const observer = new MutationObserver(() => { ensureHost(); render(); });
  observer.observe(document.documentElement, {childList:true, subtree:true});
  window.addEventListener('xfactor:incident-open', ((event: CustomEvent<{incidentId?:string}>) => {
    selectedIncidentId = event.detail?.incidentId;
    window.setTimeout(render, 0);
  }) as EventListener);
  window.addEventListener('storage', event => { if (event.key === KEY) render(); });
  try { const channel = new BroadcastChannel('xfactor-os-workspace'); channel.onmessage = render; } catch { /* enhancement only */ }
  window.setTimeout(render, 0);
}
