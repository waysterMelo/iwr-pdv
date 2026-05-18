import type { PaymentMethod } from '../types/sale'
import type {
  PromissoryNote,
  PromissoryNoteCalendarDay,
  PromissoryNoteCollectionAction,
  PromissoryNoteCollectionEvent,
  PromissoryNoteDelinquencyRange,
  PromissoryNoteFilters,
  PromissoryNotePayment,
  PromissoryManualPayload,
  PromissoryRenegotiationPayload,
} from '../types/promissoryNote'
import { apiBaseUrl, get, getAuthToken, HttpRequestError, post } from './httpClient'

function toQuery(filters: PromissoryNoteFilters = {}) {
  const params = new URLSearchParams()

  if (filters.status) params.set('status', filters.status)
  if (filters.customerId) params.set('customerId', String(filters.customerId))
  if (filters.startDate) params.set('startDate', filters.startDate)
  if (filters.endDate) params.set('endDate', filters.endDate)

  return params.size > 0 ? `?${params.toString()}` : ''
}

export async function getPromissoryNotes(filters: PromissoryNoteFilters = {}) {
  return get<PromissoryNote[]>(`/api/promissory-notes${toQuery(filters)}`)
}

export async function getPromissoryNotesDueToday() {
  return get<PromissoryNote[]>('/api/promissory-notes/due-today')
}

export async function getPromissoryNoteCalendarDays(startDate: string, endDate: string) {
  const params = new URLSearchParams({ startDate, endDate })
  return get<PromissoryNoteCalendarDay[]>(`/api/promissory-notes/calendar-days?${params.toString()}`)
}

export async function createManualPromissoryNotes(payload: PromissoryManualPayload) {
  return post<PromissoryNote[]>('/api/promissory-notes/manual', payload)
}

export async function payPromissoryNote(
  noteId: number,
  paymentMethod: Exclude<PaymentMethod, 'PROMISSORY_NOTE'>,
  amount?: number,
  chargeInterestAndPenalty = false,
) {
  return post<PromissoryNote>(`/api/promissory-notes/${noteId}/payments`, {
    paymentMethod,
    amount: amount && amount > 0 ? amount : null,
    chargeInterestAndPenalty,
  })
}

export async function getPromissoryNotePayments(noteId: number) {
  return get<PromissoryNotePayment[]>(`/api/promissory-notes/${noteId}/payments`)
}

export async function addPromissoryNoteCollectionEvent(
  noteId: number,
  action: PromissoryNoteCollectionAction,
  comment?: string,
  promisedPaymentDate?: string,
) {
  return post<PromissoryNoteCollectionEvent>(`/api/promissory-notes/${noteId}/collection-events`, {
    action,
    comment: comment?.trim() || null,
    promisedPaymentDate: promisedPaymentDate || null,
  })
}

export async function getPromissoryNoteCollectionEvents(noteId: number) {
  return get<PromissoryNoteCollectionEvent[]>(`/api/promissory-notes/${noteId}/collection-events`)
}

export async function getPromissoryDelinquencyReport() {
  return get<PromissoryNoteDelinquencyRange[]>('/api/promissory-notes/delinquency-report')
}

export async function renegotiatePromissoryNotes(payload: PromissoryRenegotiationPayload) {
  return post<PromissoryNote[]>('/api/promissory-notes/renegotiations', payload)
}

export async function getPromissoryWhatsappMessage(noteId: number, pixKey?: string) {
  const params = new URLSearchParams()
  if (pixKey) params.set('pixKey', pixKey)
  return get<string>(`/api/promissory-notes/${noteId}/whatsapp-message${params.size ? `?${params.toString()}` : ''}`)
}

export function getPromissoryNotePrintUrl(noteId: number) {
  return `/api/promissory-notes/${noteId}/print`
}

export function getPromissoryNotesBySalePrintUrl(saleId: number) {
  return `/api/promissory-notes/sale/${saleId}/print`
}

export function getPromissoryPaymentReceiptUrl(paymentId: number) {
  return `/api/promissory-notes/payments/${paymentId}/receipt`
}

export function getPromissoryNotesExportUrl(filters: PromissoryNoteFilters = {}, dueToday = false) {
  const query = toQuery(filters)
  const separator = query ? '&' : '?'
  return `/api/promissory-notes/export.csv${query}${dueToday ? `${separator}dueToday=true` : ''}`
}

export async function downloadPromissoryNotesCsv(filters: PromissoryNoteFilters = {}) {
  const path = getPromissoryNotesExportUrl(filters, false)
  const response = await fetch(`${apiBaseUrl}${path}`, {
    headers: {
      Accept: 'text/csv',
      ...(getAuthToken() ? { Authorization: `Bearer ${getAuthToken()}` } : {}),
    },
    credentials: 'include',
  })

  if (!response.ok) {
    throw new HttpRequestError(`Failed to download CSV (Status: ${response.status})`, response.status)
  }

  const blob = await response.blob()
  const url = window.URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = 'notas-promissorias.csv'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.URL.revokeObjectURL(url)
}
