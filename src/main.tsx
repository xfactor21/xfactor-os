import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import './xfactor/brand-refresh.css'
import { installIncidentUx } from './xfactor/incidentUx'
import ErrorBoundary from './components/ErrorBoundary.tsx'

installIncidentUx()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
