import { useEffect, useState } from 'react'
import './App.css'
import { CashRegisterPage } from './pages/CashRegisterPage'
import { LoginPage } from './pages/LoginPage'
import { ProductManagementPage } from './pages/ProductManagementPage'
import { SalesCheckoutPage } from './pages/SalesCheckoutPage'
import { SalesHistoryPage } from './pages/SalesHistoryPage'
import { getCurrentUser, logout } from './services/authService'
import { clearAuthToken, getAuthToken } from './services/httpClient'
import type { AuthUser } from './types/auth'

type AppView = 'checkout' | 'cash-register' | 'products' | 'history'

function App() {
  const [currentView, setCurrentView] = useState<AppView>('checkout')
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null)
  const [isSessionChecking, setIsSessionChecking] = useState(() => Boolean(getAuthToken()))
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const menuItems: Array<{ id: AppView; label: string; eyebrow: string }> = [
    { id: 'checkout', label: 'Vendas', eyebrow: 'PDV' },
    { id: 'cash-register', label: 'Caixa', eyebrow: 'Operacao' },
    { id: 'history', label: 'Historico', eyebrow: 'Consultas' },
    { id: 'products', label: 'Produtos', eyebrow: 'Estoque' },
  ]

  const currentItem = menuItems.find((item) => item.id === currentView) ?? menuItems[0]
  const operatorInitial = currentUser?.displayName.trim().charAt(0).toUpperCase() || 'I'

  useEffect(() => {
    if (!getAuthToken()) {
      return
    }

    async function loadCurrentUser() {
      try {
        const user = await getCurrentUser()
        setCurrentUser(user)
      } catch {
        clearAuthToken()
        setCurrentUser(null)
      } finally {
        setIsSessionChecking(false)
      }
    }

    void loadCurrentUser()
  }, [])

  async function handleLogout() {
    setIsLoggingOut(true)

    try {
      await logout()
    } finally {
      setCurrentUser(null)
      setIsLoggingOut(false)
      setCurrentView('checkout')
    }
  }

  if (isSessionChecking) {
    return (
      <main className="login-shell">
        <section className="login-card">
          <div className="login-brand">
            <span className="brand-mark">IWR.</span>
            <span className="brand-caption">Atelier PDV</span>
          </div>
          <div className="product-empty">Validando sessao local...</div>
        </section>
      </main>
    )
  }

  if (!currentUser) {
    return <LoginPage onAuthenticated={setCurrentUser} />
  }

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
          <div className="operator-avatar">{operatorInitial}</div>
          <div className="operator-details">
            <strong>{currentUser.displayName}</strong>
            <span>{currentUser.role === 'ADMIN' ? 'Administrador' : 'Operador'}</span>
          </div>
          <button
            className="logout-button"
            type="button"
            onClick={() => void handleLogout()}
            disabled={isLoggingOut}
          >
            {isLoggingOut ? 'Saindo...' : 'Sair'}
          </button>
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
        {currentView === 'cash-register' ? <CashRegisterPage /> : null}
        {currentView === 'history' ? <SalesHistoryPage /> : null}
        {currentView === 'products' ? <ProductManagementPage /> : null}
      </section>
    </div>
  )
}

export default App
