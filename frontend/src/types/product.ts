export type Product = {
  id: number
  name: string
  code: string
  categoryId: number
  categoryName: string
  categoryIcon: string
  batchId: number | null
  price: number
  stockQuantity: number
  active: boolean
  createdAt: string
  updatedAt: string
}

export type ProductPayload = {
  name: string
  code: string
  categoryId: number
  price: number
  stockQuantity: number
  active: boolean
}

export type ProductCategory = {
  id: number
  name: string
  icon: string
  active: boolean
}

export type ProductActivationPayload = {
  active: boolean
}

export type ProductStockStatus = 'ALL' | 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK'

export type ProductSortField = 'name' | 'code' | 'price' | 'stockQuantity' | 'createdAt' | 'updatedAt'

export type ProductSortDirection = 'asc' | 'desc'

export type ProductPage = {
  content: Product[]
  page: number
  size: number
  totalElements: number
  totalPages: number
  first: boolean
  last: boolean
}

export type ProductPageFilters = {
  search: string
  active: 'ALL' | 'ACTIVE' | 'INACTIVE'
  stockStatus: ProductStockStatus
  minPrice: string
  maxPrice: string
  categoryId: string
  lowStockThreshold: string
  sort: ProductSortField
  direction: ProductSortDirection
  size: number
}
