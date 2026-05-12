import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { Banknote, CalendarDays, FileDown, ReceiptText, TrendingUp, WalletCards } from 'lucide-react'
import { Metric } from '../components/Metric'
import { PageHeader } from '../components/PageHeader'
import {
  downloadAdminDashboardReport,
  getAdminDashboardPaymentMethods,
  getAdminDashboardReceivables,
  getAdminDashboardSummary,
} from '../services/adminDashboardService'
import type {
  AdminDashboardFilters,
  AdminDashboardPaymentMethod,
  AdminDashboardReceivables,
  AdminDashboardSummary,
} from '../types/adminDashboard'
import type { PaymentMethod } from '../types/sale'
import { getErrorMessage } from '../utils/errors'
import { formatCurrency } from '../utils/formatters'
import { useAppMessage } from '../hooks/useAppMessage'

const paymentLabels: Record<PaymentMethod, string> = {
  CASH: 'Dinheiro',
  PIX: 'Pix',
  DEBIT_CARD: 'Debito',
  CREDIT_CARD: 'Credito',
  PROMISSORY_NOTE: 'Promissoria',
}

const statusLabels = {
  PENDING: 'Pendente',
  PAID: 'Pago',
  OVERDUE: 'Vencido',
  CANCELLED: 'Cancelado',
}

