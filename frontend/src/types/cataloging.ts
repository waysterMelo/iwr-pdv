import type { AuthUser } from './auth'
import type { Product } from './product'

export type ProductBatchStatus = 'DRAFT' | 'LABELS_PRINTED' | 'CATALOGED' | 'SENT_TO_STORE'

export type ProductBatchItemPayload = {
  name: string
  code: string
  categoryId: number
  price: number
  stockQuantity: number
  active: boolean
}

export type ProductBatchPayload = {
  name: string
  items: ProductBatchItemPayload[]
}

export type ProductBatchStoreShipmentPayload = {
  sentToStoreAt: string
  note: string
}

export type ProductBatch = {
  id: number
  name: string
  status: ProductBatchStatus
  totalProducts: number
  totalPieces: number
  createdBy: AuthUser
  labelsPrintedAt: string | null
  catalogedAt: string | null
  sentToStoreAt: string | null
  storeShipmentNote: string | null
  createdAt: string
  updatedAt: string
  products: Product[]
}
