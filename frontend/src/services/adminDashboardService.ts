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

function getMonthRange(monthValue: string) {
  const [year, month] = monthValue.split('-').map(Number)
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`
  const end = new Date(year, month, 0)
  const endDate = `${year}-${String(month).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')}`
  return { startDate, endDate }
}

export function getAdminDashboardSummary(filters: AdminDashboardFilters) {
  return get<AdminDashboardSummary>(`/api/admin/dashboard/summary?${buildQuery(filters)}`)
}

export function getAdminDashboardPaymentMethods(filters: AdminDashboardFilters) {
  return get<AdminDashboardPaymentMethod[]>(`/api/admin/dashboard/payment-methods?${buildQuery(filters)}`)
}

export function getAdminDashboardReceivables(filters: AdminDashboardFilters, calendarMonth?: string) {
  const params = new URLSearchParams(buildQuery(filters))
  if (calendarMonth) {
    const range = getMonthRange(calendarMonth)
    params.set('calendarStartDate', range.startDate)
    params.set('calendarEndDate', range.endDate)
  }

  return get<AdminDashboardReceivables>(`/api/admin/dashboard/receivables?${params.toString()}`)
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
