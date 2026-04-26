import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { cancelSale, getSaleReceiptUrl, getSales } from '../services/saleService'
import type { Sale } from '../types/sale'
import { getErrorMessage } from '../utils/errors'
import { formatCurrency, formatNullableDateTime } from '../utils/formatters'

function getSellerName(sale: Sale) {
  return sale.operator?.displayName?.trim() || 'Vendedor nao identificado'
}

export function SalesHistoryPage() {
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

    const confirmed = window.confirm('Cancelar esta venda e devolver os itens ao estoque?')
    if (!confirmed) {
      return
    }

    setIsCancelling(true)

    try {
      const cancelledSale = await cancelSale(selectedSale.id, reason.trim())
      setSelectedSale(cancelledSale)
      await loadSales(startDate, endDate)
      setErrorMessage(null)
    } catch (error) {
      setErrorMessage(getErrorMessage(error, 'Nao foi possivel cancelar a venda.'))
    } finally {
      setIsCancelling(false)
    }
  }

  return (
    <main className="app-shell">
      <div className="app-container history-container">
        <section className="checkout-hero-panel">
          <div>
            <span className="eyebrow">Historico</span>
            <h1>Historico de vendas</h1>
            <p>
              Consulte vendas reais, revise itens vendidos e acompanhe o total do periodo.
            </p>
          </div>
          <div className="checkout-summary">
            <span>Total listado</span>
            <strong>{formatCurrency(totalAmount)}</strong>
            <small>{sales.length} venda(s) encontradas</small>
          </div>
        </section>

        <section className="scanner-panel">
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
                {sales.map((sale) => (
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
                    <span>Venda #{sale.id}</span>
                    <strong>{formatCurrency(sale.totalAmount)}</strong>
                    <small>
                      {sale.status === 'CANCELLED' ? 'Cancelada' : 'Concluida'} - {sale.paymentMethod} -{' '}
                      {formatNullableDateTime(sale.soldAt)}
                    </small>
                  </button>
                ))}
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
                    <span>Pagamento</span>
                    <strong>{selectedSale.paymentMethod}</strong>
                    <small>Vendedor: {getSellerName(selectedSale)}</small>
                  </div>
                  <div className="cart-price">
                    <span>Desconto</span>
                    <strong>{formatCurrency(selectedSale.discountAmount)}</strong>
                  </div>
                  <div className="cart-price">
                    <span>Total</span>
                    <strong>{formatCurrency(selectedSale.totalAmount)}</strong>
                  </div>
                </article>
                {selectedSale.status === 'CANCELLED' ? (
                  <div className="feedback-message feedback-message--error">
                    Venda cancelada em {formatNullableDateTime(selectedSale.cancelledAt)}. Motivo:{' '}
                    {selectedSale.cancellationReason}
                  </div>
                ) : null}
                {selectedSale.items.map((item) => (
                  <article className="cart-item" key={item.id}>
                    <div className="cart-item-main">
                      <span>{item.productCode}</span>
                      <strong>{item.productName}</strong>
                      <small>{item.quantity} x {formatCurrency(item.unitPrice)}</small>
                    </div>
                    <div className="cart-price">
                      <span>Subtotal</span>
                      <strong>{formatCurrency(item.subtotal)}</strong>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  )
}
