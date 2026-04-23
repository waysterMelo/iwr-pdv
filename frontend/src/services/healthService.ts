import type { HealthStatus } from '../types/health'
import { HttpRequestError, get } from './httpClient'

export async function getHealthStatus(signal?: AbortSignal) {
  return get<HealthStatus>('/health', { signal })
}

export { HttpRequestError }
