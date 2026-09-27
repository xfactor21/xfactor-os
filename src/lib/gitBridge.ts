import { isTauri } from './platform';

export interface GitFileStatus {
  path: string;
  indexStatus: string;
  worktreeStatus: string;
}

export interface GitStatus {
  branch?: string;
  upstream?: string;
  ahead: number;
  behind: number;
  detached: boolean;
  files: GitFileStatus[];
}

async function invokeDesktop<T>(command: string, args: Record<string, unknown>): Promise<T> {
  if (!isTauri()) throw new Error('Git integration requires the desktop app.');
  const { invoke } = await import('@tauri-apps/api/core');
  return invoke<T>(command, args);
}

export function getGitStatus(root: string): Promise<GitStatus> {
  return invokeDesktop('git_status', { root });
}

export function getGitDiff(root: string, path?: string, staged = false): Promise<string> {
  return invokeDesktop('git_diff', { root, path, staged });
}

export function stageGitPaths(root: string, paths: string[]): Promise<void> {
  return invokeDesktop('git_stage', { root, paths });
}

export function unstageGitPaths(root: string, paths: string[]): Promise<void> {
  return invokeDesktop('git_unstage', { root, paths });
}

export function commitGit(root: string, message: string): Promise<string> {
  return invokeDesktop('git_commit', { root, message });
}
