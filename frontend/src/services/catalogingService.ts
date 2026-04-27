import type {
  ProductBatch,
  ProductBatchPayload,
  ProductBatchStoreShipmentPayload,
} from '../types/cataloging'
import { get, patch, post } from './httpClient'

export async function getProductBatches(signal?: AbortSignal) {
  return get<ProductBatch[]>('/api/product-batches', { signal })
}

export async function createProductBatch(payload: ProductBatchPayload) {
  return post<ProductBatch>('/api/product-batches', payload)
}

export async function markBatchLabelsPrinted(batchId: number) {
  return patch<ProductBatch>(`/api/product-batches/${batchId}/labels-printed`, {})
}

export async function markBatchCataloged(batchId: number) {
  return patch<ProductBatch>(`/api/product-batches/${batchId}/cataloged`, {})
}

export async function markBatchSentToStore(
  batchId: number,
  payload: ProductBatchStoreShipmentPayload,
) {
  return patch<ProductBatch>(`/api/product-batches/${batchId}/sent-to-store`, payload)
}

export function getBatchLabelsUrl(batchId: number) {
  return `/api/product-batches/${batchId}/labels`
}
