import type { CashMovementType, CashRegister } from '../types/cashRegister'
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

export async function closeCashRegister(cashRegisterId: number, declaredCashAmount: number) {
  return post<CashRegister>(`/api/cash-register/${cashRegisterId}/close`, { declaredCashAmount })
}

export async function downloadCashRegisterReport() {
  const token = getAuthToken()
  const response = await fetch(`${apiBaseUrl}/api/cash-register/current/report`, {
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
  a.download = 'relatorio-caixa.pdf'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  
  URL.revokeObjectURL(url)
}
