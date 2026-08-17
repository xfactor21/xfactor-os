import { chromium } from 'playwright';

const base = process.env.XFACTOR_BASE_URL || 'http://127.0.0.1:4173';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const failures = [];

const studioModes = [
  'draw', 'wireframe', 'animation', 'vector', 'diagram', 'moodboard', 'presentation', 'iconDesign',
  'imageConverter', 'backgroundRemover', 'paletteGenerator', 'quickPhotoEditor', 'logoMaker', 'pixelArt',
  'videoTrimmer', 'audioTrimmer', 'pdfMarkup', 'qrGenerator', 'memeGenerator', 'fontPairing',
  'screenshotAnnotator', 'gifMaker', 'chartBuilder', 'printLayout', 'modelViewer',
];

const check = async (label, fn) => {
  try { await fn(); console.log(`PASS: ${label}`); }
  catch (error) { failures.push(`${label}: ${error?.message || error}`); console.error(`FAIL: ${label}`); }
};

page.on('pageerror', error => failures.push(`pageerror: ${error.message}`));

await check('main shell loads', async () => {
  await page.goto(base, { waitUntil: 'networkidle' });
  await page.getByText('xFACTOR.OS').first().waitFor();
});

await check('preview is cross-origin isolated', async () => {
  const isolated = await page.evaluate(() => globalThis.crossOriginIsolated);
  if (!isolated) throw new Error('crossOriginIsolated is false');
});

await check('first-run workspace is empty', async () => {
  await page.getByText('YOUR FLOOR IS EMPTY.').waitFor();
});

await check('incident creation and persistence', async () => {
  await page.getByRole('button', { name: /THROW IN YOUR FIRST INCIDENT/i }).click();
  const name = page.locator('.blackbox-name');
  await name.waitFor();
  await name.fill('BROWSER SMOKE INCIDENT');
  await page.waitForTimeout(150);
  await page.reload({ waitUntil: 'networkidle' });
  await page.getByText('BROWSER SMOKE INCIDENT').first().waitFor();
});

await check('Hotwire signal capture works', async () => {
  const hotwire = page.locator('.xf-hotwire input');
  await hotwire.fill('browser smoke thought');
  await page.getByRole('button', { name: 'TASK', exact: true }).click();
  await page.keyboard.press('Control+J');
  await page.getByText('browser smoke thought').waitFor();
});

await check('Command Deck routes to Vault', async () => {
  await page.keyboard.press('Control+K');
  const input = page.getByPlaceholder('TYPE WHAT YOU WANT TO DO...');
  await input.fill('open vault');
  await input.press('Enter');
  await page.getByText('BURY IT WITH COORDINATES.').waitFor();
});

await check('Black Vault file survives reload through IndexedDB', async () => {
  const fileInput = page.locator('input[type="file"][multiple]');
  await fileInput.setInputFiles({
    name: 'browser-smoke-vault.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('xFactor.OS Black Vault IndexedDB persistence smoke'),
  });
  await page.getByText('browser-smoke-vault.txt').waitFor();
  const beforeReload = await page.evaluate(async () => {
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open('xfactor-os-assets');
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
    try {
      if (!db.objectStoreNames.contains('blobs')) return false;
      return await new Promise((resolve, reject) => {
        const tx = db.transaction('blobs', 'readonly');
        const count = tx.objectStore('blobs').count();
        count.onsuccess = () => resolve(count.result > 0);
        count.onerror = () => reject(count.error);
      });
    } finally { db.close(); }
  });
  if (!beforeReload) throw new Error('Vault IndexedDB contains no persisted blob');
  await page.reload({ waitUntil: 'networkidle' });
  await page.keyboard.press('Control+K');
  const input = page.getByPlaceholder('TYPE WHAT YOU WANT TO DO...');
  await input.fill('open vault');
  await input.press('Enter');
  await page.getByText('browser-smoke-vault.txt').waitFor();
});

await check('Tape view opens', async () => {
  await page.keyboard.press('Control+K');
  const input = page.getByPlaceholder('TYPE WHAT YOU WANT TO DO...');
  await input.fill('open tape');
  await input.press('Enter');
  await page.getByText('THE MESS HAS A MEMORY.').waitFor();
});

await check('Terminal surface opens', async () => {
  await page.keyboard.press('Control+K');
  const input = page.getByPlaceholder('TYPE WHAT YOU WANT TO DO...');
  await input.fill('open terminal');
  await input.press('Enter');
  await page.getByText('POWER TOOLS, NO TRAINING WHEELS.').waitFor();
});

for (const runtime of ['PYTHON', 'RUBY', 'PHP', 'GO', 'NODE.JS']) {
  await check(`Terminal ${runtime} runtime boots`, async () => {
    const chip = page.locator('#r-terminal .chip').filter({ hasText: runtime }).first();
    await chip.click();
    await page.locator('#r-terminal .terminalStatus.ready').waitFor({ state: 'visible', timeout: runtime === 'NODE.JS' ? 30000 : 20000 });
  });
}

await check('Design Lab surface opens', async () => {
  await page.keyboard.press('Control+K');
  const input = page.getByPlaceholder('TYPE WHAT YOU WANT TO DO...');
  await input.fill('open lab');
  await input.press('Enter');
  await page.getByRole('button', { name: /EXIT LAB/i }).waitFor();
});

await check('all 25 Design Lab modes mount in production browser', async () => {
  await page.getByRole('button', { name: /EXIT LAB/i }).click();
  await page.evaluate((modes) => {
    const now = new Date().toISOString();
    const boards = modes.map((mode, index) => ({
      id: `browser-smoke-${index}-${mode}`,
      name: `SMOKE ${mode}`,
      mode,
      createdAt: now,
      updatedAt: now,
    }));
    localStorage.setItem('xfactor-studio-boards-v1', JSON.stringify(boards));
  }, studioModes);
  await page.reload({ waitUntil: 'networkidle' });

  for (const mode of studioModes) {
    await page.keyboard.press('Control+K');
    const input = page.getByPlaceholder('TYPE WHAT YOU WANT TO DO...');
    await input.fill('open lab');
    await input.press('Enter');
    await page.getByRole('button', { name: /EXIT LAB/i }).waitFor();

    const boardName = `SMOKE ${mode}`;
    await page.locator('.dpBoardCard').filter({ hasText: boardName }).click();
    await page.locator('#r-studio .rh').filter({ hasText: boardName }).waitFor({ timeout: 15000 });
    const childCount = await page.locator('#r-studio').evaluate((el) => el.children.length);
    if (childCount < 2) throw new Error(`${mode} did not mount a tool surface`);
    console.log(`PASS: Design Lab mode mounts: ${mode}`);

    await page.getByRole('button', { name: /EXIT LAB/i }).click();
    await page.getByText('xFACTOR.OS').first().waitFor();
  }
});

await browser.close();
if (failures.length) {
  console.error(`\nBrowser smoke failures (${failures.length}):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log('\nBrowser smoke checks passed.');
