import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { AppMessageProvider } from './components/AppMessageModal.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppMessageProvider>
      <App />
    </AppMessageProvider>
  </StrictMode>,
)
