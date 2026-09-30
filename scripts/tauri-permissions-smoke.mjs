import fs from 'node:fs';

function assert(name, condition) {
  if (!condition) throw new Error(`FAIL: ${name}`);
  console.log(`PASS: ${name}`);
}

const capability = JSON.parse(fs.readFileSync('src-tauri/capabilities/default.json', 'utf8'));
const permissions = new Set(capability.permissions ?? []);
const windows = capability.windows ?? [];
const webviews = capability.webviews ?? [];

assert('privileged capability is scoped to trusted main webview only', windows.length === 0 && webviews.length === 1 && webviews[0] === 'main');
assert('capture-widget receives no shared privileged capability', !windows.includes('capture-widget') && !webviews.includes('capture-widget'));
assert('remote xBrowser child receives no privileged capability', !webviews.includes('xf-browser-surface'));
assert('main retains native open dialog', permissions.has('dialog:allow-open'));
assert('main retains native save dialog', permissions.has('dialog:allow-save'));
assert('main allows isolated browser webview creation', permissions.has('core:webview:allow-create-webview-window'));
assert('main retains selected-file read access', permissions.has('fs:allow-read-text-file'));
assert('main retains selected-file write access', permissions.has('fs:allow-write-text-file'));
assert('main no longer grants SQL default permission', !permissions.has('sql:default'));
assert('main no longer grants SQL load permission', !permissions.has('sql:allow-load'));
assert('main no longer grants SQL execute permission', !permissions.has('sql:allow-execute'));
assert('main no longer grants SQL select permission', !permissions.has('sql:allow-select'));
assert('main no longer grants unused fs exists permission', !permissions.has('fs:allow-exists'));
assert('main no longer grants broad dialog default permission', !permissions.has('dialog:default'));

const browserBackend = fs.readFileSync('src-tauri/src/browser.rs', 'utf8');
const tauriLib = fs.readFileSync('src-tauri/src/lib.rs', 'utf8');
assert('desktop browser backend only accepts http(s)', browserBackend.includes('matches!(url.scheme(), "http" | "https")'));
assert('desktop browser backend blocks credential-bearing URLs', browserBackend.includes('Credential-bearing URLs are not accepted.'));
assert('desktop browser backend blocks loopback/private/link-local networks', browserBackend.includes('ip.is_private()') && browserBackend.includes('ip.is_loopback()') && browserBackend.includes('ip.is_link_local()') && browserBackend.includes('100') && browserBackend.includes('64..=127'));
assert('desktop browser backend revalidates redirect destinations', browserBackend.includes('Policy::none()') && browserBackend.includes('validate_public_destination(&current)'));
assert('desktop browser backend caps HTML and asset bytes', browserBackend.includes('MAX_HTML_BYTES') && browserBackend.includes('MAX_ASSET_BYTES') && browserBackend.includes('read_bounded'));
assert('browser capture commands are explicitly registered', tauriLib.includes('browser::browser_fetch_html') && tauriLib.includes('browser::browser_fetch_asset'));
const nativeBrowser = fs.readFileSync('src-tauri/src/native_browser.rs', 'utf8');
assert('native child xBrowser commands are explicitly registered', tauriLib.includes('native_browser::browser_surface_open') && tauriLib.includes('native_browser::browser_surface_close'));
assert('native xBrowser uses Tauri child-webview API', nativeBrowser.includes('WebviewBuilder::new(LABEL') && nativeBrowser.includes('host.add_child(builder'));
assert('native xBrowser navigation is http(s) only', nativeBrowser.includes('xBrowser navigation accepts only http(s) URLs.'));
const cargoText = fs.readFileSync('src-tauri/Cargo.toml', 'utf8');
assert('Tauri unstable multiwebview feature is enabled', cargoText.includes('"unstable"'));
const browserRoom = fs.readFileSync('src/xfactor/BrowserRoom.tsx', 'utf8');
const nativeSurface = fs.readFileSync('src/xfactor/NativeBrowserSurface.tsx', 'utf8');
assert('Browser room selects native surface on desktop', browserRoom.includes('<NativeBrowserSurface') && nativeSurface.includes("'browser_surface_open'"));
assert('web fallback states frame limitations truthfully', browserRoom.includes('SOME SITES BLOCK EMBEDDING'));
assert('no broad Tauri HTTP plugin permission is granted', ![...permissions].some(permission => String(permission).startsWith('http:')));

const widget = fs.readFileSync('src/components/CaptureWidget.tsx', 'utf8');
assert('capture widget uses canonical xFactor workspace store', widget.includes("from '../xfactor/store'"));
assert('capture widget does not import tauri APIs', !widget.includes('@tauri-apps/'));
assert('capture widget does not import legacy sqlite adapter', !widget.includes('localDb'));
assert('capture widget does not invoke Tauri IPC directly', !/\binvoke\s*\(/.test(widget));

const app = fs.readFileSync('src/App.tsx', 'utf8');
assert('current main entrypoint mounts ChaosDeck directly', app.includes("from './xfactor/ChaosDeck'"));
assert('current main entrypoint does not mount legacy Shell', !app.includes('./components/Shell'));

const fileIo = fs.readFileSync('src/lib/fileIO.ts', 'utf8');
assert('active file I/O uses isolated platform detection', fileIo.includes("from './platform'"));
assert('active file I/O does not depend on sqlite adapter', !fileIo.includes("from './localDb'"));

console.log('\nTauri least-privilege smoke passed.');
