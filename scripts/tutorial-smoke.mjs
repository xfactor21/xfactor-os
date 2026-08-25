import { chromium } from 'playwright';

const base = process.env.XFACTOR_BASE_URL || 'http://127.0.0.1:4173';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });

try {
  await page.goto(base, { waitUntil: 'networkidle' });
  await page.getByText('xFACTOR.OS').first().waitFor();

  const replay = page.locator('[data-xfactor-tour-button]');
  await replay.waitFor({ state: 'visible' });
  await replay.click();

  const dialog = page.getByRole('dialog', { name: 'xFactor.OS quick start tutorial' });
  await dialog.waitFor({ state: 'visible' });
  await dialog.getByText('01 // THE FLOOR').waitFor();

  for (let i = 0; i < 6; i++) {
    await dialog.getByRole('button', { name: 'NEXT' }).click();
  }

  await dialog.getByText('07 // COMMAND DECK').waitFor();
  await dialog.getByRole('button', { name: 'ENTER THE CHAOS' }).click();
  await dialog.waitFor({ state: 'detached' });

  const completion = await page.evaluate(() => localStorage.getItem('xfactor-os-tutorial-v1'));
  if (completion !== 'complete') throw new Error('tutorial completion flag was not persisted');

  await replay.click();
  await page.getByRole('dialog', { name: 'xFactor.OS quick start tutorial' }).waitFor();
  await page.getByRole('button', { name: 'SKIP TOUR' }).click();

  console.log('Tutorial browser acceptance passed.');
} finally {
  await browser.close();
}
