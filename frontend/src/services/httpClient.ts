type RequestOptions = {
  signal?: AbortSignal
}

type ErrorPayload = {
  message?: string
}

export class HttpRequestError extends Error {
  public readonly status: number
  public readonly payload?: unknown

  constructor(
    message: string,
    status: number,
    payload?: unknown,
  ) {
    super(message)
    this.name = 'HttpRequestError'
    this.status = status
    this.payload = payload
  }
}

const rawBaseUrl = import.meta.env.VITE_API_BASE_URL ?? ''
const apiBaseUrl = rawBaseUrl.endsWith('/') ? rawBaseUrl.slice(0, -1) : rawBaseUrl
const authTokenStorageKey = 'iwr-pdv-auth-token'
let authToken = window.localStorage.getItem(authTokenStorageKey)

export function setAuthToken(token: string) {
  authToken = token
  window.localStorage.setItem(authTokenStorageKey, token)
}

export function clearAuthToken() {
  authToken = null
  window.localStorage.removeItem(authTokenStorageKey)
}

export function getAuthToken() {
  return authToken
}

async function parseResponse<T>(response: Response): Promise<T | ErrorPayload | string> {
  const contentType = response.headers.get('content-type') ?? ''

  if (contentType.includes('application/json')) {
    return (await response.json()) as T | ErrorPayload
  }

  return response.text()
}

async function request<T>(
  path: string,
  method: string,
  body?: unknown,
  options: RequestOptions = {},
) {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    headers: {
      Accept: 'application/json',
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    credentials: 'include',
    method,
    signal: options.signal,
  })

  const payload = await parseResponse<T>(response)

  if (!response.ok) {
    const message =
      typeof payload === 'object' && payload !== null && 'message' in payload
        ? String(payload.message)
        : `Request failed with status ${response.status}.`

    throw new HttpRequestError(message, response.status, payload)
  }

  return payload as T
}

export async function get<T>(path: string, options: RequestOptions = {}) {
  return request<T>(path, 'GET', undefined, options)
}

export async function post<T>(path: string, body?: unknown, options: RequestOptions = {}) {
  return request<T>(path, 'POST', body, options)
}

export async function put<T>(path: string, body: unknown, options: RequestOptions = {}) {
  return request<T>(path, 'PUT', body, options)
}

export async function patch<T>(path: string, body: unknown, options: RequestOptions = {}) {
  return request<T>(path, 'PATCH', body, options)
}
