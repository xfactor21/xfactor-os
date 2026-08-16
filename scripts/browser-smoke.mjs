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
