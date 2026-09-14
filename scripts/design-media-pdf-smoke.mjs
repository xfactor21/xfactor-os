import { chromium } from 'playwright';
import { PDFDocument } from 'pdf-lib';
import { readFile } from 'node:fs/promises';

const base = process.env.XFACTOR_BASE_URL || 'http://127.0.0.1:4173';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 1050 }, acceptDownloads: true });
const failures = [];
const check = async (label, fn) => { try { await fn(); console.log(`PASS: ${label}`); } catch (e) { failures.push(`${label}: ${e?.message || e}`); console.error(`FAIL: ${label}`, e); } };
page.on('pageerror', (e) => failures.push(`pageerror: ${e.message}`));

function makeWav(seconds = 1, rate = 8000) {
  const frames = seconds * rate, dataSize = frames * 2, buf = Buffer.alloc(44 + dataSize);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + dataSize, 4); buf.write('WAVEfmt ', 8); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22); buf.writeUInt32LE(rate, 24); buf.writeUInt32LE(rate * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34); buf.write('data', 36); buf.writeUInt32LE(dataSize, 40);
  for (let i = 0; i < frames; i++) buf.writeInt16LE(Math.round(Math.sin(i / rate * Math.PI * 2 * 440) * 12000), 44 + i * 2);
  return buf;
}

const pdf = await PDFDocument.create();
pdf.addPage([300, 200]);
const pdfBytes = Buffer.from(await pdf.save());
const boards = [
  { id: 'video2-test', name: 'VIDEO2 TEST', mode: 'videoTrimmer' },
  { id: 'audio2-test', name: 'AUDIO2 TEST', mode: 'audioTrimmer' },
  { id: 'pdf2-test', name: 'PDF2 TEST', mode: 'pdfMarkup' },
];

await page.goto(base, { waitUntil: 'networkidle' });
await page.evaluate((b) => localStorage.setItem('xfactor-studio-boards-v1', JSON.stringify(b.map((x) => ({ ...x, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() })))), boards);
await page.reload({ waitUntil: 'networkidle' });
async function openLab() { await page.keyboard.press('Control+K'); const cmd = page.getByPlaceholder('TYPE WHAT YOU WANT TO DO...'); await cmd.fill('open lab'); await cmd.press('Enter'); }
async function open(name, testId) { await openLab(); await page.locator('.dpBoardCard').filter({ hasText: name }).click(); await page.getByTestId(testId).waitFor(); }
async function back() { await page.getByRole('button', { name: 'ALL BOARDS', exact: true }).click(); await page.locator('.dpBoardCard').first().waitFor(); }

await check('Video Trimmer 2.0 loads real WebM metadata and persists exact in/out controls', async () => {
  await open('VIDEO2 TEST', 'video-trimmer-2-root');
  const bytes = await page.evaluate(async () => {
    const c = document.createElement('canvas'); c.width = 64; c.height = 64; const ctx = c.getContext('2d'); const stream = c.captureStream(20);
    const rec = new MediaRecorder(stream, { mimeType: MediaRecorder.isTypeSupported('video/webm;codecs=vp8') ? 'video/webm;codecs=vp8' : 'video/webm' }); const chunks = [];
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data); rec.start(50);
    for (let i = 0; i < 12; i++) { ctx.fillStyle = i % 2 ? '#ff2d78' : '#00f5ff'; ctx.fillRect(0, 0, 64, 64); await new Promise((r) => setTimeout(r, 50)); }
    const done = new Promise((resolve) => { rec.onstop = async () => resolve(Array.from(new Uint8Array(await new Blob(chunks, { type: 'video/webm' }).arrayBuffer()))); }); rec.stop(); return await done;
  });
  await page.getByLabel('Video file').setInputFiles([{ name: 'tiny.webm', mimeType: 'video/webm', buffer: Buffer.from(bytes) }]);
  await page.getByLabel('Video trim end').waitFor();
  const dur = Number(await page.getByLabel('Video trim end').inputValue()); if (!(dur > 0)) throw new Error(`invalid video duration ${dur}`);
  const end = Math.max(0.1, dur * 0.8), start = Math.min(end - 0.05, dur * 0.2);
  await page.getByLabel('Video trim start').fill(start.toFixed(2)); await page.getByLabel('Video trim end').fill(end.toFixed(2)); await page.getByLabel('Video export name').fill('clip-test'); await page.waitForTimeout(150);
  const prefs = await page.evaluate(() => JSON.parse(localStorage.getItem('xfactor-studio-videotrim2-video2-test') || '{}'));
  if (prefs.exportName !== 'clip-test' || Math.abs(prefs.start - start) > 0.03 || Math.abs(prefs.end - end) > 0.03) throw new Error('video trim prefs did not persist exact values');
  await back();
});

