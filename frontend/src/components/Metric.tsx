import type { LucideIcon } from 'lucide-react'

type MetricTone = 'default' | 'gold' | 'danger' | 'success' | 'warning'

type MetricProps = {
  label: string
  value: string
  hint?: string
  tone?: MetricTone
  icon?: LucideIcon
}

export function Metric({ label, value, hint, tone = 'default', icon: Icon }: MetricProps) {
  const surfaceClassName = tone === 'gold' ? 'metric-card--gold-surface' : ''

  return (
    <div className={`metric-card metric-card--${tone} ${surfaceClassName}`.trim()}>
      <div className="metric-card__glow" />
      <span className="metric-card__label">
        {Icon ? <Icon size={16} strokeWidth={2.4} aria-hidden="true" /> : null}
        {label}
      </span>
      <strong className="metric-card__value">{value}</strong>
      {hint ? <small className="metric-card__hint">{hint}</small> : null}
    </div>
  )
}
