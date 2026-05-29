import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './global-typography.css'
import './ui-overhaul.css'
import './pdv-gold-cards.css'
import './global-workspace-width.css'
import App from './App.tsx'
import { AppMessageProvider } from './components/AppMessageModal.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppMessageProvider>
      <App />
    </AppMessageProvider>
  </StrictMode>,
)
