import { useEffect, useMemo, useState } from 'react'
import { getCurrentCashRegister } from '../services/cashRegisterService'
import { findProductByCode } from '../services/productService'
import { closeSale } from '../services/saleService'
import type { CashRegister } from '../types/cashRegister'
import type { Product } from '../types/product'
import type { PaymentMethod, Sale } from '../types/sale'
import { getErrorMessage } from '../utils/errors'

export type CartItem = {
  product: Product
  quantity: number
}

export type FeedbackType = 'success' | 'error'

export function getCartItemTotal(item: CartItem) {
  return item.product.price * item.quantity
}

export function useSalesCart() {
  const [cartItems, setCartItems] = useState<CartItem[]>([])
  const [message, setMessage] = useState<string | null>(null)
  const [messageType, setMessageType] = useState<FeedbackType>('success')
  const [isSearching, setIsSearching] = useState(false)
  const [isClosingSale, setIsClosingSale] = useState(false)
  const [cashRegister, setCashRegister] = useState<CashRegister | null>(null)
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH')
  const [discountAmount, setDiscountAmount] = useState('0.00')
  const [amountReceived, setAmountReceived] = useState('')
  const [lastSale, setLastSale] = useState<Sale | null>(null)

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
    void refreshCashRegister()
  }, [])

  async function refreshCashRegister() {
    try {
      setCashRegister(await getCurrentCashRegister())
    } catch {
      setCashRegister(null)
    }
  }

  function showMessage(nextMessage: string, nextType: FeedbackType) {
    setMessage(nextMessage)
    setMessageType(nextType)
  }

  function addProductToCart(product: Product) {
    if (!product.active) {
      showMessage('Produto inativo. Reative no cadastro antes de vender.', 'error')
      return false
    }

    if (product.stockQuantity <= 0) {
      showMessage('Produto sem estoque disponivel.', 'error')
      return false
    }

    const existingItem = cartItems.find((item) => item.product.id === product.id)

    if (!existingItem) {
      setCartItems([...cartItems, { product, quantity: 1 }])
      showMessage(`${product.name} adicionado ao carrinho.`, 'success')
      return true
    }

    if (existingItem.quantity >= product.stockQuantity) {
      showMessage('Quantidade no carrinho atingiu o estoque disponivel.', 'error')
      return false
    }

    setCartItems(
      cartItems.map((item) =>
        item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item,
      ),
    )
    showMessage(`${product.name} atualizado no carrinho.`, 'success')
    return true
  }

  async function addProductCodeToCart(code: string) {
    const normalizedCode = code.trim()

    if (!normalizedCode) {
      showMessage('Informe ou leia um codigo para adicionar ao carrinho.', 'error')
      return false
    }

    setIsSearching(true)

    try {
      const product = await findProductByCode(normalizedCode)

      if (!product) {
        showMessage(`Produto com codigo ${normalizedCode.toUpperCase()} nao encontrado.`, 'error')
        return false
      }

      return addProductToCart(product)
    } catch (error) {
      showMessage(getErrorMessage(error, 'Nao foi possivel buscar o produto.'), 'error')
      return false
    } finally {
      setIsSearching(false)
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
  }

  async function finalizeSale() {
    if (cartItems.length === 0) {
      showMessage('Adicione pelo menos um item antes de finalizar a venda.', 'error')
      return null
    }

    if (!cashRegister) {
      showMessage('Abra o caixa antes de finalizar vendas.', 'error')
      return null
    }

    if (parsedDiscountAmount > subtotalAmount) {
      showMessage('O desconto nao pode ser maior que o subtotal.', 'error')
      return null
    }

    if (paymentMethod === 'CASH' && parsedAmountReceived < totalAmount) {
      showMessage('O valor recebido em dinheiro deve cobrir o total da venda.', 'error')
      return null
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
      await refreshCashRegister()
      showMessage(`Venda #${sale.id} finalizada com sucesso.`, 'success')
      return sale
    } catch (error) {
      showMessage(getErrorMessage(error, 'Nao foi possivel finalizar a venda.'), 'error')
      return null
    } finally {
      setIsClosingSale(false)
    }
  }

  return {
    amountReceived,
    cartItems,
    cashRegister,
    changeAmount,
    discountAmount,
    isClosingSale,
    isSearching,
    lastSale,
    message,
    messageType,
    parsedDiscountAmount,
    paymentMethod,
    setAmountReceived,
    setDiscountAmount,
    setPaymentMethod,
    subtotalAmount,
    totalAmount,
    totalItems,
    addProductCodeToCart,
    addProductToCart,
    clearCart,
    finalizeSale,
    refreshCashRegister,
    showMessage,
    updateQuantity,
  }
}
