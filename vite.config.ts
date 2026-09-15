import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'
import { readFileSync } from 'node:fs'

const packageVersion = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')).version as string

const isolationHeaders = {
  'Cross-Origin-Embedder-Policy': 'require-corp',
  'Cross-Origin-Opener-Policy': 'same-origin',
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'xfactor-version-stamp',
      transformIndexHtml(html) {
        return html.replaceAll('__XFACTOR_VERSION__', packageVersion)
      },
    },
  ],
  // WebContainers requires cross-origin isolation for SharedArrayBuffer.
  // Keep the same headers on both dev and preview so CI/browser acceptance
  // exercises the same security boundary the Terminal expects in production.
  server: {
    headers: isolationHeaders,
  },
  preview: {
    headers: isolationHeaders,
  },
  build: {
    // Poppable Quick Capture widget: a real second Tauri window with its
    // own webview, so it needs its own HTML entry point (widget.html →
    // widget-main.tsx) alongside the main app.
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        widget: resolve(__dirname, 'widget.html'),
      },
    },
  },
})
