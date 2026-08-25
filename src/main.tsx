import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import './xfactor/brand-refresh.css'
import './xfactor/tutorial.css'
import './modules/studio/draw/draw-pro.css'
import { installIncidentUx } from './xfactor/incidentUx'
import { installIncidentContextUx } from './xfactor/incidentContextUx'
import { installDrawProEnhancements } from './modules/studio/draw/drawProEnhancements'
import { installXfactorTutorial } from './xfactor/tutorial'
import ErrorBoundary from './components/ErrorBoundary.tsx'

installIncidentUx()
installIncidentContextUx()
installDrawProEnhancements()
installXfactorTutorial()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
