import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './ui-overhaul.css'
import './pdv-gold-cards.css'
import './pdv-visual-rebalance.css'
import './customer-profile-polish.css'
import './customer-profile-engineered.css'
import './customer-profile-date-icons.css'
import App from './App.tsx'
import { AppMessageProvider } from './components/AppMessageModal.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppMessageProvider>
      <App />
    </AppMessageProvider>
  </StrictMode>,
)
