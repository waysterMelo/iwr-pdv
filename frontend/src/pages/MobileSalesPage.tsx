import { lazy, Suspense, useState, type FormEvent } from 'react'
import { useAppMessage } from '../hooks/useAppMessage'
import { getCartItemTotal, useSalesCart } from '../hooks/useSalesCart'
import type { PaymentMethod } from '../types/sale'
import { formatCurrency } from '../utils/formatters'
import { CurrencyInput } from '../components/CurrencyInput'
import { PaginationControls } from '../components/PaginationControls'
import { usePagination } from '../hooks/usePagination'

type MobileSalesPageProps = {
  onBack: () => void
}

const MobileQrScanner = lazy(() => import('../components/MobileQrScanner').then((module) => ({ default: module.MobileQrScanner })))

export function MobileSalesPage({ onBack }: MobileSalesPageProps) {
  const { confirm } = useAppMessage()
  const [manualCode, setManualCode] = useState('')
  const [scannerOpen, setScannerOpen] = useState(false)
  const checkout = useSalesCart({ initialPaymentMethod: 'PIX' })
  const cartPagination = usePagination(checkout.cartItems, 5)

  async function handleManualSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const added = await checkout.addProductCodeToCart(manualCode)

    if (added) {
      setManualCode('')
    }
  }

  async function handleScannedCode(code: string) {
    return checkout.addProductCodeToCart(code)
  }

  async function handleFinalizeSale() {
    const confirmed = await confirm({
      type: 'warning',
      title: 'Finalizar venda?',
      message: `Confirma o fechamento da venda no valor de ${formatCurrency(checkout.totalAmount)}?`,
      confirmLabel: 'Finalizar',
      cancelLabel: 'Revisar',
    })

    if (!confirmed) {
      return
    }

    const sale = await checkout.finalizeSale()

    if (sale) {
      setScannerOpen(false)
    }
  }

  return (
    <main className="mobile-sale-shell">
      <header className="mobile-topbar">
        <button className="mobile-icon-button" type="button" onClick={onBack} aria-label="Voltar">
          &lt;
        </button>
        <div>
          <span className="eyebrow">PDV Mobile</span>
          <h1>Venda rapida</h1>
        </div>
      </header>

      <>
          <section className="mobile-total-panel">
            <span>Total</span>
            <strong>{formatCurrency(checkout.totalAmount)}</strong>
            <small>{checkout.totalItems} item(ns)</small>
          </section>

          <section className="mobile-action-panel">
            <button className="mobile-primary-button" type="button" onClick={() => setScannerOpen(true)}>
              Abrir camera
            </button>

            <form className="mobile-manual-form" onSubmit={handleManualSubmit}>
              <label htmlFor="mobileManualCode">Codigo manual</label>
              <div>
                <input
                  id="mobileManualCode"
                  value={manualCode}
                  onChange={(event) => setManualCode(event.target.value.toUpperCase())}
                  placeholder="IWR-000001"
                  autoComplete="off"
                />
                <button type="submit" disabled={checkout.isSearching}>
                  {checkout.isSearching ? '...' : '+'}
                </button>
              </div>
            </form>

            {checkout.message ? (
              <div
                className={`feedback-message ${
                  checkout.messageType === 'success' ? 'feedback-message--success' : 'feedback-message--error'
                }`}
              >
                {checkout.message}
              </div>
            ) : null}
          </section>

          <section className="mobile-cart-panel">
            <header className="mobile-section-header">
              <h2>Carrinho</h2>
              <button
                className="mobile-link-button"
                type="button"
                onClick={checkout.clearCart}
                disabled={checkout.cartItems.length === 0}
              >
                Limpar
              </button>
            </header>

            {checkout.cartItems.length === 0 ? (
              <div className="mobile-empty-state">Nenhum produto adicionado.</div>
            ) : (
              <div className="mobile-cart-list">
                {cartPagination.pageItems.map((item) => (
                  <article className="mobile-cart-item" key={item.product.id}>
                    <div>
                      <span>{item.product.code}</span>
                      <strong>{item.product.name}</strong>
                      <small>Estoque: {item.product.stockQuantity}</small>
                    </div>
                    <div className="mobile-cart-quantity">
                      <button
                        type="button"
                        onClick={() => checkout.updateQuantity(item.product.id, item.quantity - 1)}
                        aria-label={`Reduzir quantidade de ${item.product.name}`}
                      >
                        -
                      </button>
                      <input
                        aria-label={`Quantidade de ${item.product.name}`}
                        value={item.quantity}
                        inputMode="numeric"
                        onChange={(event) => checkout.updateQuantity(item.product.id, Number(event.target.value))}
                      />
                      <button
                        type="button"
                        onClick={() => checkout.updateQuantity(item.product.id, item.quantity + 1)}
                        aria-label={`Aumentar quantidade de ${item.product.name}`}
                      >
                        +
                      </button>
                    </div>
                    <strong className="mobile-item-total">{formatCurrency(getCartItemTotal(item))}</strong>
                  </article>
                ))}
                <PaginationControls
                  itemLabel="itens"
                  page={cartPagination.page}
                  pageSize={cartPagination.pageSize}
                  totalItems={cartPagination.totalItems}
                  totalPages={cartPagination.totalPages}
                  onPageChange={cartPagination.setPage}
                />
              </div>
            )}
          </section>

          <section className="mobile-payment-panel">
            <label htmlFor="mobilePaymentMethod">Pagamento</label>
            <select
              id="mobilePaymentMethod"
              value={checkout.paymentMethod}
              onChange={(event) => checkout.setPaymentMethod(event.target.value as PaymentMethod)}
            >
              <option value="CASH">Dinheiro</option>
              <option value="PIX">Pix</option>
              <option value="DEBIT_CARD">Cartao debito</option>
              <option value="CREDIT_CARD">Cartao credito</option>
            </select>

            <div className="mobile-payment-grid">
              <label htmlFor="mobileDiscount">Desconto</label>
              <CurrencyInput
                id="mobileDiscount"
                value={checkout.discountAmount}
                onChange={checkout.setDiscountAmount}
              />

              {checkout.paymentMethod === 'CASH' ? (
                <>
                  <label htmlFor="mobileAmountReceived">Recebido</label>
                  <CurrencyInput
                    id="mobileAmountReceived"
                    value={checkout.amountReceived}
                    onChange={checkout.setAmountReceived}
                    placeholder="R$ 0,00"
                  />
                  <span>Troco</span>
                  <strong>{formatCurrency(checkout.changeAmount)}</strong>
                </>
              ) : null}
            </div>
          </section>

          <footer className="mobile-sale-footer">
            <div>
              <span>Subtotal {formatCurrency(checkout.subtotalAmount)}</span>
              <strong>{formatCurrency(checkout.totalAmount)}</strong>
            </div>
            <button
              className="mobile-primary-button"
              type="button"
              disabled={checkout.cartItems.length === 0 || checkout.isClosingSale}
              onClick={() => void handleFinalizeSale()}
            >
              {checkout.isClosingSale ? 'Finalizando...' : 'Finalizar'}
            </button>
          </footer>

          {scannerOpen ? (
            <Suspense fallback={<div className="mobile-empty-state">Abrindo camera...</div>}>
              <MobileQrScanner
                active={scannerOpen}
                onClose={() => setScannerOpen(false)}
                onRead={handleScannedCode}
              />
            </Suspense>
          ) : null}
        </>
    </main>
  )
}
