const WORKSPACE_KEY = 'xfactor-os-workspace-v2';
let installed = false;

type WorkspaceLite = { selectedIncidentId?: string; incidents?: Array<{id:string;archived?:boolean}> };

function readWorkspace(): WorkspaceLite | null {
  try { const raw = localStorage.getItem(WORKSPACE_KEY); return raw ? JSON.parse(raw) as WorkspaceLite : null; } catch { return null; }
}

function markIncidentCards() {
  const ws = readWorkspace();
  const visibleIds = (ws?.incidents ?? []).filter(i => !i.archived).map(i => i.id);
  document.querySelectorAll<HTMLElement>('.xf-shard').forEach((card, index) => {
    card.setAttribute('role', 'button');
    card.setAttribute('tabindex', '0');
    card.setAttribute('aria-label', `${card.querySelector('h2')?.textContent ?? 'Incident'} — open incident dossier`);
    card.dataset.incidentInteractive = 'true';
    if (visibleIds[index]) card.dataset.incidentId = visibleIds[index];
  });
}

function selectPersistedIncident(incidentId?: string) {
  if (!incidentId) return;
  const ws = readWorkspace();
  if (!ws) return;
  ws.selectedIncidentId = incidentId;
  localStorage.setItem(WORKSPACE_KEY, JSON.stringify(ws));
  try { const channel = new BroadcastChannel('xfactor-os-workspace'); channel.postMessage({type:'incident-open',incidentId}); channel.close(); } catch { /* enhancement only */ }
}

function revealBlackbox(incidentId?: string) {
  selectPersistedIncident(incidentId);
  window.dispatchEvent(new CustomEvent('xfactor:incident-open', {detail:{incidentId}}));
  window.setTimeout(() => {
    const blackbox = document.querySelector<HTMLElement>('.xf-blackbox');
    if (!blackbox) return;
    blackbox.classList.remove('incident-focus-pulse');
    void blackbox.offsetWidth;
    blackbox.classList.add('incident-focus-pulse');
    blackbox.scrollIntoView({ behavior: 'smooth', block: 'center' });
    window.setTimeout(() => blackbox.classList.remove('incident-focus-pulse'), 1400);
  }, 0);
}

export function installIncidentUx() {
  if (installed || typeof window === 'undefined') return;
  installed = true;

  let down: { x: number; y: number; card: HTMLElement } | null = null;
  const observer = new MutationObserver(markIncidentCards);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  markIncidentCards();

  document.addEventListener('pointerdown', (event) => {
    const card = (event.target as Element | null)?.closest<HTMLElement>('.xf-shard');
    if (!card) return;
    down = { x: event.clientX, y: event.clientY, card };
  }, true);

  document.addEventListener('pointerup', (event) => {
    if (!down) return;
    const current = down;
    down = null;
    const card = (event.target as Element | null)?.closest<HTMLElement>('.xf-shard');
    if (!card || card !== current.card) return;
    const distance = Math.hypot(event.clientX - current.x, event.clientY - current.y);
    if (distance > 7) return;
    revealBlackbox(card.dataset.incidentId);
  }, true);

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const card = (event.target as Element | null)?.closest<HTMLElement>('.xf-shard');
    if (!card) return;
    event.preventDefault();
    revealBlackbox(card.dataset.incidentId);
  });
}
