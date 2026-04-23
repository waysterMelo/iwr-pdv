export type Product = {
  id: number
  name: string
  code: string
  price: number
  stockQuantity: number
  active: boolean
  createdAt: string
  updatedAt: string
}

export type ProductPayload = {
  name: string
  code: string
  price: number
  stockQuantity: number
  active: boolean
}

export type ProductActivationPayload = {
  active: boolean
}
