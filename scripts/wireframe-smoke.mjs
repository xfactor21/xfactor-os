import { chromium } from 'playwright';

const base = process.env.XFACTOR_BASE_URL || 'http://127.0.0.1:4173';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 1050 } });
const failures = [];
const check = async (label, fn) => {
  try { await fn(); console.log(`PASS: ${label}`); }
  catch (error) { failures.push(`${label}: ${error?.message || error}`); console.error(`FAIL: ${label}`, error); }
};
page.on('pageerror', (error) => failures.push(`pageerror: ${error.message}`));
const allowAutosave = () => page.waitForTimeout(300);

await page.goto(base, { waitUntil: 'networkidle' });
await page.evaluate(() => {
  localStorage.setItem('xfactor-studio-boards-v1', JSON.stringify([{
    id: 'wireframe-2-acceptance',
    name: 'WIREFRAME 2 ACCEPTANCE',
    mode: 'wireframe',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }]));
  localStorage.removeItem('xos-studio-wf-wireframe-2-acceptance');
});
await page.reload({ waitUntil: 'networkidle' });

await check('Wireframe 2.0 opens from Design Lab', async () => {
  await page.keyboard.press('Control+K');
  const command = page.getByPlaceholder('TYPE WHAT YOU WANT TO DO...');
  await command.fill('open lab');
  await command.press('Enter');
  await page.locator('.dpBoardCard').filter({ hasText: 'WIREFRAME 2 ACCEPTANCE' }).click();
  await page.locator('.wf2').waitFor();
  await page.getByText('LAYERS', { exact: false }).first().waitFor();
  await page.getByText('INSPECTOR', { exact: true }).waitFor();
});

await check('device-frame presets create real frames', async () => {
  await page.getByRole('button', { name: 'MOBILE', exact: true }).click();
  await page.getByRole('button', { name: 'DESKTOP', exact: true }).click();
  const frames = page.locator('.wf2-item.wf2-frame');
  if (await frames.count() !== 2) throw new Error(`expected 2 frames, got ${await frames.count()}`);
});

await check('component instances attach to a frame and expose variants/constraints', async () => {
  await page.locator('.wf2-layer').filter({ hasText: 'Mobile 390' }).click();
  await page.getByRole('button', { name: /Primary Button/ }).first().click();
  const component = page.locator('.wf2-item.wf2-component');
  await component.waitFor();
  await allowAutosave();
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('xos-studio-wf-wireframe-2-acceptance') || '{}'));
  const item = stored.items?.find((entry) => entry.type === 'component');
  if (!item?.componentId) throw new Error('component instance has no componentId');
  if (!item?.parentFrameId) throw new Error('component instance did not auto-parent to a frame');
  const h = page.locator('.wf2-inspector label').filter({ hasText: 'HORIZONTAL' }).locator('select');
  await h.selectOption('right');
  const v = page.locator('.wf2-inspector label').filter({ hasText: 'VERTICAL' }).locator('select');
  await v.selectOption('bottom');
  const state = page.locator('.wf2-inspector label').filter({ hasText: 'STATE' }).locator('select');
  await state.selectOption('hover');
  await allowAutosave();
});

await check('alignment controls operate on multi-selection', async () => {
  await page.getByRole('button', { name: 'DUPLICATE', exact: true }).click();
  const components = page.locator('.wf2-item.wf2-component');
  if (await components.count() < 2) throw new Error('duplicate did not create a second component');
  await components.nth(0).click();
  await components.nth(1).click({ modifiers: ['Shift'] });
  await page.getByRole('button', { name: 'CX', exact: true }).click();
  await allowAutosave();
});

await check('prototype link creates a navigable preview', async () => {
  await page.getByRole('button', { name: 'LINK', exact: true }).click();
  await page.locator('.wf2-item.wf2-component').first().click();
  await page.locator('.wf2-item.wf2-frame').nth(1).click();
  await allowAutosave();
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('xos-studio-wf-wireframe-2-acceptance') || '{}'));
  if (!stored.links?.length) throw new Error('prototype link was not persisted');

  await page.locator('.wf2-layer').filter({ hasText: 'Mobile 390' }).click();
  await page.getByRole('button', { name: /PLAY/ }).click();
  await page.locator('.wf2-playoverlay').waitFor();
  const previewComponent = page.locator('.wf2-previewitem.component').first();
  await previewComponent.waitFor();
  // Components were deliberately center-aligned above, so they can overlap. Trigger the linked
  // source directly here; ordinary pointer hit-testing correctly favors the topmost sibling.
  await previewComponent.evaluate((element) => element.click());
  await page.locator('.wf2-playbar').getByText('Desktop 1440').waitFor();
  await page.getByRole('button', { name: 'EXIT PREVIEW' }).click();
});

await check('document persists across reload with no render crash', async () => {
  await allowAutosave();
  await page.reload({ waitUntil: 'networkidle' });
  await page.keyboard.press('Control+K');
  const command = page.getByPlaceholder('TYPE WHAT YOU WANT TO DO...');
  await command.fill('open lab');
  await command.press('Enter');
  await page.locator('.dpBoardCard').filter({ hasText: 'WIREFRAME 2 ACCEPTANCE' }).click();
  await page.locator('.wf2').waitFor();
  if (await page.locator('.wf2-item.wf2-frame').count() !== 2) throw new Error('frames did not persist');
  if (await page.locator('.wf2-item.wf2-component').count() < 2) throw new Error('components did not persist');
});

await browser.close();
if (failures.length) {
  console.error(`\nWireframe acceptance failures (${failures.length}):`);
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}
console.log('\nWireframe 2.0 browser acceptance passed.');
