import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { BadgeDollarSign, CreditCard, ReceiptText, UserRound, Filter } from 'lucide-react'
import { cancelSale, getSaleReceiptUrl, getSales } from '../services/saleService'
import { useAppMessage } from '../hooks/useAppMessage'
import { PaginationControls } from '../components/PaginationControls'
import type { Sale } from '../types/sale'
import { getErrorMessage } from '../utils/errors'
import { formatCurrency, formatNullableDateTime } from '../utils/formatters'
import { formatPaymentMethod } from '../utils/paymentMethods'
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
        <section className="customer-premium-list-panel sales-history-filter-panel" style={{ padding: '20px', marginBottom: '24px', background: '#211609', border: '1px solid rgba(91, 58, 10, 0.35)', boxShadow: '0 26px 64px rgba(91, 58, 10, 0.26)' }}>
          <form className="customer-premium-search" onSubmit={handleFilterSubmit} style={{ display: 'flex', gap: '16px', alignItems: 'flex-end', flexWrap: 'wrap', background: 'transparent', border: 'none', padding: 0 }}>
            <div className="field-group" style={{ flex: 1, minWidth: '150px' }}>
              <label htmlFor="startDate" style={{ color: '#f9e7b5', fontWeight: 900, fontSize: '0.62rem', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '6px', display: 'block' }}>Data Início</label>
              <input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
                style={{ colorScheme: 'dark', background: 'rgba(0, 0, 0, 0.55)', color: '#f9e7b5', border: '1px solid rgba(91, 58, 10, 0.35)', borderRadius: '12px', minHeight: '48px', padding: '0 16px', width: '100%' }}
              />
            </div>
            <div className="field-group" style={{ flex: 1, minWidth: '150px' }}>
              <label htmlFor="endDate" style={{ color: '#f9e7b5', fontWeight: 900, fontSize: '0.62rem', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '6px', display: 'block' }}>Data Fim</label>
              <input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(event) => setEndDate(event.target.value)}
                style={{ colorScheme: 'dark', background: 'rgba(0, 0, 0, 0.55)', color: '#f9e7b5', border: '1px solid rgba(91, 58, 10, 0.35)', borderRadius: '12px', minHeight: '48px', padding: '0 16px', width: '100%' }}
              />
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button className="customer-premium-primary-button" type="submit" disabled={isLoading} style={{ minHeight: '48px', padding: '0 24px' }}>
                <Filter size={15} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
                Filtrar
              </button>
              <button className="customer-premium-secondary-button" type="button" onClick={clearFilters} disabled={isLoading} style={{ minHeight: '48px', padding: '0 24px', background: 'rgba(249, 231, 181, 0.15) !important', color: '#f9e7b5 !important', border: '1px solid rgba(91, 58, 10, 0.35) !important' }}>
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
            <header style={{ borderBottom: '1px solid rgba(33, 22, 9, 0.12)', paddingBottom: '14px', marginBottom: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <ReceiptText size={22} style={{ color: '#5b3a0a' }} />
                <div>
                  <h2 style={{ fontSize: '1.1rem', color: '#211609', margin: 0, fontWeight: 500 }}>Vendas</h2>
                  <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: 'rgba(33, 22, 9, 0.75)' }}>Selecione uma venda para visualizar os detalhes e itens.</p>
                </div>
              </div>
            </header>

            {isLoading ? (
              <div className="product-empty">Carregando histórico...</div>
            ) : sales.length === 0 ? (
              <div className="product-empty" style={{ background: '#211609', color: '#f9e7b5', borderRadius: '16px', padding: '40px', border: '1px solid rgba(91, 58, 10, 0.35)' }}>Nenhuma venda encontrada para o período.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'grid', gap: '12px' }}>
                  {salesPagination.pageItems.map((sale) => {
                    const isActive = selectedSale?.id === sale.id;
                    return (
                      <button
                        key={sale.id}
                        onClick={() => setSelectedSale(sale)}
                        className={isActive ? "sale-history-item sale-history-item--active" : "sale-history-item"}
                        style={{
                          display: 'grid',
                          gap: '8px',
                          width: '100%',
                          padding: '16px',
                          textAlign: 'left',
                          cursor: 'pointer',
                          transition: 'all 0.2s ease',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600, fontSize: '0.9rem' }}>
                            <ReceiptText size={14} style={{ color: '#5b3a0a' }} />
                            Venda #{sale.id}
                          </span>
                          <strong style={{ fontSize: '1rem' }}>{formatCurrency(sale.totalAmount)}</strong>
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
                            background: sale.status === 'CANCELLED' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(33, 22, 9, 0.08)',
                            border: sale.status === 'CANCELLED' ? '1px solid rgba(239, 68, 68, 0.25)' : '1px solid rgba(33, 22, 9, 0.15)',
                            color: sale.status === 'CANCELLED' ? '#ef4444' : '#211609'
                          }}>
                            {sale.status === 'CANCELLED' ? 'Cancelada' : 'Concluída'}
                          </span>
                          <span style={{ fontSize: '0.75rem', color: 'rgba(33, 22, 9, 0.65)' }}>{formatPaymentMethod(sale.paymentMethod)}</span>
                        </div>
                        <small style={{ fontSize: '0.72rem', display: 'block', color: 'rgba(33, 22, 9, 0.65)' }}>
                          {formatNullableDateTime(sale.soldAt)}
                        </small>
                      </button>
                    );
                  })}
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
            <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid rgba(33, 22, 9, 0.12)', paddingBottom: '14px', marginBottom: '8px', gap: '12px', flexWrap: 'wrap' }}>
              <div>
                <h2 style={{ fontSize: '1.1rem', color: '#211609', margin: 0, fontWeight: 500 }}>
                  {selectedSale
                    ? `Detalhe da venda #${selectedSale.id}`
                    : 'Detalhe da venda'}
                </h2>
                <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: 'rgba(33, 22, 9, 0.75)' }}>
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
                      borderColor: selectedSale.status !== 'CANCELLED' ? '#e11d48' : undefined,
                      color: selectedSale.status !== 'CANCELLED' ? '#e11d48' : undefined,
                      background: selectedSale.status !== 'CANCELLED' ? 'rgba(225, 29, 72, 0.08)' : undefined
                    }}
                  >
                    {isCancelling ? 'Cancelando...' : 'Cancelar venda'}
                  </button>
                </div>
              ) : null}
            </header>

            {!selectedSale ? (
              <div className="product-empty" style={{ background: '#211609', color: '#f9e7b5', borderRadius: '16px', padding: '40px', border: '1px solid rgba(91, 58, 10, 0.35)' }}>Selecione uma venda para visualizar os itens.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <article className="sale-detail-summary-card" style={{ background: '#211609', border: '1px solid rgba(91, 58, 10, 0.35)', borderRadius: '16px', padding: '20px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.05)' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <span style={{ fontSize: '0.65rem', textTransform: 'uppercase', color: '#f9e7b5', fontWeight: 900, display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <CreditCard size={12} style={{ color: '#d7ad55' }} /> Pagamento
                    </span>
                    <strong style={{ fontSize: '1.1rem', color: '#fff' }}>{formatPaymentMethod(selectedSale.paymentMethod)}</strong>
                    <small style={{ color: 'rgba(249, 231, 181, 0.75)', fontSize: '0.75rem', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <UserRound size={12} style={{ color: '#d7ad55' }} /> {getSellerName(selectedSale)}
                    </small>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', textAlign: 'right', borderLeft: '1px solid rgba(91, 58, 10, 0.22)', paddingLeft: '16px' }}>
                    <span style={{ fontSize: '0.65rem', textTransform: 'uppercase', color: '#f9e7b5', fontWeight: 900, display: 'flex', alignItems: 'center', gap: '4px', justifyContent: 'flex-end' }}>
                      <BadgeDollarSign size={12} style={{ color: '#fca5a5' }} /> Desconto
                    </span>
                    <strong style={{ fontSize: '1.25rem', color: '#fca5a5', marginTop: '4px' }}>{formatCurrency(selectedSale.discountAmount)}</strong>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', textAlign: 'right', borderLeft: '1px solid rgba(91, 58, 10, 0.22)', paddingLeft: '16px' }}>
                    <span style={{ fontSize: '0.65rem', textTransform: 'uppercase', color: '#f9e7b5', fontWeight: 900, display: 'flex', alignItems: 'center', gap: '4px', justifyContent: 'flex-end' }}>
                      <BadgeDollarSign size={12} style={{ color: '#d7ad55' }} /> Total
                    </span>
                    <strong style={{ fontSize: '1.25rem', color: '#f6d78b', marginTop: '4px' }}>{formatCurrency(selectedSale.totalAmount)}</strong>
                  </div>
                </article>

                {selectedSale.status === 'CANCELLED' ? (
                  <div className="feedback-message feedback-message--error" style={{ background: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.25)', color: '#ef4444', padding: '16px', borderRadius: '12px', fontSize: '0.85rem' }}>
                    <strong>Venda cancelada em {formatNullableDateTime(selectedSale.cancelledAt)}.</strong>
                    <div style={{ marginTop: '4px' }}>Motivo: {selectedSale.cancellationReason}</div>
                  </div>
                ) : null}

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <h3 style={{ fontSize: '0.9rem', color: '#211609', fontWeight: 900, letterSpacing: '0.06em', textTransform: 'uppercase', margin: '10px 0 4px' }}>Itens da Venda</h3>
                  {saleItemsPagination.pageItems.map((item) => (
                    <article key={item.id} style={{ background: 'rgba(255, 255, 255, 0.62)', border: '1px solid rgba(91, 58, 10, 0.16)', borderRadius: '12px', padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <span style={{ display: 'inline-flex', background: 'rgba(33, 22, 9, 0.08)', padding: '2px 6px', borderRadius: '4px', fontSize: '0.65rem', color: '#211609', border: '1px solid rgba(33, 22, 9, 0.15)', fontFamily: 'monospace', width: 'fit-content' }}>
                          {item.productCode}
                        </span>
                        <strong style={{ color: '#211609', fontSize: '0.9rem' }}>{item.productName}</strong>
                        <small style={{ color: 'rgba(33, 22, 9, 0.65)', fontSize: '0.78rem' }}>{item.quantity} x {formatCurrency(item.unitPrice)}</small>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <span style={{ fontSize: '0.65rem', textTransform: 'uppercase', color: 'rgba(33, 22, 9, 0.65)', display: 'block', marginBottom: '2px' }}>Subtotal</span>
                        <strong style={{ color: '#5b3a0a', fontSize: '0.95rem' }}>{formatCurrency(item.subtotal)}</strong>
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
