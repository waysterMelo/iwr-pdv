import type { HealthStatus } from '../types/health'

type HealthStatusCardProps = {
  health: HealthStatus | null
  errorMessage: string | null
  isLoading: boolean
  onRefresh: () => void
}

const STATUS_DESCRIPTION: Record<string, string> = {
  UP: 'Aplicacao e banco disponiveis para operacao.',
  DOWN: 'Servico indisponivel no momento.',
  DEGRADED: 'Aplicacao no ar, mas a dependencia de banco precisa de atencao.',
}

function getBadgeClassName(status: string) {
  if (status === 'UP') {
    return 'status-badge status-badge--up'
  }

  if (status === 'DEGRADED') {
    return 'status-badge status-badge--degraded'
  }

  if (status === 'DOWN') {
    return 'status-badge status-badge--down'
  }

  return 'status-badge status-badge--loading'
}

function formatDate(value: string | null) {
  if (!value) {
    return 'Ainda nao consultado'
  }

  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'medium',
  }).format(new Date(value))
}

export function HealthStatusCard({
  health,
  errorMessage,
  isLoading,
  onRefresh,
}: HealthStatusCardProps) {
  const applicationStatus = health?.status ?? (isLoading ? 'LOADING' : 'DOWN')
  const databaseStatus = health?.database ?? 'DOWN'
  const message = errorMessage
    ? errorMessage
    : STATUS_DESCRIPTION[applicationStatus] ?? 'Carregando o status do backend.'

  return (
    <section className="status-panel">
      <div className="status-card">
        <header className="status-card-header">
          <div>
            <h2>Status do sistema</h2>
            <p>Esta tela consulta o endpoint `/health` para validar a disponibilidade da aplicacao.</p>
          </div>
          <div className="status-badges">
            <span className={getBadgeClassName(applicationStatus)}>
              Aplicacao {applicationStatus}
            </span>
            <span className={getBadgeClassName(databaseStatus)}>Banco {databaseStatus}</span>
          </div>
        </header>

        <div className="status-card-grid">
          <div className="status-detail">
            <span>Servico</span>
            <strong>{health?.application ?? 'iwr-pdv-backend'}</strong>
          </div>
          <div className="status-detail">
            <span>Ultima checagem</span>
            <strong>{formatDate(health?.checkedAt ?? null)}</strong>
          </div>
          <div className="status-detail">
            <span>Observacao</span>
            <strong>{applicationStatus === 'UP' ? 'Pronto para operacao' : 'Requer ajuste de ambiente'}</strong>
          </div>
        </div>

        <p className="status-message">{message}</p>

        <div className="status-actions">
          <span className="status-meta">
            Use `docker compose up -d` na raiz e rode o backend na porta `8080`.
          </span>
          <button className="action-button" type="button" onClick={onRefresh} disabled={isLoading}>
            {isLoading ? 'Atualizando...' : 'Atualizar status'}
          </button>
        </div>
      </div>
    </section>
  )
}
