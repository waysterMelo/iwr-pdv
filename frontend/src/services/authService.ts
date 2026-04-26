import type {
  AuthUser,
  LoginResponse,
  ManagedUser,
  UserCreatePayload,
  UserPasswordUpdatePayload,
  UserUpdatePayload,
} from '../types/auth'
import { clearAuthToken, get, patch, post, put, setAuthToken } from './httpClient'

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

export async function getUsers() {
  return get<ManagedUser[]>('/api/users')
}

export async function createUser(payload: UserCreatePayload) {
  return post<ManagedUser>('/api/users', payload)
}

export async function updateUser(userId: number, payload: UserUpdatePayload) {
  return put<ManagedUser>(`/api/users/${userId}`, payload)
}

export async function updateUserPassword(userId: number, payload: UserPasswordUpdatePayload) {
  return patch<ManagedUser>(`/api/users/${userId}/password`, payload)
}
