import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { BadgeDollarSign, CalendarClock, CreditCard, ReceiptText, UserRound, Sparkles, Filter, Search, Receipt } from 'lucide-react'
import { cancelSale, getSaleReceiptUrl, getSales } from '../services/saleService'
import { useAppMessage } from '../hooks/useAppMessage'
import { PageHeader } from '../components/PageHeader'
import { PaginationControls } from '../components/PaginationControls'
import type { Sale } from '../types/sale'
import { getErrorMessage } from '../utils/errors'
import { formatCurrency, formatNullableDateTime } from '../utils/formatters'
import { usePagination } from '../hooks/usePagination'

function getSellerName(sale: Sale) {
  return sale.operator?.displayName?.trim() || 'Vendedor nao identificado'
}

export function SalesHistoryPage() {
  const { confirm, notify } = useAppMessage()
  const [sales, setSales] = useState<Sale[]>([])
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isCancelling, setIsCancelling] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const totalAmount = useMemo(
    () => sales.reduce((sum, sale) => sum + sale.totalAmount, 0),
    [sales],
  )
  const salesPagination = usePagination(sales, 8)
  const saleItemsPagination = usePagination(selectedSale?.items ?? [], 6)

  const loadSales = useCallback(async (nextStartDate: string, nextEndDate: string) => {
    setIsLoading(true)

    try {
      const response = await getSales(nextStartDate, nextEndDate)
      setSales(response)
      setSelectedSale(response[0] ?? null)
      setErrorMessage(null)
    } catch (error) {
      setErrorMessage(getErrorMessage(error, 'Nao foi possivel carregar o historico.'))
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadSales('', '')
    }, 0)

    return () => window.clearTimeout(timeoutId)
  }, [loadSales])

  function handleFilterSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void loadSales(startDate, endDate)
  }

  function clearFilters() {
    setStartDate('')
    setEndDate('')
    void loadSales('', '')
  }

  async function handleCancelSale() {
    if (!selectedSale || selectedSale.status === 'CANCELLED') {
      return
    }

    const reason = window.prompt(`Informe o motivo do cancelamento da venda #${selectedSale.id}:`)
    if (!reason?.trim()) {
      return
    }

    const confirmed = await confirm({
      type: 'warning',
      title: 'Cancelar venda?',
      message: 'Cancelar esta venda e devolver os itens ao estoque?',
      confirmLabel: 'Cancelar venda',
      cancelLabel: 'Voltar',
    })
    if (!confirmed) {
      return
    }

    setIsCancelling(true)

    try {
      const cancelledSale = await cancelSale(selectedSale.id, reason.trim())
      setSelectedSale(cancelledSale)
      await loadSales(startDate, endDate)
      setErrorMessage(null)
      notify({
        type: 'success',


        title: 'Venda cancelada',
        message: `Venda #${selectedSale.id} cancelada e estoque devolvido.`,
      })
    } catch (error) {
      const message = getErrorMessage(error, 'Nao foi possivel cancelar a venda.')
      setErrorMessage(message)
      notify({
        type: 'error',
        title: 'Erro ao cancelar venda',
        message,
      })
    } finally {
      setIsCancelling(false)
    }
  }

  return (
    <main className="app-shell customer-premium-shell">
      <div className="app-container customer-premium-container">
        
        {/* Banner do Topo */}
        <div className="customer-premium-hero">
          <section className="customer-premium-banner">
            <div className="customer-premium-badges">
              <span>★ HISTÓRICO</span>
              <strong>{sales.length} data(s) de venda(s)</strong>
            </div>
            <h1>Histórico de vendas</h1>
            <p>Consulte vendas reais, revise itens vendidos e acompanhe o total do período.</p>
          </section>

          <section className="customer-premium-target-card">
            <div>
              <span>Faturamento Total</span>
              <small>Período selecionado</small>
            </div>
            <strong>{formatCurrency(totalAmount)}</strong>
            <div className="customer-premium-progress">
              <span style={{ width: '100%' }} />
            </div>
          </section>
        </div>

        {/* Filtros de Vendas Premium */}
        <section className="customer-premium-list-panel" style={{ padding: '20px', marginBottom: '24px' }}>
          <form className="customer-premium-search" onSubmit={handleFilterSubmit} style={{ display: 'flex', gap: '16px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div className="field-group" style={{ flex: 1, minWidth: '150px' }}>
              <label htmlFor="startDate" style={{ color: '#f6d78b', fontWeight: 900, fontSize: '0.62rem', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '6px', display: 'block' }}>Data Início</label>
              <input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
                style={{ colorScheme: 'dark', background: '#0d1016', color: '#fff', border: '1px solid rgba(226,232,240,0.12)', borderRadius: '12px', minHeight: '48px', padding: '0 16px', width: '100%' }}
              />
            </div>
            <div className="field-group" style={{ flex: 1, minWidth: '150px' }}>
              <label htmlFor="endDate" style={{ color: '#f6d78b', fontWeight: 900, fontSize: '0.62rem', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '6px', display: 'block' }}>Data Fim</label>
              <input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(event) => setEndDate(event.target.value)}
                style={{ colorScheme: 'dark', background: '#0d1016', color: '#fff', border: '1px solid rgba(226,232,240,0.12)', borderRadius: '12px', minHeight: '48px', padding: '0 16px', width: '100%' }}
              />
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button className="customer-premium-primary-button" type="submit" disabled={isLoading} style={{ minHeight: '48px', padding: '0 24px' }}>
                <Filter size={15} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
                Filtrar
              </button>
              <button className="customer-premium-secondary-button" type="button" onClick={clearFilters} disabled={isLoading} style={{ minHeight: '48px', padding: '0 24px' }}>
                Limpar
              </button>
            </div>
          </form>

          {errorMessage ? (
            <div className="feedback-message feedback-message--error" style={{ marginTop: '16px' }}>{errorMessage}</div>
          ) : null}
        </section>

        {/* Grade de Histórico */}
        <div className="history-grid">
          {/* Coluna Esquerda: Listagem de Vendas */}
          <section className="customer-premium-list-panel" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <header style={{ borderBottom: '1px solid rgba(226, 232, 240, 0.08)', paddingBottom: '14px', marginBottom: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <ReceiptText size={22} style={{ color: '#d7ad55' }} />
                <div>
                  <h2 style={{ fontSize: '1.1rem', color: '#fff', margin: 0, fontWeight: 500 }}>Vendas</h2>
                  <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: '#707b8c' }}>Selecione uma venda para visualizar os detalhes e itens.</p>
                </div>
              </div>
            </header>

            {isLoading ? (
              <div className="product-empty">Carregando histórico...</div>
            ) : sales.length === 0 ? (
              <div className="product-empty" style={{ background: '#0d1016', borderRadius: '16px', padding: '40px' }}>Nenhuma venda encontrada para o período.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'grid', gap: '12px' }}>
                  {salesPagination.pageItems.map((sale) => (
                    <button
                      key={sale.id}
                      onClick={() => setSelectedSale(sale)}
                      style={{
                        display: 'grid',
                        gap: '8px',
                        width: '100%',
                        padding: '16px',
                        textAlign: 'left',
                        borderRadius: '12px',
                        background: selectedSale?.id === sale.id ? 'linear-gradient(135deg, rgba(215, 173, 85, 0.12), rgba(16, 17, 23, 0.98))' : '#0d1016',
                        border: selectedSale?.id === sale.id ? '1px solid #d7ad55' : '1px solid rgba(226, 232, 240, 0.08)',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: selectedSale?.id === sale.id ? '#f6d78b' : '#fff', fontWeight: 600, fontSize: '0.9rem' }}>
                          <ReceiptText size={14} style={{ color: '#d7ad55' }} />
                          Venda #{sale.id}
                        </span>
                        <strong style={{ color: selectedSale?.id === sale.id ? '#f6d78b' : '#fff', fontSize: '1rem' }}>{formatCurrency(sale.totalAmount)}</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          padding: '2px 8px',
                          borderRadius: '999px',
                          fontSize: '0.62rem',
                          fontWeight: 900,
                          letterSpacing: '0.06em',
                          textTransform: 'uppercase',
                          background: sale.status === 'CANCELLED' ? 'rgba(251, 113, 133, 0.1)' : 'rgba(45, 212, 191, 0.1)',
                          border: sale.status === 'CANCELLED' ? '1px solid rgba(251, 113, 133, 0.28)' : '1px solid rgba(45, 212, 191, 0.28)',
                          color: sale.status === 'CANCELLED' ? '#fb7185' : '#2dd4bf'
                        }}>
                          {sale.status === 'CANCELLED' ? 'Cancelada' : 'Concluída'}
                        </span>
                        <span style={{ fontSize: '0.75rem', color: '#707b8c' }}>{sale.paymentMethod}</span>
                      </div>
                      <small style={{ color: '#707b8c', fontSize: '0.72rem', display: 'block' }}>
                        {formatNullableDateTime(sale.soldAt)}
                      </small>
                    </button>
                  ))}
                </div>
                <PaginationControls
                  itemLabel="vendas"
                  page={salesPagination.page}
                  pageSize={salesPagination.pageSize}
                  totalItems={salesPagination.totalItems}
                  totalPages={salesPagination.totalPages}
                  onPageChange={salesPagination.setPage}
                />
              </div>
            )}
          </section>

          {/* Coluna Direita: Detalhes da Venda Selecionada */}
          <section className="customer-premium-list-panel" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid rgba(226, 232, 240, 0.08)', paddingBottom: '14px', marginBottom: '8px', gap: '12px', flexWrap: 'wrap' }}>
              <div>
                <h2 style={{ fontSize: '1.1rem', color: '#fff', margin: 0, fontWeight: 500 }}>
                  {selectedSale
                    ? `Detalhe da venda #${selectedSale.id}`
                    : 'Detalhe da venda'}
                </h2>
                <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: '#707b8c' }}>
                  {selectedSale
                    ? `Status: ${selectedSale.status === 'CANCELLED' ? 'Cancelada' : 'Concluída'}`
                    : 'Nenhuma venda selecionada.'}
                </p>
              </div>
              {selectedSale ? (
                <div style={{ display: 'flex', gap: '10px' }}>
                  <a
                    className="customer-premium-secondary-button"
                    href={getSaleReceiptUrl(selectedSale.id)}
                    target="_blank"
                    rel="noreferrer"
                    style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minHeight: '38px', padding: '0 16px', fontSize: '0.8rem' }}
                  >
                    Imprimir recibo
                  </a>
                  <button
                    className="customer-premium-secondary-button"
                    type="button"
                    disabled={selectedSale.status === 'CANCELLED' || isCancelling}
                    onClick={() => void handleCancelSale()}
                    style={{
                      minHeight: '38px',
                      padding: '0 16px',
                      fontSize: '0.8rem',
                      borderColor: selectedSale.status !== 'CANCELLED' ? 'rgba(251, 113, 133, 0.4)' : undefined,
                      color: selectedSale.status !== 'CANCELLED' ? '#fb7185' : undefined,
                      background: selectedSale.status !== 'CANCELLED' ? 'rgba(251, 113, 133, 0.05)' : undefined
                    }}
                  >
                    {isCancelling ? 'Cancelando...' : 'Cancelar venda'}
                  </button>
                </div>
              ) : null}
            </header>

            {!selectedSale ? (
              <div className="product-empty" style={{ background: '#0d1016', borderRadius: '16px', padding: '40px' }}>Selecione uma venda para visualizar os itens.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <article style={{ background: '#101117', border: '1px solid rgba(226,232,240,0.08)', borderRadius: '16px', padding: '20px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <span style={{ fontSize: '0.65rem', textTransform: 'uppercase', color: '#707b8c', fontWeight: 900, display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <CreditCard size={12} style={{ color: '#d7ad55' }} /> Pagamento
                    </span>
                    <strong style={{ fontSize: '1.1rem', color: '#fff' }}>{selectedSale.paymentMethod}</strong>
                    <small style={{ color: '#8d98a8', fontSize: '0.75rem', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <UserRound size={12} style={{ color: '#d7ad55' }} /> {getSellerName(selectedSale)}
                    </small>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', textAlign: 'right', borderLeft: '1px solid rgba(226,232,240,0.08)', paddingLeft: '16px' }}>
                    <span style={{ fontSize: '0.65rem', textTransform: 'uppercase', color: '#707b8c', fontWeight: 900, display: 'flex', alignItems: 'center', gap: '4px', justifyContent: 'flex-end' }}>
                      <BadgeDollarSign size={12} style={{ color: '#fb7185' }} /> Desconto
                    </span>
                    <strong style={{ fontSize: '1.25rem', color: '#fb7185', marginTop: '4px' }}>{formatCurrency(selectedSale.discountAmount)}</strong>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', textAlign: 'right', borderLeft: '1px solid rgba(226,232,240,0.08)', paddingLeft: '16px' }}>
                    <span style={{ fontSize: '0.65rem', textTransform: 'uppercase', color: '#707b8c', fontWeight: 900, display: 'flex', alignItems: 'center', gap: '4px', justifyContent: 'flex-end' }}>
                      <BadgeDollarSign size={12} style={{ color: '#f2cf7a' }} /> Total
                    </span>
                    <strong style={{ fontSize: '1.25rem', color: '#f6d78b', marginTop: '4px' }}>{formatCurrency(selectedSale.totalAmount)}</strong>
                  </div>
                </article>

                {selectedSale.status === 'CANCELLED' ? (
                  <div className="feedback-message feedback-message--error" style={{ background: 'rgba(251, 113, 133, 0.1)', border: '1px solid rgba(251, 113, 133, 0.25)', color: '#fb7185', padding: '16px', borderRadius: '12px', fontSize: '0.85rem' }}>
                    <strong>Venda cancelada em {formatNullableDateTime(selectedSale.cancelledAt)}.</strong>
                    <div style={{ marginTop: '4px' }}>Motivo: {selectedSale.cancellationReason}</div>
                  </div>
                ) : null}

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <h3 style={{ fontSize: '0.9rem', color: '#f6d78b', fontWeight: 900, letterSpacing: '0.06em', textTransform: 'uppercase', margin: '10px 0 4px' }}>Itens da Venda</h3>
                  {saleItemsPagination.pageItems.map((item) => (
                    <article key={item.id} style={{ background: '#0d1016', border: '1px solid rgba(226,232,240,0.06)', borderRadius: '12px', padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <span style={{ display: 'inline-flex', background: '#151922', padding: '2px 6px', borderRadius: '4px', fontSize: '0.65rem', color: '#b9c4d4', fontFamily: 'monospace', width: 'fit-content' }}>
                          {item.productCode}
                        </span>
                        <strong style={{ color: '#fff', fontSize: '0.9rem' }}>{item.productName}</strong>
                        <small style={{ color: '#707b8c', fontSize: '0.78rem' }}>{item.quantity} x {formatCurrency(item.unitPrice)}</small>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <span style={{ fontSize: '0.65rem', textTransform: 'uppercase', color: '#707b8c', display: 'block', marginBottom: '2px' }}>Subtotal</span>
                        <strong style={{ color: '#f6d78b', fontSize: '0.95rem' }}>{formatCurrency(item.subtotal)}</strong>
                      </div>
                    </article>
                  ))}
                  <PaginationControls
                    itemLabel="itens"
                    page={saleItemsPagination.page}
                    pageSize={saleItemsPagination.pageSize}
                    totalItems={saleItemsPagination.totalItems}
                    totalPages={saleItemsPagination.totalPages}
                    onPageChange={saleItemsPagination.setPage}
                  />
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  )
}
