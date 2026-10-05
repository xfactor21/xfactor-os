import { chromium } from 'playwright';

const base = process.env.XFACTOR_BASE_URL || 'http://127.0.0.1:4173';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const failures = [];

const waitSpatialSettled = async () => {
  const mask = page.locator('.xf-spatial-transition-mask');
  if (await mask.count()) await mask.waitFor({ state: 'detached', timeout: 20000 });
};

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

await check('global Normal Plasma Matter control renders true spatial surfaces from Floor', async () => {
  const control = page.getByLabel('Global spatial display mode');
  await control.waitFor();
  try {
    await page.getByRole('button', { name: 'PLASMA', exact: true }).click();
    await page.locator('.xf-root.xf-plasma-mode').waitFor();
    await waitSpatialSettled();
    const floorSurface = page.locator('.xf-root.xf-plasma-mode .xf-shard.xf-true-spatial.plasma-panel').first();
    await floorSurface.waitFor();
    const plasmaCanvas = page.locator('.xf-root.xf-plasma-mode canvas').first();
    await plasmaCanvas.waitFor();
    const plasmaVisual = await page.evaluate(() => {
      const canvas = document.querySelector('.xf-root.xf-plasma-mode canvas');
      const surface = document.querySelector('.xf-root.xf-plasma-mode .xf-shard.xf-true-spatial');
      const content = document.querySelector('.xf-root.xf-plasma-mode .xf-shard .xf-spatial-content');
      if (!(canvas instanceof HTMLCanvasElement) || !(surface instanceof HTMLElement) || !(content instanceof HTMLElement)) return null;
      const cs = getComputedStyle(surface);
      const canvasStyle = getComputedStyle(canvas);
      const contentStyle = getComputedStyle(content);
      const main = document.querySelector('.xf-root.xf-plasma-mode .xf-main');
      const mainStyle = main instanceof HTMLElement ? getComputedStyle(main) : null;
      return { z: canvasStyle.zIndex, display: canvasStyle.display, background: cs.backgroundColor, backgroundImage: cs.backgroundImage, surfaceZ: cs.zIndex, contentZ: contentStyle.zIndex, contentOpacity: contentStyle.opacity, contentVisibility: contentStyle.visibility, mainFilter: mainStyle?.filter ?? 'missing' };
    });
    if (!plasmaVisual) throw new Error('true Plasma renderer did not mount with readable content');
    if (plasmaVisual.z !== '8' || plasmaVisual.display === 'none') throw new Error('Plasma canvas is not on the M6 material layer');
    if (plasmaVisual.backgroundImage !== 'none' || plasmaVisual.background !== 'rgba(0, 0, 0, 0)') throw new Error('legacy card fill is still covering the WebGL body');
    if (Number(plasmaVisual.contentZ) < 30) throw new Error('card content is not lifted above the material');
    if (Number(plasmaVisual.surfaceZ) <= Number(plasmaVisual.z)) throw new Error('surface stacking plane is not above the Plasma canvas');
    if (plasmaVisual.mainFilter !== 'none') throw new Error('main content creates a stacking context that can trap text under the Plasma canvas');
    if (plasmaVisual.contentOpacity !== '1' || plasmaVisual.contentVisibility !== 'visible') throw new Error('Plasma content plane is visually suppressed');

    await page.getByRole('button', { name: /MATTER/i }).click();
    await page.locator('.xf-root.xf-matter-mode').waitFor();
    await waitSpatialSettled();
    await page.locator('.xf-root.xf-matter-mode .xf-shard.xf-true-spatial.plasma-panel').first().waitFor();
  } finally {
    const spatial = page.locator('.xf-root.xf-plasma-mode, .xf-root.xf-matter-mode');
    if (await spatial.count()) {
      await page.getByRole('button', { name: 'NORMAL', exact: true }).click();
      await waitSpatialSettled();
      await spatial.waitFor({ state: 'detached', timeout: 10000 });
    }
  }
});

