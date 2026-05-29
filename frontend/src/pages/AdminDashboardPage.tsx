import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { Banknote, BarChart3, CalendarDays, FileDown, ReceiptText, TrendingUp, WalletCards, ChevronLeft, ChevronRight } from 'lucide-react'
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
  const topCustomersPagination = usePagination(receivables.topCustomers, 6)
  const receivableItemsPagination = usePagination(receivables.items, 10)

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
      <div className="app-container customer-premium-container">
        
        {/* Banner do Topo */}
        <div className="customer-premium-hero">
          <section className="customer-premium-banner">
            <div className="customer-premium-badges">
              <span>★ BI &amp; AUDITORIA</span>
              <strong>Somente Administradores</strong>
            </div>
            <h1>Painel Administrativo</h1>
            <p>Acompanhe em tempo real as vendas, faturamento, parcelas de promissórias e recebimentos consolidados.</p>
          </section>

          <section className="customer-premium-target-card">
            <div>
              <span>Índice de Recebimento</span>
              <small>Efetividade de Cobrança</small>
            </div>
            <strong style={{ color: '#2dd4bf' }}>{receivedRatio}</strong>
            <div className="customer-premium-progress">
              <span style={{ width: receivedRatio, background: 'linear-gradient(90deg, #2dd4bf, #8ff2e7)' }} />
            </div>
          </section>
        </div>

        {/* Barra de Filtros e Preset de Períodos */}
        <section className="customer-premium-form-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="admin-dashboard-presets" style={{ display: 'flex', gap: '10px' }}>
            <button className="customer-premium-secondary-button" type="button" onClick={() => applyPreset('today')} style={{ minHeight: '36px', fontSize: '0.72rem', flex: 1 }}>Hoje</button>
            <button className="customer-premium-secondary-button" type="button" onClick={() => applyPreset('yesterday')} style={{ minHeight: '36px', fontSize: '0.72rem', flex: 1 }}>Ontem</button>
            <button className="customer-premium-secondary-button" type="button" onClick={() => applyPreset('week')} style={{ minHeight: '36px', fontSize: '0.72rem', flex: 1 }}>Esta semana</button>
            <button className="customer-premium-secondary-button" type="button" onClick={() => applyPreset('month')} style={{ minHeight: '36px', fontSize: '0.72rem', flex: 1 }}>Este mês</button>
          </div>

          <form className="history-filter-form" onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto auto', gap: '14px', alignItems: 'end', background: 'var(--surface-dark)', padding: '18px', borderRadius: '14px', border: '1px solid rgba(226,232,240,0.06)' }}>
            <div className="field-group">
              <label htmlFor="dashboardStart">Início</label>
              <input
                id="dashboardStart"
                type="date"
                value={draftFilters.startDate}
                onChange={(event) => setDraftFilters((current) => ({ ...current, startDate: event.target.value }))}
                style={{ colorScheme: 'dark', minHeight: '44px' }}
              />
            </div>
            <div className="field-group">
              <label htmlFor="dashboardEnd">Fim</label>
              <input
                id="dashboardEnd"
                type="date"
                value={draftFilters.endDate}
                onChange={(event) => setDraftFilters((current) => ({ ...current, endDate: event.target.value }))}
                style={{ colorScheme: 'dark', minHeight: '44px' }}
              />
            </div>
            <button className="customer-premium-primary-button" type="submit" disabled={isLoading} style={{ minHeight: '44px' }}>
              Filtrar Período
            </button>
            <button className="customer-premium-secondary-button" type="button" onClick={() => void handleReport()} style={{ minHeight: '44px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <FileDown size={14} /> PDF Relatório
            </button>
          </form>
          {errorMessage ? <div className="feedback-message feedback-message--error">{errorMessage}</div> : null}
        </section>

        {/* Métricas Principais (Grid 4 Colunas) */}
        <div className="customer-premium-metrics">
          <article style={{ border: '1px solid rgba(215, 173, 85, 0.4)', background: 'linear-gradient(180deg, rgba(215,173,85,0.04), rgba(0,0,0,0))' }}>
            <div>
              <span>Faturamento total</span>
              <strong style={{ color: 'var(--gold-strong)' }}>{formatCurrency(summary.totalSold)}</strong>
            </div>
            <TrendingUp size={19} aria-hidden="true" style={{ color: '#d7ad55', background: 'rgba(215, 173, 85, 0.1)' }} />
          </article>

          <article style={{ border: '1px solid rgba(45, 212, 191, 0.4)', background: 'linear-gradient(180deg, rgba(45,212,191,0.04), rgba(0,0,0,0))' }}>
            <div>
              <span>Total recebido</span>
              <strong style={{ color: '#2dd4bf' }}>{formatCurrency(summary.totalReceived)}</strong>
            </div>
            <Banknote size={19} aria-hidden="true" style={{ color: '#2dd4bf', background: 'rgba(45, 212, 191, 0.1)' }} />
          </article>

          <article>
            <div>
              <span>Promissórias em aberto</span>
              <strong>{formatCurrency(summary.openReceivables)}</strong>
            </div>
            <ReceiptText size={19} aria-hidden="true" />
          </article>

          <article style={{ borderColor: summary.overdueReceivables > 0 ? 'rgba(251, 113, 133, 0.4)' : undefined }}>
            <div>
              <span>Montante vencido</span>
              <strong style={{ color: summary.overdueReceivables > 0 ? '#fb7185' : '#fff' }}>{formatCurrency(summary.overdueReceivables)}</strong>
            </div>
            <CalendarDays size={19} aria-hidden="true" style={{ color: '#fb7185', background: 'rgba(251, 113, 133, 0.1)' }} />
          </article>
        </div>

        {/* Métricas Secundárias */}
        <div className="customer-premium-metrics" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
          <article style={{ minHeight: '94px', padding: '16px 20px' }}>
            <div>
              <span style={{ fontSize: '0.6rem' }}>Volume de Vendas</span>
              <strong style={{ fontSize: '1.4rem' }}>{summary.saleCount}</strong>
            </div>
            <WalletCards size={16} />
          </article>
          <article style={{ minHeight: '94px', padding: '16px 20px' }}>
            <div>
              <span style={{ fontSize: '0.6rem' }}>Ticket Médio</span>
              <strong style={{ fontSize: '1.4rem' }}>{formatCurrency(summary.averageTicket)}</strong>
            </div>
          </article>
          <article style={{ minHeight: '94px', padding: '16px 20px' }}>
            <div>
              <span style={{ fontSize: '0.6rem' }}>Descontos Concedidos</span>
              <strong style={{ fontSize: '1.4rem', color: '#fb7185' }}>{formatCurrency(summary.totalDiscounts)}</strong>
            </div>
          </article>
          <article style={{ minHeight: '94px', padding: '16px 20px', borderColor: summary.dueTodayReceivables > 0 ? 'rgba(215,173,85,0.3)' : undefined }}>
            <div>
              <span style={{ fontSize: '0.6rem' }}>Vencimentos de Hoje</span>
              <strong style={{ fontSize: '1.4rem', color: summary.dueTodayReceivables > 0 ? '#f6d78b' : '#fff' }}>{formatCurrency(summary.dueTodayReceivables)}</strong>
            </div>
          </article>
        </div>

        {/* Visão de Business Intelligence (BI) */}
        <section className="customer-premium-form-panel" style={{ padding: '24px' }}>
          <header style={{ display: 'flex', alignItems: 'center', gap: '10px', borderBottom: '1px solid rgba(226,232,240,0.08)', paddingBottom: '14px', marginBottom: '18px' }}>
            <BarChart3 size={22} style={{ color: '#d7ad55' }} />
            <div>
              <h2 style={{ fontSize: '1.1rem', color: '#fff', margin: 0, fontWeight: 500 }}>Visão Analítica de BI</h2>
              <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Indicadores gráficos e métricas rápidas de performance.</p>
            </div>
          </header>

          <div className="admin-bi-grid" style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr', gap: '22px' }}>
            {/* Gráficos de Barras com degradê Gold */}
            <div className="admin-mini-chart" style={{ background: 'var(--surface-dark)', border: '1px solid rgba(226,232,240,0.06)', borderRadius: '14px', padding: '18px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <span style={{ color: 'var(--gold-strong)', fontSize: '0.68rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Faturamento por Forma</span>
              {paymentMethods.length === 0 ? (
                <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', padding: '20px 0' }}>Sem movimentações no período.</div>
              ) : (
                <div style={{ display: 'grid', gap: '10px' }}>
                  {paymentMethods.map((payment) => (
                    <div className="admin-chart-row" key={payment.paymentMethod} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <small style={{ width: '80px', color: 'var(--text-secondary)', fontSize: '0.72rem', whiteSpace: 'nowrap' }}>{formatPaymentMethod(payment.paymentMethod)}</small>
                      <div style={{ flex: 1, height: '8px', background: '#11141a', borderRadius: '4px', overflow: 'hidden' }}>
                        <i style={{ 
                          display: 'block', 
                          height: '100%', 
                          borderRadius: 'inherit',
                          background: 'linear-gradient(90deg, #d7ad55, #f6d78b)', 
                          width: `${Math.max(6, (payment.receivedAmount / maxPaymentAmount) * 100)}%` 
                        }} />
                      </div>
                      <strong style={{ width: '90px', textAlign: 'right', color: '#fff', fontSize: '0.78rem' }}>{formatCurrency(payment.receivedAmount)}</strong>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Divisão de Recebíveis */}
            <div className="admin-mini-chart admin-mini-chart--split" style={{ background: 'var(--surface-dark)', border: '1px solid rgba(226,232,240,0.06)', borderRadius: '14px', padding: '18px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '14px' }}>
              <span style={{ color: 'var(--gold-strong)', fontSize: '0.68rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Recebíveis da Carteira</span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(226,232,240,0.04)', paddingBottom: '6px' }}>
                  <small style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>Em aberto</small>
                  <strong style={{ color: '#fff', fontSize: '0.85rem' }}>{formatCurrency(receivables.openAmount)}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(226,232,240,0.04)', paddingBottom: '6px' }}>
                  <small style={{ color: '#fb7185', fontSize: '0.75rem' }}>Vencido</small>
                  <strong style={{ color: '#fb7185', fontSize: '0.85rem' }}>{formatCurrency(receivables.overdueAmount)}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <small style={{ color: 'var(--gold-strong)', fontSize: '0.75rem' }}>Próximos 7 dias</small>
                  <strong style={{ color: 'var(--gold-strong)', fontSize: '0.85rem' }}>{formatCurrency(receivables.dueNext7DaysAmount)}</strong>
                </div>
              </div>
            </div>

            {/* Métricas de BI Vendas */}
            <div className="admin-mini-chart admin-mini-chart--split" style={{ background: 'var(--surface-dark)', border: '1px solid rgba(226,232,240,0.06)', borderRadius: '14px', padding: '18px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '14px' }}>
              <span style={{ color: 'var(--gold-strong)', fontSize: '0.68rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.04em' }}>BI de Operações</span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(226,232,240,0.04)', paddingBottom: '6px' }}>
                  <small style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>Total de Vendas</small>
                  <strong style={{ color: '#fff', fontSize: '0.85rem' }}>{summary.saleCount} un.</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(226,232,240,0.04)', paddingBottom: '6px' }}>
                  <small style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>Ticket Médio</small>
                  <strong style={{ color: '#fff', fontSize: '0.85rem' }}>{formatCurrency(summary.averageTicket)}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <small style={{ color: '#fb7185', fontSize: '0.75rem' }}>Desconto Total</small>
                  <strong style={{ color: '#fb7185', fontSize: '0.85rem' }}>{formatCurrency(summary.totalDiscounts)}</strong>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Calendário de Recebimentos com Halos Dourados */}
        <section className="customer-premium-form-panel" style={{ padding: '24px' }}>
          <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(226,232,240,0.08)', paddingBottom: '14px', marginBottom: '18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <CalendarDays size={22} style={{ color: '#d7ad55' }} />
              <div>
                <h2 style={{ fontSize: '1.1rem', color: '#fff', margin: 0, fontWeight: 500 }}>Calendário de recebimentos</h2>
                <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Clique em uma data iluminada para filtrar os recebíveis agendados para aquele dia.</p>
              </div>
            </div>
            
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <button className="customer-premium-secondary-button" type="button" onClick={() => setCalendarMonth((current) => shiftMonth(current, -1))} style={{ minHeight: '34px', fontSize: '0.72rem' }}>
                <ChevronLeft size={16} /> Anterior
              </button>
              <strong style={{ color: '#fff', fontSize: '0.9rem', textTransform: 'capitalize' }}>
                {new Date(`${calendarMonth}-01T00:00:00`).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
              </strong>
              <button className="customer-premium-secondary-button" type="button" onClick={() => setCalendarMonth((current) => shiftMonth(current, 1))} style={{ minHeight: '34px', fontSize: '0.72rem' }}>
                Próximo <ChevronRight size={16} />
              </button>
            </div>
          </header>

          <div className="calendar-weekdays" style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', textAlign: 'center', fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 900, marginBottom: '10px' }}>
            {['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'].map((day) => <span key={day}>{day}</span>)}
          </div>
          
          <div className="collection-calendar-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '6px' }}>
            {calendarDays.map((day, index) => {
              const total = day.date ? receivableDayTotals.get(day.date) : undefined
              const isSelected = day.date === selectedCalendarDate
              
              // Efeito de Halo Dourado Iluminando dias com recebíveis
              const dayStyle: React.CSSProperties = {
                minHeight: '64px',
                background: isSelected ? 'rgba(215, 173, 85, 0.22)' : total ? 'rgba(215, 173, 85, 0.06)' : '#0d1016',
                border: isSelected ? '1px solid #d7ad55' : total ? '1px solid rgba(215, 173, 85, 0.3)' : '1px solid rgba(226, 232, 240, 0.04)',
                boxShadow: total && !isSelected ? '0 0 10px rgba(215, 173, 85, 0.08)' : undefined,
                borderRadius: '8px',
                color: day.muted ? '#7b8493' : '#fff',
                cursor: day.muted ? 'default' : 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                padding: '8px 10px',
                transition: 'all 0.2s',
                textAlign: 'left'
              }

              return (
                <button
                  key={day.date || `admin-cal-${index}`}
                  className={day.date ? 'collection-calendar-day' : 'collection-calendar-day--empty'}
                  type="button"
                  disabled={day.muted}
                  onClick={() => selectCalendarDate(day.date)}
                  style={dayStyle}
                >
                  <span style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>{day.day || ''}</span>
                  {total ? (
                    <small style={{ fontSize: '0.62rem', color: 'var(--gold-strong)', fontWeight: 'bold', display: 'block', width: '100%', borderTop: '1px solid rgba(215,173,85,0.15)', paddingTop: '4px', marginTop: '4px' }}>
                      {total.count} nota(s) — {formatCurrency(total.amount)}
                    </small>
                  ) : null}
                </button>
              )
            })}
          </div>
        </section>

        {/* Resumos Secundários */}
        <div className="admin-dashboard-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '22px' }}>
          
          {/* Resumo por Forma de Pagamento */}
          <section className="customer-premium-form-panel" style={{ padding: '24px' }}>
            <header style={{ borderBottom: '1px solid rgba(226,232,240,0.08)', paddingBottom: '14px', marginBottom: '16px' }}>
              <h2 style={{ fontSize: '1.05rem', color: '#fff', margin: 0, fontWeight: 500 }}>Faturamento por Pagamento</h2>
              <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Resumo de vendas efetuadas e baixas ocorridas no período.</p>
            </header>

            <div className="admin-payment-list" style={{ display: 'grid', gap: '10px' }}>
              {paymentMethods.length === 0 ? (
                <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', padding: '20px 0' }}>Nenhuma venda ou recebimento neste período.</div>
              ) : (
                paymentMethods.map((payment) => (
                  <article key={payment.paymentMethod} style={{ background: 'var(--surface-dark)', border: '1px solid rgba(226,232,240,0.05)', borderRadius: '12px', padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <strong style={{ color: '#fff', fontSize: '0.9rem', display: 'block' }}>{formatPaymentMethod(payment.paymentMethod)}</strong>
                      <small style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>{payment.saleCount} venda(s) — {payment.receiptCount} baixa(s)</small>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <strong style={{ color: 'var(--gold-strong)', fontSize: '0.95rem', display: 'block' }}>{formatCurrency(payment.soldAmount)}</strong>
                      <small style={{ color: '#2dd4bf', fontSize: '0.72rem' }}>Recebido: {formatCurrency(payment.receivedAmount)}</small>
                    </div>
                  </article>
                ))
              )}
            </div>
          </section>

          {/* Maiores Devedores / Recebíveis do Período */}
          <section className="customer-premium-form-panel" style={{ padding: '24px' }}>
            <header style={{ borderBottom: '1px solid rgba(226,232,240,0.08)', paddingBottom: '14px', marginBottom: '16px' }}>
              <h2 style={{ fontSize: '1.05rem', color: '#fff', margin: 0, fontWeight: 500 }}>Concentração de Devedores</h2>
              <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Maiores saldos a receber vinculados a clientes.</p>
            </header>

            <div className="admin-top-customers" style={{ display: 'grid', gap: '10px' }}>
              {receivables.topCustomers.length === 0 ? (
                <div className="product-empty" style={{ background: 'var(--surface-dark)', borderRadius: '16px', padding: '40px' }}>Nenhum saldo pendente a receber de clientes.</div>
              ) : (
                topCustomersPagination.pageItems.map((customer) => (
                  <div key={customer.customerId} style={{ background: 'var(--surface-dark)', border: '1px solid rgba(226,232,240,0.05)', borderRadius: '12px', padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <strong style={{ color: '#fff', fontSize: '0.9rem', display: 'block' }}>{customer.customerName}</strong>
                      <small style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>Possui {customer.openInstallments} parcela(s) em aberto</small>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <strong style={{ color: '#fb7185', fontSize: '#0.95rem' }}>{formatCurrency(customer.openAmount)}</strong>
                    </div>
                  </div>
                ))
              )}
              <PaginationControls itemLabel="clientes" page={topCustomersPagination.page} pageSize={topCustomersPagination.pageSize} totalItems={topCustomersPagination.totalItems} totalPages={topCustomersPagination.totalPages} onPageChange={topCustomersPagination.setPage} />
            </div>
          </section>
        </div>

        {/* Tabela de Recebíveis do Período */}
        <section className="customer-premium-form-panel" style={{ padding: '24px' }}>
          <header style={{ borderBottom: '1px solid rgba(226,232,240,0.08)', paddingBottom: '14px', marginBottom: '18px' }}>
            <h2 style={{ fontSize: '1.1rem', color: '#fff', margin: 0, fontWeight: 500 }}>Histórico de parcelas no período</h2>
            <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Todas as parcelas com vencimento agendado para o intervalo filtrado.</p>
          </header>

          {isLoading ? (
            <div className="product-empty">Atualizando listagem de parcelas...</div>
          ) : receivables.items.length === 0 ? (
            <div className="product-empty" style={{ background: 'var(--surface-dark)', borderRadius: '16px', padding: '40px' }}>Nenhuma parcela de promissória pendente no período.</div>
          ) : (
            <div className="admin-receivable-table" style={{ display: 'grid', gap: '8px' }}>
              <div className="admin-receivable-head" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 1fr', padding: '10px 18px', background: 'var(--surface-dark)', borderRadius: '8px', fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 900 }}>
                <span>Cliente</span>
                <span>Venda</span>
                <span>Parcela</span>
                <span>Vencimento</span>
                <span>Status</span>
                <span style={{ textAlign: 'right' }}>Valor</span>
              </div>
              
              <div style={{ display: 'grid', gap: '8px' }}>
                {receivableItemsPagination.pageItems.map((item) => (
                  <article key={item.noteId} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 1fr', padding: '12px 18px', background: 'var(--surface-dark)', border: '1px solid rgba(226,232,240,0.04)', borderRadius: '10px', fontSize: '0.82rem', alignItems: 'center' }}>
                    <span style={{ color: '#fff', fontWeight: 'bold', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.customerName}</span>
                    <span style={{ color: 'var(--text-secondary)' }}>#{item.saleId}</span>
                    <span style={{ color: 'var(--text-secondary)' }}>{item.installmentNumber}/{item.totalInstallments}</span>
                    <span style={{ color: '#fff' }}>{new Date(`${item.dueDate}T00:00:00`).toLocaleDateString('pt-BR')}</span>
                    <span style={{ color: item.status === 'OVERDUE' ? '#fb7185' : item.status === 'PAID' ? '#2dd4bf' : '#f6d78b' }}>
                      {statusLabels[item.status]}
                    </span>
                    <strong style={{ color: 'var(--gold-strong)', textAlign: 'right' }}>{formatCurrency(item.amount)}</strong>
                  </article>
                ))}
              </div>
              <PaginationControls itemLabel="parcelas" page={receivableItemsPagination.page} pageSize={receivableItemsPagination.pageSize} totalItems={receivableItemsPagination.totalItems} totalPages={receivableItemsPagination.totalPages} onPageChange={receivableItemsPagination.setPage} />
            </div>
          )}
        </section>

      </div>
    </main>
  )
}



