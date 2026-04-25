import type { Sale, SalePayload } from '../types/sale'
import { get, post } from './httpClient'

export async function closeSale(payload: SalePayload) {
  return post<Sale>('/api/sales', payload)
}

export async function getSales(startDate?: string, endDate?: string) {
  const searchParams = new URLSearchParams()

  if (startDate) {
    searchParams.set('startDate', startDate)
  }

  if (endDate) {
    searchParams.set('endDate', endDate)
  }

  const query = searchParams.size > 0 ? `?${searchParams.toString()}` : ''
  return get<Sale[]>(`/api/sales${query}`)
}

export async function cancelSale(saleId: number, reason: string) {
  return post<Sale>(`/api/sales/${saleId}/cancel`, { reason })
}

export function getSaleReceiptUrl(saleId: number) {
  return `/api/sales/${saleId}/receipt`
}
