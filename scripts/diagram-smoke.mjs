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
    id: 'diagram-2-acceptance', name: 'DIAGRAM 2 ACCEPTANCE', mode: 'diagram',
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  }]));
  localStorage.removeItem('xos-studio-diagram2-diagram-2-acceptance');
  localStorage.removeItem('xos-studio-diagram-diagram-2-acceptance');
});
await page.reload({ waitUntil: 'networkidle' });

async function openDiagram() {
  await page.keyboard.press('Control+K');
  const command = page.getByPlaceholder('TYPE WHAT YOU WANT TO DO...');
  await command.fill('open lab'); await command.press('Enter');
  await page.locator('.dpBoardCard').filter({ hasText: 'DIAGRAM 2 ACCEPTANCE' }).click();
  await page.getByTestId('diagram-2-root').waitFor();
}

function stage() {
  return page.getByTestId('diagram-2-root').locator('div[style*="width: 1040px"][style*="height: 680px"]').last();
}

async function clickStage(rx, ry) {
  const box = await stage().boundingBox();
  if (!box) throw new Error('diagram stage has no bounding box');
  await page.mouse.click(box.x + box.width * rx, box.y + box.height * ry);
}

async function nodeWrapper(text) {
  const label = page.getByTestId('diagram-2-root').getByText(text, { exact: true }).last();
  return label.locator('..');
}

await check('Diagram 2.0 opens from Design Lab', openDiagram);

await check('node tools create real persistent v2 nodes', async () => {
  await page.getByRole('button', { name: 'PROCESS', exact: true }).click();
  await clickStage(.25, .3);
  await page.getByRole('button', { name: 'DECISION', exact: true }).click();
  await clickStage(.62, .32);
  await page.waitForTimeout(250);
  const doc = await page.evaluate(() => JSON.parse(localStorage.getItem('xos-studio-diagram2-diagram-2-acceptance') || '{}'));
  if (doc.version !== 2) throw new Error('diagram v2 document was not persisted');
  if (doc.nodes?.length !== 2) throw new Error(`expected 2 nodes, got ${doc.nodes?.length}`);
  if (!doc.nodes.some((n) => n.type === 'process') || !doc.nodes.some((n) => n.type === 'decision')) throw new Error('node types missing');
});

await check('connector mode creates attached orthogonal connector', async () => {
  await page.getByRole('button', { name: 'CONNECT', exact: true }).click();
  await (await nodeWrapper('PROCESS')).click({ force: true });
  await (await nodeWrapper('DECISION')).click({ force: true });
  await page.waitForTimeout(180);
  const doc = await page.evaluate(() => JSON.parse(localStorage.getItem('xos-studio-diagram2-diagram-2-acceptance') || '{}'));
  if (doc.edges?.length !== 1) throw new Error(`expected 1 connector, got ${doc.edges?.length}`);
  if (doc.edges[0].route !== 'orthogonal') throw new Error('default connector route is not orthogonal');
});

await check('inspector edits node geometry and text', async () => {
  await page.getByRole('button', { name: 'SELECT', exact: true }).click();
  await (await nodeWrapper('PROCESS')).click({ force: true });
  const inspector = page.getByTestId('diagram-2-root').locator('aside');
  const textInput = inspector.locator('label').filter({ hasText: 'TEXT' }).locator('input');
  await textInput.fill('START HERE');
  const numberInputs = inspector.locator('input[type="number"]');
  await numberInputs.nth(0).fill('120');
  await page.waitForTimeout(220);
  const doc = await page.evaluate(() => JSON.parse(localStorage.getItem('xos-studio-diagram2-diagram-2-acceptance') || '{}'));
  const node = doc.nodes.find((n) => n.text === 'START HERE');
  if (!node || Number(node.x) !== 120) throw new Error('inspector changes did not persist');
});

await check('swimlane and auto-layout workflow persists', async () => {
  await page.getByRole('button', { name: '+ LANE', exact: true }).click();
  await page.getByRole('button', { name: 'AUTO LAYOUT', exact: true }).click();
  await page.waitForTimeout(220);
  const doc = await page.evaluate(() => JSON.parse(localStorage.getItem('xos-studio-diagram2-diagram-2-acceptance') || '{}'));
  if (doc.lanes?.length !== 1) throw new Error('swimlane did not persist');
  if (!doc.nodes?.every((n) => Number.isFinite(n.x) && Number.isFinite(n.y))) throw new Error('auto-layout produced invalid geometry');
});

await check('document survives reload without render crash', async () => {
  await page.reload({ waitUntil: 'networkidle' });
  await openDiagram();
  const doc = await page.evaluate(() => JSON.parse(localStorage.getItem('xos-studio-diagram2-diagram-2-acceptance') || '{}'));
  if (doc.nodes?.length !== 2 || doc.edges?.length !== 1 || doc.lanes?.length !== 1) throw new Error(`diagram document did not survive reload: ${doc.nodes?.length}/${doc.edges?.length}/${doc.lanes?.length}`);
});

await browser.close();
if (failures.length) {
  console.error(`\nDiagram acceptance failures (${failures.length}):`);
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}
console.log('\nDiagram 2.0 browser acceptance passed.');
