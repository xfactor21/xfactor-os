import type { StudioCommandId } from './editorCore';

function root(): HTMLElement | null {
  return document.querySelector<HTMLElement>('#dpRoot');
}

function clickButton(container: ParentNode, matcher: (button: HTMLButtonElement) => boolean): boolean {
  const button = Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find(matcher);
  if (!button || button.disabled) return false;
  button.click();
  return true;
}

function clickToolByTitle(title: string): boolean {
  const container = root()?.querySelector('#dpToolgroup');
  if (!container) return false;
  const tool = Array.from(container.querySelectorAll<HTMLElement>('.tool')).find((node) => node.title === title);
  if (!tool) return false;
  tool.click();
  return true;
}

function setActualSize(): boolean {
  const zoom = root()?.querySelector('#dpZoom');
  if (!zoom) return false;
  const label = Array.from(zoom.querySelectorAll('span')).find((node) => /%$/.test(node.textContent?.trim() ?? ''));
  const controls = Array.from(zoom.querySelectorAll<HTMLElement>('.tool'));
  if (!label || controls.length < 2) return false;

  const parsed = Number.parseInt(label.textContent ?? '', 10);
  if (!Number.isFinite(parsed)) return false;
  const delta = 100 - parsed;
  const clicks = Math.min(40, Math.round(Math.abs(delta) / 10));
  const control = delta < 0 ? controls[0] : controls.at(-1);
  if (!control) return false;
  for (let i = 0; i < clicks; i += 1) control.click();
  return true;
}

function nudgeBrushSize(direction: -1 | 1): boolean {
  const panel = root()?.querySelector('#dpBrushPanel');
  if (!panel) return false;
  const range = panel.querySelector<HTMLInputElement>('input[type="range"]');
  if (!range) return false;
  const current = Number(range.value);
  const min = Number(range.min || 1);
  const max = Number(range.max || 200);
  const step = current < 20 ? 1 : current < 60 ? 5 : 10;
  const next = Math.max(min, Math.min(max, current + direction * step));
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  setter?.call(range, String(next));
  range.dispatchEvent(new Event('change', { bubbles: true }));
  return true;
}

export function handleDrawPaintShortcut(command: StudioCommandId): boolean {
  const drawRoot = root();
  if (!drawRoot) return false;

  if (command === 'undo' || command === 'redo') {
    const actions = drawRoot.querySelector('#dpTopActions');
    const label = command === 'undo' ? 'UNDO' : 'REDO';
    return actions ? clickButton(actions, (button) => button.textContent?.trim().startsWith(label) ?? false) : false;
  }

  if (command === 'zoomOut' || command === 'zoomIn') {
    const zoom = drawRoot.querySelector('#dpZoom');
    if (!zoom) return false;
    const controls = Array.from(zoom.querySelectorAll<HTMLElement>('.tool'));
    const control = command === 'zoomOut' ? controls[0] : controls.at(-1);
    if (!control) return false;
    control.click();
    return true;
  }

  if (command === 'zoomReset') return setActualSize();
  if (command === 'brushTool') return clickToolByTitle('brush');
  if (command === 'eraserTool') return clickToolByTitle('eraser');
  if (command === 'marqueeTool') return clickToolByTitle('marquee');
  if (command === 'lassoTool') return clickToolByTitle('lasso');
  if (command === 'wandTool') return clickToolByTitle('wand');
  if (command === 'eyedropperTool') return clickToolByTitle('eyedropper');
  if (command === 'textTool') return clickToolByTitle('text');
  if (command === 'brushSmaller') return nudgeBrushSize(-1);
  if (command === 'brushLarger') return nudgeBrushSize(1);

  return false;
}
