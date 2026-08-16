import { useState } from 'react';
import { event, loadWorkspace, newSignal, saveWorkspace } from '../xfactor/store';
import Icon from '../design-system/icons/Icon';

const CHANNEL = 'xfactor-os-workspace';

/** Desktop tray capture writes into the exact same xFactor.OS workspace as
 * Hotwire. It remains local-first and does not require an account or the
 * legacy xOS `nodes` table. */
export default function CaptureWidget() {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ kind: 'saved' | 'error'; text: string } | null>(null);

  function submit() {
    const value = text.trim();
    if (!value || busy) return;
    setBusy(true);
    setResult(null);
    try {
      const workspace = loadWorkspace();
      const incidentId = workspace.selectedIncidentId;
      const next = {
        ...workspace,
        signals: [newSignal(value, 'spark', incidentId), ...workspace.signals],
        activity: [event('signal', `Quick Capture${incidentId ? ' into incident' : ''}`, incidentId), ...workspace.activity],
      };
      if (!saveWorkspace(next)) throw new Error('Local storage is unavailable. Capture was not saved.');
      try {
        const channel = new BroadcastChannel(CHANNEL);
        channel.postMessage({ type: 'workspace-updated' });
        channel.close();
      } catch {
        // Storage events still cover standard multi-window browsers/webviews.
      }
      setText('');
      setResult({ kind: 'saved', text: 'Captured into xFactor.OS.' });
    } catch (error) {
      setResult({ kind: 'error', text: error instanceof Error ? error.message : 'Capture failed.' });
    } finally {
      setBusy(false);
      window.setTimeout(() => setResult(null), 2500);
    }
  }

  return (
    <div className="widgetRoot">
      <div className="widgetHeader">
        <Icon name="neuralCapture" size={13} glow="magenta" /> xFACTOR.OS // HOTWIRE
      </div>
      <textarea
        className="widgetTextarea"
        autoFocus
        placeholder="Throw a thought into the system…"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit();
        }}
      />
      <div className="widgetFooter">
        <span className="widgetHint">Cmd/Ctrl+Enter to burn it in</span>
        <button className="widgetSubmit" onClick={submit} disabled={busy || !text.trim()}>
          {busy ? 'SAVING…' : 'BURN IT IN'}
        </button>
      </div>
      {result && <div className={`widgetResult widgetResult-${result.kind}`}>{result.text}</div>}
    </div>
  );
}
