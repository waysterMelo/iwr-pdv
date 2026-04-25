import type { Product, ProductActivationPayload, ProductPayload } from '../types/product'
import { get, patch, post, put } from './httpClient'

export async function getProducts(search: string) {
  const searchParams = new URLSearchParams()

  if (search.trim()) {
    searchParams.set('search', search.trim())
  }

  const query = searchParams.size > 0 ? `?${searchParams.toString()}` : ''
  return get<Product[]>(`/api/products${query}`)
}

export async function findProductByCode(code: string) {
  const products = await getProducts(code)
  return products.find((product) => product.code.toUpperCase() === code.trim().toUpperCase()) ?? null
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
