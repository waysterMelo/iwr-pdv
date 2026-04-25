import { useState } from 'react'
import './App.css'
import { ProductManagementPage } from './pages/ProductManagementPage'
import { SalesCheckoutPage } from './pages/SalesCheckoutPage'

type AppView = 'checkout' | 'products'

function App() {
  const [currentView, setCurrentView] = useState<AppView>('checkout')

  return (
    <>
      <nav className="app-navigation" aria-label="Navegacao principal">
        <button
          className={currentView === 'checkout' ? 'nav-button nav-button--active' : 'nav-button'}
          type="button"
          onClick={() => setCurrentView('checkout')}
        >
          Caixa
        </button>
        <button
          className={currentView === 'products' ? 'nav-button nav-button--active' : 'nav-button'}
          type="button"
          onClick={() => setCurrentView('products')}
        >
          Produtos
        </button>
      </nav>
      {currentView === 'checkout' ? <SalesCheckoutPage /> : <ProductManagementPage />}
    </>
  )
}

export default App
