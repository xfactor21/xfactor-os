const TUTORIAL_KEY = 'xfactor-os-tutorial-v1';

const STEPS = [
  {
    kicker: '01 // THE FLOOR',
    title: 'THROW THE MESS SOMEWHERE.',
    body: 'Projects, problems, experiments, and obsessions become Incidents. Drag them around freely; the data underneath stays structured.',
    hint: 'Click an Incident instead of dragging it to open its Blackbox dossier.',
    target: '.xf-floor',
  },
  {
    kicker: '02 // BLACKBOX',
    title: 'ONE THING. ALL ITS CONTEXT.',
    body: 'The Blackbox is the editable dossier for the selected Incident: name, description, status, priority, heat, tags, next move, tasks, relationships, linked assets, and activity.',
    hint: 'If the Floor is empty, create an Incident first and this panel becomes its control room.',
    target: '.xf-blackbox',
  },
  {
    kicker: '03 // HOTWIRE + SIGNAL',
    title: 'CAPTURE BEFORE YOU ORGANIZE.',
    body: 'Hotwire is the always-available capture strip. Burn in a spark, task, note, or link. Signal is the inbox where you edit, route, pin, complete, and clean up those captures.',
    hint: 'Ctrl/Cmd + J jumps straight to Signal.',
    target: '.xf-hotwire',
  },
  {
    kicker: '04 // PILES',
    title: 'ORGANIZED DISORGANIZATION.',
    body: 'Shift-select multiple Incidents and pile them together. Piles overlap instead of forcing one rigid folder hierarchy, so the same Incident can belong in more than one context.',
    hint: 'STACK IT restores order. RIOT MODE deliberately wrecks the layout without losing data.',
    target: '.xf-rail',
  },
  {
    kicker: '05 // BLACK VAULT + DESIGN LAB',
    title: 'KEEP THE STUFF WITH THE REASON IT EXISTS.',
    body: 'Vault stores files, links, references, and Design Lab output. Design Lab is the creative suite. Work created while an Incident is selected can stay attached to that Incident.',
    hint: 'Use the left rail to open LAB or VAULT at any time.',
    target: '.xf-rail',
  },
  {
    kicker: '06 // TAPE + BACKUP',
    title: 'THE MESS HAS A MEMORY.',
    body: 'Tape is the operational history. From there you can export a full workspace backup or restore one later. Local work keeps functioning even if cloud sync is unavailable.',
    hint: 'Back up before major experiments or before moving machines.',
    target: '.xf-rail',
  },
  {
    kicker: '07 // COMMAND DECK',
    title: 'DON’T HUNT FOR BUTTONS.',
    body: 'Ctrl/Cmd + K opens the Command Deck. Try natural commands like “NEW PROJECT MONSTER X”, “TASK SHIP THE BUILD”, “OPEN VAULT”, or “FIND AUDIO”.',
    hint: 'The small TOUR button in the top bar replays this tutorial whenever you want.',
    target: '.xf-command',
  },
] as const;

let mounted = false;
let current = 0;
let overlay: HTMLElement | null = null;
let highlighted: HTMLElement | null = null;

function markComplete() {
  try { localStorage.setItem(TUTORIAL_KEY, 'complete'); } catch { /* local storage may be blocked */ }
}

function hasCompleted() {
  try { return localStorage.getItem(TUTORIAL_KEY) === 'complete'; } catch { return false; }
}

function clearHighlight() {
  highlighted?.classList.remove('xf-tour-target');
  highlighted = null;
}

