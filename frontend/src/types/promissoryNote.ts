import type { AuthUser } from './auth'
import type { Customer } from './customer'
import type { PaymentMethod, SaleItem } from './sale'

export type PromissoryNoteStatus = 'PENDING' | 'PARTIALLY_PAID' | 'PAID' | 'OVERDUE' | 'CANCELLED'

export type PromissoryInstallmentPayload = {
  dueDate: string
  amount: number
}

export type PromissoryNoteSummary = {
  id: number
  installmentNumber: number
  totalInstallments: number
  amount: number
  dueDate: string
  status: PromissoryNoteStatus
}

export type PromissoryNote = PromissoryNoteSummary & {
  saleId: number | null
  customer: Customer
  paidAmount: number
  remainingAmount: number
  updatedAmount: number
  daysOverdue: number
  paidAt: string | null
  paidBy: AuthUser | null
  paymentMethod: PaymentMethod | null
  createdAt: string
  updatedAt: string
  saleItems: SaleItem[]
}

export type PromissoryNotePayment = {
  id: number
  amount: number
  penaltyAmount: number
  interestAmount: number
  totalReceived: number
  paymentMethod: Exclude<PaymentMethod, 'PROMISSORY_NOTE'>
  paidBy: AuthUser
  paidAt: string
}

export type PromissoryNoteDelinquencyRange = {
  range: string
  amount: number
  count: number
}

export type PromissoryNoteCalendarDay = {
  date: string
  amount: number
  count: number
}

export type PromissoryManualPayload = {
  customerId: number
  items: Array<{
    productId: number
    quantity: number
    unitPrice: number
  }>
  discountAmount?: number
  installments: PromissoryInstallmentPayload[]
}

export type PromissoryNoteFilters = {
  status?: PromissoryNoteStatus | ''
  customerId?: number
  startDate?: string
  endDate?: string
}
