import type { Customer, CustomerPage, CustomerPayload, CustomerProfile } from '../types/customer'
import type { PromissoryNoteStatus } from '../types/promissoryNote'
import type { SaleStatus } from '../types/sale'
import { apiBaseUrl, get, getAuthToken, HttpRequestError, post, put } from './httpClient'

export type CustomerProfileExportFilters = {
  startDate?: string
  endDate?: string
  saleStatus?: SaleStatus | ''
  noteStatus?: PromissoryNoteStatus | ''
}

export async function getCustomers(search?: string) {
  const params = new URLSearchParams()
  if (search?.trim()) {
    params.set('search', search.trim())
  }

  const query = params.size > 0 ? `?${params.toString()}` : ''
  return get<Customer[]>(`/api/customers${query}`)
}

export async function getCustomerPage(search = '', page = 0, size = 6, signal?: AbortSignal) {
  const params = new URLSearchParams()
  if (search.trim()) {
    params.set('search', search.trim())
  }
  params.set('page', String(page))
  params.set('size', String(size))

  return get<CustomerPage>(`/api/customers/page?${params.toString()}`, { signal })
}

export async function getCustomerBirthdays() {
  return get<Customer[]>('/api/customers/birthdays')
}

export async function getCustomerProfile(customerId: number) {
  return get<CustomerProfile>(`/api/customers/${customerId}/profile`)
}

function toProfileExportQuery(filters: CustomerProfileExportFilters = {}) {
  const params = new URLSearchParams()

  if (filters.startDate) params.set('startDate', filters.startDate)
  if (filters.endDate) params.set('endDate', filters.endDate)
  if (filters.saleStatus) params.set('saleStatus', filters.saleStatus)
  if (filters.noteStatus) params.set('noteStatus', filters.noteStatus)

  return params.size > 0 ? `?${params.toString()}` : ''
}

export async function downloadCustomerProfileExcelReport(customerId: number, filters: CustomerProfileExportFilters = {}) {
  const response = await fetch(`${apiBaseUrl}/api/customers/${customerId}/profile/export.csv${toProfileExportQuery(filters)}`, {
    headers: {
      Accept: 'text/csv',
      ...(getAuthToken() ? { Authorization: `Bearer ${getAuthToken()}` } : {}),
    },
    credentials: 'include',
  })

  if (!response.ok) {
    throw new HttpRequestError(`Failed to download customer report (Status: ${response.status})`, response.status)
  }

  const blob = await response.blob()
  const url = window.URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `consulta-cliente-${customerId}.csv`
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.URL.revokeObjectURL(url)
}

export async function createCustomer(payload: CustomerPayload) {
  return post<Customer>('/api/customers', payload)
}

export async function updateCustomer(customerId: number, payload: CustomerPayload) {
  return put<Customer>(`/api/customers/${customerId}`, payload)
}
