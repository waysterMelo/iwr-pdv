import { useEffect, useRef, useState, type FormEvent } from 'react'
import { getCartItemTotal, useSalesCart } from '../hooks/useSalesCart'
import { getSaleReceiptUrl } from '../services/saleService'
import type { PaymentMethod, Sale } from '../types/sale'
import { formatCurrency } from '../utils/formatters'
import { CurrencyInput } from '../components/CurrencyInput'
import { useAppMessage } from '../hooks/useAppMessage'
import './SalesCheckoutPage.css'
import './SalesCheckoutResponsiveFix.css'

export function SalesCheckoutPage() {
  const { confirm } = useAppMessage()
  const [scanCode, setScanCode] = useState('')
  const [receiptSale, setReceiptSale] = useState<Sale | null>(null)
  const scannerInputRef = useRef<HTMLInputElement>(null)
  const receiptFrameRef = useRef<HTMLIFrameElement>(null)
  const checkout = useSalesCart()

  useEffect(() => {
    scannerInputRef.current?.focus()
  }, [])

  async function handleScannerSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const added = await checkout.addProductCodeToCart(scanCode)

    if (added) {
      setScanCode('')
    }

    scannerInputRef.current?.focus()
  }

  function clearCart() {
    checkout.clearCart()
    scannerInputRef.current?.focus()
  }

  async function handleCloseSale() {
    if (checkout.cartItems.length === 0) {
      checkout.showMessage('Adicione pelo menos um item antes de finalizar a venda.', 'error')
      return
    }

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
      setReceiptSale(sale)
    }

    scannerInputRef.current?.focus()
  }

  return (
    <main className="app-shell checkout-page">
      <div className="app-container checkout-container">
        <section className="checkout-hero-panel">
          <div>
            <span className="checkout-kicker">PDV · Venda rápida</span>
            <h1>Caixa com leitura por codigo</h1>
            <p>
              Leia o QR Code ou digite o codigo do produto para montar a venda, finalizar
              no backend e baixar estoque automaticamente.
            </p>
          </div>
          <div className="checkout-summary">
            <span>Total da venda</span>
            <strong>{formatCurrency(checkout.totalAmount)}</strong>
            <div className="checkout-status-row">
              <span className={checkout.cashRegister ? 'checkout-badge checkout-badge--success' : 'checkout-badge checkout-badge--warning'}>
                {checkout.cashRegister ? `Caixa #${checkout.cashRegister.id} aberto` : 'Abra o caixa'}
              </span>
              <span className="checkout-badge checkout-badge--muted">{checkout.totalItems} item(ns)</span>
            </div>
          </div>
        </section>

        <section className="scanner-panel checkout-scanner-panel">
          <form className="scanner-form" onSubmit={handleScannerSubmit}>
            <label htmlFor="scannerCode">Leitor de codigo</label>
            <div className="scanner-row">
              <input
                id="scannerCode"
                ref={scannerInputRef}
                value={scanCode}
                onChange={(event) => setScanCode(event.target.value.toUpperCase())}
                placeholder="IWR-000001"
                autoComplete="off"
              />
              <button className="action-button" type="submit" disabled={checkout.isSearching}>
                {checkout.isSearching ? 'Buscando...' : 'Adicionar'}
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

        <section className="scanner-panel checkout-payment-panel">
          <header className="section-header">
            <div>
              <h2>Pagamento</h2>
              <p>Revise subtotal, desconto e forma de pagamento antes de finalizar.</p>
            </div>
          </header>
          <div className="form-grid checkout-payment-grid">
            <div className="field-group">
              <label htmlFor="paymentMethod">Forma de pagamento</label>
              <select
                id="paymentMethod"
                value={checkout.paymentMethod}
                onChange={(event) => checkout.setPaymentMethod(event.target.value as PaymentMethod)}
              >
                <option value="CASH">Dinheiro</option>
                <option value="PIX">Pix</option>
                <option value="DEBIT_CARD">Cartao debito</option>
                <option value="CREDIT_CARD">Cartao credito</option>
              </select>
            </div>
            <div className="field-group">
              <label htmlFor="discountAmount">Desconto R$</label>
              <CurrencyInput
                id="discountAmount"
                value={checkout.discountAmount}
                onChange={(value) => checkout.setDiscountAmount(value)}
              />
            </div>
            {checkout.paymentMethod === 'CASH' ? (
              <div className="field-group">
                <label htmlFor="amountReceived">Valor recebido</label>
                <CurrencyInput
                  id="amountReceived"
                  value={checkout.amountReceived}
                  onChange={(value) => checkout.setAmountReceived(value)}
                  placeholder="R$ 0,00"
                />
              </div>
            ) : null}
            <div className="field-group">
              <label>Troco</label>
              <strong className="payment-total">{formatCurrency(checkout.changeAmount)}</strong>
            </div>
          </div>
        </section>

        <section className="cart-panel">
          <header className="section-header">
            <div>
              <h2>Carrinho da venda</h2>
              <p>Revise quantidades antes de finalizar a venda.</p>
            </div>
            <button
              className="secondary-button"
              type="button"
              onClick={clearCart}
              disabled={checkout.cartItems.length === 0}
            >
              Limpar carrinho
            </button>
          </header>

          {checkout.cartItems.length === 0 ? (
            <div className="product-empty">Nenhum item no carrinho. Leia uma etiqueta para comecar.</div>
          ) : (
            <div className="cart-list">
              {checkout.cartItems.map((item) => (
                <article className="cart-item" key={item.product.id}>
                  <div className="cart-item-main">
                    <span>{item.product.code}</span>
                    <strong>{item.product.name}</strong>
                    <small>Estoque disponivel: {item.product.stockQuantity}</small>
                  </div>
                  <div className="cart-quantity">
                    <button
                      className="icon-button"
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
                      className="icon-button"
                      type="button"
                      onClick={() => checkout.updateQuantity(item.product.id, item.quantity + 1)}
                      aria-label={`Aumentar quantidade de ${item.product.name}`}
                    >
                      +
                    </button>
                  </div>
                  <div className="cart-price">
                    <span>{formatCurrency(item.product.price)}</span>
                    <strong>{formatCurrency(getCartItemTotal(item))}</strong>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="checkout-footer-panel">
          <div>
            <span>
              Subtotal {formatCurrency(checkout.subtotalAmount)} - desconto{' '}
              {formatCurrency(checkout.parsedDiscountAmount)}
            </span>
            <strong>{formatCurrency(checkout.totalAmount)}</strong>
          </div>
          <button
            className="action-button"
            type="button"
            disabled={checkout.cartItems.length === 0 || checkout.isClosingSale || !checkout.cashRegister}
            onClick={() => void handleCloseSale()}
          >
            {checkout.isClosingSale ? 'Finalizando...' : 'Finalizar venda'}
          </button>
          {checkout.lastSale ? (
            <button className="icon-link" type="button" onClick={() => setReceiptSale(checkout.lastSale)}>
              Recibo #{checkout.lastSale.id}
            </button>
          ) : null}
        </section>
      </div>

      {receiptSale ? (
        <div
          className="qr-modal-backdrop"
          role="presentation"
          onClick={() => setReceiptSale(null)}
        >
          <section
            className="receipt-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="receipt-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="qr-modal-header">
              <div>
                <span className="eyebrow">Venda finalizada</span>
                <h2 id="receipt-modal-title">Recibo da venda #{receiptSale.id}</h2>
                <p>Total: {formatCurrency(receiptSale.totalAmount)}</p>
              </div>
              <button
                className="icon-button icon-button--close"
                type="button"
                onClick={() => setReceiptSale(null)}
                aria-label="Fechar recibo"
              >
                Fechar
              </button>
            </header>
            <iframe
              className="receipt-preview-frame"
              ref={receiptFrameRef}
              src={getSaleReceiptUrl(receiptSale.id)}
              title={`Recibo da venda ${receiptSale.id}`}
            />
            <div className="qr-modal-actions">
              <button
                className="secondary-button"
                type="button"
                onClick={() => receiptFrameRef.current?.contentWindow?.print()}
              >
                Imprimir recibo
              </button>
              <a
                className="action-button action-button--link"
                href={getSaleReceiptUrl(receiptSale.id)}
                target="_blank"
                rel="noreferrer"
              >
                Abrir em nova aba
              </a>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  )
}
