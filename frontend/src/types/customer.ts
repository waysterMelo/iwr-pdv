export type Customer = {
  id: number
  name: string
  cpf: string | null
  phone: string | null
  email: string | null
  address: string | null
  birthDate: string | null
  active: boolean
  createdAt: string
  updatedAt: string
}

export type CustomerPayload = {
  name: string
  cpf?: string
  phone?: string
  email?: string
  address?: string
  birthDate?: string
  active?: boolean
}

export type CustomerPage = {
  content: Customer[]
  page: number
  size: number
  totalElements: number
  totalPages: number
  first: boolean
  last: boolean
}
