import { chromium } from 'playwright';
import { readFile } from 'node:fs/promises';

const base=process.env.XFACTOR_BASE_URL||'http://127.0.0.1:4173';
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1600,height:1050},acceptDownloads:true});
const failures=[];
const check=async(label,fn)=>{try{await fn();console.log(`PASS: ${label}`);}catch(e){failures.push(`${label}: ${e?.message||e}`);console.error(`FAIL: ${label}`,e);}};
page.on('pageerror',e=>failures.push(`pageerror: ${e.message}`));
const boards=[
 {id:'annot2-test',name:'ANNOT2 TEST',mode:'screenshotAnnotator'},
 {id:'gif2-test',name:'GIF2 TEST',mode:'gifMaker'},
 {id:'chart2-test',name:'CHART2 TEST',mode:'chartBuilder'},
 {id:'print2-test',name:'PRINT2 TEST',mode:'printLayout'},
 {id:'model2-test',name:'MODEL2 TEST',mode:'modelViewer'},
];
await page.goto(base,{waitUntil:'networkidle'});
await page.evaluate(b=>localStorage.setItem('xfactor-studio-boards-v1',JSON.stringify(b.map(x=>({...x,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()})))),boards);
await page.reload({waitUntil:'networkidle'});
async function openLab(){await page.keyboard.press('Control+K');const cmd=page.getByPlaceholder('TYPE WHAT YOU WANT TO DO...');await cmd.fill('open lab');await cmd.press('Enter');await page.locator('.dpBoardCard').first().waitFor();}
async function ensureBoards(){const all=page.getByRole('button',{name:'ALL BOARDS',exact:true});if(await all.count()){await all.click();await page.locator('.dpBoardCard').first().waitFor();}else if(!(await page.locator('.dpBoardCard').count()))await openLab();}
async function open(name,testId){await ensureBoards();await page.locator('.dpBoardCard').filter({hasText:name}).click();await page.getByTestId(testId).waitFor();}
const svg=(fill)=>Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="80" height="60"><rect width="80" height="60" fill="${fill}"/></svg>`);

await check('Screenshot Annotator 2.0 migrates prefs and exports editable project',async()=>{
 await page.evaluate(()=>localStorage.setItem('xos-studio-annotate-annot2-test',JSON.stringify({tool:'rect',color:'#ff00aa',width:5})));
 await open('ANNOT2 TEST','screenshot-annotator-2-root');
 const input=page.locator('[data-testid="screenshot-annotator-2-root"] input[type=file]').first();await input.setInputFiles({name:'shot.svg',mimeType:'image/svg+xml',buffer:svg('#223344')});
 await page.getByLabel('OUTPUT').fill('qa-shot');await page.waitForTimeout(120);
 const prefs=await page.evaluate(()=>JSON.parse(localStorage.getItem('xfactor-studio-annotate2-annot2-test')||'{}'));if(prefs.tool!=='rect'||prefs.color!=='#ff00aa'||prefs.width!==5||prefs.outputName!=='qa-shot')throw new Error(`annotator prefs mismatch ${JSON.stringify(prefs)}`);
 const canvas=page.locator('[data-testid="screenshot-annotator-2-root"] canvas');const b=await canvas.boundingBox();if(!b)throw new Error('annotator canvas missing');await page.mouse.move(b.x+10,b.y+10);await page.mouse.down();await page.mouse.move(b.x+45,b.y+35);await page.mouse.up();
 const pending=page.waitForEvent('download');await page.getByRole('button',{name:'EXPORT PROJECT',exact:true}).click();const dl=await pending,p=await dl.path();if(!p)throw new Error('annotator project path unavailable');const project=JSON.parse(await readFile(p,'utf8'));if(project.version!==2||project.annotations?.length!==1)throw new Error('annotator sidecar incomplete');
});

await check('GIF Maker 2.0 persists output settings and exports real GIF89a',async()=>{
 await open('GIF2 TEST','gif-maker-2-root');const input=page.locator('[data-testid="gif-maker-2-root"] input[type=file]');await input.setInputFiles([{name:'a.svg',mimeType:'image/svg+xml',buffer:svg('#ff2d78')},{name:'b.svg',mimeType:'image/svg+xml',buffer:svg('#00f5ff')}]);
 await page.getByLabel('OUTPUT').fill('qa-animation');await page.getByLabel('DEFAULT DELAY (MS)').fill('140');await page.getByRole('button',{name:'COVER',exact:true}).click();await page.waitForTimeout(150);
 const prefs=await page.evaluate(()=>JSON.parse(localStorage.getItem('xfactor-studio-gif2-gif2-test')||'{}'));if(prefs.outputName!=='qa-animation'||prefs.defaultDelay!==140||prefs.fit!=='cover')throw new Error(`gif prefs mismatch ${JSON.stringify(prefs)}`);
 const pending=page.waitForEvent('download');await page.getByRole('button',{name:/EXPORT GIF/}).click();const dl=await pending,p=await dl.path();if(!p)throw new Error('gif path unavailable');const bytes=await readFile(p);if(bytes.subarray(0,6).toString()!=='GIF89a')throw new Error('not GIF89a');
});

await check('Chart Builder 2.0 persists v2 document and exports CSV/project',async()=>{
 await open('CHART2 TEST','chart-builder-2-root');await page.getByLabel('TITLE').fill('Launch Metrics');await page.getByLabel('OUTPUT').fill('launch-chart');await page.getByRole('button',{name:'LINE',exact:true}).click();await page.waitForTimeout(120);
 const doc=await page.evaluate(()=>JSON.parse(localStorage.getItem('xfactor-studio-chart2-chart2-test')||'{}'));if(doc.version!==2||doc.title!=='Launch Metrics'||doc.outputName!=='launch-chart'||doc.chartType!=='line')throw new Error(`chart persistence mismatch ${JSON.stringify(doc)}`);
 let pending=page.waitForEvent('download');await page.getByRole('button',{name:'EXPORT CSV',exact:true}).click();let dl=await pending,p=await dl.path();if(!p||!(await readFile(p,'utf8')).includes('label,value'))throw new Error('chart csv invalid');
 pending=page.waitForEvent('download');await page.getByRole('button',{name:'EXPORT PROJECT',exact:true}).click();dl=await pending;p=await dl.path();if(!p||JSON.parse(await readFile(p,'utf8')).version!==2)throw new Error('chart project invalid');
});

await check('Print Layout 2.0 persists document and exports real multi-page PDF',async()=>{
 await open('PRINT2 TEST','print-layout-2-root');await page.getByLabel('OUTPUT').fill('qa-layout');await page.getByRole('button',{name:/TEXT/}).click();await page.getByRole('button',{name:'+ PAGE',exact:true}).click();await page.waitForTimeout(150);
 const doc=await page.evaluate(()=>JSON.parse(localStorage.getItem('xfactor-studio-print2-print2-test')||'{}'));if(doc.version!==2||doc.outputName!=='qa-layout'||doc.pages?.length!==2)throw new Error(`print persistence mismatch ${JSON.stringify(doc)}`);
 const pending=page.waitForEvent('download');await page.getByRole('button',{name:/EXPORT PDF/}).click();const dl=await pending,p=await dl.path();if(!p)throw new Error('pdf path unavailable');const bytes=await readFile(p);if(bytes.subarray(0,4).toString()!=='%PDF')throw new Error('print export is not a PDF');
});

await check('3D Model Viewer 2.0 loads glTF and persists viewer settings',async()=>{
 await open('MODEL2 TEST','model-viewer-2-root');await page.getByLabel('AUTO ROTATE').check();await page.getByLabel('GRID').uncheck();
 const pos=Buffer.alloc(36);[-1,-1,0,1,-1,0,0,1,0].forEach((v,i)=>pos.writeFloatLE(v,i*4));
 const gltf={asset:{version:'2.0'},scene:0,scenes:[{nodes:[0]}],nodes:[{mesh:0}],meshes:[{primitives:[{attributes:{POSITION:0}}]}],buffers:[{uri:`data:application/octet-stream;base64,${pos.toString('base64')}`,byteLength:36}],bufferViews:[{buffer:0,byteOffset:0,byteLength:36,target:34962}],accessors:[{bufferView:0,componentType:5126,count:3,type:'VEC3',min:[-1,-1,0],max:[1,1,0]}]};
 await page.locator('[data-testid="model-viewer-2-root"] input[type=file]').setInputFiles({name:'triangle.gltf',mimeType:'model/gltf+json',buffer:Buffer.from(JSON.stringify(gltf))});await page.getByText(/LOADED: triangle.gltf/).waitFor();await page.waitForTimeout(250);
 const prefs=await page.evaluate(()=>JSON.parse(localStorage.getItem('xfactor-studio-modelviewer2-model2-test')||'{}'));if(prefs.version!==2||prefs.autoRotate!==true||prefs.showGrid!==false)throw new Error(`model prefs mismatch ${JSON.stringify(prefs)}`);
});

await browser.close();if(failures.length){console.error(`\nFinal utility failures (${failures.length}):`);failures.forEach(f=>console.error(`- ${f}`));process.exit(1);}console.log('\nFinal Design Lab utilities 2.0 acceptance passed.');
