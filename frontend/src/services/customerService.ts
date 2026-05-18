import type { Customer, CustomerPage, CustomerPayload } from '../types/customer'
import { get, post, put } from './httpClient'

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

export async function createCustomer(payload: CustomerPayload) {
  return post<Customer>('/api/customers', payload)
}

export async function updateCustomer(customerId: number, payload: CustomerPayload) {
  return put<Customer>(`/api/customers/${customerId}`, payload)
}
