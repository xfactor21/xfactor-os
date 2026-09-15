import { isTauri } from './platform';

/** Local-file open/edit/save for the Terminal (.py) and Browser (.html)
 * rooms. Desktop-only — every function here throws if called from the web
 * preview build. Platform detection is intentionally isolated from the
 * legacy SQLite adapter so active desktop file editing does not pull SQL
 * plumbing into the current xFactor.OS shell.
 *
 * Security note: `capabilities/default.json` grants `fs:allow-read-text-file`
 * / `fs:allow-write-text-file` with NO static path scope. That's
 * deliberate, not an oversight — `@tauri-apps/plugin-dialog`'s open/save
 * commands dynamically extend the fs plugin's scope to exactly the file the
 * user picked in the native OS dialog. This module only touches files chosen
 * through the real OS picker.
 */

export interface OpenedFile {
  path: string;
  name: string;
  content: string;
}

async function requireTauri() {
  if (!isTauri()) throw new Error('File editing requires the desktop app.');
}

export async function openTextFile(extensions: string[], label: string): Promise<OpenedFile | null> {
  await requireTauri();
  const { open } = await import('@tauri-apps/plugin-dialog');
  const { readTextFile } = await import('@tauri-apps/plugin-fs');
  const path = await open({ multiple: false, directory: false, filters: [{ name: label, extensions }] });
  if (!path || typeof path !== 'string') return null;
  const content = await readTextFile(path);
  const name = path.split(/[/\\]/).pop() ?? path;
  return { path, name, content };
}

export async function writeTextFileAt(path: string, content: string): Promise<void> {
  await requireTauri();
  const { writeTextFile } = await import('@tauri-apps/plugin-fs');
  await writeTextFile(path, content);
}

export async function saveTextFileAs(
  content: string,
  extensions: string[],
  label: string,
  defaultName?: string,
): Promise<string | null> {
  await requireTauri();
  const { save } = await import('@tauri-apps/plugin-dialog');
  const { writeTextFile } = await import('@tauri-apps/plugin-fs');
  const path = await save({ defaultPath: defaultName, filters: [{ name: label, extensions }] });
  if (!path) return null;
  await writeTextFile(path, content);
  return path;
}
