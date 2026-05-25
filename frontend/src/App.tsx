import { lazy, Suspense, useEffect, useState } from 'react'
import type { LucideIcon } from 'lucide-react'
import { BarChart3, ChevronDown, ClipboardList, FileSpreadsheet, Gift, History, Package, PlusCircle, ReceiptText, Search, ShieldCheck, Tags, UserPlus, Users } from 'lucide-react'
import './App.css'

import { LoginPage } from './pages/LoginPage'
import { getCurrentUser, logout } from './services/authService'
import { clearAuthToken, getAuthToken } from './services/httpClient'
import { useMediaQuery } from './hooks/useMediaQuery'
import type { AuthUser } from './types/auth'

type AppView =
  | 'checkout'
  | 'history'
  | 'admin-dashboard'
  | 'promissory-notes'
  | 'promissory-create'
  | 'promissory-report'
  | 'loyalty'
  | 'customers-create'
  | 'customers-list'
  | 'customer-profile'
  | 'products-create'
  | 'products-list'
  | 'products-labels'
  | 'product-edit'
  | 'audit'
  | 'users'
type MobileView = 'home' | 'sale'

const AuditLogPage = lazy(() => import('./pages/AuditLogPage').then((module) => ({ default: module.AuditLogPage })))
const AdminDashboardPage = lazy(() => import('./pages/AdminDashboardPage').then((module) => ({ default: module.AdminDashboardPage })))
const CustomerManagementPage = lazy(() => import('./pages/CustomerManagementPage').then((module) => ({ default: module.CustomerManagementPage })))
const LoyaltyPage = lazy(() => import('./pages/LoyaltyPage').then((module) => ({ default: module.LoyaltyPage })))
const MobileSalesPage = lazy(() => import('./pages/MobileSalesPage').then((module) => ({ default: module.MobileSalesPage })))
const ProductEditPage = lazy(() => import('./pages/ProductEditPage').then((module) => ({ default: module.ProductEditPage })))
const ProductManagementPage = lazy(() => import('./pages/ProductManagementPage').then((module) => ({ default: module.ProductManagementPage })))
const PromissoryNotesPage = lazy(() => import('./pages/PromissoryNotesPage').then((module) => ({ default: module.PromissoryNotesPage })))
const SalesCheckoutPage = lazy(() => import('./pages/SalesCheckoutPage').then((module) => ({ default: module.SalesCheckoutPage })))
const SalesHistoryPage = lazy(() => import('./pages/SalesHistoryPage').then((module) => ({ default: module.SalesHistoryPage })))
const UserManagementPage = lazy(() => import('./pages/UserManagementPage').then((module) => ({ default: module.UserManagementPage })))

const menuIcons: Record<AppView, LucideIcon> = {
  checkout: ReceiptText,
  history: History,
  'admin-dashboard': BarChart3,
  'promissory-notes': ClipboardList,
  'promissory-create': PlusCircle,
  'promissory-report': FileSpreadsheet,
  loyalty: Gift,
  'customers-create': UserPlus,
  'customers-list': Users,
  'customer-profile': Search,
  audit: ShieldCheck,
  'products-create': PlusCircle,
  'products-list': Package,
  'products-labels': Tags,
  'product-edit': Package,
  users: Users,
}

function LoadingView() {
  return <div className="product-empty">Carregando tela...</div>
}

