import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Banknote, CreditCard, Landmark, ReceiptText, TrendingUp, Wallet } from 'lucide-react'
import {
  addCashMovement,
  closeCashRegister,
  getCurrentCashRegister,
  openCashRegister,
} from '../services/cashRegisterService'
import type { CashMovementType, CashRegister } from '../types/cashRegister'
import { getErrorMessage } from '../utils/errors'
import { formatCurrency, formatNullableDateTime } from '../utils/formatters'
import { CurrencyInput } from '../components/CurrencyInput'
import { Metric } from '../components/Metric'
import { PageHeader } from '../components/PageHeader'
import { useAppMessage } from '../hooks/useAppMessage'

export function CashRegisterPage() {
  const { notify } = useAppMessage()
  const [cashRegister, setCashRegister] = useState<CashRegister | null>(null)
  const [openingAmount, setOpeningAmount] = useState('0.00')
  const [movementType, setMovementType] = useState<CashMovementType>('CASH_IN')
  const [movementAmount, setMovementAmount] = useState('')
  const [movementReason, setMovementReason] = useState('')
  const [declaredCashAmount, setDeclaredCashAmount] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [messageType, setMessageType] = useState<'success' | 'error'>('success')
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const showMessage = useCallback((nextMessage: string, nextType: 'success' | 'error') => {
    setMessage(nextMessage)
    setMessageType(nextType)
    notify({
      type: nextType,
      title: nextType === 'success' ? 'Caixa atualizado' : 'Nao foi possivel atualizar o caixa',
      message: nextMessage,
    })
  }, [notify])

  const loadCashRegister = useCallback(async () => {
    setIsLoading(true)

    try {
      setCashRegister(await getCurrentCashRegister())
    } catch (error) {
      showMessage(getErrorMessage(error, 'Nao foi possivel carregar o caixa.'), 'error')
    } finally {
      setIsLoading(false)
    }
  }, [showMessage])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadCashRegister()
    }, 0)

    return () => window.clearTimeout(timeoutId)
  }, [loadCashRegister])

  async function handleOpen(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsSubmitting(true)

    try {
      const response = await openCashRegister(Number(openingAmount))
      setCashRegister(response)
      showMessage('Caixa aberto com sucesso.', 'success')
    } catch (error) {
      showMessage(getErrorMessage(error, 'Nao foi possivel abrir o caixa.'), 'error')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleMovement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!movementReason.trim()) {
      showMessage('Informe o motivo da movimentacao.', 'error')
      return
    }

    setIsSubmitting(true)

    try {
      const response = await addCashMovement(movementType, Number(movementAmount), movementReason.trim())
      setCashRegister(response)
      setMovementAmount('')
      setMovementReason('')
      showMessage('Movimentacao registrada.', 'success')
    } catch (error) {
      showMessage(getErrorMessage(error, 'Nao foi possivel registrar a movimentacao.'), 'error')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleClose(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!cashRegister) {
      return
    }

    setIsSubmitting(true)

    try {
      const response = await closeCashRegister(cashRegister.id, Number(declaredCashAmount))
      setCashRegister(response)
      showMessage('Caixa fechado com sucesso.', 'success')
    } catch (error) {
      showMessage(getErrorMessage(error, 'Nao foi possivel fechar o caixa.'), 'error')
    } finally {
      setIsSubmitting(false)
    }
  }

  const totals = cashRegister?.totalsByPaymentMethod ?? {}
  const declaredCashNumber = Number(declaredCashAmount) || 0
  const closingDifference = cashRegister ? declaredCashNumber - cashRegister.expectedCashAmount : 0

  return (
    <main className="app-shell">
      <div className="app-container history-container">
        <PageHeader
          eyebrow="Caixa diario"
          title="Abertura e fechamento de caixa"
          subtitle="Abra o caixa antes de vender, registre sangrias ou suprimentos e feche comparando o dinheiro esperado com o valor contado."
          metricLabel="Status do caixa"
          metricValue={isLoading ? '...' : cashRegister?.status === 'OPEN' ? 'Aberto' : 'Fechado'}
          status={cashRegister?.status === 'OPEN' ? `Desde ${formatNullableDateTime(cashRegister.openedAt)}` : undefined}
        />

        {cashRegister?.status === 'OPEN' ? (
          <div className="quick-actions">
            <button
              className="quick-action quick-action--soft quick-action--movement"
              type="button"
              onClick={() => document.getElementById('movementAmount')?.focus()}
            >
              Registrar sangria
            </button>
            <button className="quick-action quick-action--ghost quick-action--print" type="button" onClick={() => window.print()}>
              Imprimir resumo
            </button>
            <button
              className="quick-action quick-action--primary quick-action--close-cash"
              type="button"
              onClick={() => document.getElementById('declaredCashAmount')?.focus()}
            >
              Fechar caixa
            </button>
          </div>
        ) : null}

        {message ? (
          <div
            className={`feedback-message ${
              messageType === 'success' ? 'feedback-message--success' : 'feedback-message--error'
            }`}
          >
            {message}
          </div>
        ) : null}

        {!cashRegister || cashRegister.status === 'CLOSED' ? (
          <section className="scanner-panel">
            <header className="section-header">
              <div>
                <h2>Abrir caixa</h2>
                <p>Informe o dinheiro inicial disponivel para troco.</p>
              </div>
            </header>
            <form className="scanner-form" onSubmit={handleOpen}>
              <div className="field-group">
                <label htmlFor="openingAmount">Saldo na gaveta (dinheiro)</label>
                <CurrencyInput
                  id="openingAmount"
                  value={openingAmount}
                  onChange={setOpeningAmount}
                  placeholder="R$ 0,00"
                />
              </div>
              <button className="action-button" type="submit" disabled={isSubmitting}>
                Abrir caixa
              </button>
            </form>
          </section>
        ) : (
          <>
            <div className="metric-grid metric-grid--3">
              <Metric label="Total vendido" value={formatCurrency(cashRegister.totalSalesAmount)} hint={`${Object.values(totals).filter(v => v > 0).length} forma(s) de pagamento`} tone="gold" icon={ReceiptText} />
              <Metric label="Dinheiro esperado" value={formatCurrency(cashRegister.expectedCashAmount)} hint="Inclui suprimentos" icon={Wallet} />
              <Metric label="Saldo de movimentacoes" value={formatCurrency(cashRegister.cashInAmount - cashRegister.cashOutAmount)} hint={`${cashRegister.movements.length} movimentacao(es)`} icon={TrendingUp} />
            </div>

            <div className="history-grid">
              <section className="scanner-panel">
                <header className="section-header">
                  <div>
                    <h2>Resumo por pagamento</h2>
                    <p>Totais considerados apenas para vendas concluidas.</p>
                  </div>
                </header>
                <div className="product-card-grid">
                  <div>
                    <span><Banknote size={14} strokeWidth={2.3} aria-hidden="true" />Dinheiro</span>
                    <strong>{formatCurrency(totals.CASH)}</strong>
                  </div>
                  <div>
                    <span><Landmark size={14} strokeWidth={2.3} aria-hidden="true" />Pix</span>
                    <strong>{formatCurrency(totals.PIX)}</strong>
                  </div>
                  <div>
                    <span><CreditCard size={14} strokeWidth={2.3} aria-hidden="true" />Debito</span>
                    <strong>{formatCurrency(totals.DEBIT_CARD)}</strong>
                  </div>
                  <div>
                    <span><CreditCard size={14} strokeWidth={2.3} aria-hidden="true" />Credito</span>
                    <strong>{formatCurrency(totals.CREDIT_CARD)}</strong>
                  </div>
                </div>

                <form className="product-form" onSubmit={handleMovement}>
                  <div className="form-grid">
                    <div className="field-group">
                      <label htmlFor="movementType">Tipo</label>
                      <select
                        id="movementType"
                        value={movementType}
                        onChange={(event) => setMovementType(event.target.value as CashMovementType)}
                      >
                        <option value="CASH_IN">Suprimento</option>
                        <option value="CASH_OUT">Sangria</option>
                      </select>
                    </div>
                    <div className="field-group">
                      <label htmlFor="movementAmount">Valor</label>
                      <CurrencyInput
                        id="movementAmount"
                        value={movementAmount}
                        onChange={setMovementAmount}
                        placeholder="R$ 0,00"
                      />
                    </div>
                    <div className="field-group field-group--full">
                      <label htmlFor="movementReason">Motivo</label>
                      <input
                        id="movementReason"
                        value={movementReason}
                        onChange={(event) => setMovementReason(event.target.value)}
                        placeholder="Ex.: Sangria para cofre"
                      />
                    </div>
                  </div>
                  <button className="secondary-button" type="submit" disabled={isSubmitting}>
                    Registrar movimentacao
                  </button>
                </form>
              </section>

              <section className="cart-panel">
                <header className="section-header">
                  <div>
                    <h2>Fechamento</h2>
                    <p>Conte o dinheiro fisico e informe o valor declarado.</p>
                  </div>
                </header>
                <form className="scanner-form" onSubmit={handleClose}>
                  <div className="cash-closing-layout">
                    <div className="field-group">
                      <label htmlFor="declaredCashAmount">Dinheiro contado</label>
                      <CurrencyInput
                        id="declaredCashAmount"
                        value={declaredCashAmount}
                        onChange={setDeclaredCashAmount}
                        placeholder="R$ 0,00"
                      />
                    </div>
                    <div className="cash-difference-card">
                      <span>Diferenca</span>
                      <strong>{formatCurrency(closingDifference)}</strong>
                    </div>
                  </div>
                  <button className="action-button" type="submit" disabled={isSubmitting}>
                    Fechar caixa
                  </button>
                </form>

                <div className="sale-history-list">
                  {cashRegister.movements.length === 0 ? (
                    <div className="product-empty">Nenhuma sangria ou suprimento registrado.</div>
                  ) : (
                    cashRegister.movements.map((movement) => (
                      <article className="sale-history-item" key={movement.id}>
                        <span>{movement.type === 'CASH_IN' ? 'Suprimento' : 'Sangria'}</span>
                        <strong>{formatCurrency(movement.amount)}</strong>
                        <small>{movement.reason} - {formatNullableDateTime(movement.createdAt)}</small>
                      </article>
                    ))
                  )}
                </div>
              </section>
            </div>
          </>
        )}
      </div>
    </main>
  )
}
