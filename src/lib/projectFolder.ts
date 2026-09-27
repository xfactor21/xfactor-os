import { isTauri } from './platform';

export type ProjectEntryKind = 'file' | 'directory';

export interface ProjectEntry {
  name: string;
  relativePath: string;
  kind: ProjectEntryKind;
  depth: number;
  children?: ProjectEntry[];
}

export interface ProjectScanResult {
  rootPath: string;
  entries: ProjectEntry[];
  fileCount: number;
  directoryCount: number;
  truncated: boolean;
}

export interface MirrorFile {
  path: string;
  content: string;
}

const GENERATED_DIRS = new Set([
  '.git', '.hg', '.svn',
  'node_modules', 'dist', 'build', '.next', '.nuxt', '.output',
  'coverage', '.turbo', '.cache', '.parcel-cache',
  'target', '.venv', 'venv', '__pycache__', '.pytest_cache',
  'vendor', 'Pods', '.gradle', '.idea', '.vscode-test',
]);

const TEXT_EXTENSIONS = new Set([
  'js', 'jsx', 'mjs', 'cjs', 'ts', 'tsx',
  'html', 'htm', 'css', 'scss', 'sass', 'less',
  'json', 'jsonc', 'md', 'mdx', 'txt', 'csv', 'xml', 'svg',
  'py', 'rb', 'php', 'go', 'rs', 'java', 'kt', 'kts', 'swift',
  'c', 'h', 'cc', 'cpp', 'hpp', 'cs',
  'sh', 'bash', 'zsh', 'fish', 'ps1', 'bat', 'cmd',
  'toml', 'yaml', 'yml', 'ini', 'conf', 'properties',
  'sql', 'graphql', 'gql', 'vue', 'svelte',
]);

const TEXT_FILENAMES = new Set([
  'Dockerfile', 'Makefile', 'Procfile', 'Gemfile', 'Rakefile',
  'package.json', 'package-lock.json', 'pnpm-lock.yaml', 'yarn.lock',
  'tsconfig.json', 'jsconfig.json', 'vite.config.js', 'vite.config.ts',
]);

const SENSITIVE_PATTERNS = [
  /^\.env($|\.)/i,
  /(^|\/)\.npmrc$/i,
  /(^|\/)\.pypirc$/i,
  /(^|\/)credentials(\.|$)/i,
  /(^|\/)secrets?(\.|$)/i,
  /(^|\/)id_(rsa|ed25519)(\.|$)/i,
  /\.(pem|key|p12|pfx)$/i,
];

async function requireDesktop() {
  if (!isTauri()) throw new Error('Opening a real project folder requires the desktop app.');
}

function safeRelativePath(relativePath: string): string {
  const normalized = relativePath.replace(/\\/g, '/').replace(/^\/+/, '');
  if (!normalized || normalized === '.') return '';
  const parts = normalized.split('/');
  if (parts.some((part) => !part || part === '.' || part === '..')) {
    throw new Error('Unsafe project-relative path.');
  }
  return parts.join('/');
}

async function projectPath(rootPath: string, relativePath: string): Promise<string> {
  const clean = safeRelativePath(relativePath);
  if (!clean) return rootPath;
  const { join } = await import('@tauri-apps/api/path');
  return join(rootPath, ...clean.split('/'));
}

export function isLikelyTextProjectFile(relativePath: string): boolean {
  const name = relativePath.split('/').pop() || relativePath;
  if (TEXT_FILENAMES.has(name)) return true;
  if (/^\.env($|\.)/i.test(name)) return true;
  const ext = name.includes('.') ? name.split('.').pop()?.toLowerCase() : undefined;
  return Boolean(ext && TEXT_EXTENSIONS.has(ext));
}

export function isSensitiveProjectFile(relativePath: string): boolean {
  const normalized = relativePath.replace(/\\/g, '/');
  return SENSITIVE_PATTERNS.some((pattern) => pattern.test(normalized));
}

export async function chooseProjectFolder(): Promise<string | null> {
  await requireDesktop();
  const { open } = await import('@tauri-apps/plugin-dialog');
  const selected = await open({
    multiple: false,
    directory: true,
    recursive: true,
    title: 'Bind project folder to this Incident',
  });
  return typeof selected === 'string' ? selected : null;
}

