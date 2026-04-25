export type UserRole = 'ADMIN' | 'OPERATOR'

export type AuthUser = {
  id: number
  username: string
  displayName: string
  role: UserRole
}

export type LoginResponse = {
  token: string
  expiresAt: string
  user: AuthUser
}
