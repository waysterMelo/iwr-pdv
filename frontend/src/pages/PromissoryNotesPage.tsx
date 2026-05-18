import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import {
  AlertCircle,
  ArrowLeft,
  CalendarDays,
  CalendarClock,
  CheckCircle2,
  FileDown,
  MessageCircle,
  PlusCircle,
  Printer,
  ReceiptText,
  Search,
} from 'lucide-react'
import { Metric } from '../components/Metric'
import { PageHeader } from '../components/PageHeader'
import { PaginationControls } from '../components/PaginationControls'
import { getCustomers } from '../services/customerService'
import {
  createManualPromissoryNotes,
  downloadPromissoryNotesCsv,
  getPromissoryNotePrintUrl,
  getPromissoryNoteCalendarDays,
  getPromissoryNoteCollectionEvents,
  getPromissoryNotePayments,
  getPromissoryNotes,
  getPromissoryNotesDueToday,
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
  PromissoryNoteCalendarDay,
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

function shiftMonth(value: string, offset: number) {
  const [year, month] = value.split('-').map(Number)
  const date = new Date(year, month - 1 + offset, 1)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function buildCalendarDays(monthValue: string) {
  const [year, month] = monthValue.split('-').map(Number)
  const firstDate = new Date(year, month - 1, 1)
  const lastDate = new Date(year, month, 0)
  const days: Array<{ date: string; day: number; muted: boolean }> = []

  for (let index = 0; index < firstDate.getDay(); index += 1) {
    days.push({ date: '', day: 0, muted: true })
  }

  for (let day = 1; day <= lastDate.getDate(); day += 1) {
    days.push({
      date: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
      day,
      muted: false,
    })
  }

  return days
}

function monthRange(monthValue: string) {
  const [year, month] = monthValue.split('-').map(Number)
  const endDay = new Date(year, month, 0).getDate()
  return {
    startDate: `${year}-${String(month).padStart(2, '0')}-01`,
    endDate: `${year}-${String(month).padStart(2, '0')}-${String(endDay).padStart(2, '0')}`,
  }
}

export function PromissoryNotesPage() {
  const { confirm, notify } = useAppMessage()
  const [notes, setNotes] = useState<PromissoryNote[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [selectedNote, setSelectedNote] = useState<PromissoryNote | null>(null)
  const [filters, setFilters] = useState<PromissoryNoteFilters>({})
  const [draftFilters, setDraftFilters] = useState({ status: '', customerId: '', startDate: '', endDate: '' })
  const [pageMode, setPageMode] = useState<'wallet' | 'manual-create'>('wallet')
  const [manualNoteForm, setManualNoteForm] = useState({
    customerId: '',
    totalAmount: '',
    installments: '1',
    firstDueDate: getLocalToday(),
  })
  const [listMode, setListMode] = useState<'due-today' | 'custom'>('due-today')
  const [calendarMonth, setCalendarMonth] = useState(() => getLocalToday().slice(0, 7))
  const [selectedCalendarDate, setSelectedCalendarDate] = useState(() => getLocalToday())
  const [searchTerm, setSearchTerm] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<Exclude<PaymentMethod, 'PROMISSORY_NOTE'>>('CASH')
  const [paymentAmount, setPaymentAmount] = useState('')
  const [chargeInterestAndPenalty, setChargeInterestAndPenalty] = useState(false)
  const [payments, setPayments] = useState<PromissoryNotePayment[]>([])
  const [collectionEvents, setCollectionEvents] = useState<PromissoryNoteCollectionEvent[]>([])
  const [delinquencyReport, setDelinquencyReport] = useState<PromissoryNoteDelinquencyRange[]>([])
  const [calendarReceivableDays, setCalendarReceivableDays] = useState<PromissoryNoteCalendarDay[]>([])
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
  const [isExportingCsv, setIsExportingCsv] = useState(false)
  const [isCreatingManualNote, setIsCreatingManualNote] = useState(false)
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
        (note.saleId ? String(note.saleId).includes(normalizedSearch) : 'nota avulsa'.includes(normalizedSearch)) ||
        (note.customer.cpf ?? '').includes(normalizedSearch)
      )
    })
  }, [notes, searchTerm])
  const notePagination = usePagination(filteredNotes, 8)
  const calendarDays = useMemo(() => buildCalendarDays(calendarMonth), [calendarMonth])
  const calendarTotals = useMemo(() => {
    const totals = new Map<string, { count: number; amount: number }>()
    calendarReceivableDays.forEach((day) => {
      totals.set(day.date, { count: day.count, amount: day.amount })
    })
    return totals
  }, [calendarReceivableDays])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      if (filteredNotes.length === 0) {
        setSelectedNote(null)
        return
      }

      if (!selectedNote || !filteredNotes.some((note) => note.id === selectedNote.id)) {
        setSelectedNote(filteredNotes[0])
      }
    }, 0)

    return () => window.clearTimeout(timeoutId)
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

  const loadCalendarDays = useCallback(async (nextCalendarMonth: string) => {
    try {
      const range = monthRange(nextCalendarMonth)
      setCalendarReceivableDays(await getPromissoryNoteCalendarDays(range.startDate, range.endDate))
    } catch {
      setCalendarReceivableDays([])
    }
  }, [])

  const refreshCurrentList = useCallback(async () => {
    if (listMode === 'due-today') {
      await loadDueToday()
    } else {
      await loadNotes(filters)
    }
    await loadDelinquencyReport()
    await loadCalendarDays(calendarMonth)
  }, [calendarMonth, filters, listMode, loadCalendarDays, loadDelinquencyReport, loadDueToday, loadNotes])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadDueToday()
      void loadDelinquencyReport()
      getCustomers().then(setCustomers).catch(() => setCustomers([]))
    }, 0)

    return () => window.clearTimeout(timeoutId)
  }, [loadDelinquencyReport, loadDueToday])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadCalendarDays(calendarMonth)
    }, 0)

    return () => window.clearTimeout(timeoutId)
  }, [calendarMonth, loadCalendarDays])

  useEffect(() => {
    let isCurrent = true
    const timeoutId = window.setTimeout(() => {
      if (!selectedNote) {
        setPayments([])
        setCollectionEvents([])
        return
      }

      setPaymentAmount(selectedNote.remainingAmount > 0 ? String(selectedNote.remainingAmount) : '')
      setRenegotiationFirstAmount(selectedNote.remainingAmount > 0 ? String((selectedNote.remainingAmount / 2).toFixed(2)) : '')
      setRenegotiationSecondAmount(selectedNote.remainingAmount > 0 ? String((selectedNote.remainingAmount / 2).toFixed(2)) : '')

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
    }, 0)

    return () => {
      isCurrent = false
      window.clearTimeout(timeoutId)
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
      void loadCalendarDays(calendarMonth)
    }, 60_000)

    return () => window.clearInterval(intervalId)
  }, [calendarMonth, listMode, loadCalendarDays, loadDelinquencyReport, loadDueToday, loadNotes, filters])

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

  function handleCalendarDateClick(date: string) {
    if (!date) return
    const nextDraftFilters = { ...draftFilters, startDate: date, endDate: date }
    const nextFilters: PromissoryNoteFilters = {
      status: nextDraftFilters.status ? nextDraftFilters.status as PromissoryNoteStatus : undefined,
      customerId: nextDraftFilters.customerId ? Number(nextDraftFilters.customerId) : undefined,
      startDate: date,
      endDate: date,
    }
    setSelectedCalendarDate(date)
    setDraftFilters(nextDraftFilters)
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

  function buildManualInstallments(totalAmount: number, installmentsCount: number, firstDueDate: string) {
    const [year, month, day] = firstDueDate.split('-').map(Number)
    const totalInCents = Math.round(totalAmount * 100)
    const baseAmount = Math.floor(totalInCents / installmentsCount)
    const remainder = totalInCents % installmentsCount

    return Array.from({ length: installmentsCount }, (_, index) => {
      const dueDate = new Date(year, month - 1 + index, day)
      const amountInCents = baseAmount + (index < remainder ? 1 : 0)
      return {
        dueDate: `${dueDate.getFullYear()}-${String(dueDate.getMonth() + 1).padStart(2, '0')}-${String(dueDate.getDate()).padStart(2, '0')}`,
        amount: amountInCents / 100,
      }
    })
  }

  async function handleManualNoteSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const customerId = Number(manualNoteForm.customerId)
    const totalAmount = Number(manualNoteForm.totalAmount)
    const installmentsCount = Number(manualNoteForm.installments)

    if (!customerId || !Number.isFinite(totalAmount) || totalAmount <= 0 || !Number.isInteger(installmentsCount) || installmentsCount < 1) {
      notify({
        type: 'error',
        title: 'Nota incompleta',
        message: 'Informe cliente, valor total e quantidade de parcelas.',
      })
      return
    }

    setIsCreatingManualNote(true)
    try {
      const newNotes = await createManualPromissoryNotes({
        customerId,
        installments: buildManualInstallments(totalAmount, installmentsCount, manualNoteForm.firstDueDate),
      })
      setManualNoteForm({ customerId: '', totalAmount: '', installments: '1', firstDueDate: getLocalToday() })
      setPageMode('wallet')
      setListMode('custom')
      setFilters({})
      setDraftFilters({ status: '', customerId: '', startDate: '', endDate: '' })
      await loadNotes({})
      await loadDelinquencyReport()
      await loadCalendarDays(calendarMonth)
      setSelectedNote(newNotes[0] ?? null)
      notify({
        type: 'success',
        title: 'Nota avulsa cadastrada',
        message: `${newNotes.length} parcela(s) adicionada(s) a carteira.`,
      })
    } catch (error) {
      notify({
        type: 'error',
        title: 'Nao foi possivel cadastrar',
        message: getErrorMessage(error, 'Revise os dados da nota promissoria.'),
      })
    } finally {
      setIsCreatingManualNote(false)
    }
  }

  async function handleExportCsv() {
    setIsExportingCsv(true)
    try {
      await downloadPromissoryNotesCsv(filters)
      notify({
        type: 'success',
        title: 'CSV gerado',
        message: 'A carteira de notas promissorias foi exportada.',
      })
    } catch (error) {
      notify({
        type: 'error',
        title: 'CSV indisponivel',
        message: getErrorMessage(error, 'Nao foi possivel exportar as notas promissorias.'),
      })
    } finally {
      setIsExportingCsv(false)
    }
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
      message: `Registrar recebimento de ${formatCurrency(amount ?? selectedNote.remainingAmount)}?`,
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
        message: `Parcela #${paidNote.id} registrada como recebida.`,
      })
    } catch (error) {
      notify({
        type: 'error',
        title: 'Nao foi possivel baixar',
        message: getErrorMessage(error, 'Nao foi possivel registrar o recebimento.'),
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

  if (pageMode === 'manual-create') {
    return (
      <main className="app-shell">
        <div className="app-container history-container">
          <PageHeader
            eyebrow="Recebiveis"
            title="Nova nota avulsa"
            subtitle="Cadastre promissorias antigas sem depender de uma venda no PDV."
            metricLabel="Cadastro"
            metricValue="Manual"
            status="Nota sem venda"
          />

          <section className="product-form-panel product-form-panel--new-product promissory-manual-panel promissory-manual-panel--page">
            <header className="section-header product-form-header">
              <div>
                <h2>Dados da nota</h2>
                <p>Selecione o cliente e informe como o valor sera dividido.</p>
              </div>
              <button className="secondary-button" type="button" onClick={() => setPageMode('wallet')} disabled={isCreatingManualNote}>
                <ArrowLeft size={14} strokeWidth={2.3} aria-hidden="true" />
                Voltar para carteira
              </button>
            </header>

            <form className="product-form" onSubmit={handleManualNoteSubmit}>
              <div className="form-grid">
                <div className="field-group field-group--full">
                  <label htmlFor="manualNoteCustomer">Cliente</label>
                  <select
                    id="manualNoteCustomer"
                    value={manualNoteForm.customerId}
                    onChange={(event) => setManualNoteForm((current) => ({ ...current, customerId: event.target.value }))}
                    required
                  >
                    <option value="">Selecione o cliente</option>
                    {customers.map((customer) => (
                      <option value={customer.id} key={customer.id}>{customer.name}</option>
                    ))}
                  </select>
                </div>
                <div className="field-group">
                  <label htmlFor="manualNoteAmount">Valor total</label>
                  <input
                    id="manualNoteAmount"
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={manualNoteForm.totalAmount}
                    onChange={(event) => setManualNoteForm((current) => ({ ...current, totalAmount: event.target.value }))}
                    placeholder="Ex.: 300.00"
                    required
                  />
                </div>
                <div className="field-group">
                  <label htmlFor="manualNoteInstallments">Parcelas</label>
                  <input
                    id="manualNoteInstallments"
                    type="number"
                    min="1"
                    max="36"
                    step="1"
                    value={manualNoteForm.installments}
                    onChange={(event) => setManualNoteForm((current) => ({ ...current, installments: event.target.value }))}
                    required
                  />
                </div>
                <div className="field-group field-group--full">
                  <label htmlFor="manualNoteDueDate">Primeiro vencimento</label>
                  <input
                    id="manualNoteDueDate"
                    type="date"
                    value={manualNoteForm.firstDueDate}
                    onChange={(event) => setManualNoteForm((current) => ({ ...current, firstDueDate: event.target.value }))}
                    required
                  />
                </div>
              </div>
              <div className="form-actions">
                <button className="action-button" type="submit" disabled={isCreatingManualNote}>
                  {isCreatingManualNote ? 'Cadastrando...' : 'Cadastrar nota avulsa'}
                </button>
                <button className="secondary-button" type="button" onClick={() => setPageMode('wallet')} disabled={isCreatingManualNote}>
                  Cancelar
                </button>
              </div>
            </form>
          </section>
        </div>
      </main>
    )
  }

  return (
    <main className="app-shell">
      <div className="app-container history-container">
        <PageHeader
          eyebrow="Recebiveis"
          title="Carteira de notas promissorias"
          subtitle="Acompanhe vencimentos, imprima parcelas e registre baixas de promissorias."
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

        <button className="promissory-create-card" type="button" onClick={() => setPageMode('manual-create')}>
          <span className="promissory-create-card__icon" aria-hidden="true">
            <PlusCircle size={22} strokeWidth={2.4} />
          </span>
          <span>
            <strong>Nova nota</strong>
            <small>Cadastrar promissoria avulsa sem venda</small>
          </span>
        </button>

        <section className="relationship-calendar-panel">
          <header className="section-header">
            <div>
              <h2><CalendarDays size={18} strokeWidth={2.3} aria-hidden="true" /> Calendario de cobrancas</h2>
              <p>Clique em um dia para ver as promissorias com vencimento na data.</p>
            </div>
            <div className="calendar-nav">
              <button className="secondary-button" type="button" onClick={() => setCalendarMonth((current) => shiftMonth(current, -1))}>
                Anterior
              </button>
              <strong>{new Date(`${calendarMonth}-01T00:00:00`).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</strong>
              <button className="secondary-button" type="button" onClick={() => setCalendarMonth((current) => shiftMonth(current, 1))}>
                Proximo
              </button>
            </div>
          </header>
          <div className="calendar-weekdays" aria-hidden="true">
            {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'].map((day) => <span key={day}>{day}</span>)}
          </div>
          <div className="collection-calendar-grid">
            {calendarDays.map((day, index) => {
              const total = day.date ? calendarTotals.get(day.date) : undefined
              const buttonClassName = [
                'collection-calendar-day',
                day.date === selectedCalendarDate ? 'collection-calendar-day--selected' : '',
                total ? 'collection-calendar-day--has-receivables' : '',
              ].filter(Boolean).join(' ')
              return (
                <button
                  className={buttonClassName}
                  type="button"
                  key={day.date || `empty-${index}`}
                  disabled={day.muted}
                  onClick={() => handleCalendarDateClick(day.date)}
                >
                  <span>{day.day || ''}</span>
                  {total ? <small>{total.count} cobr. {formatCurrency(total.amount)}</small> : null}
                </button>
              )
            })}
          </div>
        </section>

        <section className="scanner-panel promissory-filter-panel">
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
            <button className="icon-link" type="button" onClick={handleExportCsv} disabled={isExportingCsv}>
              <FileDown size={14} strokeWidth={2.3} aria-hidden="true" />
              {isExportingCsv ? 'Gerando...' : 'CSV'}
            </button>
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
                      {note.customer.name} - {statusLabels[note.status]} - {note.saleId ? `Venda #${note.saleId}` : 'Nota avulsa'} - Parcela {note.installmentNumber}/{note.totalInstallments}
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
                <p>{selectedNote ? `Nota #${selectedNote.id} - ${selectedNote.saleId ? `venda #${selectedNote.saleId}` : 'avulsa'}` : 'Selecione uma parcela.'}</p>
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
                    Nota cancelada{selectedNote.saleId ? ` junto com a venda #${selectedNote.saleId}` : ''}.
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
