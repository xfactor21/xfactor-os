#!/usr/bin/env node
// Keeps package.json's "version" as the single source of truth and mirrors it
// into every release-bearing manifest/lockfile that does not auto-sync with npm.
//
// Usage:
//   node scripts/sync-version.mjs          # sync all release metadata
//   npm run sync-version
//   npm version minor                       # bumps package.json, then runs this
//                                            # automatically via the "version" hook below
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const pkgPath = path.join(root, 'package.json');
const packageLockPath = path.join(root, 'package-lock.json');
const tauriConfPath = path.join(root, 'src-tauri', 'tauri.conf.json');
const cargoTomlPath = path.join(root, 'src-tauri', 'Cargo.toml');
const cargoLockPath = path.join(root, 'src-tauri', 'Cargo.lock');

const version = JSON.parse(readFileSync(pkgPath, 'utf8')).version;
if (!version) {
  console.error('sync-version: no "version" field in package.json');
  process.exit(1);
}

// package-lock.json: npm stores the root package version in two places.
const packageLock = JSON.parse(readFileSync(packageLockPath, 'utf8'));
packageLock.version = version;
if (!packageLock.packages?.['']) {
  console.error('sync-version: package-lock.json has no root package entry');
  process.exit(1);
}
packageLock.packages[''].version = version;
writeFileSync(packageLockPath, `${JSON.stringify(packageLock, null, 2)}\n`);

// tauri.conf.json: replace the top-level "version" field only.
const tauriVersionRe = /^(\s*"version":\s*)"[^"]*"/m;
const tauriConf = readFileSync(tauriConfPath, 'utf8');
if (!tauriVersionRe.test(tauriConf)) {
  console.error('sync-version: could not find "version" field in tauri.conf.json');
  process.exit(1);
}
writeFileSync(tauriConfPath, tauriConf.replace(tauriVersionRe, `$1"${version}"`));

// Cargo.toml: replace only the [package] version.
const cargoVersionRe = /^(version\s*=\s*)"[^"]*"/m;
const cargoToml = readFileSync(cargoTomlPath, 'utf8');
if (!cargoVersionRe.test(cargoToml)) {
  console.error('sync-version: could not find "version = ..." in Cargo.toml [package]');
  process.exit(1);
}
writeFileSync(cargoTomlPath, cargoToml.replace(cargoVersionRe, `$1"${version}"`));

// Cargo.lock: keep the root xfactor-os package entry aligned as well. This was
// historically stale even while Cargo.toml/Tauri had moved forward.
const cargoLock = readFileSync(cargoLockPath, 'utf8');
const cargoLockVersionRe = /(\[\[package\]\]\nname = "xfactor-os"\nversion = )"[^"]*"/;
if (!cargoLockVersionRe.test(cargoLock)) {
  console.error('sync-version: could not find xfactor-os package in Cargo.lock');
  process.exit(1);
}
writeFileSync(cargoLockPath, cargoLock.replace(cargoLockVersionRe, `$1"${version}"`));

console.log(`sync-version: all release metadata now at ${version}`);
