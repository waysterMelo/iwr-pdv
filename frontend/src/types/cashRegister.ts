import type { AuthUser } from './auth'

export type CashRegisterStatus = 'OPEN' | 'CLOSED'
export type CashMovementType = 'CASH_IN' | 'CASH_OUT'

export type CashMovement = {
  id: number
  type: CashMovementType
  amount: number
  reason: string
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
  totalSalesAmount: number
  cashSalesAmount: number
  cashInAmount: number
  cashOutAmount: number
  totalsByPaymentMethod: Record<string, number>
  openedBy: AuthUser
  closedBy: AuthUser | null
  openedAt: string
  closedAt: string | null
  movements: CashMovement[]
}
