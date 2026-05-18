import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { BadgeDollarSign, CalendarClock, CreditCard, ReceiptText, UserRound } from 'lucide-react'
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
    <main className="app-shell">
      <div className="app-container history-container">
        <PageHeader
          eyebrow="Historico"
          title="Historico de vendas"
          subtitle="Consulte vendas reais, revise itens vendidos e acompanhe o total do periodo."
          metricLabel="Total listado"
          metricValue={formatCurrency(totalAmount)}
          status={`${sales.length} venda(s)`}
        />

        <section className="scanner-panel sales-history-filter-panel">
          <form className="history-filter-form" onSubmit={handleFilterSubmit}>
            <div className="field-group">
              <label htmlFor="startDate">Inicio</label>
              <input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
              />
            </div>
            <div className="field-group">
              <label htmlFor="endDate">Fim</label>
              <input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(event) => setEndDate(event.target.value)}
              />
            </div>
            <button className="action-button" type="submit" disabled={isLoading}>
              Filtrar
            </button>
            <button className="secondary-button" type="button" onClick={clearFilters} disabled={isLoading}>
              Limpar
            </button>
          </form>

          {errorMessage ? (
            <div className="feedback-message feedback-message--error">{errorMessage}</div>
          ) : null}
        </section>

        <div className="history-grid">
          <section className="cart-panel">
            <header className="section-header">
              <div>
                <h2>Vendas</h2>
                <p>Selecione uma venda para ver os itens.</p>
              </div>
            </header>

            {isLoading ? (
              <div className="product-empty">Carregando historico...</div>
            ) : sales.length === 0 ? (
              <div className="product-empty">Nenhuma venda encontrada para o periodo.</div>
            ) : (
              <div className="sale-history-list">
                {salesPagination.pageItems.map((sale) => (
                  <button
                    className={
                      selectedSale?.id === sale.id
                        ? 'sale-history-item sale-history-item--active'
                        : 'sale-history-item'
                    }
                    type="button"
                    key={sale.id}
                    onClick={() => setSelectedSale(sale)}
                  >
                    <span><ReceiptText size={14} strokeWidth={2.3} aria-hidden="true" />Venda #{sale.id}</span>
                    <strong>{formatCurrency(sale.totalAmount)}</strong>
                    <small>
                      {sale.status === 'CANCELLED' ? 'Cancelada' : 'Concluida'} - {sale.paymentMethod} -{' '}
                      {formatNullableDateTime(sale.soldAt)}
                    </small>
                  </button>
                ))}
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

          <section className="cart-panel">
            <header className="section-header">
              <div>
                <h2>Detalhe da venda</h2>
                <p>
                  {selectedSale
                    ? `Venda #${selectedSale.id} - ${selectedSale.status === 'CANCELLED' ? 'Cancelada' : 'Concluida'}`
                    : 'Nenhuma venda selecionada.'}
                </p>
              </div>
              {selectedSale ? (
                <div className="form-actions">
                  <a
                    className="icon-link"
                    href={getSaleReceiptUrl(selectedSale.id)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Imprimir recibo
                  </a>
                  <button
                    className="secondary-button"
                    type="button"
                    disabled={selectedSale.status === 'CANCELLED' || isCancelling}
                    onClick={() => void handleCancelSale()}
                  >
                    {isCancelling ? 'Cancelando...' : 'Cancelar venda'}
                  </button>
                </div>
              ) : null}
            </header>

            {!selectedSale ? (
              <div className="product-empty">Selecione uma venda para visualizar os itens.</div>
            ) : (
              <div className="cart-list">
                <article className="cart-item">
                  <div className="cart-item-main">
                    <span><CreditCard size={14} strokeWidth={2.3} aria-hidden="true" />Pagamento</span>
                    <strong>{selectedSale.paymentMethod}</strong>
                    <small><UserRound size={13} strokeWidth={2.3} aria-hidden="true" />Vendedor: {getSellerName(selectedSale)}</small>
                  </div>
                  <div className="cart-price">
                    <span><BadgeDollarSign size={14} strokeWidth={2.3} aria-hidden="true" />Desconto</span>
                    <strong>{formatCurrency(selectedSale.discountAmount)}</strong>
                  </div>
                  <div className="cart-price">
                    <span><BadgeDollarSign size={14} strokeWidth={2.3} aria-hidden="true" />Total</span>
                    <strong>{formatCurrency(selectedSale.totalAmount)}</strong>
                  </div>
                </article>
                {selectedSale.status === 'CANCELLED' ? (
                  <div className="feedback-message feedback-message--error">
                    Venda cancelada em {formatNullableDateTime(selectedSale.cancelledAt)}. Motivo:{' '}
                    {selectedSale.cancellationReason}
                  </div>
                ) : null}
                {saleItemsPagination.pageItems.map((item) => (
                  <article className="cart-item" key={item.id}>
                    <div className="cart-item-main">
                      <span><CalendarClock size={14} strokeWidth={2.3} aria-hidden="true" />{item.productCode}</span>
                      <strong>{item.productName}</strong>
                      <small>{item.quantity} x {formatCurrency(item.unitPrice)}</small>
                    </div>
                    <div className="cart-price">
                      <span><BadgeDollarSign size={14} strokeWidth={2.3} aria-hidden="true" />Subtotal</span>
                      <strong>{formatCurrency(item.subtotal)}</strong>
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
            )}
          </section>
        </div>
      </div>
    </main>
  )
}