await check('Audio Trimmer 2.0 decodes WAV, persists exact trim/fades, and exports real WAV', async () => {
  await page.locator('.dpBoardCard').filter({ hasText: 'AUDIO2 TEST' }).click(); await page.getByTestId('audio-trimmer-2-root').waitFor();
  await page.getByLabel('Audio file').setInputFiles([{ name: 'tone.wav', mimeType: 'audio/wav', buffer: makeWav() }]); await page.getByLabel('Audio trim end').waitFor();
  await page.getByLabel('Audio trim start').fill('0.10'); await page.getByLabel('Audio trim end').fill('0.80'); await page.getByLabel('Audio export name').fill('tone-cut'); await page.getByLabel('Audio fade in').fill('0.10'); await page.getByLabel('Audio fade out').fill('0.12'); await page.waitForTimeout(200);
  const prefs = await page.evaluate(() => JSON.parse(localStorage.getItem('xfactor-studio-audiotrim2-audio2-test') || '{}'));
  if (prefs.exportName !== 'tone-cut' || Math.abs(prefs.start - 0.1) > 0.02 || Math.abs(prefs.end - 0.8) > 0.02 || Math.abs(prefs.fadeIn - 0.1) > 0.02 || Math.abs(prefs.fadeOut - 0.12) > 0.02) throw new Error('audio trim/fade prefs did not persist');
  const pending = page.waitForEvent('download'); await page.getByRole('button', { name: 'EXPORT WAV', exact: true }).click(); const dl = await pending; const path = await dl.path(); if (!path) throw new Error('WAV download path unavailable'); const out = await readFile(path); if (out.subarray(0, 4).toString() !== 'RIFF' || out.subarray(8, 12).toString() !== 'WAVE') throw new Error('export is not a valid WAV container');
  await back();
});

await check('PDF Markup 2.0 persists editable annotations with undo/redo and sidecar export', async () => {
  await page.locator('.dpBoardCard').filter({ hasText: 'PDF2 TEST' }).click(); await page.getByTestId('pdf-markup-2-root').waitFor(); await page.getByLabel('PDF file').setInputFiles([{ name: 'blank.pdf', mimeType: 'application/pdf', buffer: pdfBytes }]);
  const canvas = page.getByTestId('pdf-markup-2-root').locator('canvas'); await canvas.waitFor(); await page.getByRole('button', { name: 'RECT', exact: true }).click(); const box = await canvas.boundingBox(); if (!box) throw new Error('PDF canvas missing'); await page.mouse.move(box.x + 40, box.y + 40); await page.mouse.down(); await page.mouse.move(box.x + 140, box.y + 100); await page.mouse.up(); await page.waitForTimeout(200);
  let prefs = await page.evaluate(() => JSON.parse(localStorage.getItem('xfactor-studio-pdfmarkup2-pdf2-test') || '{}')); if (!prefs.annotations?.['0']?.length) throw new Error('PDF annotation did not persist');
  await page.getByRole('button', { name: 'UNDO', exact: true }).click(); await page.waitForTimeout(100); prefs = await page.evaluate(() => JSON.parse(localStorage.getItem('xfactor-studio-pdfmarkup2-pdf2-test') || '{}')); if ((prefs.annotations?.['0'] || []).length !== 0) throw new Error('PDF undo did not clear annotation');
  await page.getByRole('button', { name: 'REDO', exact: true }).click(); await page.waitForTimeout(100); prefs = await page.evaluate(() => JSON.parse(localStorage.getItem('xfactor-studio-pdfmarkup2-pdf2-test') || '{}')); if ((prefs.annotations?.['0'] || []).length !== 1) throw new Error('PDF redo did not restore annotation');
  const pending = page.waitForEvent('download'); await page.getByRole('button', { name: 'ANNOTATIONS JSON', exact: true }).click(); const dl = await pending; const path = await dl.path(); if (!path) throw new Error('annotation JSON download path unavailable'); const sidecar = JSON.parse(await readFile(path, 'utf8')); if (sidecar.version !== 2 || !sidecar.annotations?.['0']?.length) throw new Error('sidecar export missing editable annotation data');
});

await browser.close();
if (failures.length) { console.error(`\nMedia/PDF utility failures (${failures.length}):`); failures.forEach((f) => console.error(`- ${f}`)); process.exit(1); }
console.log('\nMedia + PDF utilities 2.0 browser acceptance passed.');
