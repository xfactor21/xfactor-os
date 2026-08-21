import { useEffect } from 'react';
import type { StudioCommandId } from './editorCore';

const STUDIO_COMMAND_EVENT = 'xfactor:studio-command';

export interface StudioCommandEventDetail {
  command: StudioCommandId;
}

export type StudioCommandHandlers = Partial<Record<StudioCommandId, () => void>>;

/**
 * Dispatch a Design Lab command to the active editor.
 *
 * The event is cancelable. Editors mark a command as handled by calling
 * preventDefault() through useStudioCommandHandlers. That lets the shared
 * workbench avoid swallowing browser shortcuts (for example Cmd/Ctrl+S)
 * when the active tool has not implemented the command yet.
 */
export function dispatchStudioCommand(command: StudioCommandId): boolean {
  const event = new CustomEvent<StudioCommandEventDetail>(STUDIO_COMMAND_EVENT, {
    cancelable: true,
    detail: { command },
  });
  window.dispatchEvent(event);
  return event.defaultPrevented;
}

/**
 * Register command handlers from an editor without coupling that editor to
 * the outer StudioWorkbench component. Only commands with concrete handlers
 * are claimed, so unsupported shortcuts remain available to the browser.
 */
export function useStudioCommandHandlers(handlers: StudioCommandHandlers) {
  useEffect(() => {
    function onCommand(rawEvent: Event) {
      const event = rawEvent as CustomEvent<StudioCommandEventDetail>;
      const handler = handlers[event.detail.command];
      if (!handler) return;
      event.preventDefault();
      handler();
    }

    window.addEventListener(STUDIO_COMMAND_EVENT, onCommand as EventListener);
    return () => window.removeEventListener(STUDIO_COMMAND_EVENT, onCommand as EventListener);
  }, [handlers]);
}
