import type { ReactNode } from 'react'

type PageHeaderProps = {
  eyebrow: string
  title: string
  subtitle: string
  metricLabel?: string
  metricValue?: string
  status?: ReactNode
}

export function PageHeader({ eyebrow, title, subtitle, metricLabel, metricValue, status }: PageHeaderProps) {
  return (
    <section className="page-header">
      <div className="page-header__copy">
        <div className="page-header__eyebrow">
          <span className="page-header__sparkle">+</span>
          {eyebrow}
          {status ? <span className="page-header__status">{status}</span> : null}
        </div>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
      {metricLabel && metricValue ? (
        <div className="page-header__metric page-header__metric--gold-surface">
          <span>{metricLabel}</span>
          <strong>{metricValue}</strong>
          <div className="page-header__progress">
            <div className="page-header__progress-bar" />
          </div>
        </div>
      ) : null}
    </section>
  )
}
