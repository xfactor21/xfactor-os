export type StudioCommandId =
  | 'help'
  | 'exit'
  | 'undo'
  | 'redo'
  | 'zoomIn'
  | 'zoomOut'
  | 'zoomReset'
  | 'save';

export interface StudioCommand {
  id: StudioCommandId;
  label: string;
  keys: string[];
  description: string;
}

export const STUDIO_COMMANDS: StudioCommand[] = [
  { id: 'help', label: 'Shortcut help', keys: ['?'], description: 'Show Design Lab keyboard shortcuts' },
  { id: 'exit', label: 'Back to boards', keys: ['Esc'], description: 'Leave the current tool when no editor field is focused' },
  { id: 'undo', label: 'Undo', keys: ['Ctrl/Cmd', 'Z'], description: 'Undo in tools that expose editor history' },
  { id: 'redo', label: 'Redo', keys: ['Ctrl/Cmd', 'Shift', 'Z'], description: 'Redo in tools that expose editor history' },
  { id: 'zoomIn', label: 'Zoom in', keys: ['Ctrl/Cmd', '+'], description: 'Zoom the active canvas when supported' },
  { id: 'zoomOut', label: 'Zoom out', keys: ['Ctrl/Cmd', '-'], description: 'Zoom the active canvas when supported' },
  { id: 'zoomReset', label: 'Actual size', keys: ['Ctrl/Cmd', '0'], description: 'Reset canvas zoom when supported' },
  { id: 'save', label: 'Save', keys: ['Ctrl/Cmd', 'S'], description: 'Commit or persist the active document when supported' },
];

export function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return target.isContentEditable || tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
}
