import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/roboto/400.css'
import '@fontsource/roboto/900.css'
import '@fontsource/righteous/400.css'
import './index.css'
import App from './App.tsx'
import { AppStateProvider } from './state/AppContext.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppStateProvider>
      <App />
    </AppStateProvider>
  </StrictMode>,
)
