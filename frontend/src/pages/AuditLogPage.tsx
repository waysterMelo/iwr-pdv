import { useEffect, useState, type FormEvent } from 'react'
import { Activity, Ban, Clock3, KeyRound } from 'lucide-react'
import { PageHeader } from '../components/PageHeader'
import { Metric } from '../components/Metric'
import { PaginationControls } from '../components/PaginationControls'
import { getAuditLogs } from '../services/auditService'
import type { AuditAction, AuditFilters, AuditLog, AuditLogPage as AuditLogPageData } from '../types/audit'
import { getErrorMessage } from '../utils/errors'
import { formatDateTime } from '../utils/formatters'

const auditActions: AuditAction[] = [
  'LOGIN_SUCCESS',
  'LOGIN_FAILED',
  'LOGOUT',
  'ACCESS_DENIED',
  'USER_CREATED',
  'USER_UPDATED',
  'USER_PASSWORD_CHANGED',
  'CASH_REGISTER_OPENED',
  'CASH_REGISTER_CLOSED',
  'CASH_MOVEMENT_CREATED',
  'PRODUCT_CREATED',
  'PRODUCT_UPDATED',
  'PRODUCT_PRICE_CHANGED',
  'PRODUCT_STOCK_CHANGED',
  'SALE_CANCELLED',
  'PROMISSORY_NOTE_PAID',
]

function actionLabel(action: AuditAction) {
  const labels: Record<AuditAction, string> = {
    LOGIN_SUCCESS: 'Login realizado',
    LOGIN_FAILED: 'Login invalido',
    LOGOUT: 'Logout realizado',
    ACCESS_DENIED: 'Acesso negado',
    USER_CREATED: 'Usuario criado',
    USER_UPDATED: 'Usuario alterado',
    USER_PASSWORD_CHANGED: 'Senha alterada',
    CASH_REGISTER_OPENED: 'Caixa aberto',
    CASH_REGISTER_CLOSED: 'Caixa fechado',
    CASH_MOVEMENT_CREATED: 'Movimento de caixa',
    PRODUCT_CREATED: 'Produto criado',
    PRODUCT_UPDATED: 'Produto alterado',
    PRODUCT_PRICE_CHANGED: 'Preco alterado',
    PRODUCT_STOCK_CHANGED: 'Estoque alterado',
    SALE_CANCELLED: 'Venda cancelada',
    PROMISSORY_NOTE_PAID: 'Promissoria baixada',
  }

  return labels[action] ?? action
}

function actionTone(action: AuditAction) {
  if (action === 'ACCESS_DENIED' || action === 'LOGIN_FAILED' || action === 'SALE_CANCELLED') {
    return 'danger'
  }

  if (action.includes('CREATED') || action === 'LOGIN_SUCCESS' || action === 'PROMISSORY_NOTE_PAID') {
    return 'success'
  }

  if (action.includes('CHANGED') || action.includes('UPDATED') || action.includes('CASH')) {
    return 'warning'
  }

  return 'default'
}

function entityLabel(entityType?: string | null) {
  const labels: Record<string, string> = {
    AUTH: 'Acesso',
    CASH_MOVEMENT: 'Movimento',
    CASH_REGISTER: 'Caixa',
    PRODUCT: 'Produto',
    PROMISSORY_NOTE: 'Promissoria',
    SALE: 'Venda',
    USER: 'Usuario',
  }

  return entityType ? labels[entityType] ?? entityType : 'Sistema'
}

function entityReference(log: AuditLog) {
  const label = entityLabel(log.entityType)
  return log.entityId ? `${label} #${log.entityId}` : label
}

function latestEventHint(logs: AuditLog[] = []) {
  if (logs.length === 0) {
    return 'Nenhum evento no periodo selecionado'
  }

  return `Ultimo evento: ${formatDateTime(logs[0].occurredAt)}`
}

function uniqueUserCount(logs: AuditLog[] = []) {
  return new Set(logs.map((log) => log.username).filter(Boolean)).size
}

