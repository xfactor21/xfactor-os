let installed = false;

function markIncidentCards() {
  document.querySelectorAll<HTMLElement>('.xf-shard').forEach((card) => {
    card.setAttribute('role', 'button');
    card.setAttribute('tabindex', '0');
    card.setAttribute('aria-label', `${card.querySelector('h2')?.textContent ?? 'Incident'} — open incident dossier`);
    card.dataset.incidentInteractive = 'true';
  });
}

function revealBlackbox() {
  const blackbox = document.querySelector<HTMLElement>('.xf-blackbox');
  if (!blackbox) return;
  blackbox.classList.remove('incident-focus-pulse');
  void blackbox.offsetWidth;
  blackbox.classList.add('incident-focus-pulse');
  blackbox.scrollIntoView({ behavior: 'smooth', block: 'center' });
  window.setTimeout(() => blackbox.classList.remove('incident-focus-pulse'), 1400);
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
    window.setTimeout(revealBlackbox, 0);
  }, true);

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const card = (event.target as Element | null)?.closest<HTMLElement>('.xf-shard');
    if (!card) return;
    event.preventDefault();
    card.click();
    revealBlackbox();
  });
}
