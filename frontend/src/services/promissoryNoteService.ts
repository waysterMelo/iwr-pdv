import type { PaymentMethod } from '../types/sale'
import type { PromissoryNote, PromissoryNoteFilters } from '../types/promissoryNote'
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

export async function payPromissoryNote(noteId: number, paymentMethod: Exclude<PaymentMethod, 'PROMISSORY_NOTE'>) {
  return post<PromissoryNote>(`/api/promissory-notes/${noteId}/payments`, { paymentMethod })
}

export function getPromissoryNotePrintUrl(noteId: number) {
  return `/api/promissory-notes/${noteId}/print`
}

export function getPromissoryNotesExportUrl(filters: PromissoryNoteFilters = {}) {
  return `/api/promissory-notes/export.csv${toQuery(filters)}`
}
