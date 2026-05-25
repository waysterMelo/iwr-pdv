export type AuditAction =
  | 'LOGIN_SUCCESS'
  | 'LOGIN_FAILED'
  | 'LOGOUT'
  | 'ACCESS_DENIED'
  | 'USER_CREATED'
  | 'USER_UPDATED'
  | 'USER_PASSWORD_CHANGED'
  | 'CASH_REGISTER_OPENED'
  | 'CASH_REGISTER_CLOSED'
  | 'CASH_MOVEMENT_CREATED'
  | 'PRODUCT_CREATED'
  | 'PRODUCT_UPDATED'
  | 'PRODUCT_PRICE_CHANGED'
  | 'PRODUCT_STOCK_CHANGED'
  | 'SALE_CANCELLED'
  | 'PROMISSORY_NOTE_CREATED'
  | 'PROMISSORY_NOTE_PAID'

export type AuditLog = {
  id: number
  userId: number | null
  username: string | null
  userDisplayName: string | null
  action: AuditAction
  entityType: string | null
  entityId: string | null
  details: string | null
  occurredAt: string
}

export type AuditLogPage = {
  content: AuditLog[]
  page: number
  size: number
  totalElements: number
  totalPages: number
  first: boolean
  last: boolean
}

export type AuditFilters = {
  username?: string
  action?: AuditAction | ''
  entityType?: string
  startDate?: string
  endDate?: string
}