await check('Hotwire signal capture works', async () => {
  const hotwire = page.locator('.xf-hotwire input');
  await hotwire.fill('browser smoke thought');
  await page.getByRole('button', { name: 'TASK', exact: true }).click();
  await hotwire.fill('browser smoke liquid pair');
  await page.getByRole('button', { name: 'NOTE', exact: true }).click();
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

await check('Signal Plasma mode is reversible, physical, and creates durable organization', async () => {
  await page.keyboard.press('Control+K');
  const input = page.getByPlaceholder('TYPE WHAT YOU WANT TO DO...');
  await input.fill('open signal');
  await input.press('Enter');
  await page.getByText("DON'T ORGANIZE IT YET.").waitFor();
  const original = page.locator('.signal-row textarea').first();
  const originalText = await original.inputValue();

  try {
    await page.getByRole('button', { name: /PLASMA/i }).click();
    await page.locator('.xf-root.xf-plasma-mode').waitFor();
    await waitSpatialSettled();
    const notes = page.locator('.xf-plasma-note');
    await notes.first().waitFor();
    if (await notes.count() < 2) throw new Error('need two Signal surfaces for fusion acceptance');
    const signalCanvas = page.locator('.xf-root.xf-plasma-mode canvas').first();
    await signalCanvas.waitFor();
    const signalCanvasZ = await signalCanvas.evaluate((node) => getComputedStyle(node).zIndex);
    if (signalCanvasZ !== '8') throw new Error('Signal Plasma canvas is not on the M6 material layer');
    if (await page.locator('.xf-plasma-note.is-fused').count()) throw new Error('Signal cards boot already fused instead of separate');

    // Physical throw acceptance: first surface must travel.
    const physical = notes.first();
    const before = await physical.boundingBox();
    if (!before) throw new Error('M6 Plasma surface has no drag geometry');
    await page.mouse.move(before.x + before.width / 2, before.y + 28);
    await page.mouse.down();
    await page.mouse.move(before.x + before.width / 2 + 110, before.y + 72, { steps: 8 });
    if ((await physical.getAttribute('data-plasma-dragging')) !== 'true') throw new Error('M6 Plasma surface did not enter drag state');
    await page.mouse.up();
    await page.waitForTimeout(450);
    const after = await physical.boundingBox();
    if (!after || Math.hypot(after.x - before.x, after.y - before.y) < 40) throw new Error('M6 Plasma surface did not travel after throw');

    // Move the second surface into contact and require a real fused state + durable bundle.
    const firstBox = await notes.nth(0).boundingBox();
    const secondBox = await notes.nth(1).boundingBox();
    if (!firstBox || !secondBox) throw new Error('Signal fusion geometry missing');
    await page.mouse.move(secondBox.x + secondBox.width / 2, secondBox.y + 28);
    await page.mouse.down();
    await page.mouse.move(firstBox.x + firstBox.width - 35, firstBox.y + firstBox.height / 2, { steps: 12 });
    await page.mouse.up();
    await page.locator('.xf-plasma-note.is-fused').first().waitFor({ timeout: 10000 });
    const bundled = await page.evaluate(() => {
      const workspace = JSON.parse(localStorage.getItem('xfactor-os-workspace-v2') || '{}');
      return Array.isArray(workspace.spatialBundles) && workspace.spatialBundles.some(bundle =>
        Array.isArray(bundle.members) && bundle.members.filter(member => member.kind === 'signal').length >= 2);
    });
    if (!bundled) throw new Error('physical Signal fusion did not persist a spatial bundle');

    const plasmaEditor = page.locator('.xf-plasma-note textarea').first();
    await plasmaEditor.fill(originalText + ' // PLASMA SAFE');
  } finally {
    if (await page.locator('.xf-root.xf-plasma-mode').count()) {
      await page.getByRole('button', { name: 'NORMAL', exact: true }).click();
      await waitSpatialSettled();
      await page.locator('.xf-root.xf-plasma-mode').waitFor({ state: 'detached', timeout: 10000 });
    }
  }

  await page.getByText("DON'T ORGANIZE IT YET.").waitFor();
  const returnedText = await page.locator('.signal-row textarea').first().inputValue();
  if (!returnedText.includes('PLASMA SAFE')) throw new Error('Signal edit did not survive Plasma -> Normal transition');
});

await check('Signal Matter mode uses canonical Signal data', async () => {
  await page.keyboard.press('Control+K');
  const input = page.getByPlaceholder('TYPE WHAT YOU WANT TO DO...');
  await input.fill('open signal');
  await input.press('Enter');
  try {
    await page.getByRole('button', { name: /MATTER/i }).click();
    await page.locator('.xf-root.xf-matter-mode').waitFor();
    await waitSpatialSettled();
    await page.getByText('THOUGHTS HAVE WEIGHT NOW.').waitFor();
    const editor = page.locator('.xf-matter-note textarea').first();
    await editor.waitFor();
    const value = await editor.inputValue();
    if (!value.includes('PLASMA SAFE')) throw new Error('Matter did not receive the canonical Signal edit');
  } finally {
    if (await page.locator('.xf-root.xf-matter-mode').count()) {
      // Floor acceptance already exercises a real pointer click. Here the goal is
      // deterministic teardown under GPU load, so avoid Playwright actionability
      // waiting on continuously animated material geometry.
      await page.getByRole('button', { name: 'NORMAL' }).dispatchEvent('click');
      await waitSpatialSettled();
      await page.locator('.xf-root.xf-matter-mode').waitFor({ state: 'detached', timeout: 10000 });
    }
  }
});

await check('M6 Files Browser Settings shell routes', async () => {
  for (const [command, heading] of [['open files','SHATTER EXPLORER.'],['open browser','STEAL THE USEFUL PARTS.'],['fabrix suite','CONNECTED DAMAGE.'],['open settings','TUNE THE CHAOS.']]) {
    await page.keyboard.press('Control+K');
    const input = page.getByPlaceholder('TYPE WHAT YOU WANT TO DO...');
    await input.fill(command);
    await input.press('Enter');
    await page.getByText(heading).waitFor();
  }
  await page.keyboard.press('Control+K');
  const suiteInput = page.getByPlaceholder('TYPE WHAT YOU WANT TO DO...');
  await suiteInput.fill('fabrix suite');
  await suiteInput.press('Enter');
  await page.getByText('CONNECTED DAMAGE.').waitFor();
  await page.getByText('DESKTOP BRIDGE REQUIRED').waitFor();
  await page.locator('.xf-command-fab').waitFor();
});

await check('Incident Developer Workbench opens', async () => {
  await page.keyboard.press('Control+K');
  const input = page.getByPlaceholder('TYPE WHAT YOU WANT TO DO...');
  await input.fill('open terminal');
  await input.press('Enter');
  await page.getByText('BUILD THE INCIDENT.').waitFor();
  await page.locator('.dev-workbench').waitFor();
  await page.getByText('BUILD // PROJECT COCKPIT').waitFor();
  await page.getByText('NO DISK PROJECT ATTACHED').waitFor();
  const workbenchDock = page.locator('.dev-dock-tabs');
  await workbenchDock.getByRole('button', { name: 'TERMINAL', exact: true }).waitFor();
  await workbenchDock.getByRole('button', { name: /PROBLEMS/ }).waitFor();
  await workbenchDock.getByRole('button', { name: 'SOURCE CONTROL', exact: true }).waitFor();
  await workbenchDock.getByRole('button', { name: /PROJECT SEARCH/ }).waitFor();
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


await browser.close();
if (failures.length) {
  console.error(`\nBrowser smoke failures (${failures.length}):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log('\nBrowser smoke checks passed.');
