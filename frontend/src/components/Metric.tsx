type MetricTone = 'default' | 'gold' | 'danger' | 'success' | 'warning'

type MetricProps = {
  label: string
  value: string
  hint?: string
  tone?: MetricTone
}

export function Metric({ label, value, hint, tone = 'default' }: MetricProps) {
  return (
    <div className={`metric-card metric-card--${tone}`}>
      <div className="metric-card__glow" />
      <span className="metric-card__label">{label}</span>
      <strong className="metric-card__value">{value}</strong>
      {hint ? <small className="metric-card__hint">{hint}</small> : null}
    </div>
  )
}
