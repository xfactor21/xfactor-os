import { chromium } from 'playwright';

const base = process.env.XFACTOR_BASE_URL || 'http://127.0.0.1:4173';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 1050 } });
const failures = [];
const check = async (label, fn) => { try { await fn(); console.log(`PASS: ${label}`); } catch (error) { failures.push(`${label}: ${error?.message || error}`); console.error(`FAIL: ${label}`, error); } };
page.on('pageerror', (error) => failures.push(`pageerror: ${error.message}`));

await page.goto(base, { waitUntil: 'networkidle' });
await page.evaluate(() => {
  localStorage.setItem('xfactor-studio-boards-v1', JSON.stringify([{
    id: 'animation-2-acceptance', name: 'ANIMATION 2 ACCEPTANCE', mode: 'animation',
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  }]));
  localStorage.removeItem('xos-studio-anim-animation-2-acceptance');
});
await page.reload({ waitUntil: 'networkidle' });

async function openAnimation() {
  await page.keyboard.press('Control+K');
  const command = page.getByPlaceholder('TYPE WHAT YOU WANT TO DO...');
  await command.fill('open lab'); await command.press('Enter');
  await page.locator('.dpBoardCard').filter({ hasText: 'ANIMATION 2 ACCEPTANCE' }).click();
  await page.locator('#animRoot').waitFor();
  await page.getByTestId('animation-2-root').waitFor();
}

await check('Animation 2.0 opens from Design Lab', openAnimation);

await check('shape creation produces a real persistent animation object', async () => {
  await page.locator('#animToolgroup .tool').nth(1).click();
  const canvas = page.locator('#animCanvasWrap canvas');
  const box = await canvas.boundingBox(); if (!box) throw new Error('animation canvas has no bounding box');
  await page.mouse.click(box.x + box.width * .35, box.y + box.height * .36);
  await page.waitForTimeout(120);
  const doc = await page.evaluate(() => JSON.parse(localStorage.getItem('xos-studio-anim-animation-2-acceptance') || '{}'));
  if (doc.objects?.length !== 1 || doc.objects[0].type !== 'rect') throw new Error('rectangle object did not persist');
});

await check('key-all creates per-property keyframes at current frame', async () => {
  await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowRight');
  await page.getByRole('button', { name: 'KEY ALL (K)', exact: true }).click();
  await page.waitForTimeout(100);
  const doc = await page.evaluate(() => JSON.parse(localStorage.getItem('xos-studio-anim-animation-2-acceptance') || '{}'));
  for (const prop of ['x','y','rotation','scaleX','scaleY','opacity']) {
    if (!doc.objects?.[0]?.keys?.[prop]?.some((k) => k.frame === 3)) throw new Error(`missing ${prop} keyframe at frame 3`);
  }
});

await check('work area and duration are editable and persisted', async () => {
  const duration = page.locator('#animPlayControls label').filter({ hasText: 'DURATION' }).locator('input');
  await duration.fill('90'); await duration.press('Enter');
  const inInput = page.locator('#animPlayControls label').filter({ hasText: 'IN' }).locator('input');
  const outInput = page.locator('#animPlayControls label').filter({ hasText: 'OUT' }).locator('input');
  await inInput.fill('2'); await inInput.press('Enter');
  await outInput.fill('40'); await outInput.press('Enter');
  await page.waitForTimeout(120);
  const doc = await page.evaluate(() => JSON.parse(localStorage.getItem('xos-studio-anim-animation-2-acceptance') || '{}'));
  if (doc.frameCount !== 90 || doc.workStart !== 2 || doc.workEnd !== 40) throw new Error(`bad work range ${doc.frameCount}/${doc.workStart}/${doc.workEnd}`);
});

await check('duplicate, visibility and lock controls change object workflow state', async () => {
  await page.getByRole('button', { name: 'DUPLICATE', exact: true }).click();
  await page.waitForTimeout(80);
  const rows = page.locator('#animSidebar .layer-row');
  if (await rows.count() !== 2) throw new Error('duplicate did not create second object');
  await rows.nth(1).getByRole('button', { name: 'FREE', exact: true }).click();
  await rows.nth(1).getByRole('button', { name: '◉', exact: true }).click();
  await page.waitForTimeout(80);
  const doc = await page.evaluate(() => JSON.parse(localStorage.getItem('xos-studio-anim-animation-2-acceptance') || '{}'));
  const copy = doc.objects?.[1]; if (!copy?.locked || copy?.visible !== false) throw new Error('lock/visibility state did not persist');
});

await check('property tracks are exposed for selected object', async () => {
  await page.getByTestId('anim-track-x').waitFor();
  await page.getByTestId('anim-track-opacity').waitFor();
});

await check('document survives reload without render crash', async () => {
  await page.reload({ waitUntil: 'networkidle' });
  await openAnimation();
  const doc = await page.evaluate(() => JSON.parse(localStorage.getItem('xos-studio-anim-animation-2-acceptance') || '{}'));
  if (doc.objects?.length !== 2 || doc.frameCount !== 90 || doc.workEnd !== 40) throw new Error('animation document did not survive reload');
});

await browser.close();
if (failures.length) {
  console.error(`\nAnimation acceptance failures (${failures.length}):`);
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}
console.log('\nAnimation 2.0 browser acceptance passed.');
