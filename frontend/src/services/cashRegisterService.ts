import type { CashMovementType, CashRegister } from '../types/cashRegister'
import { get, post } from './httpClient'

export async function getCurrentCashRegister() {
  const response = await get<CashRegister | ''>('/api/cash-register/current')
  return response === '' ? null : response
}

export async function openCashRegister(openingAmount: number) {
  return post<CashRegister>('/api/cash-register/open', { openingAmount })
}

export async function addCashMovement(type: CashMovementType, amount: number, reason: string) {
  return post<CashRegister>('/api/cash-register/movements', { type, amount, reason })
}

export async function closeCashRegister(cashRegisterId: number, declaredCashAmount: number) {
  return post<CashRegister>(`/api/cash-register/${cashRegisterId}/close`, { declaredCashAmount })
}
