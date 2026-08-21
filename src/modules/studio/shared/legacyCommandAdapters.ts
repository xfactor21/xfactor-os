import type { StudioCommandId } from './editorCore';
import { handleDrawPaintShortcut } from './drawPaintShortcuts';

/**
 * Transitional Design Lab 2.0 adapter for pre-2.0 editors.
 *
 * Mature editors can participate in the shared command layer while their
 * internal APIs are migrated. Commands are only claimed when an existing
 * editor control can perform the exact action.
 */
export function dispatchLegacyStudioCommand(command: StudioCommandId): boolean {
  if (handleDrawPaintShortcut(command)) return true;
  return false;
}
