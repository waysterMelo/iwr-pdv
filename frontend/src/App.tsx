import { useEffect, useState } from 'react'
import './App.css'
import navCashRegister from './assets/generated/nav-cash-register.png'
import navCataloging from './assets/generated/nav-cataloging.png'
import navHistory from './assets/generated/nav-history.png'
import navProducts from './assets/generated/nav-products.png'
import navSales from './assets/generated/nav-sales.png'
import navUsers from './assets/generated/nav-users.png'
import { CashRegisterPage } from './pages/CashRegisterPage'
import { CatalogingPage } from './pages/CatalogingPage'
import { CustomerManagementPage } from './pages/CustomerManagementPage'
import { LoginPage } from './pages/LoginPage'
import { LoyaltyPage } from './pages/LoyaltyPage'
import { MobileSalesPage } from './pages/MobileSalesPage'
import { MobileCashRegisterPage } from './pages/MobileCashRegisterPage'
import { ProductEditPage } from './pages/ProductEditPage'
import { ProductManagementPage } from './pages/ProductManagementPage'
import { PromissoryNotesPage } from './pages/PromissoryNotesPage'
import { SalesCheckoutPage } from './pages/SalesCheckoutPage'
import { SalesHistoryPage } from './pages/SalesHistoryPage'
import { UserManagementPage } from './pages/UserManagementPage'
import { getCurrentUser, logout } from './services/authService'
import { clearAuthToken, getAuthToken } from './services/httpClient'
import { useMediaQuery } from './hooks/useMediaQuery'
import type { AuthUser } from './types/auth'

type AppView = 'checkout' | 'cash-register' | 'promissory-notes' | 'loyalty' | 'customers' | 'products' | 'product-edit' | 'cataloging' | 'history' | 'users'
type MobileView = 'home' | 'sale' | 'cash-register'

const menuImages: Record<AppView, string> = {
  checkout: navSales,
  'cash-register': navCashRegister,
  'promissory-notes': navHistory,
  loyalty: navUsers,
  customers: navUsers,
  history: navHistory,
  products: navProducts,
  'product-edit': navProducts,
  cataloging: navCataloging,
  users: navUsers,
}

