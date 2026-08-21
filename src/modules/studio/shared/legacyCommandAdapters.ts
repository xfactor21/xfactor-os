import type { StudioCommandId } from './editorCore';

function clickButton(container: ParentNode, matcher: (button: HTMLButtonElement) => boolean): boolean {
  const button = Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find(matcher);
  if (!button || button.disabled) return false;
  button.click();
  return true;
}

function handleDrawPaint(command: StudioCommandId): boolean {
  const root = document.querySelector<HTMLElement>('#dpRoot');
  if (!root) return false;

  if (command === 'undo') {
    const actions = root.querySelector('#dpTopActions');
    return actions ? clickButton(actions, (button) => button.textContent?.trim().startsWith('UNDO') ?? false) : false;
  }

  if (command === 'redo') {
    const actions = root.querySelector('#dpTopActions');
    return actions ? clickButton(actions, (button) => button.textContent?.trim().startsWith('REDO') ?? false) : false;
  }

  if (command === 'zoomOut' || command === 'zoomIn') {
    const zoom = root.querySelector('#dpZoom');
    if (!zoom) return false;
    const controls = Array.from(zoom.querySelectorAll<HTMLElement>('.tool'));
    const control = command === 'zoomOut' ? controls[0] : controls.at(-1);
    if (!control) return false;
    control.click();
    return true;
  }

  // Draw/Paint already autosaves committed edits. We deliberately do not
  // claim Cmd/Ctrl+S yet because there is no synchronous "save now" API in
  // the editor. Likewise actual-size reset stays unclaimed until Draw/Paint
  // exposes a real zoom setter instead of faking a result with repeated clicks.
  return false;
}

/**
 * Transitional Design Lab 2.0 adapter for pre-2.0 editors.
 *
 * The new command bus is the preferred integration path. This adapter lets
 * mature legacy editors participate immediately using their existing, tested
 * UI controls while each editor is migrated to direct command handlers. It is
 * intentionally conservative: commands are only claimed when an existing
 * control can perform the exact action.
 */
export function dispatchLegacyStudioCommand(command: StudioCommandId): boolean {
  if (handleDrawPaint(command)) return true;
  return false;
}
