export type Customer = {
  id: number
  name: string
  cpf: string | null
  phone: string | null
  email: string | null
  address: string | null
  birthDate: string | null
  active: boolean
  createdAt: string
  updatedAt: string
  observations: string | null
  creditLimit: number | null
}

export type CustomerPayload = {
  name: string
  cpf?: string
  phone?: string
  email?: string
  address?: string
  birthDate?: string
  active?: boolean
  observations?: string
  creditLimit?: number
}

export type CustomerPage = {
  content: Customer[]
  page: number
  size: number
  totalElements: number
  totalPages: number
  first: boolean
  last: boolean
}

export type CustomerPurchasedItem = {
  productId: number
  productName: string
  productCode: string
  quantity: number
  totalAmount: number
  lastPurchaseAt: string
}

export type CustomerPromissoryNote = {
  id: number
  saleId: number | null
  installmentNumber: number
  totalInstallments: number
  amount: number
  paidAmount: number
  remainingAmount: number
  updatedAmount: number
  daysOverdue: number
  dueDate: string
  status: import('./promissoryNote').PromissoryNoteStatus
  paidAt: string | null
  paidBy: import('./auth').AuthUser | null
  paymentMethod: import('./sale').PaymentMethod | null
  createdAt: string
  updatedAt: string
  saleItems: import('./sale').SaleItem[]
  payments: import('./promissoryNote').PromissoryNotePayment[]
}

export type CustomerProfile = {
  customer: Customer
  saleCount: number
  completedSaleCount: number
  cancelledSaleCount: number
  totalPurchasedAmount: number
  totalDiscountAmount: number
  averageTicketAmount: number
  openPromissoryCount: number
  overduePromissoryCount: number
  paidPromissoryCount: number
  cancelledPromissoryCount: number
  openPromissoryAmount: number
  overduePromissoryAmount: number
  paidPromissoryAmount: number
  purchasedItems: CustomerPurchasedItem[]
  latestSales: import('./sale').Sale[]
  sales: import('./sale').Sale[]
  cancelledSales: import('./sale').Sale[]
  promissoryNotes: CustomerPromissoryNote[]
}
