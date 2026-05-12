import type {
  AdminDashboardFilters,
  AdminDashboardPaymentMethod,
  AdminDashboardReceivables,
  AdminDashboardSummary,
} from '../types/adminDashboard'
import { apiBaseUrl, get, getAuthToken, HttpRequestError } from './httpClient'

function buildQuery(filters: AdminDashboardFilters) {
  const params = new URLSearchParams()
  if (filters.startDate) params.set('startDate', filters.startDate)
  if (filters.endDate) params.set('endDate', filters.endDate)
  return params.toString()
}

export function getAdminDashboardSummary(filters: AdminDashboardFilters) {
  return get<AdminDashboardSummary>(`/api/admin/dashboard/summary?${buildQuery(filters)}`)
}

export function getAdminDashboardPaymentMethods(filters: AdminDashboardFilters) {
  return get<AdminDashboardPaymentMethod[]>(`/api/admin/dashboard/payment-methods?${buildQuery(filters)}`)
}

export function getAdminDashboardReceivables(filters: AdminDashboardFilters) {
  return get<AdminDashboardReceivables>(`/api/admin/dashboard/receivables?${buildQuery(filters)}`)
}

export async function downloadAdminDashboardReport(filters: AdminDashboardFilters) {
  const token = getAuthToken()
  const response = await fetch(`${apiBaseUrl}/api/admin/dashboard/report?${buildQuery(filters)}`, {
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  })

  if (!response.ok) {
    throw new HttpRequestError(`Failed to download report (Status: ${response.status})`, response.status)
  }

  const blob = await response.blob()
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `relatorio-admin-${filters.startDate}-${filters.endDate}.pdf`
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  URL.revokeObjectURL(url)
}
