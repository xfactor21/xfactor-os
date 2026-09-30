export function registerPwaRuntime() {
  if (!import.meta.env.PROD || typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
  // Tauri is not a web install target. Register only on secure hosted web origins.
  if (window.location.protocol !== 'https:') return;
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch((error) => {
      console.warn('xFactor.OS PWA runtime unavailable', error);
    });
  }, { once: true });
}
