import { chromium } from 'playwright';

const base=process.env.XFACTOR_BASE_URL||'http://127.0.0.1:4173';
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1600,height:1050},acceptDownloads:true});
const failures=[];
const check=async(label,fn)=>{try{await fn();console.log(`PASS: ${label}`);}catch(error){failures.push(`${label}: ${error?.message||error}`);console.error(`FAIL: ${label}`,error);}};
page.on('pageerror',e=>failures.push(`pageerror: ${e.message}`));
const svg=Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="40" height="20"><rect width="20" height="20" fill="#ff2d78"/><rect x="20" width="20" height="20" fill="#00f5ff"/></svg>');
const boards=[
{id:'util-convert',name:'UTILITY CONVERTER',mode:'imageConverter'},
{id:'util-palette',name:'UTILITY PALETTE',mode:'paletteGenerator'},
{id:'util-photo',name:'UTILITY PHOTO',mode:'quickPhotoEditor'},
];
await page.goto(base,{waitUntil:'networkidle'});
await page.evaluate(b=>localStorage.setItem('xfactor-studio-boards-v1',JSON.stringify(b.map(x=>({...x,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()})))),boards);
await page.reload({waitUntil:'networkidle'});
async function openLab(){await page.keyboard.press('Control+K');const cmd=page.getByPlaceholder('TYPE WHAT YOU WANT TO DO...');await cmd.fill('open lab');await cmd.press('Enter');}
async function openBoard(name,testId){await openLab();await page.locator('.dpBoardCard').filter({hasText:name}).click();await page.getByTestId(testId).waitFor();}
async function backToBoards(){await page.getByRole('button',{name:'ALL BOARDS',exact:true}).click();await page.locator('.dpBoardCard').first().waitFor();}

await check('Image Converter 2.0 batch resize and persistence',async()=>{
 await openBoard('UTILITY CONVERTER','image-converter-2-root');
 await page.getByLabel('Image files').setInputFiles([{name:'two-tone.svg',mimeType:'image/svg+xml',buffer:svg}]);
 await page.getByText(/1 IMAGE READY/).waitFor();
 await page.getByLabel('Output width').fill('20');
 await page.getByRole('button',{name:'WEBP',exact:true}).click();
 await page.getByRole('button',{name:'CONVERT ALL',exact:true}).click();
 await page.getByText(/1 CONVERSION COMPLETE/).waitFor();
 const result=page.getByText(/20×10/);await result.waitFor();
 const prefs=await page.evaluate(()=>JSON.parse(localStorage.getItem('xfactor-studio-imgconv2-util-convert')||'{}'));
 if(prefs.width!==20||prefs.format!=='webp')throw new Error('converter settings did not persist');
 await backToBoards();
});

await check('Palette Generator 2.0 extracts and saves reusable palette',async()=>{
 await page.locator('.dpBoardCard').filter({hasText:'UTILITY PALETTE'}).click();await page.getByTestId('palette-generator-2-root').waitFor();
 await page.getByLabel('Palette image').setInputFiles([{name:'two-tone.svg',mimeType:'image/svg+xml',buffer:svg}]);
 await page.waitForTimeout(300);
 const swatches=page.locator('.toolSwatch');if(await swatches.count()<2)throw new Error('image palette extraction produced too few colors');
 await page.getByRole('button',{name:'SAVE PALETTE',exact:true}).click();
 const doc=await page.evaluate(()=>JSON.parse(localStorage.getItem('xfactor-studio-palette2-util-palette')||'{}'));
 if(doc.version!==2||doc.saved?.length!==1||doc.saved[0].colors.length<2)throw new Error('saved palette document invalid');
 await backToBoards();
});

await check('Quick Photo Editor 2.0 resize, adjust, undo and persistence',async()=>{
 await page.locator('.dpBoardCard').filter({hasText:'UTILITY PHOTO'}).click();await page.getByTestId('quick-photo-2-root').waitFor();
 await page.getByLabel('Photo file').setInputFiles([{name:'two-tone.svg',mimeType:'image/svg+xml',buffer:svg}]);
 await page.getByText(/40×20 IMAGE LOADED/).waitFor();
 await page.getByLabel('Resize width').fill('20');
 await page.getByRole('button',{name:'APPLY RESIZE',exact:true}).click();
 await page.getByText(/RESIZED TO 20×10/).waitFor();
 const canvas=page.getByTestId('quick-photo-2-root').locator('canvas');if(await canvas.getAttribute('width')!=='20'||await canvas.getAttribute('height')!=='10')throw new Error('resize did not change canvas dimensions');
 await page.getByLabel('brightness').fill('25');
 await page.getByRole('button',{name:'APPLY ADJUSTMENTS',exact:true}).click();
 const undo=page.getByRole('button',{name:'Undo',exact:true});if(await undo.isDisabled())throw new Error('undo history was not created');await undo.click();
 const prefs=await page.evaluate(()=>JSON.parse(localStorage.getItem('xfactor-studio-photoedit2-util-photo')||'{}'));
 if(prefs.brightness!==25)throw new Error('photo settings did not persist');
});

await browser.close();
if(failures.length){console.error(`\nDesign utilities failures (${failures.length}):`);failures.forEach(f=>console.error(`- ${f}`));process.exit(1);}console.log('\nDesign utilities 2.0 browser acceptance passed.');