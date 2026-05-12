import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { BadgeDollarSign, FileDown, RotateCcw, Wallet } from 'lucide-react'
import { Metric } from '../components/Metric'
import { PageHeader } from '../components/PageHeader'
import { PaginationControls } from '../components/PaginationControls'
import {
  downloadCashRegisterReport,
  getCashRegisterPage,
  reopenCashRegister,
} from '../services/cashRegisterService'
import { getUsers } from '../services/authService'
import type { ManagedUser } from '../types/auth'
import type { CashRegister, CashRegisterFilters, CashRegisterPage } from '../types/cashRegister'
import { getErrorMessage } from '../utils/errors'
import { formatCurrency, formatNullableDateTime } from '../utils/formatters'
import { useAppMessage } from '../hooks/useAppMessage'

const pageSize = 8

function buildEmptyPage(): CashRegisterPage {
  return {
    content: [],
    page: 0,
    size: pageSize,
    totalElements: 0,
    totalPages: 0,
    first: true,
    last: true,
  }
}

function statusLabel(status: CashRegister['status']) {
  return status === 'OPEN' ? 'Aberto' : 'Fechado'
}

function statusClassName(status: CashRegister['status']) {
  return status === 'OPEN' ? 'cash-history-status cash-history-status--open' : 'cash-history-status'
}

function paymentTotal(cashRegister: CashRegister, paymentMethod: string) {
  return cashRegister.totalsByPaymentMethod[paymentMethod] ?? 0
}

function paymentLabel(paymentMethod: string) {
  const labels: Record<string, string> = {
    CASH: 'Dinheiro',
    PIX: 'Pix',
    DEBIT_CARD: 'Debito',
    CREDIT_CARD: 'Credito',
    PROMISSORY_NOTE: 'Promissoria',
  }

  return labels[paymentMethod] ?? paymentMethod
}