function App() {
  const [currentView, setCurrentView] = useState<AppView>('checkout')
  const [mobileView, setMobileView] = useState<MobileView>('home')
  const [editingProductId, setEditingProductId] = useState<number | null>(null)
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null)
  const [isSessionChecking, setIsSessionChecking] = useState(() => Boolean(getAuthToken()))
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const isMobileLayout = useMediaQuery('(max-width: 900px), (pointer: coarse) and (max-width: 1100px)')
  const allMenuItems: Array<{ id: AppView; label: string; eyebrow: string; adminOnly?: boolean }> = [
    { id: 'checkout', label: 'Vendas', eyebrow: 'PDV' },
    { id: 'cash-register', label: 'Caixa', eyebrow: 'Operacao' },
    { id: 'promissory-notes', label: 'Notas', eyebrow: 'Promissorias' },
    { id: 'loyalty', label: 'Fidelidade', eyebrow: 'Clientes' },
    { id: 'customers', label: 'Clientes', eyebrow: 'Cadastro' },
    { id: 'history', label: 'Historico', eyebrow: 'Consultas', adminOnly: true },
    { id: 'products', label: 'Produtos', eyebrow: 'Estoque', adminOnly: true },
    { id: 'cataloging', label: 'Catalogacao', eyebrow: 'Lotes', adminOnly: true },
    { id: 'users', label: 'Usuarios', eyebrow: 'Acessos', adminOnly: true },
  ]
  const menuItems = allMenuItems.filter((item) => currentUser?.role === 'ADMIN' || !item.adminOnly)
  const canEditProduct = currentUser?.role === 'ADMIN' && currentView === 'product-edit' && editingProductId !== null
  const visibleView = menuItems.some((item) => item.id === currentView) || canEditProduct ? currentView : 'checkout'

  const currentItem =
    visibleView === 'product-edit'
      ? { id: 'product-edit' as const, label: 'Editar produto', eyebrow: 'Estoque' }
      : menuItems.find((item) => item.id === visibleView) ?? menuItems[0]
  const operatorInitial = currentUser?.displayName.trim().charAt(0).toUpperCase() || 'I'
  const isOperationLayout = true

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
      setMobileView('home')
      setEditingProductId(null)
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

  if (isMobileLayout) {
    return (
      <div className="mobile-layout">
        {mobileView === 'home' ? (
          <main className="mobile-home-shell">
            <header className="mobile-brand-header">
              <div>
                <span className="brand-mark">IWR.</span>
                <span className="brand-caption">PDV Mobile</span>
              </div>
              <button
                className="mobile-link-button"
                type="button"
                onClick={() => void handleLogout()}
                disabled={isLoggingOut}
              >
                {isLoggingOut ? 'Saindo...' : 'Sair'}
              </button>
            </header>

            <section className="mobile-home-hero">
              <span className="eyebrow">Vendedor</span>
              <h1>{currentUser.displayName}</h1>
              <p>Venda por camera com carrinho simplificado e fechamento direto no caixa aberto.</p>
            </section>

            <div className="mobile-home-actions">
              <button className="mobile-sell-button mobile-sell-button--secondary" type="button" onClick={() => setMobileView('cash-register')}>
                Meu Caixa
              </button>
              <button className="mobile-sell-button" type="button" onClick={() => setMobileView('sale')}>
                Vender
              </button>
            </div>
          </main>
        ) : mobileView === 'sale' ? (
          <MobileSalesPage onBack={() => setMobileView('home')} />
        ) : (
          <MobileCashRegisterPage onBack={() => setMobileView('home')} />
        )}
      </div>
    )
  }

  return (
    <div className={`app-layout ${isOperationLayout ? 'app-layout--operation' : 'app-layout--compact'}`}>
      <aside className="app-sidebar">
        <div className="brand-block">
          {isOperationLayout ? <div className="brand-logo-letter">I</div> : null}
          <div className="brand-text-group">
            <span className="brand-mark">IWR.</span>
            <span className="brand-caption">ATELIER PDV</span>
          </div>
        </div>

        {isOperationLayout ? (
          <div className="premium-status-card">
            <div className="premium-status-card__icon" aria-hidden="true" />
            <div>
              <strong>Operacao premium</strong>
              <span>Caixa aberto - Loja online</span>
            </div>
          </div>
        ) : null}

        <nav className="side-navigation" aria-label="Navegacao principal">
          {menuItems.map((item) => (
            (() => {
              const menuImage = menuImages[item.id]

              return (
            <button
              className={visibleView === item.id ? 'side-nav-button side-nav-button--active' : 'side-nav-button'}
              type="button"
              key={item.id}
              onClick={() => setCurrentView(item.id)}
            >
              <span className="side-nav-icon">
                <img src={menuImage} alt="" aria-hidden="true" />
              </span>
              <span className="side-nav-copy">
                <span>{item.eyebrow}</span>
                <strong>{item.label}</strong>
              </span>
            </button>
              )
            })()
          ))}
        </nav>

        <div className="operator-card">
          <div className="operator-avatar">{operatorInitial}</div>
          <div className="operator-details">
            <strong>{currentUser.displayName}</strong>
            <span>{visibleView === 'checkout' || currentUser.role === 'OPERATOR' ? 'Vendedor' : 'Administrador'}</span>
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
          <div className="workspace-search">Buscar produto, venda ou usuario...</div>
          <div className="workspace-current">
            <span>{currentItem.eyebrow}</span>
            <strong>{currentItem.label}</strong>
          </div>
        </header>

        <div className="mobile-navigation" aria-label="Navegacao compacta">
          {menuItems.map((item) => (
            <button
              className={visibleView === item.id ? 'nav-button nav-button--active' : 'nav-button'}
              type="button"
              key={item.id}
              onClick={() => setCurrentView(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>

        {visibleView === 'checkout' ? <SalesCheckoutPage /> : null}
        {visibleView === 'cash-register' ? <CashRegisterPage /> : null}
        {visibleView === 'promissory-notes' ? <PromissoryNotesPage /> : null}
        {visibleView === 'loyalty' ? <LoyaltyPage /> : null}
        {visibleView === 'customers' ? <CustomerManagementPage /> : null}
        {visibleView === 'history' ? <SalesHistoryPage /> : null}
        {visibleView === 'products' ? (
          <ProductManagementPage
            onEditProduct={(productId) => {
              setEditingProductId(productId)
              setCurrentView('product-edit')
            }}
          />
        ) : null}
        {visibleView === 'product-edit' && editingProductId !== null ? (
          <ProductEditPage
            productId={editingProductId}
            onBack={() => {
              setEditingProductId(null)
              setCurrentView('products')
            }}
            onSaved={() => {
              setEditingProductId(null)
              setCurrentView('products')
            }}
          />
        ) : null}
        {visibleView === 'cataloging' ? <CatalogingPage /> : null}
        {visibleView === 'users' ? <UserManagementPage /> : null}
      </section>
    </div>
  )
}

export default App
