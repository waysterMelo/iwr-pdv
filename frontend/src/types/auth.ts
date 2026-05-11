export type UserRole = 'ADMIN' | 'OPERATOR'

export type AuthUser = {
  id: number
  username: string
  displayName: string
  role: UserRole
  passwordChangeRequired: boolean
}

export type LoginResponse = {
  token: string
  expiresAt: string
  user: AuthUser
}

export type ManagedUser = AuthUser & {
  active: boolean
  passwordChangeRequired: boolean
  createdAt: string
  updatedAt: string
}

export type ManagedUserPage = {
  content: ManagedUser[]
  page: number
  size: number
  totalElements: number
  totalPages: number
  first: boolean
  last: boolean
}

export type UserCreatePayload = {
  username: string
  displayName: string
  password: string
  role: UserRole
  active: boolean
}

export type UserUpdatePayload = Omit<UserCreatePayload, 'password'>

export type UserPasswordUpdatePayload = {
  password: string
}
