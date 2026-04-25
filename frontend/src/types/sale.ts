import type { AuthUser } from './auth'

export type PaymentMethod = 'CASH' | 'PIX' | 'DEBIT_CARD' | 'CREDIT_CARD'
export type SaleStatus = 'COMPLETED' | 'CANCELLED'

export type SaleItemPayload = {
  productId: number
  quantity: number
}

export type SalePayload = {
  items: SaleItemPayload[]
  paymentMethod: PaymentMethod
  discountAmount: number
  amountReceived?: number
}

export type SaleItem = {
  id: number
  productId: number
  productName: string
  productCode: string
  quantity: number
  unitPrice: number
  subtotal: number
}

export type Sale = {
  id: number
  status: SaleStatus
  operator: AuthUser
  paymentMethod: PaymentMethod
  subtotalAmount: number
  discountAmount: number
  totalAmount: number
  amountReceived: number | null
  changeAmount: number
  totalItems: number
  soldAt: string
  cancelledAt: string | null
  cancellationReason: string | null
  createdAt: string
  items: SaleItem[]
}