export function AuditLogPage() {
  const pageSize = 10
  const [auditPage, setAuditPage] = useState<AuditLogPageData>({
    content: [],
    page: 0,
    size: pageSize,
    totalElements: 0,
    totalPages: 0,
    first: true,
    last: true,
  })
  const [filters, setFilters] = useState<AuditFilters>({})
  const [page, setPage] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const logs = Array.isArray(auditPage.content) ? auditPage.content : []

  async function loadLogs(nextFilters = filters, nextPage = page) {
    setIsLoading(true)

    try {
      setAuditPage(await getAuditLogs(nextFilters, nextPage, pageSize))
      setErrorMessage(null)
    } catch (error) {
      setErrorMessage(getErrorMessage(error, 'Nao foi possivel carregar a auditoria.'))
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void loadLogs({}, 0)
  }, [])

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPage(0)
    void loadLogs(filters, 0)
  }

  function clearFilters() {
    const nextFilters: AuditFilters = {}
    setFilters(nextFilters)
    setPage(0)
    void loadLogs(nextFilters, 0)
  }

  function handlePageChange(nextPage: number) {
    setPage(nextPage)
    void loadLogs(filters, nextPage)
  }

  return (
    <main className="app-shell">
      <div className="app-container">
        <PageHeader
          eyebrow="Admin"
          title="Auditoria do sistema"
          subtitle="Consulte acessos, operacoes de caixa, alteracoes de produtos, usuarios e eventos bloqueados."
          metricLabel="Eventos"
          metricValue={String(auditPage.totalElements)}
          status="Somente ADMIN"
        />

        <div className="metric-grid metric-grid--4 audit-metric-grid">
          <Metric
            label="Eventos no filtro"
            value={String(auditPage.totalElements)}
            hint={latestEventHint(logs)}
            tone="gold"
            icon={Activity}
          />
          <Metric
            label="Usuarios envolvidos"
            value={String(uniqueUserCount(logs))}
            hint="Usuarios distintos nesta pagina"
            icon={Clock3}
          />
          <Metric
            label="Acessos bloqueados"
            value={String(logs.filter((log) => log.action === 'ACCESS_DENIED').length)}
            hint="Tentativas barradas nesta pagina"
            tone="danger"
            icon={Ban}
          />
          <Metric
            label="Logins invalidos"
            value={String(logs.filter((log) => log.action === 'LOGIN_FAILED').length)}
            hint="Falhas nesta pagina"
            tone="warning"
            icon={KeyRound}
          />
        </div>

        <section className="product-list-panel">
          <form className="inventory-toolbar" onSubmit={handleSubmit}>
            <div className="field-group">
              <label htmlFor="auditStartDate">Inicio</label>
              <input
                id="auditStartDate"
                type="date"
                value={filters.startDate ?? ''}
                onChange={(event) => setFilters((current) => ({ ...current, startDate: event.target.value }))}
              />
            </div>
            <div className="field-group">
              <label htmlFor="auditEndDate">Fim</label>
              <input
                id="auditEndDate"
                type="date"
                value={filters.endDate ?? ''}
                onChange={(event) => setFilters((current) => ({ ...current, endDate: event.target.value }))}
              />
            </div>
            <div className="field-group">
              <label htmlFor="auditUsername">Usuario</label>
              <input
                id="auditUsername"
                value={filters.username ?? ''}
                onChange={(event) => setFilters((current) => ({ ...current, username: event.target.value }))}
                placeholder="admin"
              />
            </div>
            <div className="field-group">
              <label htmlFor="auditAction">Acao</label>
              <select
                id="auditAction"
                value={filters.action ?? ''}
                onChange={(event) => setFilters((current) => ({ ...current, action: event.target.value as AuditAction | '' }))}
              >
                <option value="">Todas</option>
                {auditActions.map((action) => (
                  <option value={action} key={action}>
                    {actionLabel(action)}
                  </option>
                ))}
              </select>
            </div>
            <div className="field-group">
              <label htmlFor="auditEntity">Entidade</label>
              <input
                id="auditEntity"
                value={filters.entityType ?? ''}
                onChange={(event) => setFilters((current) => ({ ...current, entityType: event.target.value }))}
                placeholder="PRODUCT"
              />
            </div>
            <button className="action-button" type="submit" disabled={isLoading}>
              Filtrar
            </button>
            <button className="secondary-button" type="button" onClick={clearFilters} disabled={isLoading}>
              Limpar
            </button>
          </form>

          {errorMessage ? <div className="feedback-message feedback-message--error">{errorMessage}</div> : null}

          <div className="audit-log-list">
            {isLoading ? (
              <div className="product-empty">Carregando auditoria...</div>
            ) : logs.length === 0 ? (
              <div className="product-empty">Nenhum evento encontrado.</div>
            ) : (
              logs.map((log) => (
                <article className="audit-log-row" key={log.id}>
                  <time className="audit-log-row__time" dateTime={log.occurredAt}>
                    {formatDateTime(log.occurredAt)}
                  </time>
                  <div className="audit-log-row__main">
                    <div className="audit-log-row__title">
                      <span className={`audit-action-chip audit-action-chip--${actionTone(log.action)}`}>
                        {actionLabel(log.action)}
                      </span>
                      <span className="audit-log-row__entity">{entityReference(log)}</span>
                    </div>
                    {log.details ? (
                      <p className="audit-log-row__details" title={log.details}>
                        {log.details}
                      </p>
                    ) : null}
                  </div>
                  <div className="audit-log-row__user" title={log.username ?? 'Sistema'}>
                    {log.username ?? 'Sistema'}
                  </div>
                </article>
              ))
            )}
          </div>

          <PaginationControls
            itemLabel="eventos"
            page={auditPage.page}
            pageSize={auditPage.size}
            totalItems={auditPage.totalElements}
            totalPages={auditPage.totalPages}
            onPageChange={handlePageChange}
          />
        </section>
      </div>
    </main>
  )
}