export async function scanProjectFolder(
  rootPath: string,
  options: { maxEntries?: number; maxDepth?: number } = {},
): Promise<ProjectScanResult> {
  await requireDesktop();
  const { readDir } = await import('@tauri-apps/plugin-fs');
  const maxEntries = options.maxEntries ?? 4000;
  const maxDepth = options.maxDepth ?? 20;
  let seen = 0;
  let fileCount = 0;
  let directoryCount = 0;
  let truncated = false;

  async function walk(relativeDir: string, depth: number): Promise<ProjectEntry[]> {
    if (depth > maxDepth || seen >= maxEntries) {
      truncated = true;
      return [];
    }
    const absoluteDir = await projectPath(rootPath, relativeDir);
    const raw = await readDir(absoluteDir);
    const sorted = [...raw].sort((a, b) => {
      if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    const entries: ProjectEntry[] = [];
    for (const item of sorted) {
      if (seen >= maxEntries) {
        truncated = true;
        break;
      }
      if (item.isSymlink) continue;
      const relativePath = relativeDir ? `${relativeDir}/${item.name}` : item.name;
      if (item.isDirectory && GENERATED_DIRS.has(item.name)) continue;
      seen += 1;
      if (item.isDirectory) {
        directoryCount += 1;
        const children = await walk(relativePath, depth + 1);
        entries.push({ name: item.name, relativePath, kind: 'directory', depth, children });
      } else if (item.isFile) {
        fileCount += 1;
        entries.push({ name: item.name, relativePath, kind: 'file', depth });
      }
    }
    return entries;
  }

  return {
    rootPath,
    entries: await walk('', 0),
    fileCount,
    directoryCount,
    truncated,
  };
}

export async function readProjectTextFile(rootPath: string, relativePath: string): Promise<string> {
  await requireDesktop();
  if (!isLikelyTextProjectFile(relativePath)) throw new Error('This file is not recognized as editable text.');
  const { readTextFile } = await import('@tauri-apps/plugin-fs');
  return readTextFile(await projectPath(rootPath, relativePath));
}

export async function writeProjectTextFile(rootPath: string, relativePath: string, content: string): Promise<void> {
  await requireDesktop();
  const { writeTextFile } = await import('@tauri-apps/plugin-fs');
  await writeTextFile(await projectPath(rootPath, relativePath), content);
}

export async function createProjectTextFile(rootPath: string, relativePath: string, content = ''): Promise<void> {
  await requireDesktop();
  const clean = safeRelativePath(relativePath);
  if (!clean) throw new Error('A file path is required.');
  const parts = clean.split('/');
  const fileName = parts.pop();
  if (!fileName) throw new Error('A file name is required.');
  const { mkdir, writeTextFile } = await import('@tauri-apps/plugin-fs');
  if (parts.length) await mkdir(await projectPath(rootPath, parts.join('/')), { recursive: true });
  await writeTextFile(await projectPath(rootPath, clean), content);
}

export async function removeProjectPath(rootPath: string, relativePath: string, recursive = false): Promise<void> {
  await requireDesktop();
  const clean = safeRelativePath(relativePath);
  if (!clean) throw new Error('Refusing to remove the project root.');
  const { remove } = await import('@tauri-apps/plugin-fs');
  await remove(await projectPath(rootPath, clean), { recursive });
}

export async function renameProjectPath(rootPath: string, fromRelativePath: string, toRelativePath: string): Promise<void> {
  await requireDesktop();
  const from = safeRelativePath(fromRelativePath);
  const to = safeRelativePath(toRelativePath);
  if (!from || !to) throw new Error('Both source and destination paths are required.');
  const { rename } = await import('@tauri-apps/plugin-fs');
  await rename(await projectPath(rootPath, from), await projectPath(rootPath, to));
}

export function flattenProjectFiles(entries: ProjectEntry[]): ProjectEntry[] {
  const files: ProjectEntry[] = [];
  const visit = (items: ProjectEntry[]) => {
    for (const entry of items) {
      if (entry.kind === 'file') files.push(entry);
      else if (entry.children) visit(entry.children);
    }
  };
  visit(entries);
  return files;
}

/** Mirror a bounded, text-only snapshot into WebContainer. Secret-bearing files are
 * deliberately excluded by default. The desktop filesystem remains authoritative. */
export async function collectProjectMirrorFiles(
  rootPath: string,
  entries: ProjectEntry[],
  options: { maxFiles?: number; maxTotalChars?: number; includeSensitive?: boolean } = {},
): Promise<MirrorFile[]> {
  const maxFiles = options.maxFiles ?? 1200;
  const maxTotalChars = options.maxTotalChars ?? 8_000_000;
  const result: MirrorFile[] = [];
  let totalChars = 0;
  for (const entry of flattenProjectFiles(entries)) {
    if (result.length >= maxFiles || totalChars >= maxTotalChars) break;
    if (!isLikelyTextProjectFile(entry.relativePath)) continue;
    if (!options.includeSensitive && isSensitiveProjectFile(entry.relativePath)) continue;
    try {
      const content = await readProjectTextFile(rootPath, entry.relativePath);
      if (content.length > 1_500_000) continue;
      if (totalChars + content.length > maxTotalChars) break;
      result.push({ path: entry.relativePath, content });
      totalChars += content.length;
    } catch {
      // Skip unreadable/non-UTF8 files; one file must not block the project mirror.
    }
  }
  return result;
}
