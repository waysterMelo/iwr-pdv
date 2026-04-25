import type { AuthUser, LoginResponse } from '../types/auth'
import { clearAuthToken, get, post, setAuthToken } from './httpClient'

export async function login(username: string, password: string) {
  const response = await post<LoginResponse>('/api/auth/login', {
    username,
    password,
  })

  setAuthToken(response.token)
  return response
}

export async function getCurrentUser() {
  return get<AuthUser>('/api/auth/me')
}

export async function logout() {
  try {
    await post<void>('/api/auth/logout')
  } finally {
    clearAuthToken()
  }
}
