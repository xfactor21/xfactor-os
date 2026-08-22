import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import './xfactor/brand-refresh.css'
import './modules/studio/draw/draw-pro.css'
import { installIncidentUx } from './xfactor/incidentUx'
import { installIncidentContextUx } from './xfactor/incidentContextUx'
import { installDrawProEnhancements } from './modules/studio/draw/drawProEnhancements'
import ErrorBoundary from './components/ErrorBoundary.tsx'

installIncidentUx()
installIncidentContextUx()
installDrawProEnhancements()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
