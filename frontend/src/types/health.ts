export type HealthState = 'UP' | 'DOWN' | 'DEGRADED'

export type HealthStatus = {
  application: string
  status: HealthState
  database: HealthState
  checkedAt: string
}
