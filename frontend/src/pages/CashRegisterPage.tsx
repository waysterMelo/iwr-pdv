import { useCallback, useEffect, useState, type FormEvent } from 'react'
import {
  addCashMovement,
  closeCashRegister,
  getCurrentCashRegister,
  openCashRegister,
} from '../services/cashRegisterService'
import type { CashMovementType, CashRegister } from '../types/cashRegister'

function formatCurrency(value: number | null | undefined) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value ?? 0)
}

function formatDate(value: string | null) {
  if (!value) {
    return '-'
  }

  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value))
}

export function CashRegisterPage() {
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

  const loadCashRegister = useCallback(async () => {
    setIsLoading(true)

    try {
      setCashRegister(await getCurrentCashRegister())
    } catch (error) {
      showMessage(error instanceof Error ? error.message : 'Nao foi possivel carregar o caixa.', 'error')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadCashRegister()
    }, 0)

    return () => window.clearTimeout(timeoutId)
  }, [loadCashRegister])

  function showMessage(nextMessage: string, nextType: 'success' | 'error') {
    setMessage(nextMessage)
    setMessageType(nextType)
  }

  async function handleOpen(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsSubmitting(true)

    try {
      const response = await openCashRegister(Number(openingAmount))
      setCashRegister(response)
      showMessage('Caixa aberto com sucesso.', 'success')
    } catch (error) {
      showMessage(error instanceof Error ? error.message : 'Nao foi possivel abrir o caixa.', 'error')
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
      showMessage(error instanceof Error ? error.message : 'Nao foi possivel registrar a movimentacao.', 'error')
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
      showMessage(error instanceof Error ? error.message : 'Nao foi possivel fechar o caixa.', 'error')
    } finally {
      setIsSubmitting(false)
    }
  }

  const totals = cashRegister?.totalsByPaymentMethod ?? {}

  return (
    <main className="app-shell">
      <div className="app-container history-container">
        <section className="checkout-hero-panel">
          <div>
            <span className="eyebrow">Caixa diario</span>
            <h1>Abertura e fechamento de caixa</h1>
            <p>
              Abra o caixa antes de vender, registre sangrias ou suprimentos e feche
              comparando o dinheiro esperado com o valor contado.
            </p>
          </div>
          <div className="checkout-summary">
            <span>Status do caixa</span>
            <strong>{isLoading ? '...' : cashRegister?.status === 'OPEN' ? 'Aberto' : 'Fechado'}</strong>
            <small>{cashRegister ? `Aberto em ${formatDate(cashRegister.openedAt)}` : 'Nenhum caixa aberto'}</small>
          </div>
        </section>

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
                <label htmlFor="openingAmount">Saldo inicial</label>
                <input
                  id="openingAmount"
                  inputMode="decimal"
                  value={openingAmount}
                  onChange={(event) => setOpeningAmount(event.target.value)}
                />
              </div>
              <button className="action-button" type="submit" disabled={isSubmitting}>
                Abrir caixa
              </button>
            </form>
          </section>
        ) : (
          <>
            <section className="stats-grid">
              <article className="stat-card">
                <strong>{formatCurrency(cashRegister.totalSalesAmount)}</strong>
                <span>total vendido</span>
              </article>
              <article className="stat-card">
                <strong>{formatCurrency(cashRegister.expectedCashAmount)}</strong>
                <span>dinheiro esperado</span>
              </article>
              <article className="stat-card">
                <strong>{formatCurrency(cashRegister.cashInAmount - cashRegister.cashOutAmount)}</strong>
                <span>saldo de movimentacoes</span>
              </article>
            </section>

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
                    <span>Dinheiro</span>
                    <strong>{formatCurrency(totals.CASH)}</strong>
                  </div>
                  <div>
                    <span>Pix</span>
                    <strong>{formatCurrency(totals.PIX)}</strong>
                  </div>
                  <div>
                    <span>Debito</span>
                    <strong>{formatCurrency(totals.DEBIT_CARD)}</strong>
                  </div>
                  <div>
                    <span>Credito</span>
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
                      <input
                        id="movementAmount"
                        inputMode="decimal"
                        value={movementAmount}
                        onChange={(event) => setMovementAmount(event.target.value)}
                        placeholder="0.00"
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
                  <div className="field-group">
                    <label htmlFor="declaredCashAmount">Dinheiro contado</label>
                    <input
                      id="declaredCashAmount"
                      inputMode="decimal"
                      value={declaredCashAmount}
                      onChange={(event) => setDeclaredCashAmount(event.target.value)}
                      placeholder="0.00"
                    />
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
                        <small>{movement.reason} - {formatDate(movement.createdAt)}</small>
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
