let bootPromise: Promise<import('@webcontainer/api').WebContainer> | null = null;

export function webContainerSupported(): boolean {
  return typeof window !== 'undefined' && window.crossOriginIsolated === true;
}

/** One WebContainer per page. The Terminal and Developer Workbench share it,
 * so the interactive shell sees the exact same /workspace files/processes
 * that the Workbench edits and launches. */
export async function getWebContainer(): Promise<import('@webcontainer/api').WebContainer> {
  if (!bootPromise) {
    bootPromise = (async () => {
      const { WebContainer } = await import('@webcontainer/api');
      return WebContainer.boot({ coep: 'require-corp' });
    })();
  }
  return bootPromise;
}
