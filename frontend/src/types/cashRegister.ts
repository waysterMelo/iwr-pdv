import type { AuthUser } from './auth'
import type { PaymentMethod } from './sale'
import type { Sale } from './sale'

export type CashRegisterStatus = 'OPEN' | 'CLOSED'
export type CashMovementType = 'CASH_IN' | 'CASH_OUT'

export type CashMovement = {
  id: number
  type: CashMovementType
  amount: number
  reason: string
  paymentMethod: PaymentMethod | null
  referenceType: string | null
  referenceId: number | null
  operator: AuthUser
  createdAt: string
}

export type CashRegister = {
  id: number
  status: CashRegisterStatus
  openingAmount: number
  declaredCashAmount: number | null
  expectedCashAmount: number
  cashDifference: number | null
  closingDifferenceReason: string | null
  totalSalesAmount: number
  cashSalesAmount: number
  cashInAmount: number
  cashOutAmount: number
  totalsByPaymentMethod: Record<string, number>
  openedBy: AuthUser
  closedBy: AuthUser | null
  reopenedBy: AuthUser | null
  openedAt: string
  closedAt: string | null
  reopenedAt: string | null
  reopenReason: string | null
  sales: Sale[]
  movements: CashMovement[]
}

export type CashRegisterPage = {
  content: CashRegister[]
  page: number
  size: number
  totalElements: number
  totalPages: number
  first: boolean
  last: boolean
}

export type CashRegisterFilters = {
  openedStartDate?: string
  openedEndDate?: string
  closedStartDate?: string
  closedEndDate?: string
  status?: CashRegisterStatus | ''
  operatorId?: number
  withDifference?: boolean
}
