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
  await page.getByText('DIAGRAM / FLOWCHART 2.0', { exact: true }).waitFor();
}

await check('Diagram 2.0 opens from Design Lab', openDiagram);

async function clickStage(rx, ry) {
  const stage = page.locator('.diagram2 .toolShellBody > div').last().locator('div').filter({ has: page.locator('svg') }).last();
  const target = page.locator('.diagram2 [data-testid="diagram-2-root"]');
  void target;
  const root = page.getByTestId('diagram-2-root');
  const stageCandidate = root.locator('div').filter({ has: root.locator('svg') }).last();
  const box = await stageCandidate.boundingBox();
  if (!box) throw new Error('diagram stage has no bounding box');
  await page.mouse.click(box.x + box.width * rx, box.y + box.height * ry);
}

await check('node tools create real persistent v2 nodes', async () => {
  await page.getByRole('button', { name: 'PROCESS', exact: true }).click();
  const allDivs = page.getByTestId('diagram-2-root').locator('div');
  let stage = null;
  for (let i = 0; i < await allDivs.count(); i++) {
    const el = allDivs.nth(i);
    const box = await el.boundingBox();
    const style = await el.getAttribute('style');
    if (box && box.width > 900 && box.height > 600 && style?.includes('background-color')) { stage = el; break; }
  }
  if (!stage) throw new Error('could not locate diagram canvas');
  let box = await stage.boundingBox();
  await page.mouse.click(box.x + box.width * .25, box.y + box.height * .3);
  await page.getByRole('button', { name: 'DECISION', exact: true }).click();
  box = await stage.boundingBox();
  await page.mouse.click(box.x + box.width * .62, box.y + box.height * .32);
  await page.waitForTimeout(250);
  const doc = await page.evaluate(() => JSON.parse(localStorage.getItem('xos-studio-diagram2-diagram-2-acceptance') || '{}'));
  if (doc.version !== 2) throw new Error('diagram v2 document was not persisted');
  if (doc.nodes?.length !== 2) throw new Error(`expected 2 nodes, got ${doc.nodes?.length}`);
  if (!doc.nodes.some((n) => n.type === 'process') || !doc.nodes.some((n) => n.type === 'decision')) throw new Error('node types missing');
});

await check('connector mode creates attached orthogonal connector', async () => {
  const nodes = page.getByTestId('diagram-2-root').locator('.toolShellBody').locator('div').filter({ hasText: /PROCESS|DECISION/ });
  await page.getByRole('button', { name: 'CONNECT', exact: true }).click();
  const docBefore = await page.evaluate(() => JSON.parse(localStorage.getItem('xos-studio-diagram2-diagram-2-acceptance') || '{}'));
  const ids = docBefore.nodes.map((n) => n.id);
  for (const id of ids) {
    const node = page.locator(`[style*="position: absolute"]`).filter({ hasText: docBefore.nodes.find((n) => n.id === id).text }).last();
    await node.click();
  }
  await page.waitForTimeout(200);
  const doc = await page.evaluate(() => JSON.parse(localStorage.getItem('xos-studio-diagram2-diagram-2-acceptance') || '{}'));
  if (doc.edges?.length !== 1) throw new Error(`expected 1 connector, got ${doc.edges?.length}`);
  if (doc.edges[0].route !== 'orthogonal') throw new Error('default connector route is not orthogonal');
});

await check('inspector edits node geometry and style', async () => {
  await page.getByRole('button', { name: 'SELECT', exact: true }).click();
  const processText = page.getByText('PROCESS', { exact: true }).last();
  await processText.click();
  const inspector = page.getByTestId('diagram-2-root').locator('aside');
  const textInput = inspector.locator('label').filter({ hasText: 'TEXT' }).locator('input');
  await textInput.fill('START HERE');
  const xInput = inspector.locator('label').filter({ hasText: /^X/ }).locator('input');
  await xInput.fill('120');
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
  if (doc.nodes?.length !== 2 || doc.edges?.length !== 1 || doc.lanes?.length !== 1) throw new Error('diagram document did not survive reload');
});

await browser.close();
if (failures.length) {
  console.error(`\nDiagram acceptance failures (${failures.length}):`);
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}
console.log('\nDiagram 2.0 browser acceptance passed.');