function toIsoDate(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function todayFilters(): AdminDashboardFilters {
  const today = toIsoDate(new Date())
  return { startDate: today, endDate: today }
}

function presetFilters(preset: 'today' | 'yesterday' | 'week' | 'month'): AdminDashboardFilters {
  const now = new Date()
  const start = new Date(now)
  const end = new Date(now)

  if (preset === 'yesterday') {
    start.setDate(start.getDate() - 1)
    end.setDate(end.getDate() - 1)
  }

  if (preset === 'week') {
    const day = start.getDay()
    const diff = day === 0 ? 6 : day - 1
    start.setDate(start.getDate() - diff)
  }

  if (preset === 'month') {
    start.setDate(1)
  }

  return { startDate: toIsoDate(start), endDate: toIsoDate(end) }
}

function emptySummary(filters: AdminDashboardFilters): AdminDashboardSummary {
  return {
    startDate: filters.startDate,
    endDate: filters.endDate,
    totalSold: 0,
    totalReceived: 0,
    totalCashSales: 0,
    totalPixSales: 0,
    totalDebitSales: 0,
    totalCreditSales: 0,
    totalPromissorySales: 0,
    saleCount: 0,
    averageTicket: 0,
    totalDiscounts: 0,
    openReceivables: 0,
    overdueReceivables: 0,
    dueTodayReceivables: 0,
    dueNext7DaysReceivables: 0,
    dueNext30DaysReceivables: 0,
  }
}

const emptyReceivables: AdminDashboardReceivables = {
  openAmount: 0,
  overdueAmount: 0,
  dueTodayAmount: 0,
  dueNext7DaysAmount: 0,
  dueNext30DaysAmount: 0,
  topCustomers: [],
  items: [],
}

export function AdminDashboardPage() {
  const { notify } = useAppMessage()
  const [filters, setFilters] = useState<AdminDashboardFilters>(() => todayFilters())
  const [draftFilters, setDraftFilters] = useState<AdminDashboardFilters>(() => todayFilters())
  const [summary, setSummary] = useState<AdminDashboardSummary>(() => emptySummary(todayFilters()))
  const [paymentMethods, setPaymentMethods] = useState<AdminDashboardPaymentMethod[]>([])
  const [receivables, setReceivables] = useState<AdminDashboardReceivables>(emptyReceivables)
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const loadDashboard = useCallback(async (nextFilters: AdminDashboardFilters) => {
    setIsLoading(true)
    try {
      const [nextSummary, nextPaymentMethods, nextReceivables] = await Promise.all([
        getAdminDashboardSummary(nextFilters),
        getAdminDashboardPaymentMethods(nextFilters),
        getAdminDashboardReceivables(nextFilters),
      ])
      setSummary(nextSummary)
      setPaymentMethods(nextPaymentMethods)
      setReceivables(nextReceivables)
      setErrorMessage(null)
    } catch (error) {
      setErrorMessage(getErrorMessage(error, 'Nao foi possivel carregar o painel administrativo.'))
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadDashboard(filters)
  }, [filters, loadDashboard])

  const receivedRatio = useMemo(() => {
    if (summary.totalSold <= 0) return '0%'
    return `${Math.min(100, Math.round((summary.totalReceived / summary.totalSold) * 100))}%`
  }, [summary.totalReceived, summary.totalSold])

  function applyPreset(preset: 'today' | 'yesterday' | 'week' | 'month') {
    const nextFilters = presetFilters(preset)
    setDraftFilters(nextFilters)
    setFilters(nextFilters)
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFilters(draftFilters)
  }

  async function handleReport() {
    try {
      await downloadAdminDashboardReport(filters)
    } catch (error) {
      notify({
        type: 'error',
        title: 'Relatorio indisponivel',
        message: getErrorMessage(error, 'Nao foi possivel baixar o relatorio administrativo.'),
      })
    }
  }

  return (
    <main className="app-shell">
      <div className="app-container admin-dashboard-container">
        <PageHeader
          eyebrow="Admin"
          title="Painel Admin"
          subtitle="Acompanhe vendas, recebimentos e promissorias abertas por periodo."
          metricLabel="Recebido"
          metricValue={receivedRatio}
          status="Somente ADMIN"
        />

        <section className="scanner-panel admin-dashboard-filter-panel">
          <div className="admin-dashboard-presets">
            <button className="secondary-button" type="button" onClick={() => applyPreset('today')}>Hoje</button>
            <button className="secondary-button" type="button" onClick={() => applyPreset('yesterday')}>Ontem</button>
            <button className="secondary-button" type="button" onClick={() => applyPreset('week')}>Semana</button>
            <button className="secondary-button" type="button" onClick={() => applyPreset('month')}>Mes</button>
          </div>
          <form className="history-filter-form" onSubmit={handleSubmit}>
            <div className="field-group">
              <label htmlFor="dashboardStart">Inicio</label>
              <input
                id="dashboardStart"
                type="date"
                value={draftFilters.startDate}
                onChange={(event) => setDraftFilters((current) => ({ ...current, startDate: event.target.value }))}
              />
            </div>
            <div className="field-group">
              <label htmlFor="dashboardEnd">Fim</label>
              <input
                id="dashboardEnd"
                type="date"
                value={draftFilters.endDate}
                onChange={(event) => setDraftFilters((current) => ({ ...current, endDate: event.target.value }))}
              />
            </div>
            <button className="action-button" type="submit" disabled={isLoading}>Filtrar</button>
            <button className="secondary-button" type="button" onClick={() => void handleReport()}>
              <FileDown size={14} strokeWidth={2.3} aria-hidden="true" />PDF
            </button>
          </form>
          {errorMessage ? <div className="feedback-message feedback-message--error">{errorMessage}</div> : null}
        </section>

        <div className="metric-grid metric-grid--4">
          <Metric label="Total vendido" value={formatCurrency(summary.totalSold)} tone="gold" icon={TrendingUp} />
          <Metric label="Total recebido" value={formatCurrency(summary.totalReceived)} tone="success" icon={Banknote} />
          <Metric label="Em aberto" value={formatCurrency(summary.openReceivables)} tone="warning" icon={ReceiptText} />
          <Metric label="Vencido" value={formatCurrency(summary.overdueReceivables)} tone={summary.overdueReceivables > 0 ? 'danger' : 'default'} icon={CalendarDays} />
        </div>

        <div className="metric-grid metric-grid--4 admin-dashboard-secondary-metrics">
          <Metric label="Vendas" value={String(summary.saleCount)} icon={WalletCards} />
          <Metric label="Ticket medio" value={formatCurrency(summary.averageTicket)} />
          <Metric label="Descontos" value={formatCurrency(summary.totalDiscounts)} />
          <Metric label="Vence hoje" value={formatCurrency(summary.dueTodayReceivables)} tone="warning" />
        </div>

        <div className="admin-dashboard-grid">
          <section className="cart-panel admin-dashboard-panel">
            <header className="section-header">
              <div>
                <h2>Resumo por pagamento</h2>
                <p>Vendido no periodo e recebido no caixa.</p>
              </div>
            </header>
            <div className="admin-payment-list">
              {paymentMethods.map((payment) => (
                <article className="admin-payment-row" key={payment.paymentMethod}>
                  <div>
                    <span>{paymentLabels[payment.paymentMethod]}</span>
                    <small>{payment.saleCount} venda(s) - {payment.receiptCount} baixa(s)</small>
                  </div>
                  <div>
                    <strong>{formatCurrency(payment.soldAmount)}</strong>
                    <small>Recebido {formatCurrency(payment.receivedAmount)}</small>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="cart-panel admin-dashboard-panel">
            <header className="section-header">
              <div>
                <h2>Recebiveis</h2>
                <p>Promissorias abertas e vencimentos proximos.</p>
              </div>
            </header>
            <div className="cash-history-kpi-grid">
              <div><span>Aberto</span><strong>{formatCurrency(receivables.openAmount)}</strong></div>
              <div><span>Vencido</span><strong>{formatCurrency(receivables.overdueAmount)}</strong></div>
              <div><span>7 dias</span><strong>{formatCurrency(receivables.dueNext7DaysAmount)}</strong></div>
              <div><span>30 dias</span><strong>{formatCurrency(receivables.dueNext30DaysAmount)}</strong></div>
            </div>
            <div className="admin-top-customers">
              {receivables.topCustomers.length === 0 ? (
                <div className="product-empty">Nenhum cliente com valor em aberto.</div>
              ) : receivables.topCustomers.map((customer) => (
                <div className="admin-top-customer" key={customer.customerId}>
                  <span>{customer.customerName}</span>
                  <strong>{formatCurrency(customer.openAmount)}</strong>
                  <small>{customer.openInstallments} parcela(s)</small>
                </div>
              ))}
            </div>
          </section>
        </div>

        <section className="cart-panel admin-dashboard-panel">
          <header className="section-header">
            <div>
              <h2>Lista de recebiveis</h2>
              <p>Parcelas abertas no periodo selecionado.</p>
            </div>
          </header>
          {isLoading ? (
            <div className="product-empty">Carregando painel...</div>
          ) : receivables.items.length === 0 ? (
            <div className="product-empty">Nenhuma promissoria aberta no periodo.</div>
          ) : (
            <div className="admin-receivable-table">
              <div className="admin-receivable-head">
                <span>Cliente</span>
                <span>Venda</span>
                <span>Parcela</span>
                <span>Vencimento</span>
                <span>Status</span>
                <span>Valor</span>
              </div>
              {receivables.items.map((item) => (
                <article className="admin-receivable-row" key={item.noteId}>
                  <span>{item.customerName}</span>
                  <span>#{item.saleId}</span>
                  <span>{item.installmentNumber}/{item.totalInstallments}</span>
                  <span>{new Date(`${item.dueDate}T00:00:00`).toLocaleDateString('pt-BR')}</span>
                  <span>{statusLabels[item.status]}</span>
                  <strong>{formatCurrency(item.amount)}</strong>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  )
}