function highlightTarget(selector: string) {
  clearHighlight();
  const target = document.querySelector<HTMLElement>(selector);
  if (!target) return;
  highlighted = target;
  target.classList.add('xf-tour-target');
  if (selector !== '.xf-rail' && selector !== '.xf-hotwire' && selector !== '.xf-command') {
    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}

function renderStep() {
  if (!overlay) return;
  const step = STEPS[current];
  overlay.querySelector<HTMLElement>('[data-tour-kicker]')!.textContent = step.kicker;
  overlay.querySelector<HTMLElement>('[data-tour-title]')!.textContent = step.title;
  overlay.querySelector<HTMLElement>('[data-tour-body]')!.textContent = step.body;
  overlay.querySelector<HTMLElement>('[data-tour-hint]')!.textContent = step.hint;
  overlay.querySelector<HTMLElement>('[data-tour-count]')!.textContent = `${current + 1} / ${STEPS.length}`;
  const back = overlay.querySelector<HTMLButtonElement>('[data-tour-back]')!;
  const next = overlay.querySelector<HTMLButtonElement>('[data-tour-next]')!;
  back.disabled = current === 0;
  next.textContent = current === STEPS.length - 1 ? 'ENTER THE CHAOS' : 'NEXT';
  highlightTarget(step.target);
}

function closeTutorial(completed = true) {
  clearHighlight();
  overlay?.remove();
  overlay = null;
  document.body.classList.remove('xf-tour-open');
  if (completed) markComplete();
}

export function openXfactorTutorial() {
  if (overlay) return;
  current = 0;
  overlay = document.createElement('div');
  overlay.className = 'xf-tour-backdrop';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', 'xFactor.OS quick start tutorial');
  overlay.innerHTML = `
    <section class="xf-tour-card">
      <div class="xf-tour-brand"><span>×</span><div><b>xFACTOR.OS</b><small>QUICK START // CONTROLLED CHAOS</small></div></div>
      <div class="xf-tour-kicker" data-tour-kicker></div>
      <h2 data-tour-title></h2>
      <p data-tour-body></p>
      <div class="xf-tour-hint"><b>TRY THIS //</b><span data-tour-hint></span></div>
      <div class="xf-tour-foot">
        <button class="xf-tour-skip" data-tour-skip>SKIP TOUR</button>
        <span data-tour-count></span>
        <div><button data-tour-back>BACK</button><button class="primary" data-tour-next>NEXT</button></div>
      </div>
    </section>`;
  document.body.appendChild(overlay);
  document.body.classList.add('xf-tour-open');
  overlay.querySelector('[data-tour-skip]')?.addEventListener('click', () => closeTutorial(true));
  overlay.querySelector('[data-tour-back]')?.addEventListener('click', () => { if (current > 0) { current--; renderStep(); } });
  overlay.querySelector('[data-tour-next]')?.addEventListener('click', () => {
    if (current >= STEPS.length - 1) { closeTutorial(true); return; }
    current++;
    renderStep();
  });
  overlay.addEventListener('keydown', event => {
    if (event.key === 'Escape') closeTutorial(true);
    if (event.key === 'ArrowRight') (overlay?.querySelector<HTMLButtonElement>('[data-tour-next]'))?.click();
    if (event.key === 'ArrowLeft') (overlay?.querySelector<HTMLButtonElement>('[data-tour-back]'))?.click();
  });
  renderStep();
  window.setTimeout(() => overlay?.querySelector<HTMLButtonElement>('[data-tour-next]')?.focus(), 0);
}

function injectReplayButton() {
  if (document.querySelector('[data-xfactor-tour-button]')) return true;
  const topbar = document.querySelector<HTMLElement>('.xf-topbar');
  if (!topbar) return false;
  const button = document.createElement('button');
  button.className = 'xf-tour-replay';
  button.dataset.xfactorTourButton = 'true';
  button.type = 'button';
  button.innerHTML = '<b>?</b><span>TOUR</span>';
  button.addEventListener('click', openXfactorTutorial);
  const command = topbar.querySelector('.xf-command');
  topbar.insertBefore(button, command ?? null);
  return true;
}

export function installXfactorTutorial() {
  if (mounted || typeof window === 'undefined') return;
  mounted = true;

  if (!injectReplayButton()) {
    const observer = new MutationObserver(() => {
      if (injectReplayButton()) observer.disconnect();
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
    window.setTimeout(() => observer.disconnect(), 10000);
  }

  if (!hasCompleted()) {
    window.setTimeout(() => openXfactorTutorial(), 650);
  }

  window.addEventListener('xfactor:open-tutorial', openXfactorTutorial as EventListener);
}
