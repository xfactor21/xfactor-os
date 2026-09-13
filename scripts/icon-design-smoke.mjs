import { chromium } from 'playwright';

const base = process.env.XFACTOR_BASE_URL || 'http://127.0.0.1:4173';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 1050 }, acceptDownloads: true });
const failures = [];
const check = async (label, fn) => { try { await fn(); console.log(`PASS: ${label}`); } catch (error) { failures.push(`${label}: ${error?.message || error}`); console.error(`FAIL: ${label}`, error); } };
page.on('pageerror', (error) => failures.push(`pageerror: ${error.message}`));

await page.goto(base, { waitUntil: 'networkidle' });
await page.evaluate(() => {
  localStorage.setItem('xfactor-studio-boards-v1', JSON.stringify([{ id:'icon-design-2-acceptance', name:'ICON DESIGN 2 ACCEPTANCE', mode:'iconDesign', createdAt:new Date().toISOString(), updatedAt:new Date().toISOString() }]));
  localStorage.removeItem('xfactor-studio-icondesign2-icon-design-2-acceptance');
  localStorage.removeItem('xos-studio-icondesign-icon-design-2-acceptance');
});
await page.reload({ waitUntil: 'networkidle' });

async function openIconDesign() {
  await page.keyboard.press('Control+K');
  const command = page.getByPlaceholder('TYPE WHAT YOU WANT TO DO...');
  await command.fill('open lab');
  await command.press('Enter');
  await page.locator('.dpBoardCard').filter({ hasText:'ICON DESIGN 2 ACCEPTANCE' }).click();
  await page.getByTestId('icon-design-2-root').waitFor();
}

await check('Icon Design 2.0 opens from Design Lab', openIconDesign);

await check('set metadata and mirrored painting persist in v2 document', async () => {
  await page.getByLabel('Icon set name').fill('Extension Icons');
  await page.getByLabel('Icon name').fill('tab-vault');
  await page.getByRole('button', { name:'Mirror X', exact:true }).click();
  await page.locator('[data-cell-index="1"]').click();
  await page.waitForTimeout(120);
  const doc = await page.evaluate(() => JSON.parse(localStorage.getItem('xfactor-studio-icondesign2-icon-design-2-acceptance') || '{}'));
  if (doc.version !== 2) throw new Error('v2 document not persisted');
  if (doc.setName !== 'Extension Icons' || doc.icons?.[0]?.name !== 'tab-vault') throw new Error('metadata did not persist');
  if (doc.icons[0].grid[1] !== '#FFFFFF' || doc.icons[0].grid[14] !== '#FFFFFF') throw new Error('mirror painting did not persist both cells');
});

await check('transform and duplicate workflows persist', async () => {
  await page.getByRole('button', { name:'Rotate 90°', exact:true }).click();
  await page.getByRole('button', { name:'Duplicate Icon', exact:true }).click();
  await page.waitForTimeout(120);
  const doc = await page.evaluate(() => JSON.parse(localStorage.getItem('xfactor-studio-icondesign2-icon-design-2-acceptance') || '{}'));
  if (doc.icons?.length !== 2) throw new Error(`expected 2 icons, got ${doc.icons?.length}`);
  if (!doc.icons[1].name.includes('copy')) throw new Error('duplicated icon name missing copy suffix');
});

await check('SVG export produces a real file', async () => {
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name:'Export SVG', exact:true }).click();
  const download = await downloadPromise;
  if (!download.suggestedFilename().endsWith('.svg')) throw new Error(`unexpected filename ${download.suggestedFilename()}`);
});

await check('document survives reload', async () => {
  await page.reload({ waitUntil:'networkidle' });
  await openIconDesign();
  await page.getByLabel('Icon set name').waitFor();
  const name = await page.getByLabel('Icon set name').inputValue();
  if (name !== 'Extension Icons') throw new Error('set metadata did not survive reload');
  const doc = await page.evaluate(() => JSON.parse(localStorage.getItem('xfactor-studio-icondesign2-icon-design-2-acceptance') || '{}'));
  if (doc.icons?.length !== 2) throw new Error('icon set did not survive reload');
});

await browser.close();
if (failures.length) {
  console.error(`\nIcon Design acceptance failures (${failures.length}):`);
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}
console.log('\nIcon Design 2.0 browser acceptance passed.');