function App() {
  const [currentView, setCurrentView] = useState<AppView>('checkout')
  const [mobileView, setMobileView] = useState<MobileView>('home')
  const [editingProductId, setEditingProductId] = useState<number | null>(null)
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null)
  const [isSessionChecking, setIsSessionChecking] = useState(() => Boolean(getAuthToken()))
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [openMenuGroups, setOpenMenuGroups] = useState<Record<string, boolean>>({ Vendas: true })
  const isMobileLayout = useMediaQuery('(max-width: 900px), (pointer: coarse) and (max-width: 1100px)')
  const allMenuGroups: Array<{
    label: string
    items: Array<{ id: AppView; label: string; eyebrow: string; adminOnly?: boolean }>
  }> = [
    {
      label: 'Vendas',
      items: [
        { id: 'checkout', label: 'Nova venda', eyebrow: 'PDV' },
        { id: 'history', label: 'Historico', eyebrow: 'Consultas', adminOnly: true },
      ],
    },
    {
      label: 'Clientes',
      items: [
        { id: 'customers-create', label: 'Cadastrar', eyebrow: 'Clientes' },
        { id: 'customers-list', label: 'Listar', eyebrow: 'Clientes' },
        { id: 'customer-profile', label: 'Consulta completa', eyebrow: 'Clientes' },
        { id: 'loyalty', label: 'Aniversarios', eyebrow: 'Clientes' },
      ],
    },
    {
      label: 'Produtos',
      items: [
        { id: 'products-create', label: 'Cadastrar', eyebrow: 'Estoque' },
        { id: 'products-list', label: 'Listar/estoque', eyebrow: 'Estoque' },
        { id: 'products-labels', label: 'Etiquetas', eyebrow: 'Estoque' },
      ],
    },
    {
      label: 'Notas',
      items: [
        { id: 'promissory-notes', label: 'Listar/baixar', eyebrow: 'Promissorias' },
        { id: 'promissory-create', label: 'Cadastrar', eyebrow: 'Promissorias' },
        { id: 'promissory-report', label: 'Relatorio Excel', eyebrow: 'Promissorias' },
      ],
    },
    {
      label: 'Admin',
      items: [
        { id: 'admin-dashboard', label: 'Painel Admin', eyebrow: 'Admin', adminOnly: true },
        { id: 'users', label: 'Usuarios', eyebrow: 'Acessos', adminOnly: true },
        { id: 'audit', label: 'Auditoria', eyebrow: 'Admin', adminOnly: true },
      ],
    },
  ]
  const visibleMenuGroups = allMenuGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => currentUser?.role === 'ADMIN' || !item.adminOnly),
    }))
    .filter((group) => group.items.length > 0)
  const menuItems = visibleMenuGroups.flatMap((group) => group.items)
  const canEditProduct = currentView === 'product-edit' && editingProductId !== null
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

  useEffect(() => {
    const activeGroup = allMenuGroups.find((group) =>
      group.items.some((item) => item.id === visibleView) ||
      (group.label === 'Produtos' && visibleView === 'product-edit')
    )
    if (activeGroup) {
      setOpenMenuGroups({ [activeGroup.label]: true })
    }
  }, [visibleView])

  function toggleMenuGroup(groupLabel: string) {
    setOpenMenuGroups((current) => ({ ...current, [groupLabel]: !current[groupLabel] }))
  }

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
              <p>Venda por camera com carrinho simplificado e fechamento direto.</p>
            </section>

            <div className="mobile-home-actions">
              <button className="mobile-sell-button" type="button" onClick={() => setMobileView('sale')}>
                Vender
              </button>
            </div>
          </main>
        ) : mobileView === 'sale' ? (
          <Suspense fallback={<LoadingView />}>
            <MobileSalesPage onBack={() => setMobileView('home')} />
          </Suspense>
        ) : null}
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
              <span>Vendas e promissorias</span>
            </div>
          </div>
        ) : null}

        <nav className="side-navigation" aria-label="Navegacao principal">
          {visibleMenuGroups.map((group) => (
            <div className="side-nav-group" key={group.label}>
              <button
                className={`side-nav-dropdown-trigger${openMenuGroups[group.label] ? ' side-nav-dropdown-trigger--open' : ''}`}
                type="button"
                onClick={() => toggleMenuGroup(group.label)}
                aria-expanded={Boolean(openMenuGroups[group.label])}
              >
                <span>{group.label}</span>
                <ChevronDown size={16} strokeWidth={2.4} aria-hidden="true" />
              </button>
              <div
                className={`side-navigation-submenu${openMenuGroups[group.label] ? ' side-navigation-submenu--open' : ''}`}
                hidden={!openMenuGroups[group.label]}
              >
                {group.items.map((item) => {
                  const MenuIcon = menuIcons[item.id]

                  return (
                    <button
                      className={visibleView === item.id ? 'side-nav-button side-nav-button--active' : 'side-nav-button'}
                      type="button"
                      key={item.id}
                      onClick={() => {
                        setOpenMenuGroups((current) => ({ ...current, [group.label]: true }))
                        setCurrentView(item.id)
                      }}
                    >
                      <span className="side-nav-icon">
                        <MenuIcon size={21} strokeWidth={2.25} aria-hidden="true" />
                      </span>
                      <span className="side-nav-copy">
                        <span>{item.eyebrow}</span>
                        <strong>{item.label}</strong>
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
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

        {currentUser.passwordChangeRequired ? (
          <div className="feedback-message feedback-message--warning">
            Troque a senha padrao antes de operar em producao.
          </div>
        ) : null}

        <Suspense fallback={<LoadingView />}>
          {visibleView === 'checkout' ? <SalesCheckoutPage /> : null}
          {visibleView === 'admin-dashboard' ? <AdminDashboardPage /> : null}
          {visibleView === 'promissory-notes' ? (
            <PromissoryNotesPage
              mode="wallet"
              onModeChange={(nextMode) => {
                setCurrentView(nextMode === 'manual-create' ? 'promissory-create' : nextMode === 'report' ? 'promissory-report' : 'promissory-notes')
              }}
            />
          ) : null}
          {visibleView === 'promissory-create' ? (
            <PromissoryNotesPage
              mode="manual-create"
              onModeChange={(nextMode) => {
                setCurrentView(nextMode === 'manual-create' ? 'promissory-create' : nextMode === 'report' ? 'promissory-report' : 'promissory-notes')
              }}
            />
          ) : null}
          {visibleView === 'promissory-report' ? (
            <PromissoryNotesPage
              mode="report"
              onModeChange={(nextMode) => {
                setCurrentView(nextMode === 'manual-create' ? 'promissory-create' : nextMode === 'report' ? 'promissory-report' : 'promissory-notes')
              }}
            />
          ) : null}
          {visibleView === 'loyalty' ? <LoyaltyPage /> : null}
          {visibleView === 'customers-create' ? <CustomerManagementPage mode="create" /> : null}
          {visibleView === 'customers-list' ? <CustomerManagementPage mode="list" /> : null}
          {visibleView === 'customer-profile' ? <CustomerManagementPage mode="profile" /> : null}
          {visibleView === 'history' ? <SalesHistoryPage /> : null}
          {visibleView === 'audit' ? <AuditLogPage /> : null}
          {visibleView === 'products-create' ? (
            <ProductManagementPage
              mode="create"
              onEditProduct={(productId) => {
                setEditingProductId(productId)
                setCurrentView('product-edit')
              }}
            />
          ) : null}
          {visibleView === 'products-list' ? (
            <ProductManagementPage
              mode="list"
              onEditProduct={(productId) => {
                setEditingProductId(productId)
                setCurrentView('product-edit')
              }}
            />
          ) : null}
          {visibleView === 'products-labels' ? (
            <ProductManagementPage
              mode="labels"
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
                setCurrentView('products-list')
              }}
              onSaved={() => {
                setEditingProductId(null)
                setCurrentView('products-list')
              }}
            />
          ) : null}

          {visibleView === 'users' ? <UserManagementPage /> : null}
        </Suspense>
      </section>
    </div>
  )
}

export default App
