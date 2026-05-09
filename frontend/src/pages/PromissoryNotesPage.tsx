import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { AlertCircle, CalendarClock, CheckCircle2, FileDown, Printer, ReceiptText, Search } from 'lucide-react'
import { Metric } from '../components/Metric'
import { PageHeader } from '../components/PageHeader'
import { getCustomers } from '../services/customerService'
import {
  getPromissoryNotePrintUrl,
  getPromissoryNotes,
  getPromissoryNotesDueToday,
  getPromissoryNotesExportUrl,
  payPromissoryNote,
} from '../services/promissoryNoteService'
import type { Customer } from '../types/customer'
import type { PromissoryNote, PromissoryNoteFilters, PromissoryNoteStatus } from '../types/promissoryNote'
import type { PaymentMethod } from '../types/sale'
import { getErrorMessage } from '../utils/errors'
import { formatCurrency, formatNullableDateTime } from '../utils/formatters'
import { useAppMessage } from '../hooks/useAppMessage'

const statusLabels: Record<PromissoryNoteStatus, string> = {
  PENDING: 'Pendente',
  PAID: 'Pago',
  OVERDUE: 'Vencido',
  CANCELLED: 'Cancelado',
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
  const [isLoading, setIsLoading] = useState(true)
  const [isPaying, setIsPaying] = useState(false)
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

  const metrics = useMemo(() => {
    const openNotes = notes.filter((note) => note.status !== 'PAID')
    const today = getLocalToday()
    return {
      openAmount: openNotes.reduce((sum, note) => sum + note.amount, 0),
      overdueAmount: notes.filter((note) => note.status === 'OVERDUE').reduce((sum, note) => sum + note.amount, 0),
      dueTodayAmount: openNotes.filter((note) => note.dueDate === today).reduce((sum, note) => sum + note.amount, 0),
      paidAmount: notes.filter((note) => note.status === 'PAID').reduce((sum, note) => sum + note.amount, 0),
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

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadDueToday()
      getCustomers().then(setCustomers).catch(() => setCustomers([]))
    }, 0)

    return () => window.clearTimeout(timeoutId)
  }, [loadDueToday])

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
  }

  function clearFilters() {
    const nextFilters = {}
    setDraftFilters({ status: '', customerId: '', startDate: '', endDate: '' })
    setFilters(nextFilters)
    setListMode('custom')
    void loadNotes(nextFilters)
  }

  function showDueToday() {
    setDraftFilters({ status: '', customerId: '', startDate: '', endDate: '' })
    setFilters({})
    setListMode('due-today')
    void loadDueToday()
  }

  async function handlePay() {
    if (!selectedNote || selectedNote.status === 'PAID') return

    const confirmed = await confirm({
      type: 'warning',
      title: 'Baixar nota?',
      message: `Registrar recebimento de ${formatCurrency(selectedNote.amount)} no caixa aberto?`,
      confirmLabel: 'Baixar',
      cancelLabel: 'Voltar',
    })
    if (!confirmed) return

    setIsPaying(true)

    try {
      const paidNote = await payPromissoryNote(selectedNote.id, paymentMethod)
      setSelectedNote(paidNote)
      if (listMode === 'due-today') {
        await loadDueToday()
      } else {
        await loadNotes(filters)
      }
      notify({
        type: 'success',
        title: 'Nota baixada',
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
                <option value="OVERDUE">Vencidos</option>
                <option value="PAID">Pagos</option>
                <option value="CANCELLED">Cancelados</option>
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
            <a className="icon-link" href={getPromissoryNotesExportUrl(filters)} target="_blank" rel="noreferrer">
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
                {filteredNotes.map((note) => (
                  <button
                    className={selectedNote?.id === note.id ? 'sale-history-item sale-history-item--active' : 'sale-history-item'}
                    type="button"
                    key={note.id}
                    onClick={() => setSelectedNote(note)}
                  >
                    <span><CalendarClock size={14} strokeWidth={2.3} aria-hidden="true" />Vence {formatDate(note.dueDate)}</span>
                    <strong>{formatCurrency(note.amount)}</strong>
                    <small>
                      {note.customer.name} - {statusLabels[note.status]} - Parcela {note.installmentNumber}/{note.totalInstallments}
                    </small>
                  </button>
                ))}
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
                    <small>{[selectedNote.customer.cpf, selectedNote.customer.phone].filter(Boolean).join(' - ') || 'Sem documento'}</small>
                  </div>
                  <div className="cart-price">
                    <span>Valor</span>
                    <strong>{formatCurrency(selectedNote.amount)}</strong>
                  </div>
                  <div className="cart-price">
                    <span>Vencimento</span>
                    <strong>{formatDate(selectedNote.dueDate)}</strong>
                  </div>
                </article>

                {selectedNote.status === 'PAID' ? (
                  <div className="feedback-message feedback-message--success">
                    Pago em {formatNullableDateTime(selectedNote.paidAt)} por {selectedNote.paymentMethod ?? '-'}.
                  </div>
                ) : selectedNote.status === 'CANCELLED' ? (
                  <div className="feedback-message feedback-message--warning">
                    Nota cancelada junto com a venda #{selectedNote.saleId}.
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
                    <button className="action-button" type="button" disabled={isPaying} onClick={() => void handlePay()}>
                      {isPaying ? 'Baixando...' : 'Baixar no caixa'}
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
                </div>

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
