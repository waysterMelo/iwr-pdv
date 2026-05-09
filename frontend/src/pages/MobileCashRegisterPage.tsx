import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { useAppMessage } from '../hooks/useAppMessage'
import { CurrencyInput } from '../components/CurrencyInput'
import {
  addCashMovement,
  closeCashRegister,
  getCurrentCashRegister,
  openCashRegister,
} from '../services/cashRegisterService'
import type { CashMovementType, CashRegister } from '../types/cashRegister'
import { getErrorMessage } from '../utils/errors'
import { formatCurrency, formatNullableDateTime } from '../utils/formatters'

type MobileCashRegisterPageProps = {
  onBack: () => void
}

export function MobileCashRegisterPage({ onBack }: MobileCashRegisterPageProps) {
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
  const [view, setView] = useState<'status' | 'movement' | 'close'>('status')

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
      setView('status')
    } catch (error) {
      showMessage(getErrorMessage(error, 'Nao foi possivel registrar a movimentacao.'), 'error')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleClose(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!cashRegister) return
    setIsSubmitting(true)
    try {
      const response = await closeCashRegister(cashRegister.id, Number(declaredCashAmount))
      setCashRegister(response)
      showMessage('Caixa fechado com sucesso.', 'success')
      setView('status')
    } catch (error) {
      showMessage(getErrorMessage(error, 'Nao foi possivel fechar o caixa.'), 'error')
    } finally {
      setIsSubmitting(false)
    }
  }

  const isOpen = cashRegister && cashRegister.status === 'OPEN'

  return (
    <main className="mobile-sale-shell">
      <header className="mobile-topbar">
        <button className="mobile-icon-button" type="button" onClick={view === 'status' ? onBack : () => setView('status')} aria-label="Voltar">
          &lt;
        </button>
        <div>
          <span className="eyebrow">Gestao de Caixa</span>
          <h1>Meu Caixa</h1>
        </div>
      </header>

      {message ? (
        <div className={`feedback-message ${messageType === 'success' ? 'feedback-message--success' : 'feedback-message--error'}`} style={{ margin: '16px' }}>
          {message}
        </div>
      ) : null}

      {isLoading ? (
        <div style={{ padding: '16px', textAlign: 'center' }}>Carregando caixa...</div>
      ) : !isOpen ? (
        <section className="mobile-action-panel mobile-action-panel--empty">
          <div className="mobile-action-panel-header">
            <h2>Nenhum caixa aberto</h2>
            <p>Informe o saldo inicial para abrir o caixa e liberar as vendas.</p>
          </div>
          <form className="mobile-manual-form" onSubmit={handleOpen}>
            <div>
              <label htmlFor="mobileOpeningAmount">Saldo inicial (Dinheiro)</label>
              <CurrencyInput
                id="mobileOpeningAmount"
                value={openingAmount}
                onChange={setOpeningAmount}
                placeholder="0.00"
              />
            </div>
            <button className="mobile-primary-button" type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Abrindo...' : 'Abrir caixa'}
            </button>
          </form>
        </section>
      ) : view === 'status' ? (
        <>
          <section className="mobile-total-panel">
            <span>Resumo do Caixa</span>
            <strong>{formatCurrency(cashRegister.totalSalesAmount)}</strong>
            <small>Aberto em: {formatNullableDateTime(cashRegister.openedAt)}</small>

            <div className="mobile-total-panel-footer">
              <div>
                <span>Dinheiro Esperado</span>
                <strong>{formatCurrency(cashRegister.expectedCashAmount)}</strong>
              </div>
              <div>
                <span>Movimentacoes</span>
                <strong>{formatCurrency(cashRegister.cashInAmount - cashRegister.cashOutAmount)}</strong>
              </div>
            </div>
          </section>

          <section className="mobile-action-panel">
            <button className="mobile-primary-button" type="button" onClick={() => setView('movement')}>
              Registrar Sangria/Suprimento
            </button>
            <button className="mobile-primary-button mobile-primary-button--danger" type="button" onClick={() => setView('close')}>
              Fechar Caixa
            </button>
          </section>
        </>
      ) : view === 'movement' ? (
        <section className="mobile-action-panel">
          <h2>Nova Movimentacao</h2>
          <form className="mobile-manual-form" onSubmit={handleMovement}>
            <div>
              <label>Tipo</label>
              <select value={movementType} onChange={(e) => setMovementType(e.target.value as CashMovementType)}>
                <option value="CASH_IN">Suprimento (Entrada)</option>
                <option value="CASH_OUT">Sangria (Retirada)</option>
              </select>
            </div>
            <div>
              <label>Valor</label>
              <CurrencyInput value={movementAmount} onChange={setMovementAmount} placeholder="0.00" />
            </div>
            <div>
              <label>Motivo</label>
              <input value={movementReason} onChange={(e) => setMovementReason(e.target.value)} placeholder="Ex.: Sangria para cofre" />
            </div>
            <button className="mobile-primary-button" type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Registrando...' : 'Confirmar'}
            </button>
          </form>
        </section>
      ) : (
        <section className="mobile-action-panel">
          <h2>Fechamento de Caixa</h2>
          <p>O sistema espera encontrar {formatCurrency(cashRegister!.expectedCashAmount)} em dinheiro.</p>
          <form className="mobile-manual-form" onSubmit={handleClose}>
            <div>
              <label>Dinheiro Contado</label>
              <CurrencyInput value={declaredCashAmount} onChange={setDeclaredCashAmount} placeholder="0.00" />
            </div>
            <button className="mobile-primary-button mobile-primary-button--danger" type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Fechando...' : 'Confirmar Fechamento'}
            </button>
          </form>
        </section>
      )}
    </main>
  )
}