export function CashRegisterHistoryPage() {
  const { confirm, notify } = useAppMessage()
  const [cashPage, setCashPage] = useState<CashRegisterPage>(() => buildEmptyPage())
  const [filters, setFilters] = useState<CashRegisterFilters>({})
  const [page, setPage] = useState(0)
  const [selectedCashRegister, setSelectedCashRegister] = useState<CashRegister | null>(null)
  const [operators, setOperators] = useState<ManagedUser[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isReopening, setIsReopening] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const loadCashRegisters = useCallback(async (nextFilters = filters, nextPage = page) => {
    setIsLoading(true)

    try {
      const response = await getCashRegisterPage(nextFilters, nextPage, pageSize)
      setCashPage(response)
      setSelectedCashRegister((current) => {
        if (current && response.content.some((cashRegister) => cashRegister.id === current.id)) {
          return response.content.find((cashRegister) => cashRegister.id === current.id) ?? current
        }

        return response.content[0] ?? null
      })
      setErrorMessage(null)
    } catch (error) {
      setErrorMessage(getErrorMessage(error, 'Nao foi possivel carregar o historico de caixas.'))
    } finally {
      setIsLoading(false)
    }
  }, [filters, page])

  useEffect(() => {
    void loadCashRegisters({}, 0)
  }, [])

  useEffect(() => {
    async function loadOperators() {
      try {
        setOperators(await getUsers())
      } catch {
        setOperators([])
      }
    }

    void loadOperators()
  }, [])

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPage(0)
    void loadCashRegisters(filters, 0)
  }

  function clearFilters() {
    const nextFilters: CashRegisterFilters = {}
    setFilters(nextFilters)
    setPage(0)
    void loadCashRegisters(nextFilters, 0)
  }

  async function handleDownloadReport(cashRegister: CashRegister) {
    try {
      await downloadCashRegisterReport(cashRegister.id)
    } catch (error) {
      notify({
        type: 'error',
        title: 'Relatorio indisponivel',
        message: getErrorMessage(error, 'Nao foi possivel baixar o relatorio.'),
      })
    }
  }

  async function handleReopen(cashRegister: CashRegister) {
    const reason = window.prompt(`Motivo para reabrir o caixa #${cashRegister.id}:`)
    if (!reason?.trim()) return

    const confirmed = await confirm({
      type: 'warning',
      title: 'Reabrir caixa?',
      message: 'A reabertura sera registrada na auditoria com usuario, data e motivo.',
      confirmLabel: 'Reabrir',
      cancelLabel: 'Voltar',
    })
    if (!confirmed) return

    setIsReopening(true)
    try {
      const reopened = await reopenCashRegister(cashRegister.id, reason.trim())
      setSelectedCashRegister(reopened)
      await loadCashRegisters(filters, page)
      notify({
        type: 'success',
        title: 'Caixa reaberto',
        message: `Caixa #${cashRegister.id} reaberto para correcao.`,
      })
    } catch (error) {
      notify({
        type: 'error',
        title: 'Nao foi possivel reabrir',
        message: getErrorMessage(error, 'Verifique se nao existe outro caixa aberto.'),
      })
    } finally {
      setIsReopening(false)
    }
  }

  const closedRegisters = cashPage.content.filter((cashRegister) => cashRegister.status === 'CLOSED').length
  const registersWithDifference = cashPage.content.filter((cashRegister) => cashRegister.cashDifference && cashRegister.cashDifference !== 0).length
  const totalSalesAmount = cashPage.content.reduce((sum, cashRegister) => sum + cashRegister.totalSalesAmount, 0)

  return (
    <main className="app-shell">
      <div className="app-container history-container">
        <PageHeader
          eyebrow="Admin"
          title="Historico de caixas"
          subtitle="Consulte caixas por periodo, confira diferencas, baixe relatorios e reabra caixas quando necessario."
          metricLabel="Caixas"
          metricValue={String(cashPage.totalElements)}
          status="Operacao"
        />

        <div className="metric-grid metric-grid--3">
          <Metric label="Vendido na pagina" value={formatCurrency(totalSalesAmount)} tone="gold" icon={BadgeDollarSign} />
          <Metric label="Fechados na pagina" value={String(closedRegisters)} icon={Wallet} />
          <Metric label="Com diferenca" value={String(registersWithDifference)} tone={registersWithDifference > 0 ? 'warning' : 'default'} icon={RotateCcw} />
        </div>

        <section className="scanner-panel cash-history-filter-panel">
          <form className="history-filter-form" onSubmit={handleSubmit}>
            <div className="field-group">
              <label htmlFor="cashOpenedStart">Abertura inicio</label>
              <input
                id="cashOpenedStart"
                type="date"
                value={filters.openedStartDate ?? ''}
                onChange={(event) => setFilters((current) => ({ ...current, openedStartDate: event.target.value }))}
              />
            </div>
            <div className="field-group">
              <label htmlFor="cashOpenedEnd">Abertura fim</label>
              <input
                id="cashOpenedEnd"
                type="date"
                value={filters.openedEndDate ?? ''}
                onChange={(event) => setFilters((current) => ({ ...current, openedEndDate: event.target.value }))}
              />
            </div>
            <div className="field-group">
              <label htmlFor="cashStatus">Status</label>
              <select
                id="cashStatus"
                value={filters.status ?? ''}
                onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value as CashRegisterFilters['status'] }))}
              >
                <option value="">Todos</option>
                <option value="OPEN">Abertos</option>
                <option value="CLOSED">Fechados</option>
              </select>
            </div>
            <div className="field-group">
              <label htmlFor="cashClosedStart">Fechamento inicio</label>
              <input
                id="cashClosedStart"
                type="date"
                value={filters.closedStartDate ?? ''}
                onChange={(event) => setFilters((current) => ({ ...current, closedStartDate: event.target.value }))}
              />
            </div>
            <div className="field-group">
              <label htmlFor="cashClosedEnd">Fechamento fim</label>
              <input
                id="cashClosedEnd"
                type="date"
                value={filters.closedEndDate ?? ''}
                onChange={(event) => setFilters((current) => ({ ...current, closedEndDate: event.target.value }))}
              />
            </div>
            <div className="field-group">
              <label htmlFor="cashOperator">Operador</label>
              <select
                id="cashOperator"
                value={filters.operatorId ?? ''}
                onChange={(event) => setFilters((current) => ({
                  ...current,
                  operatorId: event.target.value ? Number(event.target.value) : undefined,
                }))}
              >
                <option value="">Todos</option>
                {operators.map((operator) => (
                  <option value={operator.id} key={operator.id}>{operator.displayName}</option>
                ))}
              </select>
            </div>
            <label className="checkbox-field cash-history-checkbox">
              <input
                type="checkbox"
                checked={Boolean(filters.withDifference)}
                onChange={(event) => setFilters((current) => ({ ...current, withDifference: event.target.checked }))}
              />
              Com diferenca
            </label>
            <button className="action-button" type="submit" disabled={isLoading}>Filtrar</button>
            <button className="secondary-button" type="button" onClick={clearFilters} disabled={isLoading}>Limpar</button>
          </form>

          {errorMessage ? <div className="feedback-message feedback-message--error">{errorMessage}</div> : null}
        </section>

        <div className="history-grid cash-history-grid">
          <section className="cart-panel cash-history-list-panel">
            <header className="section-header">
              <div>
                <h2>Caixas</h2>
                <p>Selecione um caixa para revisar o fechamento.</p>
              </div>
            </header>

            {isLoading ? (
              <div className="product-empty">Carregando caixas...</div>
            ) : cashPage.content.length === 0 ? (
              <div className="product-empty">Nenhum caixa encontrado.</div>
            ) : (
              <div className="sale-history-list cash-history-list">
                {cashPage.content.map((cashRegister) => (
                  <button
                    className={
                      selectedCashRegister?.id === cashRegister.id
                        ? 'sale-history-item sale-history-item--active cash-history-row cash-history-row--active'
                        : 'sale-history-item cash-history-row'
                    }
                    type="button"
                    key={cashRegister.id}
                    onClick={() => setSelectedCashRegister(cashRegister)}
                  >
                    <span>
                      Caixa #{cashRegister.id}
                      <em className={statusClassName(cashRegister.status)}>{statusLabel(cashRegister.status)}</em>
                    </span>
                    <strong>{formatCurrency(cashRegister.totalSalesAmount)}</strong>
                    <small>
                      {cashRegister.openedBy.displayName} - {formatNullableDateTime(cashRegister.openedAt)}
                    </small>
                  </button>
                ))}
                <PaginationControls
                  itemLabel="caixas"
                  page={cashPage.page}
                  pageSize={cashPage.size}
                  totalItems={cashPage.totalElements}
                  totalPages={cashPage.totalPages}
                  onPageChange={(nextPage) => {
                    setPage(nextPage)
                    void loadCashRegisters(filters, nextPage)
                  }}
                />
              </div>
            )}
          </section>

          <section className="cart-panel cash-history-detail-panel">
            <header className="section-header">
              <div>
                <h2>Detalhe do caixa</h2>
                <p>{selectedCashRegister ? `Caixa #${selectedCashRegister.id}` : 'Selecione um caixa.'}</p>
              </div>
              {selectedCashRegister ? (
                <div className="form-actions">
                  <button className="secondary-button" type="button" onClick={() => void handleDownloadReport(selectedCashRegister)}>
                    <FileDown size={14} strokeWidth={2.3} aria-hidden="true" />Relatorio
                  </button>
                  {selectedCashRegister.status === 'CLOSED' ? (
                    <button
                      className="secondary-button"
                      type="button"
                      disabled={isReopening}
                      onClick={() => void handleReopen(selectedCashRegister)}
                    >
                      {isReopening ? 'Reabrindo...' : 'Reabrir'}
                    </button>
                  ) : null}
                </div>
              ) : null}
            </header>

            {!selectedCashRegister ? (
              <div className="product-empty">Selecione um caixa para visualizar.</div>
            ) : (
              <div className="cart-list cash-history-detail">
                <article className="cart-item cash-history-summary-card">
                  <div className="cart-item-main">
                    <span className={statusClassName(selectedCashRegister.status)}>{statusLabel(selectedCashRegister.status)}</span>
                    <strong>Caixa #{selectedCashRegister.id}</strong>
                    <small>Abertura: {formatNullableDateTime(selectedCashRegister.openedAt)}</small>
                  </div>
                  <div className="cart-price">
                    <span>Total vendido</span>
                    <strong>{formatCurrency(selectedCashRegister.totalSalesAmount)}</strong>
                  </div>
                  <div className="cart-price">
                    <span>Diferenca</span>
                    <strong>{formatCurrency(selectedCashRegister.cashDifference ?? 0)}</strong>
                  </div>
                </article>

                <div className="cash-history-kpi-grid">
                  <div><span>Inicial</span><strong>{formatCurrency(selectedCashRegister.openingAmount)}</strong></div>
                  <div><span>Esperado</span><strong>{formatCurrency(selectedCashRegister.expectedCashAmount)}</strong></div>
                  <div><span>Declarado</span><strong>{formatCurrency(selectedCashRegister.declaredCashAmount ?? 0)}</strong></div>
                  <div><span>Suprimentos</span><strong>{formatCurrency(selectedCashRegister.cashInAmount)}</strong></div>
                  <div><span>Sangrias</span><strong>{formatCurrency(selectedCashRegister.cashOutAmount)}</strong></div>
                  <div><span>Fechado por</span><strong>{selectedCashRegister.closedBy?.displayName ?? '-'}</strong></div>
                </div>

                <section className="cash-history-payment-panel" aria-label="Resumo por pagamento">
                  <h3>Resumo por pagamento</h3>
                  <div className="cash-history-payment-grid">
                    <div><span>Dinheiro</span><strong>{formatCurrency(paymentTotal(selectedCashRegister, 'CASH'))}</strong></div>
                    <div><span>Pix</span><strong>{formatCurrency(paymentTotal(selectedCashRegister, 'PIX'))}</strong></div>
                    <div><span>Debito</span><strong>{formatCurrency(paymentTotal(selectedCashRegister, 'DEBIT_CARD'))}</strong></div>
                    <div><span>Credito</span><strong>{formatCurrency(paymentTotal(selectedCashRegister, 'CREDIT_CARD'))}</strong></div>
                    <div><span>Promissoria</span><strong>{formatCurrency(paymentTotal(selectedCashRegister, 'PROMISSORY_NOTE'))}</strong></div>
                  </div>
                </section>

                <section className="cash-history-sales-panel" aria-label="Vendas vinculadas ao caixa">
                  <div className="cash-history-subheader">
                    <h3>Vendas vinculadas</h3>
                    <span>{selectedCashRegister.sales.length} venda(s)</span>
                  </div>
                  {selectedCashRegister.sales.length === 0 ? (
                    <div className="product-empty">Nenhuma venda vinculada a este caixa.</div>
                  ) : (
                    <div className="cash-history-sales-list">
                      {selectedCashRegister.sales.map((sale) => (
                        <article className="cash-history-sale-row" key={sale.id}>
                          <div>
                            <span>Venda #{sale.id}</span>
                            <strong>{formatCurrency(sale.totalAmount)}</strong>
                          </div>
                          <small>
                            {paymentLabel(sale.paymentMethod)} - {sale.totalItems} item(ns) - {formatNullableDateTime(sale.soldAt)}
                          </small>
                        </article>
                      ))}
                    </div>
                  )}
                </section>

                <div className="cash-history-timeline">
                  <div>
                    <span>Abertura</span>
                    <strong>{formatNullableDateTime(selectedCashRegister.openedAt)}</strong>
                    <small>{selectedCashRegister.openedBy.displayName}</small>
                  </div>
                  <div>
                    <span>Fechamento</span>
                    <strong>{formatNullableDateTime(selectedCashRegister.closedAt)}</strong>
                    <small>{selectedCashRegister.closedBy?.displayName ?? '-'}</small>
                  </div>
                </div>

                {selectedCashRegister.closingDifferenceReason ? (
                  <div className="feedback-message feedback-message--warning">
                    Motivo da diferenca: {selectedCashRegister.closingDifferenceReason}
                  </div>
                ) : null}

                {selectedCashRegister.reopenReason ? (
                  <div className="feedback-message feedback-message--success">
                    Reaberto por {selectedCashRegister.reopenedBy?.displayName ?? '-'} em{' '}
                    {formatNullableDateTime(selectedCashRegister.reopenedAt)}. Motivo: {selectedCashRegister.reopenReason}
                  </div>
                ) : null}
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  )
}
