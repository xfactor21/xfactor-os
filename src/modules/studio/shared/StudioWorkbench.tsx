import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import Icon from '../../../design-system/icons/Icon';
import { isEditableTarget, STUDIO_COMMANDS } from './editorCore';
import { dispatchStudioCommand } from './studioCommandBus';
import { dispatchLegacyStudioCommand } from './legacyCommandAdapters';
import { useDrawPaintNavigation } from './useDrawPaintNavigation';

interface Props {
  boardName: string;
  modeLabel: string;
  onExit: () => void;
  children: ReactNode;
}

/** Shared editor shell for Design Lab 2.0. */
export default function StudioWorkbench({ boardName, modeLabel, onExit, children }: Props) {
  const [helpOpen, setHelpOpen] = useState(false);
  useDrawPaintNavigation();

  useEffect(() => {
    function runCommand(command: Parameters<typeof dispatchStudioCommand>[0], event: KeyboardEvent) {
      const handled = dispatchStudioCommand(command) || dispatchLegacyStudioCommand(command);
      if (handled) event.preventDefault();
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented) return;
      const editable = isEditableTarget(event.target);
      const mod = event.metaKey || event.ctrlKey;

      if (event.key === '?' && !editable) {
        event.preventDefault();
        setHelpOpen((value) => !value);
        return;
      }

      if (event.key === 'Escape') {
        if (helpOpen) {
          event.preventDefault();
          setHelpOpen(false);
          return;
        }
        if (!editable) {
          event.preventDefault();
          onExit();
        }
        return;
      }

      if (editable) return;

      if (!mod) {
        const key = event.key.toLowerCase();
        if (event.altKey && event.key === '[') return runCommand('layerBelow', event);
        if (event.altKey && event.key === ']') return runCommand('layerAbove', event);
        if (key === 'b') return runCommand('brushTool', event);
        if (key === 'e') return runCommand('eraserTool', event);
        if (key === 'm') return runCommand('marqueeTool', event);
        if (key === 'l') return runCommand('lassoTool', event);
        if (key === 'w') return runCommand('wandTool', event);
        if (key === 'i') return runCommand('eyedropperTool', event);
        if (key === 't') return runCommand('textTool', event);
        if (event.key === '[') return runCommand('brushSmaller', event);
        if (event.key === ']') return runCommand('brushLarger', event);
        return;
      }

      const key = event.key.toLowerCase();
      let command: Parameters<typeof dispatchStudioCommand>[0] | null = null;
      if (key === 'z') command = event.shiftKey ? 'redo' : 'undo';
      else if (key === 'y') command = 'redo';
      else if (key === '+' || key === '=') command = 'zoomIn';
      else if (key === '-' || key === '_') command = 'zoomOut';
      else if (key === '0') command = event.shiftKey ? 'zoomFit' : 'zoomReset';
      else if (key === 'j') command = 'duplicateLayer';
      else if (key === 's') command = 'save';
      if (command) runCommand(command, event);
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [helpOpen, onExit]);

  return (
    <div className="studioWorkbench" data-studio-workbench="true">
      <div
        className="studioWorkbenchStatus"
        style={{
          display: 'flex', alignItems: 'center', gap: 10, minHeight: 30, padding: '4px 8px', margin: '0 4px 8px',
          border: '1px solid rgba(255,255,255,.08)', background: 'rgba(5,8,13,.72)', backdropFilter: 'blur(12px)',
          fontSize: 9, letterSpacing: '.08em', textTransform: 'uppercase',
        }}
      >
        <button className="chip" onClick={onExit} title="Back to all Design Lab boards (Esc)">
          <Icon name="chevronLeft" size={11} /> BOARDS
        </button>
        <span style={{ opacity: 0.56 }}>{modeLabel}</span>
        <span style={{ opacity: 0.24 }}>//</span>
        <strong style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{boardName}</strong>
        <span style={{ marginLeft: 'auto', opacity: 0.5 }}>ESC BACK · ? SHORTCUTS</span>
        <button className="chip small" onClick={() => setHelpOpen(true)} title="Keyboard shortcuts">?</button>
      </div>

      {children}

      {helpOpen && (
        <div role="dialog" aria-modal="true" aria-label="Design Lab keyboard shortcuts"
          onMouseDown={(event) => { if (event.target === event.currentTarget) setHelpOpen(false); }}
          style={{ position: 'fixed', inset: 0, zIndex: 12000, display: 'grid', placeItems: 'center', background: 'rgba(0,0,0,.72)', padding: 20 }}
        >
          <div className="gpanel" style={{ width: 'min(620px, 94vw)', maxHeight: '82vh', overflow: 'auto', padding: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <Icon name="designStudio" size={16} />
              <h3 style={{ margin: 0 }}>DESIGN LAB SHORTCUTS</h3>
              <button className="chip small" onClick={() => setHelpOpen(false)} style={{ marginLeft: 'auto' }}>CLOSE</button>
            </div>
            <div style={{ display: 'grid', gap: 7 }}>
              {STUDIO_COMMANDS.map((command) => (
                <div key={command.id} style={{ display: 'grid', gridTemplateColumns: '150px 1fr', gap: 12, padding: '9px 10px', border: '1px solid rgba(255,255,255,.06)', background: 'rgba(255,255,255,.025)' }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {command.keys.map((key) => <kbd key={key} style={{ padding: '2px 6px', border: '1px solid rgba(255,255,255,.16)', borderRadius: 3, fontSize: 9 }}>{key}</kbd>)}
                  </div>
                  <div>
                    <strong style={{ display: 'block', fontSize: 10 }}>{command.label}</strong>
                    <span style={{ opacity: 0.55, fontSize: 9 }}>{command.description}</span>
                  </div>
                </div>
              ))}
            </div>
            <p style={{ opacity: 0.48, fontSize: 9, margin: '14px 0 0' }}>
              Supported commands are claimed by the active editor. Unsupported shortcuts are left to the browser, and shortcuts never steal keystrokes while typing in an input, textarea, select, or content-editable field.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
