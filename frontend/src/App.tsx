import { useState } from 'react'
import './App.css'
import { ProductManagementPage } from './pages/ProductManagementPage'
import { SalesCheckoutPage } from './pages/SalesCheckoutPage'
import { SalesHistoryPage } from './pages/SalesHistoryPage'

type AppView = 'checkout' | 'products' | 'history'

function App() {
  const [currentView, setCurrentView] = useState<AppView>('checkout')
  const menuItems: Array<{ id: AppView; label: string; eyebrow: string }> = [
    { id: 'checkout', label: 'Vendas', eyebrow: 'PDV' },
    { id: 'history', label: 'Historico', eyebrow: 'Consultas' },
    { id: 'products', label: 'Produtos', eyebrow: 'Estoque' },
  ]

  const currentItem = menuItems.find((item) => item.id === currentView) ?? menuItems[0]

  return (
    <div className="app-layout">
      <aside className="app-sidebar">
        <div className="brand-block">
          <span className="brand-mark">IWR.</span>
          <span className="brand-caption">Atelier PDV</span>
        </div>

        <nav className="side-navigation" aria-label="Navegacao principal">
          {menuItems.map((item) => (
            <button
              className={currentView === item.id ? 'side-nav-button side-nav-button--active' : 'side-nav-button'}
              type="button"
              key={item.id}
              onClick={() => setCurrentView(item.id)}
            >
              <span>{item.eyebrow}</span>
              <strong>{item.label}</strong>
            </button>
          ))}
        </nav>

        <div className="operator-card">
          <div className="operator-avatar">W</div>
          <div>
            <strong>Wayster</strong>
            <span>Operacao local</span>
          </div>
        </div>
      </aside>

      <section className="workspace">
        <header className="workspace-header">
          <span>{currentItem.eyebrow}</span>
          <strong>{currentItem.label}</strong>
        </header>

        <div className="mobile-navigation" aria-label="Navegacao compacta">
          {menuItems.map((item) => (
            <button
              className={currentView === item.id ? 'nav-button nav-button--active' : 'nav-button'}
              type="button"
              key={item.id}
              onClick={() => setCurrentView(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>

        {currentView === 'checkout' ? <SalesCheckoutPage /> : null}
        {currentView === 'history' ? <SalesHistoryPage /> : null}
        {currentView === 'products' ? <ProductManagementPage /> : null}
      </section>
    </div>
  )
}

export default App
