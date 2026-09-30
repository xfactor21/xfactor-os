import fs from 'node:fs';
function assert(name, condition) { if (!condition) throw new Error(`FAIL: ${name}`); console.log(`PASS: ${name}`); }
const manifest = JSON.parse(fs.readFileSync(new URL('../public/manifest.webmanifest', import.meta.url), 'utf8'));
const index = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const main = fs.readFileSync(new URL('../src/main.tsx', import.meta.url), 'utf8');
const runtime = fs.readFileSync(new URL('../src/pwaRuntime.ts', import.meta.url), 'utf8');
const sw = fs.readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8');
const vercel = fs.readFileSync(new URL('../vercel.json', import.meta.url), 'utf8');
assert('manifest is linked from the app shell', index.includes('rel="manifest"') && index.includes('/manifest.webmanifest'));
assert('manifest has stable identity and standalone display', manifest.id === '/' && manifest.start_url.startsWith('/') && manifest.display === 'standalone');
assert('manifest carries Chromium 192 and 512 PNG fallbacks', manifest.icons.some(icon => icon.type === 'image/png' && icon.sizes === '192x192') && manifest.icons.some(icon => icon.type === 'image/png' && icon.sizes === '512x512'));
assert('manifest carries a 512px maskable PNG icon', manifest.icons.some(icon => icon.type === 'image/png' && icon.sizes === '512x512' && String(icon.purpose).includes('maskable')));
assert('PWA registration is production HTTPS only', main.includes('registerPwaRuntime()') && runtime.includes("window.location.protocol !== 'https:'"));
assert('service worker preserves navigation shell and runtime assets', sw.includes("request.mode === 'navigate'") && sw.includes("url.pathname.startsWith('/assets/')"));
assert('service worker deliberately excludes heavy WASM and API traffic', sw.includes("url.pathname.startsWith('/api/')") && sw.includes('wasm|zip'));
assert('service worker update headers are explicit on Vercel', vercel.includes('Service-Worker-Allowed') && vercel.includes('no-cache, no-store, must-revalidate'));
console.log('\nPWA installability checks passed.');
