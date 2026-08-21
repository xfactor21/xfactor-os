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

function zoomControls() {
  const zoom = root()?.querySelector('#dpZoom');
  if (!zoom) return null;
  const label = Array.from(zoom.querySelectorAll('span')).find((node) => /%$/.test(node.textContent?.trim() ?? ''));
  const controls = Array.from(zoom.querySelectorAll<HTMLElement>('.tool'));
  if (!label || controls.length < 2) return null;
  const parsed = Number.parseInt(label.textContent ?? '', 10);
  if (!Number.isFinite(parsed)) return null;
  return { currentPercent: parsed, zoomOut: controls[0], zoomIn: controls.at(-1)! };
}

function setZoomPercent(targetPercent: number): boolean {
  const controls = zoomControls();
  if (!controls) return false;
  const target = Math.max(10, Math.min(400, Math.round(targetPercent / 10) * 10));
  const delta = target - controls.currentPercent;
  const clicks = Math.min(40, Math.round(Math.abs(delta) / 10));
  const control = delta < 0 ? controls.zoomOut : controls.zoomIn;
  for (let i = 0; i < clicks; i += 1) control.click();
  return true;
}

function setActualSize(): boolean {
  return setZoomPercent(100);
}

function fitCanvas(): boolean {
  const drawRoot = root();
  const surface = drawRoot?.querySelector<HTMLElement>('#dpCanvasScroll');
  const canvas = drawRoot?.querySelector<HTMLCanvasElement>('#dpCanvasScroll canvas');
  if (!surface || !canvas || !canvas.width || !canvas.height) return false;

  const horizontalPadding = 48;
  const verticalPadding = 48;
  const fit = Math.min(
    (surface.clientWidth - horizontalPadding) / canvas.width,
    (surface.clientHeight - verticalPadding) / canvas.height,
  );
  if (!Number.isFinite(fit) || fit <= 0) return false;
  const handled = setZoomPercent(fit * 100);
  if (handled) {
    requestAnimationFrame(() => {
      surface.scrollLeft = Math.max(0, (surface.scrollWidth - surface.clientWidth) / 2);
      surface.scrollTop = Math.max(0, (surface.scrollHeight - surface.clientHeight) / 2);
    });
  }
  return handled;
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

function selectAdjacentLayer(direction: -1 | 1): boolean {
  const panel = root()?.querySelector('#layersPanel');
  if (!panel) return false;
  const rows = Array.from(panel.querySelectorAll<HTMLElement>('.layer-row'));
  const currentIndex = rows.findIndex((row) => row.classList.contains('sel'));
  if (currentIndex < 0) return false;
  const nextIndex = Math.max(0, Math.min(rows.length - 1, currentIndex + direction));
  if (nextIndex === currentIndex) return true;
  rows[nextIndex].click();
  rows[nextIndex].scrollIntoView({ block: 'nearest' });
  return true;
}

function duplicateActiveLayer(): boolean {
  const active = root()?.querySelector<HTMLElement>('#layersPanel .layer-row.sel');
  const duplicate = active?.querySelector<HTMLElement>('.lyDup');
  if (!duplicate) return false;
  duplicate.click();
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
    const controls = zoomControls();
    if (!controls) return false;
    (command === 'zoomOut' ? controls.zoomOut : controls.zoomIn).click();
    return true;
  }

  if (command === 'zoomReset') return setActualSize();
  if (command === 'zoomFit') return fitCanvas();
  if (command === 'brushTool') return clickToolByTitle('brush');
  if (command === 'eraserTool') return clickToolByTitle('eraser');
  if (command === 'marqueeTool') return clickToolByTitle('marquee');
  if (command === 'lassoTool') return clickToolByTitle('lasso');
  if (command === 'wandTool') return clickToolByTitle('wand');
  if (command === 'eyedropperTool') return clickToolByTitle('eyedropper');
  if (command === 'textTool') return clickToolByTitle('text');
  if (command === 'brushSmaller') return nudgeBrushSize(-1);
  if (command === 'brushLarger') return nudgeBrushSize(1);
  if (command === 'layerAbove') return selectAdjacentLayer(-1);
  if (command === 'layerBelow') return selectAdjacentLayer(1);
  if (command === 'duplicateLayer') return duplicateActiveLayer();

  return false;
}
