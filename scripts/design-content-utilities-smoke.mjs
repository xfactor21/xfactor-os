import { chromium } from 'playwright';
import { readFile } from 'node:fs/promises';

const base=process.env.XFACTOR_BASE_URL||'http://127.0.0.1:4173';
const browser=await chromium.launch({headless:true});const page=await browser.newPage({viewport:{width:1600,height:1050},acceptDownloads:true});const failures=[];const check=async(label,fn)=>{try{await fn();console.log(`PASS: ${label}`);}catch(e){failures.push(`${label}: ${e?.message||e}`);console.error(`FAIL: ${label}`,e);}};page.on('pageerror',e=>failures.push(`pageerror: ${e.message}`));
const boards=[{id:'qr2-test',name:'QR2 TEST',mode:'qrGenerator'},{id:'meme2-test',name:'MEME2 TEST',mode:'memeGenerator'},{id:'font2-test',name:'FONT2 TEST',mode:'fontPairing'}];
await page.goto(base,{waitUntil:'networkidle'});await page.evaluate(b=>localStorage.setItem('xfactor-studio-boards-v1',JSON.stringify(b.map(x=>({...x,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()})))),boards);await page.reload({waitUntil:'networkidle'});
async function openLab(){await page.keyboard.press('Control+K');const cmd=page.getByPlaceholder('TYPE WHAT YOU WANT TO DO...');await cmd.fill('open lab');await cmd.press('Enter');await page.locator('.dpBoardCard').first().waitFor();}
async function ensureBoards(){const all=page.getByRole('button',{name:'ALL BOARDS',exact:true});if(await all.count()){await all.click();await page.locator('.dpBoardCard').first().waitFor();}else if(!(await page.locator('.dpBoardCard').count()))await openLab();}
async function open(name,testId){await ensureBoards();await page.locator('.dpBoardCard').filter({hasText:name}).click();await page.getByTestId(testId).waitFor();}
async function setRange(label,value){await page.getByLabel(label).evaluate((el,next)=>{const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')?.set;if(!setter)throw new Error('native setter unavailable');setter.call(el,String(next));el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));},value);}

await check('QR Generator 2.0 persists controls and exports real SVG',async()=>{
 await open('QR2 TEST','qr-generator-2-root');await page.getByLabel('QR content').fill('https://planet-x.co/test');await page.getByLabel('QR output name').fill('planet-qr');await setRange('QR margin',4);await setRange('QR size',480);await page.waitForTimeout(180);
 const prefs=await page.evaluate(()=>JSON.parse(localStorage.getItem('xfactor-studio-qr2-qr2-test')||'{}'));if(prefs.text!=='https://planet-x.co/test'||prefs.fileName!=='planet-qr'||prefs.margin!==4||prefs.size!==480)throw new Error(`QR prefs mismatch: ${JSON.stringify(prefs)}`);
 const pending=page.waitForEvent('download');await page.getByRole('button',{name:'SVG',exact:true}).click();const dl=await pending,path=await dl.path();if(!path)throw new Error('QR SVG path unavailable');const svg=await readFile(path,'utf8');if(!svg.includes('<svg')||!svg.includes('<path'))throw new Error('QR SVG export is not vector markup');
});

await check('Meme Generator 2.0 persists style and project JSON',async()=>{
 await open('MEME2 TEST','meme-generator-2-root');await page.getByLabel('Meme top text').fill('HELLO X');await page.getByLabel('Meme bottom text').fill('SHIP IT');await page.getByRole('button',{name:'PORTRAIT',exact:true}).click();await page.getByLabel('Meme output name').fill('launch-meme');await page.getByLabel('Meme uppercase').uncheck();await setRange('Meme top size',84);await page.waitForTimeout(180);
 const prefs=await page.evaluate(()=>JSON.parse(localStorage.getItem('xfactor-studio-meme2-meme2-test')||'{}'));if(prefs.top?.text!=='HELLO X'||prefs.bottom?.text!=='SHIP IT'||prefs.ratio!=='portrait'||prefs.fileName!=='launch-meme'||prefs.uppercase!==false||prefs.top?.size!==84)throw new Error(`Meme prefs mismatch: ${JSON.stringify(prefs)}`);
 const pending=page.waitForEvent('download');await page.getByRole('button',{name:'PROJECT JSON',exact:true}).click();const dl=await pending,path=await dl.path();if(!path)throw new Error('Meme project path unavailable');const project=JSON.parse(await readFile(path,'utf8'));if(project.version!==2||project.ratio!=='portrait'||project.top?.text!=='HELLO X')throw new Error('Meme project export incomplete');
});

await check('Font Pairing 2.0 persists favorites compare and exports typography spec',async()=>{
 await open('FONT2 TEST','font-pairing-2-root');await page.getByLabel('Font heading sample').fill('PLANET X');await page.getByLabel('Font body sample').fill('LOUD SOFTWARE');await page.getByRole('button',{name:'☆ SAVE',exact:true}).click();await page.getByRole('button',{name:'COMPARE',exact:true}).click();await setRange('Font heading size',60);await setRange('Font body line height',1.8);await page.waitForTimeout(180);
 const prefs=await page.evaluate(()=>JSON.parse(localStorage.getItem('xfactor-studio-fontpair2-font2-test')||'{}'));if(prefs.headingText!=='PLANET X'||prefs.bodyText!=='LOUD SOFTWARE'||!prefs.favorites?.includes(0)||prefs.compareIndex===null||prefs.headingSize!==60||Math.abs(prefs.bodyLineHeight-1.8)>.01)throw new Error(`Font prefs mismatch: ${JSON.stringify(prefs)}`);
 const pending=page.waitForEvent('download');await page.getByRole('button',{name:'SPEC JSON',exact:true}).click();const dl=await pending,path=await dl.path();if(!path)throw new Error('Font spec path unavailable');const spec=JSON.parse(await readFile(path,'utf8'));if(spec.version!==2||!spec.pair?.heading||!spec.css?.includes('font-family'))throw new Error('Font spec export incomplete');
});

await browser.close();if(failures.length){console.error(`\nContent utility failures (${failures.length}):`);failures.forEach(f=>console.error(`- ${f}`));process.exit(1);}console.log('\nContent utilities 2.0 browser acceptance passed.');
