import { chromium } from 'playwright';

const base = process.env.XFACTOR_BASE_URL || 'http://127.0.0.1:4173';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 1050 }, acceptDownloads: true });
const failures = [];
const check = async (label, fn) => { try { await fn(); console.log(`PASS: ${label}`); } catch (error) { failures.push(`${label}: ${error?.message || error}`); console.error(`FAIL: ${label}`, error); } };
page.on('pageerror', error => failures.push(`pageerror: ${error.message}`));

await page.goto(base, { waitUntil: 'networkidle' });
await page.evaluate(() => {
  localStorage.setItem('xfactor-studio-boards-v1', JSON.stringify([{ id:'presentation-2-acceptance', name:'PRESENTATION 2 ACCEPTANCE', mode:'presentation', createdAt:new Date().toISOString(), updatedAt:new Date().toISOString() }]));
  localStorage.removeItem('xos-studio-presentation2-presentation-2-acceptance');
  localStorage.removeItem('xos-studio-presentation-presentation-2-acceptance');
});
await page.reload({ waitUntil: 'networkidle' });

async function openPresentation(){
  await page.keyboard.press('Control+K');
  const command = page.getByPlaceholder('TYPE WHAT YOU WANT TO DO...');
  await command.fill('open lab'); await command.press('Enter');
  await page.locator('.dpBoardCard').filter({ hasText:'PRESENTATION 2 ACCEPTANCE' }).click();
  await page.getByTestId('presentation-2-root').waitFor();
}

await check('Presentation 2.0 opens from Design Lab', openPresentation);
await check('deck title and notes persist in v2 document', async()=>{
  const title = page.getByLabel('Deck title');
  await title.fill('Launch Deck');
  const notes = page.getByText('Speaker notes').locator('textarea');
  await notes.fill('Talk through the launch sequence.');
  await page.waitForTimeout(150);
  const doc = await page.evaluate(()=>JSON.parse(localStorage.getItem('xos-studio-presentation2-presentation-2-acceptance')||'{}'));
  if(doc.version!==2) throw new Error('v2 deck not persisted');
  if(doc.title!=='Launch Deck') throw new Error('deck title not persisted');
  if(doc.slides?.[0]?.notes!=='Talk through the launch sequence.') throw new Error('speaker notes not persisted');
});
await check('slide and block editing persist', async()=>{
  await page.getByRole('button',{name:'+ Blank',exact:true}).click();
  await page.getByRole('button',{name:'Text',exact:true}).click();
  const inspector = page.getByText('Block inspector');
  await inspector.waitFor();
  const textareas = page.locator('[data-testid="presentation-2-root"] textarea');
  await textareas.last().fill('Revenue trajectory');
  await page.waitForTimeout(120);
  const doc = await page.evaluate(()=>JSON.parse(localStorage.getItem('xos-studio-presentation2-presentation-2-acceptance')||'{}'));
  if(doc.slides?.length!==2) throw new Error(`expected 2 slides, got ${doc.slides?.length}`);
  if(!doc.slides[1].blocks?.some(b=>b.text==='Revenue trajectory')) throw new Error('text block edit not persisted');
});
await check('visibility and locking are real block properties', async()=>{
  await page.getByRole('button',{name:'Hide',exact:true}).click();
  await page.getByRole('button',{name:'Lock',exact:true}).click();
  await page.waitForTimeout(120);
  const doc = await page.evaluate(()=>JSON.parse(localStorage.getItem('xos-studio-presentation2-presentation-2-acceptance')||'{}'));
  const block = doc.slides?.[1]?.blocks?.[0];
  if(block?.visible!==false) throw new Error('visibility state not persisted');
  if(block?.locked!==true) throw new Error('lock state not persisted');
});
await check('present mode opens and exits', async()=>{
  await page.getByRole('button',{name:'Present',exact:true}).click();
  await page.getByTestId('presentation-2-present').waitFor();
  await page.keyboard.press('Escape');
  await page.getByTestId('presentation-2-root').waitFor();
});

await browser.close();
if(failures.length){ console.error(`\n${failures.length} failure(s):\n${failures.join('\n')}`); process.exit(1); }
console.log('\nPresentation 2.0 acceptance passed.');
