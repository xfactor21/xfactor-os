export type StudioCommandId =
  | 'help'
  | 'exit'
  | 'undo'
  | 'redo'
  | 'zoomIn'
  | 'zoomOut'
  | 'zoomReset'
  | 'zoomFit'
  | 'save'
  | 'brushTool'
  | 'eraserTool'
  | 'marqueeTool'
  | 'lassoTool'
  | 'wandTool'
  | 'eyedropperTool'
  | 'textTool'
  | 'brushSmaller'
  | 'brushLarger'
  | 'layerAbove'
  | 'layerBelow'
  | 'duplicateLayer';

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
  { id: 'zoomReset', label: 'Actual size', keys: ['Ctrl/Cmd', '0'], description: 'Reset canvas zoom to 100% when supported' },
  { id: 'zoomFit', label: 'Fit canvas', keys: ['Ctrl/Cmd', 'Shift', '0'], description: 'Draw/Paint: fit the entire canvas into the visible workspace' },
  { id: 'save', label: 'Save', keys: ['Ctrl/Cmd', 'S'], description: 'Commit or persist the active document when supported' },
  { id: 'brushTool', label: 'Brush', keys: ['B'], description: 'Draw/Paint: switch to the brush tool' },
  { id: 'eraserTool', label: 'Eraser', keys: ['E'], description: 'Draw/Paint: switch to the eraser tool' },
  { id: 'marqueeTool', label: 'Marquee', keys: ['M'], description: 'Draw/Paint: switch to rectangular selection' },
  { id: 'lassoTool', label: 'Lasso', keys: ['L'], description: 'Draw/Paint: switch to free-form selection' },
  { id: 'wandTool', label: 'Magic wand', keys: ['W'], description: 'Draw/Paint: switch to color-region selection' },
  { id: 'eyedropperTool', label: 'Eyedropper', keys: ['I'], description: 'Draw/Paint: sample a color from the canvas' },
  { id: 'textTool', label: 'Text', keys: ['T'], description: 'Draw/Paint: switch to the text tool' },
  { id: 'brushSmaller', label: 'Smaller brush', keys: ['['], description: 'Draw/Paint: reduce the active brush size' },
  { id: 'brushLarger', label: 'Larger brush', keys: [']'], description: 'Draw/Paint: increase the active brush size' },
  { id: 'layerBelow', label: 'Layer below', keys: ['Alt', '['], description: 'Draw/Paint: select the layer immediately below the active layer' },
  { id: 'layerAbove', label: 'Layer above', keys: ['Alt', ']'], description: 'Draw/Paint: select the layer immediately above the active layer' },
  { id: 'duplicateLayer', label: 'Duplicate layer', keys: ['Ctrl/Cmd', 'J'], description: 'Draw/Paint: duplicate the active layer' },
];

export function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return target.isContentEditable || tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
}
