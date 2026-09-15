import fs from 'node:fs';

function assert(name, condition) {
  if (!condition) throw new Error(`FAIL: ${name}`);
  console.log(`PASS: ${name}`);
}

const capability = JSON.parse(fs.readFileSync('src-tauri/capabilities/default.json', 'utf8'));
const permissions = new Set(capability.permissions ?? []);
const windows = capability.windows ?? [];

assert('capability applies only to main workspace window', windows.length === 1 && windows[0] === 'main');
assert('capture-widget receives no shared privileged capability', !windows.includes('capture-widget'));
assert('main retains native open dialog', permissions.has('dialog:allow-open'));
assert('main retains native save dialog', permissions.has('dialog:allow-save'));
assert('main retains selected-file read access', permissions.has('fs:allow-read-text-file'));
assert('main retains selected-file write access', permissions.has('fs:allow-write-text-file'));
assert('main no longer grants SQL default permission', !permissions.has('sql:default'));
assert('main no longer grants SQL load permission', !permissions.has('sql:allow-load'));
assert('main no longer grants SQL execute permission', !permissions.has('sql:allow-execute'));
assert('main no longer grants SQL select permission', !permissions.has('sql:allow-select'));
assert('main no longer grants unused fs exists permission', !permissions.has('fs:allow-exists'));
assert('main no longer grants broad dialog default permission', !permissions.has('dialog:default'));

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
