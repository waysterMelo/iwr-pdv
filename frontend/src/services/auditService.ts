import type { AuditFilters, AuditLog, AuditLogPage } from '../types/audit'
import { get } from './httpClient'

function toIsoDateTime(value?: string, endOfDay = false) {
  if (!value) {
    return undefined
  }

  return `${value}T${endOfDay ? '23:59:59' : '00:00:00'}-03:00`
}

export function getAuditLogs(filters: AuditFilters = {}, page = 0, size = 10) {
  const params = new URLSearchParams()
  params.set('page', String(Math.max(page, 0)))
  params.set('size', String(Math.max(size, 1)))

  if (filters.username?.trim()) {
    params.set('username', filters.username.trim())
  }

  if (filters.action) {
    params.set('action', filters.action)
  }

  if (filters.entityType?.trim()) {
    params.set('entityType', filters.entityType.trim().toUpperCase())
  }

  const startDate = toIsoDateTime(filters.startDate)
  const endDate = toIsoDateTime(filters.endDate, true)

  if (startDate) {
    params.set('startDate', startDate)
  }

  if (endDate) {
    params.set('endDate', endDate)
  }

  const query = params.toString()
  return get<AuditLogPage | AuditLog[]>(`/api/audit${query ? `?${query}` : ''}`).then((response) =>
    normalizeAuditPageResponse(response, page, size),
  )
}

function normalizeAuditPageResponse(response: AuditLogPage | AuditLog[], page: number, size: number): AuditLogPage {
  if (Array.isArray(response)) {
    return {
      content: response,
      page,
      size,
      totalElements: response.length,
      totalPages: response.length > 0 ? 1 : 0,
      first: true,
      last: true,
    }
  }

  const content = Array.isArray(response.content) ? response.content : []
  const resolvedSize = Number.isFinite(response.size) && response.size > 0 ? response.size : size
  const totalElements =
    Number.isFinite(response.totalElements) && response.totalElements >= 0 ? response.totalElements : content.length

  return {
    content,
    page: Number.isFinite(response.page) && response.page >= 0 ? response.page : page,
    size: resolvedSize,
    totalElements,
    totalPages:
      Number.isFinite(response.totalPages) && response.totalPages >= 0
        ? response.totalPages
        : Math.ceil(totalElements / resolvedSize),
    first: typeof response.first === 'boolean' ? response.first : page === 0,
    last: typeof response.last === 'boolean' ? response.last : (page + 1) * resolvedSize >= totalElements,
  }
}
