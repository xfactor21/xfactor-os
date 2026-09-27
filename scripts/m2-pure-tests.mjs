import fs from 'node:fs';
import ts from 'typescript';

function assert(name, condition) {
  if (!condition) throw new Error(`FAIL: ${name}`);
  console.log(`PASS: ${name}`);
}

for (const file of [
  'src/lib/projectFolder.ts',
  'src/lib/projectSearch.ts',
  'src/lib/problems.ts',
  'src/lib/gitBridge.ts',
  'src/xfactor/localProjectBindings.ts',
  'src/xfactor/DeveloperWorkbench.tsx',
  'src/xfactor/GitPanel.tsx',
]) {
  const source = fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
  const transpiled = ts.transpileModule(source, {
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
    reportDiagnostics: true,
    fileName: file,
  });
  const errors = (transpiled.diagnostics ?? []).filter((diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error);
  assert(`${file} parses`, errors.length === 0);
}

const projectFolder = fs.readFileSync(new URL('../src/lib/projectFolder.ts', import.meta.url), 'utf8');
assert('folder picker requests recursive user-selected scope', projectFolder.includes('recursive: true'));
assert('generated dependency/build directories are excluded', projectFolder.includes("'node_modules'") && projectFolder.includes("'.git'"));
assert('symlinks are skipped during tree scan', projectFolder.includes('if (item.isSymlink) continue'));
assert('unsafe parent traversal is rejected', projectFolder.includes("part === '..'"));
assert('secret-bearing files are excluded from runtime mirror by default', projectFolder.includes('isSensitiveProjectFile(entry.relativePath)'));
assert('project mirror has file and byte safety caps', projectFolder.includes('maxFiles') && projectFolder.includes('maxTotalChars'));

const bindings = fs.readFileSync(new URL('../src/xfactor/localProjectBindings.ts', import.meta.url), 'utf8');
assert('absolute local binding lives outside WorkspaceState', bindings.includes('xfactor-workbench-local-project-bindings-v1'));

const git = fs.readFileSync(new URL('../src-tauri/src/git.rs', import.meta.url), 'utf8');
assert('Git root must pass Tauri filesystem scope', git.includes('app.fs_scope().is_allowed(&path)'));
assert('Git bridge exposes no push operation', !/git_push|\["push"\]/.test(git));
assert('Git paths reject parent traversal', git.includes('*part == ".."'));

console.log('\nWorkbench M2 local pure/source checks passed.');
