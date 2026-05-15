import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import {
  AlertCircle,
  CalendarClock,
  CheckCircle2,
  FileDown,
  MessageCircle,
  Printer,
  ReceiptText,
  Search,
} from 'lucide-react'
import { Metric } from '../components/Metric'
import { PageHeader } from '../components/PageHeader'
import { PaginationControls } from '../components/PaginationControls'
import { getCustomers } from '../services/customerService'
import {
  getPromissoryNotePrintUrl,
  getPromissoryNoteCollectionEvents,
  getPromissoryNotePayments,
  getPromissoryNotes,
  getPromissoryNotesDueToday,
  getPromissoryNotesExportUrl,
  getPromissoryPaymentReceiptUrl,
  getPromissoryDelinquencyReport,
  getPromissoryWhatsappMessage,
  payPromissoryNote,
  addPromissoryNoteCollectionEvent,
  renegotiatePromissoryNotes,
} from '../services/promissoryNoteService'
import type { Customer } from '../types/customer'
import type {
  PromissoryNote,
  PromissoryNoteCollectionAction,
  PromissoryNoteCollectionEvent,
  PromissoryNoteDelinquencyRange,
  PromissoryNoteFilters,
  PromissoryNotePayment,
  PromissoryNoteStatus,
} from '../types/promissoryNote'
import type { PaymentMethod } from '../types/sale'
import { getErrorMessage } from '../utils/errors'
import { formatCurrency, formatNullableDateTime } from '../utils/formatters'
import { useAppMessage } from '../hooks/useAppMessage'
import { usePagination } from '../hooks/usePagination'
import { maskCpf, maskPhone } from '../utils/masks'

const statusLabels: Record<PromissoryNoteStatus, string> = {
  PENDING: 'Pendente',
  PARTIALLY_PAID: 'Parcial',
  PAID: 'Pago',
  OVERDUE: 'Vencido',
  CANCELLED: 'Cancelado',
  RENEGOTIATED: 'Renegociado',
}

const collectionActionLabels: Record<PromissoryNoteCollectionAction, string> = {
  CALL_MADE: 'Ligacao realizada',
  MESSAGE_SENT: 'Mensagem enviada',
  PROMISED_PAYMENT: 'Promessa de pagamento',
  NO_RESPONSE: 'Sem resposta',
  AGREEMENT_MADE: 'Acordo realizado',
  IN_PERSON_COLLECTION: 'Cobranca presencial',
  NOTE: 'Observacao',
}

const paymentLabels: Record<Exclude<PaymentMethod, 'PROMISSORY_NOTE'>, string> = {
  CASH: 'Dinheiro',
  PIX: 'Pix',
  DEBIT_CARD: 'Cartao debito',
  CREDIT_CARD: 'Cartao credito',
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' }).format(new Date(`${value}T00:00:00`))
}

function getLocalToday() {
  const now = new Date()
  const localDate = new Date(now.getTime() - now.getTimezoneOffset() * 60_000)
  return localDate.toISOString().slice(0, 10)
}

