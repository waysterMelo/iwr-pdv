import { useMemo, useState } from 'react'
import { useAppMessage } from '../hooks/useAppMessage'
import { findProductByCode } from '../services/productService'
import { closeSale } from '../services/saleService'
import type { Product } from '../types/product'
import type { PaymentMethod, Sale } from '../types/sale'
import type { PromissoryInstallmentPayload } from '../types/promissoryNote'
import { getErrorMessage } from '../utils/errors'

export type CartItem = {
  product: Product
  quantity: number
}

export type FeedbackType = 'success' | 'error'

type UseSalesCartOptions = {
  initialPaymentMethod?: PaymentMethod
}

export function getCartItemTotal(item: CartItem) {
  return item.product.price * item.quantity
}

export function useSalesCart(options: UseSalesCartOptions = {}) {
  const { notify } = useAppMessage()
  const [cartItems, setCartItems] = useState<CartItem[]>([])
  const [message, setMessage] = useState<string | null>(null)
  const [messageType, setMessageType] = useState<FeedbackType>('success')
  const [isSearching, setIsSearching] = useState(false)
  const [isClosingSale, setIsClosingSale] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(options.initialPaymentMethod ?? 'CASH')
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

  function showMessage(nextMessage: string, nextType: FeedbackType) {
    setMessage(nextMessage)
    setMessageType(nextType)
    notify({
      type: nextType,
      title: nextType === 'success' ? 'Operacao concluida' : 'Nao foi possivel continuar',
      message: nextMessage,
    })
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

  async function finalizeSale(options: { customerId?: number; promissoryInstallments?: PromissoryInstallmentPayload[] } = {}) {
    if (cartItems.length === 0) {
      showMessage('Adicione pelo menos um item antes de finalizar a venda.', 'error')
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

    if (paymentMethod === 'PROMISSORY_NOTE') {
      if (!options.customerId) {
        showMessage('Selecione um cliente para vender na nota promissoria.', 'error')
        return null
      }

      if (!options.promissoryInstallments?.length) {
        showMessage('Informe pelo menos uma parcela para a nota promissoria.', 'error')
        return null
      }

      const installmentTotal = options.promissoryInstallments.reduce((sum, installment) => sum + installment.amount, 0)
      if (Math.abs(installmentTotal - totalAmount) > 0.009) {
        showMessage('A soma das parcelas precisa fechar com o total da venda.', 'error')
        return null
      }
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
        customerId: options.customerId,
        promissoryInstallments: options.promissoryInstallments,
      })

      setCartItems([])
      setDiscountAmount('0.00')
      setAmountReceived('')
      setLastSale(sale)
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
    showMessage,
    updateQuantity,
  }
}
