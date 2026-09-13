import { chromium } from 'playwright';
import { readFile } from 'node:fs/promises';

const base=process.env.XFACTOR_BASE_URL||'http://127.0.0.1:4173';
const browser=await chromium.launch({headless:true});const page=await browser.newPage({viewport:{width:1600,height:1050},acceptDownloads:true});const failures=[];const check=async(label,fn)=>{try{await fn();console.log(`PASS: ${label}`);}catch(e){failures.push(`${label}: ${e?.message||e}`);console.error(`FAIL: ${label}`,e);}};page.on('pageerror',e=>failures.push(`pageerror: ${e.message}`));
const image=Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><rect width="40" height="40" fill="#ffffff"/><rect x="10" y="10" width="20" height="20" fill="#ff2d78"/></svg>');
const boards=[{id:'bg2-test',name:'BG2 TEST',mode:'backgroundRemover'},{id:'logo2-test',name:'LOGO2 TEST',mode:'logoMaker'},{id:'pixel2-test',name:'PIXEL2 TEST',mode:'pixelArt'}];
await page.goto(base,{waitUntil:'networkidle'});await page.evaluate(b=>localStorage.setItem('xfactor-studio-boards-v1',JSON.stringify(b.map(x=>({...x,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()})))),boards);await page.reload({waitUntil:'networkidle'});
async function openLab(){await page.keyboard.press('Control+K');const cmd=page.getByPlaceholder('TYPE WHAT YOU WANT TO DO...');await cmd.fill('open lab');await cmd.press('Enter');}
async function open(name,testId){await openLab();await page.locator('.dpBoardCard').filter({hasText:name}).click();await page.getByTestId(testId).waitFor();}
async function back(){await page.getByRole('button',{name:'ALL BOARDS',exact:true}).click();await page.locator('.dpBoardCard').first().waitFor();}

await check('Background Remover 2.0 removes only connected flat background and persists controls',async()=>{
 await open('BG2 TEST','background-remover-2-root');await page.getByLabel('Background image').setInputFiles([{name:'subject.svg',mimeType:'image/svg+xml',buffer:image}]);await page.waitForTimeout(250);
 const alpha=await page.getByTestId('background-remover-2-root').locator('canvas').evaluate(c=>{const x=c.getContext('2d').getImageData(0,0,c.width,c.height).data;return{corner:x[3],center:x[((20*c.width+20)*4)+3]};});
 if(alpha.corner!==0||alpha.center===0)throw new Error(`unexpected alpha corner=${alpha.corner} center=${alpha.center}`);
 await page.getByLabel('Background tolerance').fill('45');await page.getByLabel('Edge feather').fill('1');await page.waitForTimeout(120);const prefs=await page.evaluate(()=>JSON.parse(localStorage.getItem('xfactor-studio-bgremove2-bg2-test')||'{}'));if(prefs.tolerance!==45||prefs.feather!==1)throw new Error('background remover prefs did not persist');await back();
});

await check('Logo Maker 2.0 persists reusable brand settings and exports real SVG',async()=>{
 await page.locator('.dpBoardCard').filter({hasText:'LOGO2 TEST'}).click();await page.getByTestId('logo-maker-2-root').waitFor();await page.getByLabel('Logo wordmark').fill('PLANET X');await page.getByLabel('Logo tagline').fill('LOUD SOFTWARE');await page.getByLabel('Transparent background').check();await page.getByRole('button',{name:'SQUARE',exact:true}).click();await page.getByLabel('Logo size').selectOption('1024');await page.waitForTimeout(150);
 const prefs=await page.evaluate(()=>JSON.parse(localStorage.getItem('xfactor-studio-logo2-logo2-test')||'{}'));if(prefs.word!=='PLANET X'||prefs.sub!=='LOUD SOFTWARE'||prefs.transparent!==true||prefs.ratio!=='square'||prefs.size!==1024)throw new Error('logo settings did not persist');
 const pending=page.waitForEvent('download');await page.getByRole('button',{name:'SVG',exact:true}).click();const download=await pending;const path=await download.path();if(!path)throw new Error('SVG download path unavailable');const svg=await readFile(path,'utf8');if(!svg.includes('PLANET X')||!svg.includes('viewBox="0 0 24 24"')||svg.includes('<rect width="100%" height="100%"'))throw new Error('SVG export missing vector icon/text or transparency');await back();
});

await check('Pixel Art 2.0 mirror paint, transform and undo are real persistent edits',async()=>{
 await page.locator('.dpBoardCard').filter({hasText:'PIXEL2 TEST'}).click();await page.getByTestId('pixel-art-2-root').waitFor();await page.getByLabel('Mirror horizontal').check();const canvas=page.getByTestId('pixel-art-2-root').locator('canvas');const box=await canvas.boundingBox();if(!box)throw new Error('pixel canvas missing');await page.mouse.click(box.x+box.width*.25,box.y+box.height*.5);await page.waitForTimeout(350);
 let doc=await page.evaluate(()=>JSON.parse(localStorage.getItem('xfactor-studio-pixelart2-pixel2-test')||'{}'));const filled=doc.grid.filter(Boolean).length;if(filled<2)throw new Error(`mirror painting created ${filled} pixels`);const before=JSON.stringify(doc.grid);await page.getByRole('button',{name:'Rotate 90°',exact:true}).click();await page.waitForTimeout(300);doc=await page.evaluate(()=>JSON.parse(localStorage.getItem('xfactor-studio-pixelart2-pixel2-test')||'{}'));if(JSON.stringify(doc.grid)===before)throw new Error('rotate transform did not change grid');await page.getByRole('button',{name:'UNDO',exact:true}).click();await page.waitForTimeout(300);doc=await page.evaluate(()=>JSON.parse(localStorage.getItem('xfactor-studio-pixelart2-pixel2-test')||'{}'));if(JSON.stringify(doc.grid)!==before)throw new Error('undo did not restore pre-transform grid');
});
await browser.close();if(failures.length){console.error(`\nBrand/pixel utility failures (${failures.length}):`);failures.forEach(f=>console.error(`- ${f}`));process.exit(1);}console.log('\nBrand + pixel utilities 2.0 browser acceptance passed.');