import type {
  Product,
  ProductActivationPayload,
  ProductCategory,
  ProductPage,
  ProductPageFilters,
  ProductPayload,
} from '../types/product'
import { get, patch, post, put } from './httpClient'

export async function getProducts(search: string, signal?: AbortSignal) {
  const searchParams = new URLSearchParams()

  if (search.trim()) {
    searchParams.set('search', search.trim())
  }

  const query = searchParams.size > 0 ? `?${searchParams.toString()}` : ''
  return get<Product[]>(`/api/products${query}`, { signal })
}

export async function getProductPage(filters: ProductPageFilters, page: number, signal?: AbortSignal) {
  const searchParams = new URLSearchParams()

  if (filters.search.trim()) {
    searchParams.set('search', filters.search.trim())
  }

  if (filters.active !== 'ALL') {
    searchParams.set('active', String(filters.active === 'ACTIVE'))
  }

  if (filters.stockStatus !== 'ALL') {
    searchParams.set('stockStatus', filters.stockStatus)
  }

  if (filters.minPrice.trim()) {
    searchParams.set('minPrice', filters.minPrice.trim())
  }

  if (filters.maxPrice.trim()) {
    searchParams.set('maxPrice', filters.maxPrice.trim())
  }

  if (filters.categoryId) {
    searchParams.set('categoryId', filters.categoryId)
  }

  searchParams.set('lowStockThreshold', filters.lowStockThreshold.trim() || '5')
  searchParams.set('page', String(page))
  searchParams.set('size', String(filters.size))
  searchParams.set('sort', filters.sort)
  searchParams.set('direction', filters.direction)

  return get<ProductPage>(`/api/products/page?${searchParams.toString()}`, { signal })
}

export async function getProductCategories(signal?: AbortSignal) {
  return get<ProductCategory[]>('/api/product-categories', { signal })
}

export async function getProductById(productId: number, signal?: AbortSignal) {
  return get<Product>(`/api/products/${productId}`, { signal })
}

export async function findProductByCode(code: string) {
  const searchParams = new URLSearchParams({ code: code.trim() })
  return get<Product>(`/api/sales/product-by-code?${searchParams.toString()}`)
}

export async function createProduct(payload: ProductPayload) {
  return post<Product>('/api/products', payload)
}

export async function updateProduct(productId: number, payload: ProductPayload) {
  return put<Product>(`/api/products/${productId}`, payload)
}

export async function updateProductActivation(
  productId: number,
  payload: ProductActivationPayload,
) {
  return patch<Product>(`/api/products/${productId}/activation`, payload)
}

export function getBulkLabelsUrl(productIds: number[]) {
  const params = new URLSearchParams()
  for (const id of productIds) {
    params.append('productIds', String(id))
  }
  return `/api/products/labels?${params.toString()}`
}
