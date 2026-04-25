import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { getCurrentCashRegister } from '../services/cashRegisterService'
import { findProductByCode } from '../services/productService'
import { closeSale, getSaleReceiptUrl } from '../services/saleService'
import type { CashRegister } from '../types/cashRegister'
import type { Product } from '../types/product'
import type { PaymentMethod, Sale } from '../types/sale'

type CartItem = {
  product: Product
  quantity: number
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}

function getCartItemTotal(item: CartItem) {
  return item.product.price * item.quantity
}

export function SalesCheckoutPage() {
  const [scanCode, setScanCode] = useState('')
  const [cartItems, setCartItems] = useState<CartItem[]>([])
  const [message, setMessage] = useState<string | null>(null)
  const [messageType, setMessageType] = useState<'success' | 'error'>('success')
  const [isSearching, setIsSearching] = useState(false)
  const [isClosingSale, setIsClosingSale] = useState(false)
  const [cashRegister, setCashRegister] = useState<CashRegister | null>(null)
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH')
  const [discountAmount, setDiscountAmount] = useState('0.00')
  const [amountReceived, setAmountReceived] = useState('')
  const [lastSale, setLastSale] = useState<Sale | null>(null)
  const [receiptSale, setReceiptSale] = useState<Sale | null>(null)
  const scannerInputRef = useRef<HTMLInputElement>(null)
  const receiptFrameRef = useRef<HTMLIFrameElement>(null)

  const totalItems = cartItems.reduce((sum, item) => sum + item.quantity, 0)
  const subtotalAmount = useMemo(
    () => cartItems.reduce((sum, item) => sum + getCartItemTotal(item), 0),
    [cartItems],
  )
  const parsedDiscountAmount = Number(discountAmount) || 0
  const totalAmount = Math.max(subtotalAmount - parsedDiscountAmount, 0)
  const parsedAmountReceived = Number(amountReceived) || 0
  const changeAmount = paymentMethod === 'CASH' ? Math.max(parsedAmountReceived - totalAmount, 0) : 0

  useEffect(() => {
    scannerInputRef.current?.focus()
    void refreshCashRegister()
  }, [])

  async function refreshCashRegister() {
    try {
      setCashRegister(await getCurrentCashRegister())
    } catch {
      setCashRegister(null)
    }
  }

  function showMessage(nextMessage: string, nextType: 'success' | 'error') {
    setMessage(nextMessage)
    setMessageType(nextType)
  }

  function addProductToCart(product: Product) {
    if (!product.active) {
      showMessage('Produto inativo. Reative no cadastro antes de vender.', 'error')
      return
    }

    if (product.stockQuantity <= 0) {
      showMessage('Produto sem estoque disponivel.', 'error')
      return
    }

    setCartItems((currentItems) => {
      const existingItem = currentItems.find((item) => item.product.id === product.id)

      if (!existingItem) {
        showMessage(`${product.name} adicionado ao carrinho.`, 'success')
        return [...currentItems, { product, quantity: 1 }]
      }

      if (existingItem.quantity >= product.stockQuantity) {
        showMessage('Quantidade no carrinho atingiu o estoque disponivel.', 'error')
        return currentItems
      }

      showMessage(`${product.name} atualizado no carrinho.`, 'success')
      return currentItems.map((item) =>
        item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item,
      )
    })
  }

  async function handleScannerSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const code = scanCode.trim()

    if (!code) {
      showMessage('Informe ou leia um codigo para adicionar ao carrinho.', 'error')
      return
    }

    setIsSearching(true)

    try {
      const product = await findProductByCode(code)

      if (!product) {
        showMessage(`Produto com codigo ${code.toUpperCase()} nao encontrado.`, 'error')
        return
      }

      addProductToCart(product)
      setScanCode('')
    } catch (error) {
      showMessage(error instanceof Error ? error.message : 'Nao foi possivel buscar o produto.', 'error')
    } finally {
      setIsSearching(false)
      scannerInputRef.current?.focus()
    }
  }

  function updateQuantity(productId: number, nextQuantity: number) {
    setCartItems((currentItems) =>
      currentItems.flatMap((item) => {
        if (item.product.id !== productId) {
          return [item]
        }

        if (nextQuantity <= 0) {
          return []
        }

        return [{ ...item, quantity: Math.min(nextQuantity, item.product.stockQuantity) }]
      }),
    )
  }

  function clearCart() {
    setCartItems([])
    showMessage('Carrinho limpo. Pronto para uma nova venda.', 'success')
    scannerInputRef.current?.focus()
  }

  async function handleCloseSale() {
    if (cartItems.length === 0) {
      showMessage('Adicione pelo menos um item antes de finalizar a venda.', 'error')
      return
    }

    if (!cashRegister) {
      showMessage('Abra o caixa antes de finalizar vendas.', 'error')
      return
    }

    if (parsedDiscountAmount > subtotalAmount) {
      showMessage('O desconto nao pode ser maior que o subtotal.', 'error')
      return
    }

    if (paymentMethod === 'CASH' && parsedAmountReceived < totalAmount) {
      showMessage('O valor recebido em dinheiro deve cobrir o total da venda.', 'error')
      return
    }

    const confirmed = window.confirm(`Finalizar venda de ${formatCurrency(totalAmount)}?`)
    if (!confirmed) {
      return
    }

    setIsClosingSale(true)

    try {
      const sale = await closeSale({
        items: cartItems.map((item) => ({
          productId: item.product.id,
          quantity: item.quantity,
        })),
        paymentMethod,
        discountAmount: parsedDiscountAmount,
        amountReceived: paymentMethod === 'CASH' ? parsedAmountReceived : undefined,
      })

      setCartItems([])
      setDiscountAmount('0.00')
      setAmountReceived('')
      setLastSale(sale)
      setReceiptSale(sale)
      await refreshCashRegister()
      showMessage(`Venda #${sale.id} finalizada com sucesso.`, 'success')
    } catch (error) {
      showMessage(error instanceof Error ? error.message : 'Nao foi possivel finalizar a venda.', 'error')
    } finally {
      setIsClosingSale(false)
      scannerInputRef.current?.focus()
    }
  }

  return (
    <main className="app-shell">
      <div className="app-container checkout-container">
        <section className="checkout-hero-panel">
          <div>
            <span className="eyebrow">Caixa</span>
            <h1>Caixa com leitura por codigo</h1>
            <p>
              Leia o QR Code ou digite o codigo do produto para montar a venda, finalizar
              no backend e baixar estoque automaticamente.
            </p>
          </div>
          <div className="checkout-summary">
            <span>Total da venda</span>
            <strong>{formatCurrency(totalAmount)}</strong>
            <small>
              {cashRegister ? `Caixa #${cashRegister.id} aberto` : 'Abra o caixa antes de vender'} - {totalItems} item(ns)
            </small>
          </div>
        </section>

        <section className="scanner-panel">
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
              <button className="action-button" type="submit" disabled={isSearching}>
                {isSearching ? 'Buscando...' : 'Adicionar'}
              </button>
            </div>
          </form>

          {message ? (
            <div
              className={`feedback-message ${
                messageType === 'success' ? 'feedback-message--success' : 'feedback-message--error'
              }`}
            >
              {message}
            </div>
          ) : null}
        </section>

        <section className="scanner-panel">
          <header className="section-header">
            <div>
              <h2>Pagamento</h2>
              <p>Revise subtotal, desconto e forma de pagamento antes de finalizar.</p>
            </div>
          </header>
          <div className="form-grid">
            <div className="field-group">
              <label htmlFor="paymentMethod">Forma de pagamento</label>
              <select
                id="paymentMethod"
                value={paymentMethod}
                onChange={(event) => setPaymentMethod(event.target.value as PaymentMethod)}
              >
                <option value="CASH">Dinheiro</option>
                <option value="PIX">Pix</option>
                <option value="DEBIT_CARD">Cartao debito</option>
                <option value="CREDIT_CARD">Cartao credito</option>
              </select>
            </div>
            <div className="field-group">
              <label htmlFor="discountAmount">Desconto R$</label>
              <input
                id="discountAmount"
                inputMode="decimal"
                value={discountAmount}
                onChange={(event) => setDiscountAmount(event.target.value)}
              />
            </div>
            {paymentMethod === 'CASH' ? (
              <div className="field-group">
                <label htmlFor="amountReceived">Valor recebido</label>
                <input
                  id="amountReceived"
                  inputMode="decimal"
                  value={amountReceived}
                  onChange={(event) => setAmountReceived(event.target.value)}
                  placeholder="0.00"
                />
              </div>
            ) : null}
            <div className="field-group">
              <label>Troco</label>
              <strong className="payment-total">{formatCurrency(changeAmount)}</strong>
            </div>
          </div>
        </section>

        <section className="cart-panel">
          <header className="section-header">
            <div>
              <h2>Carrinho da venda</h2>
              <p>Revise quantidades antes de finalizar a venda.</p>
            </div>
            <button className="secondary-button" type="button" onClick={clearCart} disabled={cartItems.length === 0}>
              Limpar carrinho
            </button>
          </header>

          {cartItems.length === 0 ? (
            <div className="product-empty">Nenhum item no carrinho. Leia uma etiqueta para comecar.</div>
          ) : (
            <div className="cart-list">
              {cartItems.map((item) => (
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
                      onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                      aria-label={`Reduzir quantidade de ${item.product.name}`}
                    >
                      -
                    </button>
                    <input
                      aria-label={`Quantidade de ${item.product.name}`}
                      value={item.quantity}
                      inputMode="numeric"
                      onChange={(event) => updateQuantity(item.product.id, Number(event.target.value))}
                    />
                    <button
                      className="icon-button"
                      type="button"
                      onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
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
            <span>Subtotal {formatCurrency(subtotalAmount)} - desconto {formatCurrency(parsedDiscountAmount)}</span>
            <strong>{formatCurrency(totalAmount)}</strong>
          </div>
          <button
            className="action-button"
            type="button"
            disabled={cartItems.length === 0 || isClosingSale || !cashRegister}
            onClick={() => void handleCloseSale()}
          >
            {isClosingSale ? 'Finalizando...' : 'Finalizar venda'}
          </button>
          {lastSale ? (
            <button className="icon-link" type="button" onClick={() => setReceiptSale(lastSale)}>
              Recibo #{lastSale.id}
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
