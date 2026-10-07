import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import './xfactor/brand-refresh.css'
import './xfactor/tutorial.css'
import './modules/studio/draw/draw-pro.css'
import './modules/studio/wireframe-2.css'
import { installIncidentUx } from './xfactor/incidentUx'
import { installIncidentContextUx } from './xfactor/incidentContextUx'
import { installDrawProEnhancements } from './modules/studio/draw/drawProEnhancements'
import { installXfactorTutorial } from './xfactor/tutorial'
import ErrorBoundary from './components/ErrorBoundary.tsx'
import { startPlanetXAnalytics } from './services/planetxAnalytics'
import { registerPwaRuntime } from './pwaRuntime'

const root = document.getElementById('root')!
const boot = document.getElementById('xfactor-boot')

createRoot(root).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)

const afterFirstPaint = (callback: () => void) => {
  window.requestAnimationFrame(() => window.requestAnimationFrame(callback))
}
const runWhenIdle = (callback: () => void, timeout = 1400) => {
  const idleWindow = window as Window & { requestIdleCallback?: (cb: () => void, options?: { timeout: number }) => number }
  if (typeof idleWindow.requestIdleCallback === 'function') idleWindow.requestIdleCallback(callback, { timeout })
  else window.setTimeout(callback, 180)
}

afterFirstPaint(() => {
  document.documentElement.dataset.xfactorReady = 'true'
  boot?.classList.add('boot-out')
  window.setTimeout(() => boot?.remove(), 220)

  // DOM enhancers are useful, but they do not get to compete with first paint.
  window.setTimeout(() => {
    installIncidentUx()
    installIncidentContextUx()
    installDrawProEnhancements()
    installXfactorTutorial()
  }, 0)
})

// Network/service-worker instrumentation is explicitly noncritical startup work.
runWhenIdle(() => {
  startPlanetXAnalytics()
  registerPwaRuntime()
})
