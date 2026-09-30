import { chromium } from 'playwright';

const base = process.env.XFACTOR_BASE_URL || 'http://127.0.0.1:4173';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const failures = [];
const check = async (label, fn) => {
  try { await fn(); console.log(`PASS: ${label}`); }
  catch (error) { failures.push(`${label}: ${error?.message || error}`); console.error(`FAIL: ${label}`); }
};
page.on('pageerror', error => failures.push(`pageerror: ${error.message}`));

await check('Workbench smoke shell loads in a fresh browser', async () => {
  await page.goto(base, { waitUntil: 'networkidle' });
  await page.getByText('xFACTOR.OS').first().waitFor();
  if (!await page.evaluate(() => globalThis.crossOriginIsolated)) throw new Error('crossOriginIsolated is false');
});

await check('Workbench smoke creates an isolated Incident workspace', async () => {
  const firstRun = page.getByRole('button', { name: /THROW IN YOUR FIRST INCIDENT/i });
  if (await firstRun.count()) await firstRun.click();
  const name = page.locator('.blackbox-name');
  await name.waitFor();
  await name.fill('WORKBENCH ACCEPTANCE INCIDENT');
});

await check('Workbench opens with its full cockpit in Normal mode', async () => {
  await page.keyboard.press('Control+K');
  const input = page.getByPlaceholder('TYPE WHAT YOU WANT TO DO...');
  await input.fill('open terminal');
  await input.press('Enter');
  await page.getByText('BUILD THE INCIDENT.').waitFor();
  await page.locator('.dev-workbench').waitFor();
  await page.getByText('BUILD // PROJECT COCKPIT').waitFor();
  const normalState = await page.evaluate(() => {
    const main = document.querySelector('.xf-main');
    const canvases = [...document.querySelectorAll('.xf-main canvas')].map((canvas) => {
      const style = getComputedStyle(canvas);
      return { zIndex: style.zIndex, display: style.display, visibility: style.visibility, opacity: style.opacity };
    });
    return {
      filter: main instanceof HTMLElement ? getComputedStyle(main).filter : 'missing',
      plasmaLayerCanvases: canvases.filter((canvas) => canvas.zIndex === '8' && canvas.display !== 'none' && canvas.visibility !== 'hidden'),
    };
  });
  if (normalState.filter !== 'none') throw new Error('Workbench Normal mode unexpectedly creates a main stacking context');
  if (normalState.plasmaLayerCanvases.length) throw new Error('Workbench Normal mode still carries a Plasma material canvas at z-index 8');
});

await check('Workbench edits a project file and updates static preview', async () => {
  await page.locator('.dev-file').filter({ hasText: 'main.js' }).locator('button').first().click();
  const editor = page.locator('.dev-code-editor .cm-content');
  await editor.waitFor();
  await editor.click();
  await page.keyboard.press('Control+A');
  await page.keyboard.insertText("document.querySelector('#app').innerHTML = '<h1>WORKBENCH SMOKE</h1>';");
  const preview = page.locator('.dev-preview-pane iframe').contentFrame();
  await preview.getByText('WORKBENCH SMOKE').waitFor({ timeout: 10000 });
  const persisted = await page.evaluate(() => {
    const workspace = JSON.parse(localStorage.getItem('xfactor-os-workspace-v2') || '{}');
    const id = workspace.selectedIncidentId;
    if (!id) return false;
    const files = JSON.parse(localStorage.getItem('xfactor-workbench-v1:' + id) || '[]');
    return files.some(file => file.path === 'src/main.js' && file.content.includes('WORKBENCH SMOKE'));
  });
  if (!persisted) throw new Error('Incident-bound Workbench file did not persist');
});

await check('Workbench launches the project through WebContainer + Vite', async () => {
  await page.getByRole('button', { name: /RUN PROJECT/i }).click();
  await page.locator('.dev-status.running').waitFor({ timeout: 90000 });
  const livePreview = page.locator('.dev-preview-pane iframe').contentFrame();
  await livePreview.getByText('WORKBENCH SMOKE').waitFor({ timeout: 15000 });
});

await browser.close();
if (failures.length) {
  console.error(`\nWorkbench browser smoke failures (${failures.length}):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log('\nWorkbench browser smoke checks passed.');
