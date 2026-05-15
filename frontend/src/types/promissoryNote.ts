import type { AuthUser } from './auth'
import type { Customer } from './customer'
import type { PaymentMethod, SaleItem } from './sale'

export type PromissoryNoteStatus = 'PENDING' | 'PARTIALLY_PAID' | 'PAID' | 'OVERDUE' | 'CANCELLED' | 'RENEGOTIATED'
export type PromissoryNoteCollectionAction = 'CALL_MADE' | 'MESSAGE_SENT' | 'PROMISED_PAYMENT' | 'NO_RESPONSE' | 'AGREEMENT_MADE' | 'IN_PERSON_COLLECTION' | 'NOTE'

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
  paidAmount: number
  remainingAmount: number
  updatedAmount: number
  daysOverdue: number
  paidAt: string | null
  paidBy: AuthUser | null
  paymentMethod: PaymentMethod | null
  cashRegisterId: number | null
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
  cashRegisterId: number
  paidAt: string
}

export type PromissoryNoteCollectionEvent = {
  id: number
  action: PromissoryNoteCollectionAction
  comment: string | null
  promisedPaymentDate: string | null
  createdBy: AuthUser
  createdAt: string
}

export type PromissoryNoteDelinquencyRange = {
  range: string
  amount: number
  count: number
}

export type PromissoryRenegotiationPayload = {
  noteIds: number[]
  reason: string
  installments: PromissoryInstallmentPayload[]
}

export type PromissoryNoteFilters = {
  status?: PromissoryNoteStatus | ''
  customerId?: number
  startDate?: string
  endDate?: string
}
