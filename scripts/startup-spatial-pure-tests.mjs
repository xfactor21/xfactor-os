#!/usr/bin/env node
import fs from 'node:fs';
const read=p=>fs.readFileSync(p,'utf8');
const index=read('index.html');
const main=read('src/main.tsx');
const deck=read('src/xfactor/ChaosDeck.tsx');
const spatial=read('src/xfactor/TrueSpatial.tsx');
const mode=read('src/xfactor/plasmaMode.ts');
const css=read('src/xfactor/spatialGlobal.css');
const assert=(label,condition)=>{if(!condition){console.error(`FAIL: ${label}`);process.exitCode=1}else console.log(`PASS: ${label}`)};
assert('pre-React branded boot shell exists',index.includes('id="xfactor-boot"')&&index.includes('CONTROLLED CHAOS // BOOTING'));
assert('boot shell is dismissed after a real paint boundary',main.includes('requestAnimationFrame(() => window.requestAnimationFrame(callback))')&&main.includes("boot?.classList.add('boot-out')"));
assert('noncritical startup work is idle-deferred',main.includes('requestIdleCallback')&&main.indexOf('startPlanetXAnalytics()')>main.indexOf('runWhenIdle'));
assert('heavy product rooms are code-split',deck.includes("lazy(() => import('../modules/studio'))")&&deck.includes("lazy(() => import('./DeveloperWorkbench'))")&&deck.includes("lazy(() => import('./BrowserRoom'))"));
assert('lazy rooms have an intentional visible fallback',deck.includes('DeferredRoom')&&css.includes('.xf-deferred-room'));
assert('normal-mode WebGL prewarm waits for idle',spatial.includes('requestIdleCallback')&&spatial.includes("plasma.mode === 'normal' && !prewarmReady"));
assert('Plasma and Matter recast directly without NORMAL bounce',mode.includes('recast Plasma <-> Matter directly')&&!mode.includes('Plasma -> Matter intentionally passes through NORMAL'));
assert('spatial transition keeps canvas visible',!css.includes('.xf-spatial-transition canvas{visibility:hidden!important}')&&css.includes('.xf-spatial-transition canvas{opacity:.88'));
if(process.exitCode) process.exit(process.exitCode);
