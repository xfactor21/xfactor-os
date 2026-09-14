import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import ToolShell from './ToolShell';

type ErrorCorrection = 'L' | 'M' | 'Q' | 'H';
type QrPrefs = { version: 2; text: string; fg: string; bg: string; ecc: ErrorCorrection; size: number; margin: number; fileName: string };
const KEY = 'xfactor-studio-qr2-', LEGACY = 'xos-studio-qr-';
const fallback: QrPrefs = { version: 2, text: '', fg: '#ff2aa3', bg: '#050507', ecc: 'M', size: 320, margin: 2, fileName: 'qrcode' };
function load(boardId: string): QrPrefs { try { const raw = localStorage.getItem(KEY + boardId); if (raw) return { ...fallback, ...JSON.parse(raw), version: 2 }; const old = localStorage.getItem(LEGACY + boardId); if (old) return { ...fallback, ...JSON.parse(old), version: 2 }; } catch {} return fallback; }
function dl(blob: Blob, name: string) { const u = URL.createObjectURL(blob), a = document.createElement('a'); a.href = u; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 3000); }
function safeName(v: string) { return (v.trim() || 'qrcode').replace(/[^a-z0-9._-]+/gi, '-'); }

export default function QrGenerator({ boardId, onExit }: { boardId: string; onExit: () => void }) {
  const [prefs, setPrefs] = useState<QrPrefs>(() => load(boardId));
  const [error, setError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => { try { localStorage.setItem(KEY + boardId, JSON.stringify(prefs)); } catch {} }, [boardId, prefs]);
  useEffect(() => {
    const cv = canvasRef.current; if (!cv) return;
    if (!prefs.text.trim()) { cv.getContext('2d')?.clearRect(0, 0, cv.width, cv.height); setError(null); return; }
    QRCode.toCanvas(cv, prefs.text, { width: prefs.size, margin: prefs.margin, errorCorrectionLevel: prefs.ecc, color: { dark: prefs.fg, light: prefs.bg } }, (err) => setError(err ? err.message : null));
  }, [prefs]);
  function png() { canvasRef.current?.toBlob((b) => b && dl(b, `${safeName(prefs.fileName)}.png`), 'image/png'); }
  async function svg() { try { const out = await QRCode.toString(prefs.text, { type: 'svg', width: prefs.size, margin: prefs.margin, errorCorrectionLevel: prefs.ecc, color: { dark: prefs.fg, light: prefs.bg } }); dl(new Blob([out], { type: 'image/svg+xml' }), `${safeName(prefs.fileName)}.svg`); } catch (e) { setError(e instanceof Error ? e.message : 'SVG export failed'); } }
  function spec() { dl(new Blob([JSON.stringify(prefs, null, 2)], { type: 'application/json' }), `${safeName(prefs.fileName)}-qr.json`); }
  return <ToolShell title="QR CODE GENERATOR 2.0" onExit={onExit} actions={<><button className="wbtn ghost" disabled={!prefs.text.trim()} onClick={spec}>SPEC JSON</button><button className="wbtn ghost" disabled={!prefs.text.trim()} onClick={() => void svg()}>SVG</button><button className="wbtn" disabled={!prefs.text.trim()} onClick={png}>PNG</button></>}>
    <div className="toolRow" data-testid="qr-generator-2-root"><div className="toolCol">
      <label className="toolField">TEXT / URL<textarea aria-label="QR content" rows={4} value={prefs.text} onChange={(e) => setPrefs((p) => ({ ...p, text: e.target.value }))} placeholder="Paste a URL or type any text…"/></label>
      <label className="toolField">OUTPUT NAME<input aria-label="QR output name" value={prefs.fileName} onChange={(e) => setPrefs((p) => ({ ...p, fileName: e.target.value }))}/></label>
      <div className="toolRow"><label className="toolField">FOREGROUND<input aria-label="QR foreground" type="color" value={prefs.fg} onChange={(e) => setPrefs((p) => ({ ...p, fg: e.target.value }))}/></label><label className="toolField">BACKGROUND<input aria-label="QR background" type="color" value={prefs.bg} onChange={(e) => setPrefs((p) => ({ ...p, bg: e.target.value }))}/></label></div>
      <div className="toolField"><label>ERROR CORRECTION</label><div className="toolRow">{(['L','M','Q','H'] as ErrorCorrection[]).map((v) => <button key={v} className={`chip small ${prefs.ecc===v?'on':''}`} onClick={() => setPrefs((p) => ({ ...p, ecc: v }))}>{v}</button>)}</div></div>
      <label className="toolField">SIZE {prefs.size}px<input aria-label="QR size" type="range" min="120" max="1024" step="20" value={prefs.size} onChange={(e) => setPrefs((p) => ({ ...p, size: +e.target.value }))}/></label>
      <label className="toolField">QUIET ZONE {prefs.margin} modules<input aria-label="QR margin" type="range" min="0" max="8" step="1" value={prefs.margin} onChange={(e) => setPrefs((p) => ({ ...p, margin: +e.target.value }))}/></label>
      <div className="toolHint">SVG remains vector-sharp at any size; PNG uses the selected raster size. Higher error correction trades capacity for recovery.</div>{error && <div className="toolHint" style={{color:'var(--magenta)'}}>{error}</div>}
    </div><div className="toolCol"><div className="toolCanvasWrap"><canvas ref={canvasRef}/></div>{!prefs.text.trim() && <div className="toolHint">Enter content to generate a real scannable QR code.</div>}</div></div>
  </ToolShell>;
}
