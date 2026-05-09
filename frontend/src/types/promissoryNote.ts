import type { AuthUser } from './auth'
import type { Customer } from './customer'
import type { PaymentMethod, SaleItem } from './sale'

export type PromissoryNoteStatus = 'PENDING' | 'PAID' | 'OVERDUE' | 'CANCELLED'

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
  saleId: number
  customer: Customer
  paidAt: string | null
  paidBy: AuthUser | null
  paymentMethod: PaymentMethod | null
  cashRegisterId: number | null
  createdAt: string
  updatedAt: string
  saleItems: SaleItem[]
}

export type PromissoryNoteFilters = {
  status?: PromissoryNoteStatus | ''
  customerId?: number
  startDate?: string
  endDate?: string
}
