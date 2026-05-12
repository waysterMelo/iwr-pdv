import type { CashMovementType, CashRegister, CashRegisterFilters, CashRegisterPage } from '../types/cashRegister'
import { get, post, getAuthToken, HttpRequestError, apiBaseUrl } from './httpClient'

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

export async function closeCashRegister(
  cashRegisterId: number,
  declaredCashAmount: number,
  closingDifferenceReason?: string,
) {
  return post<CashRegister>(`/api/cash-register/${cashRegisterId}/close`, {
    declaredCashAmount,
    closingDifferenceReason: closingDifferenceReason?.trim() || null,
  })
}

export async function getCashRegisterPage(filters: CashRegisterFilters = {}, page = 0, size = 8) {
  const params = new URLSearchParams()

  if (filters.openedStartDate) params.set('openedStartDate', filters.openedStartDate)
  if (filters.openedEndDate) params.set('openedEndDate', filters.openedEndDate)
  if (filters.closedStartDate) params.set('closedStartDate', filters.closedStartDate)
  if (filters.closedEndDate) params.set('closedEndDate', filters.closedEndDate)
  if (filters.status) params.set('status', filters.status)
  if (filters.operatorId) params.set('operatorId', String(filters.operatorId))
  if (filters.withDifference) params.set('withDifference', 'true')
  params.set('page', String(page))
  params.set('size', String(size))

  return get<CashRegisterPage>(`/api/cash-register?${params.toString()}`)
}

export async function getCashRegisterById(cashRegisterId: number) {
  return get<CashRegister>(`/api/cash-register/${cashRegisterId}`)
}

export async function reopenCashRegister(cashRegisterId: number, reason: string) {
  return post<CashRegister>(`/api/cash-register/${cashRegisterId}/reopen`, { reason })
}

export async function downloadCashRegisterReport(cashRegisterId?: number) {
  const token = getAuthToken()
  const path = cashRegisterId ? `/api/cash-register/${cashRegisterId}/report` : '/api/cash-register/current/report'
  const response = await fetch(`${apiBaseUrl}${path}`, {
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  })

  if (!response.ok) {
    throw new HttpRequestError(`Failed to download report (Status: ${response.status})`, response.status)
  }

  const blob = await response.blob()
  const url = URL.createObjectURL(blob)
  
  const a = document.createElement('a')
  a.href = url
  a.download = cashRegisterId ? `relatorio-caixa-${cashRegisterId}.pdf` : 'relatorio-caixa.pdf'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  
  URL.revokeObjectURL(url)
}
