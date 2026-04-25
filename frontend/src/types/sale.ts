export type SaleItemPayload = {
  productId: number
  quantity: number
}

export type SalePayload = {
  items: SaleItemPayload[]
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
  totalAmount: number
  totalItems: number
  soldAt: string
  createdAt: string
  items: SaleItem[]
}
