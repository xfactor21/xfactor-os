import { chromium } from 'playwright';

const base=process.env.XFACTOR_BASE_URL||'http://127.0.0.1:4173';
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1600,height:1050}});
const failures=[];
const check=async(label,fn)=>{try{await fn();console.log(`PASS: ${label}`);}catch(error){failures.push(`${label}: ${error?.message||error}`);console.error(`FAIL: ${label}`,error);}};
page.on('pageerror',e=>failures.push(`pageerror: ${e.message}`));

await page.goto(base,{waitUntil:'networkidle'});
await page.evaluate(()=>{
  localStorage.setItem('xfactor-studio-boards-v1',JSON.stringify([{id:'moodboard-2-acceptance',name:'MOODBOARD 2 ACCEPTANCE',mode:'moodboard',createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()}]));
  localStorage.removeItem('xos-studio-moodboard2-moodboard-2-acceptance');
  localStorage.removeItem('xos-studio-moodboard-moodboard-2-acceptance');
});
await page.reload({waitUntil:'networkidle'});

async function openMoodboard(){await page.keyboard.press('Control+K');const cmd=page.getByPlaceholder('TYPE WHAT YOU WANT TO DO...');await cmd.fill('open lab');await cmd.press('Enter');await page.locator('.dpBoardCard').filter({hasText:'MOODBOARD 2 ACCEPTANCE'}).click();await page.getByTestId('moodboard-2-root').waitFor();}
await check('Moodboard 2.0 opens from Design Lab',openMoodboard);

await check('swatch and note creation persist v2 tiles',async()=>{
  await page.getByRole('button',{name:'swatch #FF2D78',exact:true}).click();
  await page.getByRole('button',{name:'+ NOTE',exact:true}).click();
  await page.waitForTimeout(250);
  const doc=await page.evaluate(()=>JSON.parse(localStorage.getItem('xos-studio-moodboard2-moodboard-2-acceptance')||'{}'));
  if(doc.version!==2||doc.tiles?.length!==2)throw new Error(`bad v2 doc / tile count ${doc.version}/${doc.tiles?.length}`);
  if(!doc.tiles.some(t=>t.kind==='swatch')||!doc.tiles.some(t=>t.kind==='note'))throw new Error('expected swatch and note tiles');
});

await check('note inspector edits content and exact geometry',async()=>{
  const note=page.getByTestId('mood-tile-note');await note.click({force:true});
  const aside=page.getByTestId('moodboard-2-root').locator('aside').first();
  await aside.locator('textarea').fill('NEON CHAOS');
  const nums=aside.locator('input[type="number"]');
  await nums.nth(0).fill('240');await nums.nth(1).fill('220');
  await page.waitForTimeout(220);
  const doc=await page.evaluate(()=>JSON.parse(localStorage.getItem('xos-studio-moodboard2-moodboard-2-acceptance')||'{}'));
  const t=doc.tiles.find(x=>x.kind==='note');if(!t||t.text!=='NEON CHAOS'||t.x!==240||t.y!==220)throw new Error('inspector changes did not persist');
});

await check('duplicate and layer lock/visibility controls persist',async()=>{
  await page.getByRole('button',{name:'DUPLICATE',exact:true}).click();await page.waitForTimeout(100);
  const layerPanel=page.getByTestId('moodboard-2-root').locator('aside').nth(1);
  const rows=layerPanel.locator('.layer-row');if(await rows.count()!==3)throw new Error('duplicate did not create third tile');
  await rows.first().locator('button').nth(1).click();await rows.first().locator('button').nth(0).click();await page.waitForTimeout(160);
  const doc=await page.evaluate(()=>JSON.parse(localStorage.getItem('xos-studio-moodboard2-moodboard-2-acceptance')||'{}'));
  if(!doc.tiles.some(t=>t.locked&&t.visible===false))throw new Error('lock/visibility state did not persist');
});

await check('board preset and background workflow persist',async()=>{
  const boardPanel=page.getByTestId('moodboard-2-root').locator('aside').nth(1);
  await boardPanel.getByRole('button',{name:'SQUARE',exact:true}).click();
  const color=boardPanel.locator('input[type="color"]');await color.fill('#111111');
  await page.waitForTimeout(180);
  const doc=await page.evaluate(()=>JSON.parse(localStorage.getItem('xos-studio-moodboard2-moodboard-2-acceptance')||'{}'));
  if(doc.width!==800||doc.height!==800||doc.bg!=='#111111')throw new Error(`board settings bad ${doc.width}x${doc.height}/${doc.bg}`);
});

await check('document survives reload',async()=>{await page.reload({waitUntil:'networkidle'});await openMoodboard();const doc=await page.evaluate(()=>JSON.parse(localStorage.getItem('xos-studio-moodboard2-moodboard-2-acceptance')||'{}'));if(doc.tiles?.length!==3||doc.width!==800)throw new Error('moodboard state did not survive reload');});

await browser.close();
if(failures.length){console.error(`\nMoodboard acceptance failures (${failures.length}):`);failures.forEach(f=>console.error(`- ${f}`));process.exit(1);}console.log('\nMoodboard 2.0 browser acceptance passed.');
