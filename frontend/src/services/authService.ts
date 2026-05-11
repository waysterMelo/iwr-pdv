import type {
  AuthUser,
  LoginResponse,
  ManagedUser,
  ManagedUserPage,
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
  return (await getUsersPage(0, 50)).content
}

export async function getUsersPage(page = 0, size = 6) {
  const response = await get<ManagedUserPage | ManagedUser[]>(`/api/users?page=${page}&size=${size}`)

  if (Array.isArray(response)) {
    return {
      content: response,
      page: 0,
      size,
      totalElements: response.length,
      totalPages: response.length > 0 ? 1 : 0,
      first: true,
      last: true,
    }
  }

  return response
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
