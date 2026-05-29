import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { Banknote, BarChart3, CalendarDays, ChevronLeft, ChevronRight, FileDown, ReceiptText, TrendingUp, WalletCards } from 'lucide-react'
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
import { getErrorMessage } from '../utils/errors'
import { formatCurrency } from '../utils/formatters'
import { formatPaymentMethod } from '../utils/paymentMethods'
import { useAppMessage } from '../hooks/useAppMessage'
import { PaginationControls } from '../components/PaginationControls'
import { usePagination } from '../hooks/usePagination'
import '../admin-dashboard-replica.css'

const statusLabels = {
  PENDING: 'Pendente',
  PARTIALLY_PAID: 'Parcial',
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

function formatDate(value: string | null | undefined) {
  if (!value) return '—'
  return new Date(`${value}T00:00:00`).toLocaleDateString('pt-BR')
}

function todayFilters(): AdminDashboardFilters {
  const today = toIsoDate(new Date())
  return { startDate: today, endDate: today }
}

function shiftMonth(value: string, offset: number) {
  const [year, month] = value.split('-').map(Number)
  const date = new Date(year, month - 1 + offset, 1)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function buildCalendarDays(monthValue: string) {
  const [year, month] = monthValue.split('-').map(Number)
  const firstDate = new Date(year, month - 1, 1)
  const lastDate = new Date(year, month, 0)
  const days: Array<{ date: string; day: number; muted: boolean }> = []

  for (let index = 0; index < firstDate.getDay(); index += 1) {
    days.push({ date: '', day: 0, muted: true })
  }

  for (let day = 1; day <= lastDate.getDate(); day += 1) {
    days.push({
      date: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
      day,
      muted: false,
    })
  }

  return days
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
    globalStockItems: 0,
    globalCostValue: 0,
    globalSaleValue: 0,
    totalCMV: 0,
    totalProfit: 0,
    topProducts: [],
  }
}

const emptyReceivables: AdminDashboardReceivables = {
  openAmount: 0,
  overdueAmount: 0,
  dueTodayAmount: 0,
  dueNext7DaysAmount: 0,
  dueNext30DaysAmount: 0,
  topCustomers: [],
  calendarDays: [],
  items: [],
}

export function AdminDashboardPage() {
  const { notify } = useAppMessage()
  const [filters, setFilters] = useState<AdminDashboardFilters>(() => todayFilters())
  const [draftFilters, setDraftFilters] = useState<AdminDashboardFilters>(() => todayFilters())
  const [summary, setSummary] = useState<AdminDashboardSummary>(() => emptySummary(todayFilters()))
  const [paymentMethods, setPaymentMethods] = useState<AdminDashboardPaymentMethod[]>([])
  const [receivables, setReceivables] = useState<AdminDashboardReceivables>(emptyReceivables)
  const [calendarMonth, setCalendarMonth] = useState(() => todayFilters().startDate.slice(0, 7))
  const [selectedCalendarDate, setSelectedCalendarDate] = useState(() => todayFilters().startDate)
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')

  const loadDashboard = useCallback(async (nextFilters: AdminDashboardFilters, nextCalendarMonth: string) => {
    setIsLoading(true)
    try {
      const [nextSummary, nextPaymentMethods, nextReceivables] = await Promise.all([
        getAdminDashboardSummary(nextFilters),
        getAdminDashboardPaymentMethods(nextFilters),
        getAdminDashboardReceivables(nextFilters, nextCalendarMonth),
      ])
      setSummary(nextSummary)
      setPaymentMethods(nextPaymentMethods)
      setReceivables(nextReceivables)
      setErrorMessage(null)
    } catch (error) {
      setErrorMessage(getErrorMessage(error, 'Não foi possível carregar o painel administrativo.'))
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadDashboard(filters, calendarMonth)
    }, 0)

    return () => window.clearTimeout(timeoutId)
  }, [calendarMonth, filters, loadDashboard])

  const receivedRatio = useMemo(() => {
    if (summary.totalSold <= 0) return '0%'
    return `${Math.min(100, Math.round((summary.totalReceived / summary.totalSold) * 100))}%`
  }, [summary.totalReceived, summary.totalSold])

  const receivedRatioValue = useMemo(() => {
    if (summary.totalSold <= 0) return 0
    return Math.min(100, Math.round((summary.totalReceived / summary.totalSold) * 100))
  }, [summary.totalReceived, summary.totalSold])

  const calendarDays = useMemo(() => buildCalendarDays(calendarMonth), [calendarMonth])

  const receivableDayTotals = useMemo(() => {
    const totals = new Map<string, { count: number; amount: number }>()
    receivables.calendarDays.forEach((day) => {
      totals.set(day.date, { count: day.count, amount: day.amount })
    })
    return totals
  }, [receivables.calendarDays])

  const maxPaymentAmount = useMemo(
    () => Math.max(...paymentMethods.map((payment) => payment.receivedAmount), 1),
    [paymentMethods],
  )

  const filteredItems = useMemo(() => {
    if (!searchTerm.trim()) return receivables.items
    const lower = searchTerm.toLowerCase()
    return receivables.items.filter((item) => {
      return item.customerName.toLowerCase().includes(lower) || String(item.saleId).toLowerCase().includes(lower)
    })
  }, [receivables.items, searchTerm])

  const topCustomersPagination = usePagination(receivables.topCustomers, 6)
  const receivableItemsPagination = usePagination(filteredItems, 10)

  function applyPreset(preset: 'today' | 'yesterday' | 'week' | 'month') {
    const nextFilters = presetFilters(preset)
    setDraftFilters(nextFilters)
    setFilters(nextFilters)
    setSelectedCalendarDate(nextFilters.startDate)
    setCalendarMonth(nextFilters.startDate.slice(0, 7))
  }

  function selectCalendarDate(date: string) {
    if (!date) return
    const nextFilters = { startDate: date, endDate: date }
    setSelectedCalendarDate(date)
    setDraftFilters(nextFilters)
    setFilters(nextFilters)
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFilters(draftFilters)
    setSelectedCalendarDate(draftFilters.startDate)
    setCalendarMonth(draftFilters.startDate.slice(0, 7))
  }

  async function handleReport() {
    try {
      await downloadAdminDashboardReport(filters)
      notify({
        type: 'success',
        title: 'Faturamento Exportado',
        message: 'O relatório financeiro em PDF foi baixado.',
      })
    } catch (error) {
      notify({
        type: 'error',
        title: 'Relatório indisponível',
        message: getErrorMessage(error, 'Não foi possível baixar o relatório administrativo.'),
      })
    }
  }

  return (
    <main className="app-shell customer-premium-shell admin-dashboard-shell">
      <div className="app-container customer-premium-container admx-dashboard">
        <div className="admx-hero">
          <section className="admx-banner">
            <div className="admx-badges">
              <span>★ BI &amp; AUDITORIA</span>
              <strong>Somente Administradores</strong>
            </div>
            <h1>Painel Administrativo</h1>
            <p>Acompanhe em tempo real as vendas, faturamento, parcelas de promissórias e recebimentos consolidados.</p>
          </section>

          <section className="admx-target">
            <div>
              <span>Índice de Recebimento</span>
              <small>Efetividade de Cobrança</small>
            </div>
            <strong>{receivedRatio}</strong>
            <div className="admx-progress">
              <span style={{ width: `${receivedRatioValue}%` }} />
            </div>
          </section>
        </div>

        <section className="admx-panel admx-filters">
          <div className="admx-presets">
            <button className="admx-btn" type="button" onClick={() => applyPreset('today')}>Hoje</button>
            <button className="admx-btn" type="button" onClick={() => applyPreset('yesterday')}>Ontem</button>
            <button className="admx-btn" type="button" onClick={() => applyPreset('week')}>Esta semana</button>
            <button className="admx-btn" type="button" onClick={() => applyPreset('month')}>Este mês</button>
          </div>

          <form className="admx-filter-form" onSubmit={handleSubmit}>
            <div>
              <label htmlFor="dashboardStart">Início</label>
              <input
                id="dashboardStart"
                type="date"
                value={draftFilters.startDate}
                onChange={(event) => setDraftFilters((current) => ({ ...current, startDate: event.target.value }))}
              />
            </div>
            <div>
              <label htmlFor="dashboardEnd">Fim</label>
              <input
                id="dashboardEnd"
                type="date"
                value={draftFilters.endDate}
                onChange={(event) => setDraftFilters((current) => ({ ...current, endDate: event.target.value }))}
              />
            </div>
            <button className="admx-btn admx-btn--gold" type="submit" disabled={isLoading}>Filtrar Período</button>
            <button className="admx-btn admx-btn--dark" type="button" onClick={() => void handleReport()}>
              <FileDown size={14} /> PDF Relatório
            </button>
          </form>
          {errorMessage ? <div className="feedback-message feedback-message--error">{errorMessage}</div> : null}
        </section>

        <section className="admx-metrics">
          <article className="admx-metric admx-metric--gold">
            <div>
              <span>Faturamento total</span>
              <strong>{formatCurrency(summary.totalSold)}</strong>
            </div>
            <TrendingUp size={19} aria-hidden="true" />
          </article>

          <article className="admx-metric admx-metric--green">
            <div>
              <span>Total recebido</span>
              <strong>{formatCurrency(summary.totalReceived)}</strong>
            </div>
            <Banknote size={19} aria-hidden="true" />
          </article>

          <article className="admx-metric">
            <div>
              <span>Promissórias em aberto</span>
              <strong>{formatCurrency(summary.openReceivables)}</strong>
            </div>
            <ReceiptText size={19} aria-hidden="true" />
          </article>

          <article className="admx-metric admx-metric--red">
            <div>
              <span>Montante vencido</span>
              <strong>{formatCurrency(summary.overdueReceivables)}</strong>
            </div>
            <CalendarDays size={19} aria-hidden="true" />
          </article>
        </section>

        <section className="admx-metrics admx-secondary-metrics">
          <article className="admx-metric">
            <div>
              <span>Volume de Vendas</span>
              <strong>{summary.saleCount}</strong>
            </div>
            <WalletCards size={16} />
          </article>
          <article className="admx-metric">
            <div>
              <span>Ticket Médio</span>
              <strong>{formatCurrency(summary.averageTicket)}</strong>
            </div>
            <span className="admx-metric-icon">◉</span>
          </article>
          <article className="admx-metric admx-metric--red">
            <div>
              <span>Descontos Concedidos</span>
              <strong>{formatCurrency(summary.totalDiscounts)}</strong>
            </div>
            <span className="admx-metric-icon">%</span>
          </article>
          <article className="admx-metric admx-metric--gold">
            <div>
              <span>Vencimentos de Hoje</span>
              <strong>{formatCurrency(summary.dueTodayReceivables)}</strong>
            </div>
            <span className="admx-metric-icon">!</span>
          </article>
        </section>

        <section className="admx-panel">
          <header className="admx-section-head">
            <BarChart3 size={22} aria-hidden="true" />
            <div>
              <h2>Visão Analítica de BI</h2>
              <p>Indicadores gráficos e métricas rápidas de performance.</p>
            </div>
          </header>

          <div className="admx-bi-grid">
            <article className="admx-mini-chart">
              <span className="admx-mini-title">Faturamento por Forma</span>
              {paymentMethods.length === 0 ? (
                <div className="admx-muted-state">Sem movimentações no período.</div>
              ) : (
                paymentMethods.map((payment) => {
                  const isPhysical = payment.paymentMethod === 'CASH' || payment.paymentMethod === 'DEBIT'
                  const barColor = isPhysical
                    ? 'linear-gradient(90deg, #f6d78b, #ffe9ad)'
                    : 'linear-gradient(90deg, #b77a1a, #d7ad55)'

                  return (
                    <div className="admx-chart-row" key={payment.paymentMethod}>
                      <small>{formatPaymentMethod(payment.paymentMethod)}</small>
                      <div className="admx-chart-bar">
                        <span
                          style={{
                            width: `${Math.max(6, (payment.receivedAmount / maxPaymentAmount) * 100)}%`,
                            background: barColor,
                          }}
                        />
                      </div>
                      <strong>{formatCurrency(payment.receivedAmount)}</strong>
                    </div>
                  )
                })
              )}
            </article>

            <article className="admx-mini-chart">
              <span className="admx-mini-title">Recebíveis da Carteira</span>
              <div className="admx-split-list">
                <div className="admx-split-line"><small>Em aberto</small><strong>{formatCurrency(receivables.openAmount)}</strong></div>
                <div className="admx-split-line"><small style={{ color: '#fb7185' }}>Vencido</small><strong style={{ color: '#fb7185' }}>{formatCurrency(receivables.overdueAmount)}</strong></div>
                <div className="admx-split-line"><small style={{ color: '#ffe9ad' }}>Próximos 7 dias</small><strong style={{ color: '#ffe9ad' }}>{formatCurrency(receivables.dueNext7DaysAmount)}</strong></div>
              </div>
            </article>

            <article className="admx-mini-chart">
              <span className="admx-mini-title">BI de Operações</span>
              <div className="admx-split-list">
                <div className="admx-split-line"><small>Total de Vendas</small><strong>{summary.saleCount} un.</strong></div>
                <div className="admx-split-line"><small>Ticket Médio</small><strong>{formatCurrency(summary.averageTicket)}</strong></div>
                <div className="admx-split-line"><small>Lucro estimado</small><strong style={{ color: '#34d399' }}>{formatCurrency(summary.totalProfit)}</strong></div>
              </div>
            </article>
          </div>
        </section>

        <section className="admx-admin-grid">
          <article className="admx-panel">
            <header className="admx-section-head">
              <CalendarDays size={22} aria-hidden="true" />
              <div>
                <h2>Calendário de Recebíveis</h2>
                <p>Dias com parcelas previstas e vencimentos.</p>
              </div>
              <div className="admx-calendar-toolbar">
                <button className="admx-btn admx-btn--dark" type="button" onClick={() => setCalendarMonth((current) => shiftMonth(current, -1))}>
                  <ChevronLeft size={16} /> Anterior
                </button>
                <strong>{new Date(`${calendarMonth}-01T00:00:00`).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</strong>
                <button className="admx-btn admx-btn--dark" type="button" onClick={() => setCalendarMonth((current) => shiftMonth(current, 1))}>
                  Próximo <ChevronRight size={16} />
                </button>
              </div>
            </header>

            <div className="admx-weekdays">
              {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((day) => <span key={day}>{day}</span>)}
            </div>
            <div className="admx-calendar">
              {calendarDays.map((day, index) => {
                const total = day.date ? receivableDayTotals.get(day.date) : undefined
                const isSelected = day.date === selectedCalendarDate
                const isToday = day.date === toIsoDate(new Date())
                const className = [
                  'admx-day',
                  total ? 'admx-day--has' : '',
                  isSelected ? 'admx-day--selected' : '',
                  isToday ? 'admx-day--today' : '',
                ].filter(Boolean).join(' ')

                return (
                  <button
                    className={className}
                    type="button"
                    key={`${day.date || 'empty'}-${index}`}
                    disabled={!day.date}
                    onClick={() => selectCalendarDate(day.date)}
                  >
                    <span>{day.day || ''}</span>
                    {total ? <strong>{formatCurrency(total.amount)}</strong> : null}
                  </button>
                )
              })}
            </div>
          </article>

          <article className="admx-panel">
            <header className="admx-section-head">
              <ReceiptText size={22} aria-hidden="true" />
              <div>
                <h2>Top Clientes em Aberto</h2>
                <p>Maiores saldos de promissórias e contas pendentes.</p>
              </div>
            </header>

            <div className="admx-top-customers">
              {topCustomersPagination.items.length === 0 ? (
                <div className="admx-muted-state">Nenhum cliente em aberto no período.</div>
              ) : (
                topCustomersPagination.items.map((customer) => (
                  <div className="admx-customer-line" key={customer.customerId}>
                    <div>
                      <span>{customer.customerName}</span>
                      <small>{customer.openInstallments} parcela(s) aberta(s)</small>
                    </div>
                    <strong>{formatCurrency(customer.openAmount)}</strong>
                  </div>
                ))
              )}
            </div>
            <PaginationControls
              itemLabel="clientes"
              page={topCustomersPagination.page}
              pageSize={topCustomersPagination.pageSize}
              totalItems={topCustomersPagination.totalItems}
              totalPages={topCustomersPagination.totalPages}
              onPageChange={topCustomersPagination.setPage}
            />
          </article>
        </section>

        <section className="admx-panel">
          <header className="admx-section-head">
            <ReceiptText size={22} aria-hidden="true" />
            <div>
              <h2>Recebíveis detalhados</h2>
              <p>Consulta operacional dos títulos em aberto, vencidos e futuros.</p>
            </div>
          </header>

          <div className="admx-table-tools">
            <div className="admx-search">
              <label htmlFor="receivableSearch">Buscar por cliente ou venda</label>
              <input
                id="receivableSearch"
                type="search"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Digite cliente ou ID da venda..."
              />
            </div>
            <span className="admx-muted-state">{filteredItems.length} título(s)</span>
          </div>

          <div className="admx-table-wrap">
            <table className="admx-table">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Vencimento</th>
                  <th>Status</th>
                  <th>Parcela</th>
                  <th>Valor</th>
                  <th>Venda</th>
                </tr>
              </thead>
              <tbody>
                {receivableItemsPagination.items.length === 0 ? (
                  <tr>
                    <td colSpan={6}>Nenhum recebível encontrado.</td>
                  </tr>
                ) : (
                  receivableItemsPagination.items.map((item) => (
                    <tr key={item.noteId}>
                      <td>{item.customerName}</td>
                      <td>{formatDate(item.dueDate)}</td>
                      <td>
                        <span className={`admx-status admx-status--${item.status.toLowerCase().replace('_', '-')}`}>
                          {statusLabels[item.status] ?? item.status}
                        </span>
                      </td>
                      <td>{item.installmentNumber}/{item.totalInstallments}</td>
                      <td>{formatCurrency(item.amount)}</td>
                      <td>#{item.saleId}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <PaginationControls
            itemLabel="recebíveis"
            page={receivableItemsPagination.page}
            pageSize={receivableItemsPagination.pageSize}
            totalItems={receivableItemsPagination.totalItems}
            totalPages={receivableItemsPagination.totalPages}
            onPageChange={receivableItemsPagination.setPage}
          />
        </section>
      </div>
    </main>
  )
}
