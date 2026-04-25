import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { findProductByCode } from '../services/productService'
import type { Product } from '../types/product'

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
  const scannerInputRef = useRef<HTMLInputElement>(null)

  const totalItems = cartItems.reduce((sum, item) => sum + item.quantity, 0)
  const totalAmount = useMemo(
    () => cartItems.reduce((sum, item) => sum + getCartItemTotal(item), 0),
    [cartItems],
  )

  useEffect(() => {
    scannerInputRef.current?.focus()
  }, [])

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

  return (
    <main className="app-shell">
      <div className="app-container checkout-container">
        <section className="checkout-hero-panel">
          <div>
            <span className="eyebrow">Sprint 4 em andamento</span>
            <h1>Caixa com leitura por codigo</h1>
            <p>
              Leia o QR Code ou digite o codigo do produto para montar a venda. Nesta sprint
              o carrinho ainda e local; gravacao e baixa de estoque entram na Sprint 5.
            </p>
          </div>
          <div className="checkout-summary">
            <span>Total da venda</span>
            <strong>{formatCurrency(totalAmount)}</strong>
            <small>{totalItems} item(ns) no carrinho</small>
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

        <section className="cart-panel">
          <header className="section-header">
            <div>
              <h2>Carrinho da venda</h2>
              <p>Revise quantidades antes de finalizar na proxima sprint.</p>
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
            <span>Subtotal</span>
            <strong>{formatCurrency(totalAmount)}</strong>
          </div>
          <button className="action-button" type="button" disabled>
            Finalizar na Sprint 5
          </button>
        </section>
      </div>
    </main>
  )
}
