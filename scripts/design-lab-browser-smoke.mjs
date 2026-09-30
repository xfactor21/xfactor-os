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

page.on('pageerror', error => failures.push(`pageerror: ${error.message}`));

await page.goto(base, { waitUntil: 'networkidle' });
await page.getByText('xFACTOR.OS').first().waitFor();

await page.evaluate((modes) => {
  localStorage.removeItem('xfactor-os-workspace-v2');
  const now = new Date().toISOString();
  const boards = modes.map((mode, index) => ({
    id: `design-lab-smoke-${index}-${mode}`,
    name: `SMOKE ${mode}`,
    mode,
    createdAt: now,
    updatedAt: now,
  }));
  localStorage.setItem('xfactor-studio-boards-v1', JSON.stringify(boards));
}, studioModes);
await page.reload({ waitUntil: 'networkidle' });

for (const mode of studioModes) {
  try {
    await page.keyboard.press('Control+K');
    const input = page.getByPlaceholder('TYPE WHAT YOU WANT TO DO...');
    await input.fill('open lab');
    await input.press('Enter');
    await page.getByRole('button', { name: /EXIT LAB/i }).waitFor();

    const boardName = `SMOKE ${mode}`;
    await page.locator('.dpBoardCard').filter({ hasText: boardName }).click();
    await page.locator('#r-studio .rh').filter({ hasText: boardName }).waitFor({ timeout: 15000 });
    await page.locator('#r-studio > :nth-child(2)').waitFor({ state: 'attached', timeout: 15000 });
    console.log(`PASS: Design Lab mode mounts: ${mode}`);

    await page.getByRole('button', { name: /EXIT LAB/i }).click();
    await page.getByText('xFACTOR.OS').first().waitFor();
  } catch (error) {
    failures.push(`${mode}: ${error?.message || error}`);
    console.error(`FAIL: Design Lab mode mounts: ${mode}`);
    break;
  }
}

await browser.close();
if (failures.length) {
  console.error(`\nDesign Lab browser smoke failures (${failures.length}):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log('\nAll 25 Design Lab modes mount in a fresh production browser.');
