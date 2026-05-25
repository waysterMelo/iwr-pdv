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
}

export type CustomerPayload = {
  name: string
  cpf?: string
  phone?: string
  email?: string
  address?: string
  birthDate?: string
  active?: boolean
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

export type CustomerProfile = {
  customer: Customer
  saleCount: number
  totalPurchasedAmount: number
  openPromissoryCount: number
  overduePromissoryCount: number
  openPromissoryAmount: number
  overduePromissoryAmount: number
  paidPromissoryAmount: number
  purchasedItems: CustomerPurchasedItem[]
  latestSales: import('./sale').Sale[]
  promissoryNotes: import('./promissoryNote').PromissoryNote[]
}
