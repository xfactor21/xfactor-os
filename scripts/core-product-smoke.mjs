import fs from 'node:fs';
import { chromium } from 'playwright';

const base = process.env.XFACTOR_BASE_URL || 'http://127.0.0.1:4173';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
const failures = [];

const check = async (label, fn) => {
  try {
    await fn();
    console.log(`PASS: ${label}`);
  } catch (error) {
    failures.push(`${label}: ${error?.message || error}`);
    console.error(`FAIL: ${label}`);
  }
};

page.on('pageerror', error => failures.push(`pageerror: ${error.message}`));

async function openCommand(text) {
  await page.keyboard.press('Control+K');
  const input = page.getByPlaceholder('TYPE WHAT YOU WANT TO DO...');
  await input.fill(text);
  await input.press('Enter');
}

await check('clean local-only shell boots', async () => {
  await page.goto(base, { waitUntil: 'networkidle' });
  await page.evaluate(async () => {
    localStorage.clear();
    await new Promise(resolve => {
      const req = indexedDB.deleteDatabase('xfactor-os-assets');
      req.onsuccess = req.onerror = req.onblocked = () => resolve();
    });
  });
  await page.reload({ waitUntil: 'networkidle' });
  await page.getByText('YOUR FLOOR IS EMPTY.').waitFor();
  const account = page.locator('.xf-account-btn');
  await account.waitFor();
  const accountText = (await account.innerText()).toUpperCase();
  if (!accountText.includes('LOCAL') || !accountText.includes('OFFLINE')) {
    throw new Error(`expected explicit local/offline account state, got: ${accountText}`);
  }
});

await check('Command Deck creates two named Incidents and persists them', async () => {
  await openCommand('new project CORE ALPHA');
  await openCommand('new project CORE BETA');
  await page.getByText('CORE ALPHA', { exact: true }).first().waitFor();
  await page.getByText('CORE BETA', { exact: true }).first().waitFor();
  await page.reload({ waitUntil: 'networkidle' });
  await page.getByText('CORE ALPHA', { exact: true }).first().waitFor();
  await page.getByText('CORE BETA', { exact: true }).first().waitFor();
});

await check('multi-select creates an overlapping-safe Pile and collapse state persists', async () => {
  const alpha = page.locator('.xf-shard').filter({ hasText: 'CORE ALPHA' });
  const beta = page.locator('.xf-shard').filter({ hasText: 'CORE BETA' });
  await alpha.click();
  await beta.click({ modifiers: ['Shift'] });
  await page.getByRole('button', { name: /PILES/i }).first().click();
  const pileButton = page.getByRole('button', { name: /PILE SELECTED \(2\)/i });
  await pileButton.waitFor();
  await pileButton.click();
  await page.getByText('2 INCIDENTS', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'COLLAPSE PILE', exact: true }).click();
  await page.getByRole('button', { name: 'EXPLODE PILE', exact: true }).waitFor();
  await page.reload({ waitUntil: 'networkidle' });
  await page.getByRole('button', { name: /PILES/i }).first().click();
  await page.getByRole('button', { name: 'EXPLODE PILE', exact: true }).waitFor();
});

await check('Hotwire Signal can be edited, retyped, routed, completed, and persisted', async () => {
  await page.getByRole('button', { name: /FLOOR/i }).first().click();
  const hotwire = page.locator('.xf-hotwire input');
  await hotwire.fill('core smoke task');
  await page.getByRole('button', { name: 'TASK', exact: true }).click();
  await page.keyboard.press('Control+J');
  const row = page.locator('.signal-row-full').filter({ hasText: 'core smoke task' });
  await row.waitFor();
  await row.locator('textarea').fill('core smoke edited');
  const selects = row.locator('select');
  await selects.nth(0).selectOption('note');
  await selects.nth(1).selectOption({ label: 'CORE ALPHA' });
  await row.locator('button').first().click();
  await page.reload({ waitUntil: 'networkidle' });
  await page.getByRole('button', { name: /SIGNAL/i }).first().click();
  const persisted = page.locator('.signal-row-full').filter({ hasText: 'core smoke edited' });
  await persisted.waitFor();
  if ((await persisted.locator('select').nth(0).inputValue()) !== 'note') throw new Error('Signal type did not persist');
  const routedLabel = await persisted.locator('select').nth(1).locator('option:checked').innerText();
  if (routedLabel !== 'CORE ALPHA') throw new Error(`Signal route did not persist: ${routedLabel}`);
  if (!await persisted.evaluate(el => el.classList.contains('done'))) throw new Error('Signal done state did not persist');
});

let backupText = '';
await check('workspace backup exports current core relationships', async () => {
  await page.getByRole('button', { name: /TAPE/i }).first().click();
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: /BACKUP WORKSPACE/i }).click(),
  ]);
  const path = await download.path();
  if (!path) throw new Error('backup download path unavailable');
  backupText = fs.readFileSync(path, 'utf8');
  const envelope = JSON.parse(backupText);
  const workspace = envelope.workspace || envelope.data || envelope;
  if (!Array.isArray(workspace.incidents) || workspace.incidents.length < 2) throw new Error('backup missing Incidents');
  if (!Array.isArray(workspace.piles) || workspace.piles.length < 1) throw new Error('backup missing Pile');
  if (!Array.isArray(workspace.signals) || !workspace.signals.some(s => s.text === 'core smoke edited')) throw new Error('backup missing edited Signal');
});

await check('workspace restore replaces damaged local state with normalized backup', async () => {
  await page.evaluate(() => localStorage.setItem('xfactor-os-workspace-v2', '{"schemaVersion":2,"incidents":[],"piles":[],"signals":[],"assets":[],"activity":[],"positions":{},"savedLayouts":[]}'));
  await page.reload({ waitUntil: 'networkidle' });
  await page.getByText('YOUR FLOOR IS EMPTY.').waitFor();
  const restoreInput = page.locator('input[type="file"][accept*="application/json"]');
  await restoreInput.setInputFiles({ name: 'core-backup.json', mimeType: 'application/json', buffer: Buffer.from(backupText) });
  await page.getByText('WORKSPACE RESTORED', { exact: true }).waitFor();
  await page.getByRole('button', { name: /FLOOR/i }).first().click();
  await page.getByText('CORE ALPHA', { exact: true }).first().waitFor();
  await page.getByText('CORE BETA', { exact: true }).first().waitFor();
});

await check('Black Vault binary file survives reload', async () => {
  await openCommand('open vault');
  const fileInput = page.locator('input[type="file"][multiple]');
  await fileInput.setInputFiles({
    name: 'core-audit-vault.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('xFactor.OS core post-Design-Lab audit fixture'),
  });
  await page.getByText('core-audit-vault.txt').waitFor();
  await page.reload({ waitUntil: 'networkidle' });
  await openCommand('open vault');
  await page.getByText('core-audit-vault.txt').waitFor();
});

await check('Tape and Terminal remain reachable after restore/reload cycle', async () => {
  await openCommand('open tape');
  await page.getByText('THE MESS HAS A MEMORY.').waitFor();
  await openCommand('open terminal');
  await page.getByText('POWER TOOLS, NO TRAINING WHEELS.').waitFor();
});

await browser.close();

if (failures.length) {
  console.error(`\nCore product regression failures (${failures.length}):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('\nCore product regression passed.');
