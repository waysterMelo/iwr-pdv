import type { PaymentMethod } from '../types/sale'
import type {
  PromissoryNote,
  PromissoryNoteCollectionAction,
  PromissoryNoteCollectionEvent,
  PromissoryNoteDelinquencyRange,
  PromissoryNoteFilters,
  PromissoryNotePayment,
  PromissoryRenegotiationPayload,
} from '../types/promissoryNote'
import { get, post } from './httpClient'

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