export function PromissoryNotesPage() {
  const { confirm, notify } = useAppMessage()
  const [notes, setNotes] = useState<PromissoryNote[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [selectedNote, setSelectedNote] = useState<PromissoryNote | null>(null)
  const [filters, setFilters] = useState<PromissoryNoteFilters>({})
  const [draftFilters, setDraftFilters] = useState({ status: '', customerId: '', startDate: '', endDate: '' })
  const [listMode, setListMode] = useState<'due-today' | 'custom'>('due-today')
  const [searchTerm, setSearchTerm] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<Exclude<PaymentMethod, 'PROMISSORY_NOTE'>>('CASH')
  const [paymentAmount, setPaymentAmount] = useState('')
  const [chargeInterestAndPenalty, setChargeInterestAndPenalty] = useState(false)
  const [payments, setPayments] = useState<PromissoryNotePayment[]>([])
  const [collectionEvents, setCollectionEvents] = useState<PromissoryNoteCollectionEvent[]>([])
  const [delinquencyReport, setDelinquencyReport] = useState<PromissoryNoteDelinquencyRange[]>([])
  const [collectionAction, setCollectionAction] = useState<PromissoryNoteCollectionAction>('MESSAGE_SENT')
  const [collectionComment, setCollectionComment] = useState('')
  const [promisedPaymentDate, setPromisedPaymentDate] = useState('')
  const [renegotiationReason, setRenegotiationReason] = useState('')
  const [renegotiationFirstAmount, setRenegotiationFirstAmount] = useState('')
  const [renegotiationFirstDueDate, setRenegotiationFirstDueDate] = useState('')
  const [renegotiationSecondAmount, setRenegotiationSecondAmount] = useState('')
  const [renegotiationSecondDueDate, setRenegotiationSecondDueDate] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isPaying, setIsPaying] = useState(false)
  const [isRegisteringCollection, setIsRegisteringCollection] = useState(false)
  const [isRenegotiating, setIsRenegotiating] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const printFrameRef = useRef<HTMLIFrameElement>(null)

  const filteredNotes = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase()
    return notes.filter((note) => {
      if (!normalizedSearch) return true
      return (
        note.customer.name.toLowerCase().includes(normalizedSearch) ||
        String(note.saleId).includes(normalizedSearch) ||
        (note.customer.cpf ?? '').includes(normalizedSearch)
      )
    })
  }, [notes, searchTerm])
  const notePagination = usePagination(filteredNotes, 8)

  useEffect(() => {
    if (filteredNotes.length === 0) {
      setSelectedNote(null)
      return
    }

    if (!selectedNote || !filteredNotes.some((note) => note.id === selectedNote.id)) {
      setSelectedNote(filteredNotes[0])
    }
  }, [filteredNotes, selectedNote])

  const metrics = useMemo(() => {
    const openNotes = notes.filter((note) => !['PAID', 'CANCELLED', 'RENEGOTIATED'].includes(note.status))
    const today = getLocalToday()
    return {
      openAmount: openNotes.reduce((sum, note) => sum + note.remainingAmount, 0),
      overdueAmount: notes.filter((note) => note.status === 'OVERDUE').reduce((sum, note) => sum + note.remainingAmount, 0),
      dueTodayAmount: openNotes.filter((note) => note.dueDate === today).reduce((sum, note) => sum + note.remainingAmount, 0),
      paidAmount: notes.reduce((sum, note) => sum + note.paidAmount, 0),
      openCount: openNotes.length,
    }
  }, [notes])

  const loadDueToday = useCallback(async () => {
    setIsLoading(true)

    try {
      const response = await getPromissoryNotesDueToday()
      setNotes(response)
      setSelectedNote((current) => response.find((note) => note.id === current?.id) ?? response[0] ?? null)
      setErrorMessage(null)
    } catch (error) {
      setErrorMessage(getErrorMessage(error, 'Nao foi possivel carregar notas para cobranca.'))
    } finally {
      setIsLoading(false)
    }
  }, [])

  const loadNotes = useCallback(async (nextFilters: PromissoryNoteFilters = {}) => {
    setIsLoading(true)

    try {
      const response = await getPromissoryNotes(nextFilters)
      setNotes(response)
      setSelectedNote((current) => response.find((note) => note.id === current?.id) ?? response[0] ?? null)
      setErrorMessage(null)
    } catch (error) {
      setErrorMessage(getErrorMessage(error, 'Nao foi possivel carregar notas promissorias.'))
    } finally {
      setIsLoading(false)
    }
  }, [])

  const loadDelinquencyReport = useCallback(async () => {
    try {
      const response = await getPromissoryDelinquencyReport()
      setDelinquencyReport(response)
    } catch {
      setDelinquencyReport([])
    }
  }, [])

  const refreshCurrentList = useCallback(async () => {
    if (listMode === 'due-today') {
      await loadDueToday()
    } else {
      await loadNotes(filters)
    }
    await loadDelinquencyReport()
  }, [filters, listMode, loadDelinquencyReport, loadDueToday, loadNotes])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadDueToday()
      void loadDelinquencyReport()
      getCustomers().then(setCustomers).catch(() => setCustomers([]))
    }, 0)

    return () => window.clearTimeout(timeoutId)
  }, [loadDelinquencyReport, loadDueToday])

  useEffect(() => {
    if (!selectedNote) {
      setPayments([])
      setCollectionEvents([])
      return
    }

    setPaymentAmount(selectedNote.remainingAmount > 0 ? String(selectedNote.remainingAmount) : '')
    setRenegotiationFirstAmount(selectedNote.remainingAmount > 0 ? String((selectedNote.remainingAmount / 2).toFixed(2)) : '')
    setRenegotiationSecondAmount(selectedNote.remainingAmount > 0 ? String((selectedNote.remainingAmount / 2).toFixed(2)) : '')

    let isCurrent = true
    Promise.all([
      getPromissoryNotePayments(selectedNote.id),
      getPromissoryNoteCollectionEvents(selectedNote.id),
    ])
      .then(([nextPayments, nextEvents]) => {
        if (!isCurrent) return
        setPayments(nextPayments)
        setCollectionEvents(nextEvents)
      })
      .catch(() => {
        if (!isCurrent) return
        setPayments([])
        setCollectionEvents([])
      })

    return () => {
      isCurrent = false
    }
  }, [selectedNote])

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      if (listMode === 'due-today') {
        void loadDueToday()
      } else {
        void loadNotes(filters)
      }
      void loadDelinquencyReport()
    }, 60_000)

    return () => window.clearInterval(intervalId)
  }, [listMode, loadDelinquencyReport, loadDueToday, loadNotes, filters])

  function handleFilterSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const nextFilters: PromissoryNoteFilters = {
      status: draftFilters.status as PromissoryNoteStatus | '',
      customerId: draftFilters.customerId ? Number(draftFilters.customerId) : undefined,
      startDate: draftFilters.startDate || undefined,
      endDate: draftFilters.endDate || undefined,
    }
    setFilters(nextFilters)
    setListMode('custom')
    void loadNotes(nextFilters)
    void loadDelinquencyReport()
  }

  function clearFilters() {
    const nextFilters = {}
    setDraftFilters({ status: '', customerId: '', startDate: '', endDate: '' })
    setFilters(nextFilters)
    setListMode('custom')
    void loadNotes(nextFilters)
    void loadDelinquencyReport()
  }

  function showDueToday() {
    setDraftFilters({ status: '', customerId: '', startDate: '', endDate: '' })
    setFilters({})
    setListMode('due-today')
    void loadDueToday()
    void loadDelinquencyReport()
  }

  async function handlePay() {
    if (!selectedNote || ['PAID', 'CANCELLED', 'RENEGOTIATED'].includes(selectedNote.status)) return

    const amount = paymentAmount ? Number(paymentAmount) : undefined
    if (amount !== undefined && (!Number.isFinite(amount) || amount <= 0)) {
      notify({
        type: 'error',
        title: 'Valor invalido',
        message: 'Informe um valor de pagamento maior que zero.',
      })
      return
    }

    const confirmed = await confirm({
      type: 'warning',
      title: 'Baixar nota?',
      message: `Registrar recebimento de ${formatCurrency(amount ?? selectedNote.remainingAmount)} no caixa aberto?`,
      confirmLabel: 'Baixar',
      cancelLabel: 'Voltar',
    })
    if (!confirmed) return

    setIsPaying(true)

    try {
      const paidNote = await payPromissoryNote(selectedNote.id, paymentMethod, amount, chargeInterestAndPenalty)
      setSelectedNote(paidNote)
      await refreshCurrentList()
      notify({
        type: 'success',
        title: paidNote.status === 'PAID' ? 'Nota baixada' : 'Pagamento parcial',
        message: `Parcela #${paidNote.id} registrada no caixa.`,
      })
    } catch (error) {
      notify({
        type: 'error',
        title: 'Nao foi possivel baixar',
        message: getErrorMessage(error, 'Verifique se existe caixa aberto.'),
      })
    } finally {
      setIsPaying(false)
    }
  }

  async function handleCollectionEvent() {
    if (!selectedNote) return

    setIsRegisteringCollection(true)
    try {
      const event = await addPromissoryNoteCollectionEvent(
        selectedNote.id,
        collectionAction,
        collectionComment,
        promisedPaymentDate,
      )
      setCollectionEvents((current) => [event, ...current])
      setCollectionComment('')
      setPromisedPaymentDate('')
      notify({
        type: 'success',
        title: 'Cobranca registrada',
        message: collectionActionLabels[event.action],
      })
    } catch (error) {
      notify({
        type: 'error',
        title: 'Nao foi possivel registrar',
        message: getErrorMessage(error, 'Revise os dados da cobranca.'),
      })
    } finally {
      setIsRegisteringCollection(false)
    }
  }

  async function handleWhatsappMessage() {
    if (!selectedNote) return

    try {
      const message = await getPromissoryWhatsappMessage(selectedNote.id)
      window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer')
    } catch (error) {
      notify({
        type: 'error',
        title: 'Mensagem indisponivel',
        message: getErrorMessage(error, 'Nao foi possivel gerar a mensagem.'),
      })
    }
  }

  async function handleRenegotiate() {
    if (!selectedNote || ['PAID', 'CANCELLED', 'RENEGOTIATED'].includes(selectedNote.status)) return

    const installments = [
      { dueDate: renegotiationFirstDueDate, amount: Number(renegotiationFirstAmount) },
      { dueDate: renegotiationSecondDueDate, amount: Number(renegotiationSecondAmount) },
    ].filter((installment) => installment.dueDate && Number.isFinite(installment.amount) && installment.amount > 0)

    if (!renegotiationReason.trim() || installments.length === 0) {
      notify({
        type: 'error',
        title: 'Renegociacao incompleta',
        message: 'Informe motivo, vencimento e valor de pelo menos uma parcela.',
      })
      return
    }

    const total = installments.reduce((sum, installment) => sum + installment.amount, 0)
    if (total < selectedNote.remainingAmount) {
      notify({
        type: 'error',
        title: 'Total insuficiente',
        message: 'A renegociacao deve cobrir o saldo em aberto.',
      })
      return
    }

    const confirmed = await confirm({
      type: 'warning',
      title: 'Renegociar nota?',
      message: `A nota atual sera marcada como renegociada e novas parcelas somando ${formatCurrency(total)} serao criadas.`,
      confirmLabel: 'Renegociar',
      cancelLabel: 'Voltar',
    })
    if (!confirmed) return

    setIsRenegotiating(true)
    try {
      const newNotes = await renegotiatePromissoryNotes({
        noteIds: [selectedNote.id],
        reason: renegotiationReason.trim(),
        installments,
      })
      setRenegotiationReason('')
      setRenegotiationFirstDueDate('')
      setRenegotiationSecondDueDate('')
      await refreshCurrentList()
      setSelectedNote(newNotes[0] ?? null)
      notify({
        type: 'success',
        title: 'Renegociacao concluida',
        message: `${newNotes.length} nova(s) parcela(s) criada(s).`,
      })
    } catch (error) {
      notify({
        type: 'error',
        title: 'Nao foi possivel renegociar',
        message: getErrorMessage(error, 'Revise as parcelas informadas.'),
      })
    } finally {
      setIsRenegotiating(false)
    }
  }

  return (
    <main className="app-shell">
      <div className="app-container history-container">
        <PageHeader
          eyebrow="Recebiveis"
          title="Carteira de notas promissorias"
          subtitle="Acompanhe vencimentos, imprima parcelas e registre baixas diretamente no caixa aberto."
          metricLabel="Aberto"
          metricValue={formatCurrency(metrics.openAmount)}
          status={listMode === 'due-today' ? 'Cobranca do dia' : `${metrics.openCount} parcela(s) em aberto`}
        />

        <div className="metric-grid metric-grid--4">
          <Metric label="A receber" value={formatCurrency(metrics.openAmount)} tone="gold" icon={ReceiptText} />
          <Metric label="Vence hoje" value={formatCurrency(metrics.dueTodayAmount)} tone="gold" icon={CalendarClock} />
          <Metric label="Vencido" value={formatCurrency(metrics.overdueAmount)} tone="danger" icon={AlertCircle} />
          <Metric label="Recebido" value={formatCurrency(metrics.paidAmount)} tone="success" icon={CheckCircle2} />
        </div>

        {delinquencyReport.length > 0 ? (
          <section className="scanner-panel promissory-summary-panel">
            <header className="section-header">
              <div>
                <h2>Inadimplencia</h2>
                <p>Saldo aberto por faixa de atraso.</p>
              </div>
            </header>
            <div className="promissory-mini-grid">
              {delinquencyReport.map((range) => (
                <div className="promissory-mini-card" key={range.range}>
                  <span>{range.range}</span>
                  <strong>{formatCurrency(range.amount)}</strong>
                  <small>{range.count} parcela(s)</small>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        <section className="scanner-panel">
          <div className="qr-modal-actions">
            <button className="action-button" type="button" onClick={showDueToday} disabled={isLoading}>
              Cobranca de hoje
            </button>
            <button className="secondary-button" type="button" onClick={clearFilters} disabled={isLoading}>
              Todas
            </button>
          </div>

          <form className="notes-filter-form" onSubmit={handleFilterSubmit}>
            <div className="field-group">
              <label htmlFor="noteStatus">Status</label>
              <select
                id="noteStatus"
                value={draftFilters.status}
                onChange={(event) => setDraftFilters((current) => ({ ...current, status: event.target.value }))}
              >
                <option value="">Todos</option>
                <option value="PENDING">Pendentes</option>
                <option value="PARTIALLY_PAID">Parciais</option>
                <option value="OVERDUE">Vencidos</option>
                <option value="PAID">Pagos</option>
                <option value="CANCELLED">Cancelados</option>
                <option value="RENEGOTIATED">Renegociados</option>
              </select>
            </div>
            <div className="field-group">
              <label htmlFor="noteCustomer">Cliente</label>
              <select
                id="noteCustomer"
                value={draftFilters.customerId}
                onChange={(event) => setDraftFilters((current) => ({ ...current, customerId: event.target.value }))}
              >
                <option value="">Todos</option>
                {customers.map((customer) => (
                  <option value={customer.id} key={customer.id}>{customer.name}</option>
                ))}
              </select>
            </div>
            <div className="field-group">
              <label htmlFor="noteStart">Inicio</label>
              <input
                id="noteStart"
                type="date"
                value={draftFilters.startDate}
                onChange={(event) => setDraftFilters((current) => ({ ...current, startDate: event.target.value }))}
              />
            </div>
            <div className="field-group">
              <label htmlFor="noteEnd">Fim</label>
              <input
                id="noteEnd"
                type="date"
                value={draftFilters.endDate}
                onChange={(event) => setDraftFilters((current) => ({ ...current, endDate: event.target.value }))}
              />
            </div>
            <button className="action-button" type="submit" disabled={isLoading}>Filtrar</button>
            <button className="secondary-button" type="button" onClick={clearFilters} disabled={isLoading}>Limpar</button>
            <a className="icon-link" href={getPromissoryNotesExportUrl(filters, listMode === 'due-today')} target="_blank" rel="noreferrer">
              <FileDown size={14} strokeWidth={2.3} aria-hidden="true" />CSV
            </a>
          </form>

          <div className="field-group notes-search">
            <label htmlFor="noteSearch">Busca rapida</label>
            <div className="search-with-icon">
              <Search size={16} strokeWidth={2.3} aria-hidden="true" />
              <input
                id="noteSearch"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Cliente, CPF ou venda"
              />
            </div>
          </div>

          {errorMessage ? <div className="feedback-message feedback-message--error">{errorMessage}</div> : null}
        </section>

        <div className="history-grid">
          <section className="cart-panel">
            <header className="section-header">
              <div>
                <h2>Parcelas</h2>
                <p>Ordenadas por vencimento.</p>
              </div>
            </header>
            {isLoading ? (
              <div className="product-empty">Carregando notas...</div>
            ) : filteredNotes.length === 0 ? (
              <div className="product-empty">Nenhuma nota encontrada.</div>
            ) : (
              <div className="sale-history-list">
                {notePagination.pageItems.map((note) => (
                  <button
                    className={selectedNote?.id === note.id ? 'sale-history-item sale-history-item--active' : 'sale-history-item'}
                    type="button"
                    key={note.id}
                    onClick={() => setSelectedNote(note)}
                  >
                    <span><CalendarClock size={14} strokeWidth={2.3} aria-hidden="true" />Vence {formatDate(note.dueDate)}</span>
                    <strong>{formatCurrency(note.remainingAmount)}</strong>
                    <small>
                      {note.customer.name} - {statusLabels[note.status]} - Parcela {note.installmentNumber}/{note.totalInstallments}
                    </small>
                  </button>
                ))}
                <PaginationControls
                  itemLabel="parcelas"
                  page={notePagination.page}
                  pageSize={notePagination.pageSize}
                  totalItems={notePagination.totalItems}
                  totalPages={notePagination.totalPages}
                  onPageChange={notePagination.setPage}
                />
              </div>
            )}
          </section>

          <section className="cart-panel">
            <header className="section-header">
              <div>
                <h2>Detalhe da nota</h2>
                <p>{selectedNote ? `Nota #${selectedNote.id} - venda #${selectedNote.saleId}` : 'Selecione uma parcela.'}</p>
              </div>
            </header>

            {!selectedNote ? (
              <div className="product-empty">Selecione uma nota para visualizar.</div>
            ) : (
              <div className="cart-list">
                <article className="cart-item">
                  <div className="cart-item-main">
                    <span><ReceiptText size={14} strokeWidth={2.3} aria-hidden="true" />{statusLabels[selectedNote.status]}</span>
                    <strong>{selectedNote.customer.name}</strong>
                    <small>
                      {[
                        selectedNote.customer.cpf ? maskCpf(selectedNote.customer.cpf) : '',
                        selectedNote.customer.phone ? maskPhone(selectedNote.customer.phone) : '',
                      ].filter(Boolean).join(' - ') || 'Sem documento'}
                    </small>
                  </div>
                  <div className="cart-price">
                    <span>Saldo</span>
                    <strong>{formatCurrency(selectedNote.remainingAmount)}</strong>
                  </div>
                  <div className="cart-price">
                    <span>Pago</span>
                    <strong>{formatCurrency(selectedNote.paidAmount)}</strong>
                  </div>
                  <div className="cart-price">
                    <span>Vencimento</span>
                    <strong>{formatDate(selectedNote.dueDate)}</strong>
                  </div>
                </article>

                <div className="promissory-mini-grid">
                  <div className="promissory-mini-card">
                    <span>Valor original</span>
                    <strong>{formatCurrency(selectedNote.amount)}</strong>
                  </div>
                  <div className="promissory-mini-card">
                    <span>Atualizado</span>
                    <strong>{formatCurrency(selectedNote.updatedAmount)}</strong>
                  </div>
                  <div className="promissory-mini-card">
                    <span>Atraso</span>
                    <strong>{selectedNote.daysOverdue} dia(s)</strong>
                  </div>
                </div>

                {selectedNote.status === 'PAID' ? (
                  <div className="feedback-message feedback-message--success">
                    Pago em {formatNullableDateTime(selectedNote.paidAt)} por {selectedNote.paymentMethod ?? '-'}.
                  </div>
                ) : selectedNote.status === 'CANCELLED' ? (
                  <div className="feedback-message feedback-message--warning">
                    Nota cancelada junto com a venda #{selectedNote.saleId}.
                  </div>
                ) : selectedNote.status === 'RENEGOTIATED' ? (
                  <div className="feedback-message feedback-message--warning">
                    Nota substituida por renegociacao.
                  </div>
                ) : (
                  <div className="promissory-pay-panel">
                    <div className="field-group">
                      <label htmlFor="payMethod">Forma de baixa</label>
                      <select
                        id="payMethod"
                        value={paymentMethod}
                        onChange={(event) => setPaymentMethod(event.target.value as Exclude<PaymentMethod, 'PROMISSORY_NOTE'>)}
                      >
                        {Object.entries(paymentLabels).map(([value, label]) => (
                          <option value={value} key={value}>{label}</option>
                        ))}
                      </select>
                    </div>
                    <div className="field-group">
                      <label htmlFor="payAmount">Valor recebido</label>
                      <input
                        id="payAmount"
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={paymentAmount}
                        onChange={(event) => setPaymentAmount(event.target.value)}
                      />
                    </div>
                    <label className="checkbox-row">
                      <input
                        type="checkbox"
                        checked={chargeInterestAndPenalty}
                        onChange={(event) => setChargeInterestAndPenalty(event.target.checked)}
                      />
                      Cobrar multa e juros
                    </label>
                    <button className="action-button" type="button" disabled={isPaying} onClick={() => void handlePay()}>
                      {isPaying ? 'Baixando...' : 'Registrar pagamento'}
                    </button>
                  </div>
                )}

                <div className="qr-modal-actions">
                  <button
                    className="secondary-button"
                    type="button"
                    onClick={() => printFrameRef.current?.contentWindow?.print()}
                  >
                    <Printer size={14} strokeWidth={2.3} aria-hidden="true" />Imprimir
                  </button>
                  <a className="icon-link" href={getPromissoryNotePrintUrl(selectedNote.id)} target="_blank" rel="noreferrer">
                    Abrir modelo
                  </a>
                  <button className="secondary-button" type="button" onClick={() => void handleWhatsappMessage()}>
                    <MessageCircle size={14} strokeWidth={2.3} aria-hidden="true" />WhatsApp
                  </button>
                </div>

                <section className="promissory-detail-section">
                  <header className="section-header">
                    <div>
                      <h2>Pagamentos</h2>
                      <p>{payments.length} registro(s).</p>
                    </div>
                  </header>
                  {payments.length === 0 ? (
                    <div className="product-empty">Nenhum pagamento registrado.</div>
                  ) : (
                    <div className="promissory-history-list">
                      {payments.map((payment) => (
                        <div className="promissory-history-item" key={payment.id}>
                          <div>
                            <strong>{formatCurrency(payment.amount)}</strong>
                            <small>
                              {paymentLabels[payment.paymentMethod]} - {formatNullableDateTime(payment.paidAt)}
                            </small>
                          </div>
                          <div>
                            <span>Total recebido</span>
                            <strong>{formatCurrency(payment.totalReceived)}</strong>
                          </div>
                          <a className="icon-link" href={getPromissoryPaymentReceiptUrl(payment.id)} target="_blank" rel="noreferrer">
                            Recibo
                          </a>
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                <section className="promissory-detail-section">
                  <header className="section-header">
                    <div>
                      <h2>Cobranca</h2>
                      <p>Historico de contato com o cliente.</p>
                    </div>
                  </header>
                  <div className="promissory-form-grid">
                    <div className="field-group">
                      <label htmlFor="collectionAction">Acao</label>
                      <select
                        id="collectionAction"
                        value={collectionAction}
                        onChange={(event) => setCollectionAction(event.target.value as PromissoryNoteCollectionAction)}
                      >
                        {Object.entries(collectionActionLabels).map(([value, label]) => (
                          <option value={value} key={value}>{label}</option>
                        ))}
                      </select>
                    </div>
                    <div className="field-group">
                      <label htmlFor="promisedPaymentDate">Promessa</label>
                      <input
                        id="promisedPaymentDate"
                        type="date"
                        value={promisedPaymentDate}
                        onChange={(event) => setPromisedPaymentDate(event.target.value)}
                      />
                    </div>
                    <div className="field-group promissory-grid-wide">
                      <label htmlFor="collectionComment">Comentario</label>
                      <input
                        id="collectionComment"
                        value={collectionComment}
                        onChange={(event) => setCollectionComment(event.target.value)}
                        placeholder="Resumo do contato"
                      />
                    </div>
                    <button className="secondary-button" type="button" disabled={isRegisteringCollection} onClick={() => void handleCollectionEvent()}>
                      {isRegisteringCollection ? 'Registrando...' : 'Registrar cobranca'}
                    </button>
                  </div>
                  {collectionEvents.length === 0 ? (
                    <div className="product-empty">Nenhuma cobranca registrada.</div>
                  ) : (
                    <div className="promissory-history-list">
                      {collectionEvents.map((event) => (
                        <div className="promissory-history-item" key={event.id}>
                          <div>
                            <strong>{collectionActionLabels[event.action]}</strong>
                            <small>
                              {formatNullableDateTime(event.createdAt)}
                              {event.promisedPaymentDate ? ` - Promessa ${formatDate(event.promisedPaymentDate)}` : ''}
                            </small>
                          </div>
                          <span>{event.comment || '-'}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                {!['PAID', 'CANCELLED', 'RENEGOTIATED'].includes(selectedNote.status) ? (
                  <section className="promissory-detail-section">
                    <header className="section-header">
                      <div>
                        <h2>Renegociacao</h2>
                        <p>Gere novas parcelas para substituir o saldo atual.</p>
                      </div>
                    </header>
                    <div className="promissory-form-grid">
                      <div className="field-group promissory-grid-wide">
                        <label htmlFor="renegotiationReason">Motivo</label>
                        <input
                          id="renegotiationReason"
                          value={renegotiationReason}
                          onChange={(event) => setRenegotiationReason(event.target.value)}
                          placeholder="Ex.: acordo com cliente"
                        />
                      </div>
                      <div className="field-group">
                        <label htmlFor="renegotiationFirstDueDate">1o vencimento</label>
                        <input
                          id="renegotiationFirstDueDate"
                          type="date"
                          value={renegotiationFirstDueDate}
                          onChange={(event) => setRenegotiationFirstDueDate(event.target.value)}
                        />
                      </div>
                      <div className="field-group">
                        <label htmlFor="renegotiationFirstAmount">1o valor</label>
                        <input
                          id="renegotiationFirstAmount"
                          type="number"
                          min="0.01"
                          step="0.01"
                          value={renegotiationFirstAmount}
                          onChange={(event) => setRenegotiationFirstAmount(event.target.value)}
                        />
                      </div>
                      <div className="field-group">
                        <label htmlFor="renegotiationSecondDueDate">2o vencimento</label>
                        <input
                          id="renegotiationSecondDueDate"
                          type="date"
                          value={renegotiationSecondDueDate}
                          onChange={(event) => setRenegotiationSecondDueDate(event.target.value)}
                        />
                      </div>
                      <div className="field-group">
                        <label htmlFor="renegotiationSecondAmount">2o valor</label>
                        <input
                          id="renegotiationSecondAmount"
                          type="number"
                          min="0.01"
                          step="0.01"
                          value={renegotiationSecondAmount}
                          onChange={(event) => setRenegotiationSecondAmount(event.target.value)}
                        />
                      </div>
                      <button className="secondary-button" type="button" disabled={isRenegotiating} onClick={() => void handleRenegotiate()}>
                        {isRenegotiating ? 'Renegociando...' : 'Renegociar'}
                      </button>
                    </div>
                  </section>
                ) : null}

                <iframe
                  className="promissory-print-frame"
                  ref={printFrameRef}
                  src={getPromissoryNotePrintUrl(selectedNote.id)}
                  title={`Nota promissoria ${selectedNote.id}`}
                />
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  )
}
