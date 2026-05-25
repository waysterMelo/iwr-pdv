import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import {
  AlertCircle,
  ArrowLeft,
  CalendarDays,
  CalendarClock,
  CheckCircle2,
  FileDown,
  MessageCircle,
  Package,
  PlusCircle,
  Printer,
  ReceiptText,
  Search,
  X,
  UserCheck,
  RotateCcw,
  Save,
  DollarSign,
  TrendingUp,
  Briefcase
} from 'lucide-react'
import { CurrencyInput } from '../components/CurrencyInput'
import { PercentInput } from '../components/PercentInput'
import { PageHeader } from '../components/PageHeader'
import { PaginationControls } from '../components/PaginationControls'
import { getCustomers } from '../services/customerService'
import {
  createManualPromissoryNotes,
  downloadPromissoryNotesExcelReport,
  getPromissoryNotePrintUrl,
  getPromissoryNoteCalendarDays,
  getPromissoryNotePayments,
  getPromissoryNotes,
  getPromissoryNotesDueToday,
  getPromissoryPaymentReceiptUrl,
  getPromissoryDelinquencyReport,
  getPromissoryWhatsappMessage,
  payPromissoryNote,
} from '../services/promissoryNoteService'
import { getProducts } from '../services/productService'
import type { Customer } from '../types/customer'
import type { Product } from '../types/product'
import type {
  PromissoryNote,
  PromissoryNoteCalendarDay,
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
}

const paymentLabels: Record<Exclude<PaymentMethod, 'PROMISSORY_NOTE'>, string> = {
  CASH: 'Dinheiro',
  PIX: 'Pix',
  DEBIT_CARD: 'Cartão débito',
  CREDIT_CARD: 'Cartão crédito',
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' }).format(new Date(`${value}T00:00:00`))
}

function getDaysInArrears(dueDateStr: string): number {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  
  const dueDate = new Date(dueDateStr + 'T00:00:00')
  dueDate.setHours(0, 0, 0, 0)
  
  const diffTime = today.getTime() - dueDate.getTime()
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  return diffDays > 0 ? diffDays : 0
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

type PromissoryNotesPageMode = 'wallet' | 'manual-create' | 'report'

type ManualNoteItem = {
  productId: number
  name: string
  code: string
  quantity: number
  unitPrice: number
  stockQuantity: number
}

type PromissoryNotesPageProps = {
  mode?: PromissoryNotesPageMode
  onModeChange?: (mode: PromissoryNotesPageMode) => void
}

export function PromissoryNotesPage({ mode, onModeChange }: PromissoryNotesPageProps) {
  const { confirm, notify } = useAppMessage()
  const [notes, setNotes] = useState<PromissoryNote[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [selectedNote, setSelectedNote] = useState<PromissoryNote | null>(null)
  const [filters, setFilters] = useState<PromissoryNoteFilters>({})
  const [draftFilters, setDraftFilters] = useState({ status: '', customerId: '', startDate: '', endDate: '' })
  const [pageMode, setPageMode] = useState<PromissoryNotesPageMode>('wallet')
  const [manualNoteForm, setManualNoteForm] = useState({
    customerId: '',
    discountAmount: '',
    installments: '1',
    firstDueDate: getLocalToday(),
  })
  const effectiveMode = mode ?? pageMode
  const [manualProductSearch, setManualProductSearch] = useState('')
  const [manualProductOptions, setManualProductOptions] = useState<Product[]>([])
  const [manualSelectedProductId, setManualSelectedProductId] = useState('')
  const [manualQuantity, setManualQuantity] = useState('1')
  const [manualUnitPrice, setManualUnitPrice] = useState('')
  const [manualItems, setManualItems] = useState<ManualNoteItem[]>([])
  const [listMode, setListMode] = useState<'due-today' | 'custom'>('due-today')
  const [calendarMonth, setCalendarMonth] = useState(() => getLocalToday().slice(0, 7))
  const [selectedCalendarDate, setSelectedCalendarDate] = useState(() => getLocalToday())
  const [searchTerm, setSearchTerm] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<Exclude<PaymentMethod, 'PROMISSORY_NOTE'>>('CASH')
  const [paymentAmount, setPaymentAmount] = useState('')
  const [interestAmount, setInterestAmount] = useState('0.00')
  const [interestRate, setInterestRate] = useState('0')
  const [payments, setPayments] = useState<PromissoryNotePayment[]>([])
  const [delinquencyReport, setDelinquencyReport] = useState<PromissoryNoteDelinquencyRange[]>([])
  const [calendarReceivableDays, setCalendarReceivableDays] = useState<PromissoryNoteCalendarDay[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isPaying, setIsPaying] = useState(false)
  const [isExportingReport, setIsExportingReport] = useState(false)
  const [isCreatingManualNote, setIsCreatingManualNote] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const printFrameRef = useRef<HTMLIFrameElement>(null)

  function changePageMode(nextMode: PromissoryNotesPageMode) {
    setPageMode(nextMode)
    onModeChange?.(nextMode)
  }

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
    const openNotes = notes.filter((note) => !['PAID', 'CANCELLED'].includes(note.status))
    const today = getLocalToday()
    return {
      openAmount: openNotes.reduce((sum, note) => sum + note.remainingAmount, 0),
      overdueAmount: notes.filter((note) => note.status === 'OVERDUE').reduce((sum, note) => sum + note.remainingAmount, 0),
      dueTodayAmount: openNotes.filter((note) => note.dueDate === today).reduce((sum, note) => sum + note.remainingAmount, 0),
      paidAmount: notes.reduce((sum, note) => sum + note.paidAmount, 0),
      openCount: openNotes.length,
    }
  }, [notes])
  
  const manualSubtotal = useMemo(
    () => manualItems.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0),
    [manualItems],
  )
  const manualDiscountAmount = Number(manualNoteForm.discountAmount) || 0
  const manualTotalAmount = Math.max(manualSubtotal - manualDiscountAmount, 0)

  const loadDueToday = useCallback(async () => {
    setIsLoading(true)
    try {
      const response = await getPromissoryNotesDueToday()
      setNotes(response)
      setSelectedNote((current) => response.find((note) => note.id === current?.id) ?? response[0] ?? null)
      setErrorMessage(null)
    } catch (error) {
      setErrorMessage(getErrorMessage(error, 'Não foi possível carregar notas para cobrança.'))
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
      setErrorMessage(getErrorMessage(error, 'Não foi possível carregar notas promissórias.'))
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
    if (effectiveMode !== 'manual-create') {
      return
    }

    const controller = new AbortController()
    const timeoutId = window.setTimeout(() => {
      getProducts(manualProductSearch, controller.signal)
        .then((products) => setManualProductOptions(products.filter((product) => product.active)))
        .catch(() => setManualProductOptions([]))
    }, 180)

    return () => {
      controller.abort()
      window.clearTimeout(timeoutId)
    }
  }, [effectiveMode, manualProductSearch])

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
        return
      }

      setPaymentAmount(selectedNote.remainingAmount > 0 ? selectedNote.remainingAmount.toFixed(2) : '')
      setInterestAmount('0.00')

      getPromissoryNotePayments(selectedNote.id)
        .then((nextPayments) => {
          if (!isCurrent) return
          setPayments(nextPayments)
        })
        .catch(() => {
          if (!isCurrent) return
          setPayments([])
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

  function handleAddManualItem() {
    const selectedProduct = manualProductOptions.find((product) => String(product.id) === manualSelectedProductId)
    const quantity = Number(manualQuantity)
    const unitPrice = Number(manualUnitPrice)

    if (!selectedProduct || !Number.isInteger(quantity) || quantity < 1 || !Number.isFinite(unitPrice) || unitPrice <= 0) {
      notify({
        type: 'error',
        title: 'Produto incompleto',
        message: 'Selecione o produto, quantidade e valor unitário.',
      })
      return
    }

    if (quantity > selectedProduct.stockQuantity) {
      notify({
        type: 'warning',
        title: 'Estoque insuficiente',
        message: `Disponível em estoque: ${selectedProduct.stockQuantity}.`,
      })
      return
    }

    setManualItems((current) => {
      const existingItem = current.find((item) => item.productId === selectedProduct.id && item.unitPrice === unitPrice)
      if (!existingItem) {
        return [
          ...current,
          {
            productId: selectedProduct.id,
            name: selectedProduct.name,
            code: selectedProduct.code,
            quantity,
            unitPrice,
            stockQuantity: selectedProduct.stockQuantity,
          },
        ]
      }

      return current.map((item) =>
        item === existingItem
          ? { ...item, quantity: Math.min(item.quantity + quantity, selectedProduct.stockQuantity) }
          : item,
      )
    })
    setManualSelectedProductId('')
    setManualQuantity('1')
    setManualUnitPrice('')
  }

  function removeManualItem(productId: number, unitPrice: number) {
    setManualItems((current) => current.filter((item) => item.productId !== productId || item.unitPrice !== unitPrice))
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
    const installmentsCount = Number(manualNoteForm.installments)

    if (!customerId || manualItems.length === 0 || manualTotalAmount <= 0 || !Number.isInteger(installmentsCount) || installmentsCount < 1) {
      notify({
        type: 'error',
        title: 'Nota incompleta',
        message: 'Informe o cliente, produtos, valores e quantidade de parcelas.',
      })
      return
    }

    setIsCreatingManualNote(true)
    try {
      const newNotes = await createManualPromissoryNotes({
        customerId,
        items: manualItems.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
        })),
        discountAmount: manualDiscountAmount > 0 ? manualDiscountAmount : 0,
        installments: buildManualInstallments(manualTotalAmount, installmentsCount, manualNoteForm.firstDueDate),
      })
      setManualNoteForm({ customerId: '', discountAmount: '', installments: '1', firstDueDate: getLocalToday() })
      setManualItems([])
      changePageMode('wallet')
      setListMode('custom')
      setFilters({})
      setDraftFilters({ status: '', customerId: '', startDate: '', endDate: '' })
      await loadNotes({})
      await loadDelinquencyReport()
      await loadCalendarDays(calendarMonth)
      setSelectedNote(newNotes[0] ?? null)
      notify({
        type: 'success',
        title: 'Nota cadastrada',
        message: `${newNotes.length} parcela(s) adicionada(s) à carteira e estoque atualizado.`,
      })
    } catch (error) {
      notify({
        type: 'error',
        title: 'Não foi possível cadastrar',
        message: getErrorMessage(error, 'Revise os dados da nota promissória.'),
      })
    } finally {
      setIsCreatingManualNote(false)
    }
  }

  async function handleExportReport() {
    setIsExportingReport(true)
    try {
      await downloadPromissoryNotesExcelReport(filters)
      notify({
        type: 'success',
        title: 'Relatório Excel gerado',
        message: 'A carteira de notas promissórias foi exportada para Excel com sucesso.',
      })
    } catch (error) {
      notify({
        type: 'error',
        title: 'Relatório indisponível',
        message: getErrorMessage(error, 'Não foi possível exportar o relatório.'),
      })
    } finally {
      setIsExportingReport(false)
    }
  }

  async function handlePay() {
    if (!selectedNote || ['PAID', 'CANCELLED'].includes(selectedNote.status)) return

    const amount = paymentAmount ? Number(paymentAmount) : undefined
    const interest = Math.round(montanteJuros * 100) / 100
    if (amount !== undefined && (!Number.isFinite(amount) || amount <= 0)) {
      notify({
        type: 'error',
        title: 'Valor inválido',
        message: 'Informe um valor de pagamento maior que zero.',
      })
      return
    }

    if (!Number.isFinite(interest) || interest < 0) {
      notify({
        type: 'error',
        title: 'Juros inválido',
        message: 'A taxa de juros informada gerou um valor inválido.',
      })
      return
    }

    const confirmed = await confirm({
      type: 'warning',
      title: 'Baixar nota?',
      message: `Registrar recebimento de ${formatCurrency((amount ?? selectedNote.remainingAmount) + interest)}?`,
      confirmLabel: 'Baixar',
      cancelLabel: 'Voltar',
    })
    if (!confirmed) return

    setIsPaying(true)

    try {
      const paidNote = await payPromissoryNote(selectedNote.id, paymentMethod, amount, interest)
      setSelectedNote(paidNote)
      setInterestRate('0')
      await refreshCurrentList()
      notify({
        type: 'success',
        title: paidNote.status === 'PAID' ? 'Nota baixada' : 'Pagamento parcial',
        message: `Parcela #${paidNote.id} registrada como recebida.`,
      })
    } catch (error) {
      notify({
        type: 'error',
        title: 'Não foi possível baixar',
        message: getErrorMessage(error, 'Não foi possível registrar o recebimento.'),
      })
    } finally {
      setIsPaying(false)
    }
  }


  async function handlePrintNote() {
    if (!selectedNote) return
    const printWindow = window.open(getPromissoryNotePrintUrl(selectedNote.id), '_blank')
    printWindow?.addEventListener('load', () => {
      printWindow.print()
    })
  }

  async function handleWhatsappMessage() {
    if (!selectedNote) return
    try {
      const message = await getPromissoryWhatsappMessage(selectedNote.id)
      window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer')
    } catch (error) {
      notify({
        type: 'error',
        title: 'Mensagem indisponível',
        message: getErrorMessage(error, 'Não foi possível gerar a mensagem de cobrança.'),
      })
    }
  }

  // Visual do Mapeamento Cromático de Status
  const getStatusBadgeStyle = (status: PromissoryNoteStatus) => {
    if (status === 'PAID') {
      return { border: '1px solid rgba(45, 212, 191, 0.28)', background: 'rgba(45, 212, 191, 0.1)', color: '#8ff2e7' }
    }
    if (status === 'OVERDUE') {
      return { border: '1px solid rgba(251, 113, 133, 0.28)', background: 'rgba(251, 113, 133, 0.1)', color: '#fb7185' }
    }
    if (['PENDING', 'PARTIALLY_PAID'].includes(status)) {
      return { border: '1px solid rgba(215, 173, 85, 0.28)', background: 'rgba(215, 173, 85, 0.1)', color: '#f6d78b' }
    }
    return { border: '1px solid rgba(226, 232, 240, 0.1)', background: 'rgba(255, 255, 255, 0.05)', color: '#7b8493' }
  }

  /* TELA 2: CADASTRAR COM PRODUTOS (MANUAL CREATE) */
  if (effectiveMode === 'manual-create') {
    return (
      <main className="app-shell customer-premium-shell">
        <div className="app-container customer-premium-container">
          
          <div className="customer-premium-hero">
            <section className="customer-premium-banner">
              <div className="customer-premium-badges">
                <span>★ LANÇAMENTO AVULSO</span>
                <strong>Lançamento manual</strong>
              </div>
              <h1>Cadastrar nota com produtos</h1>
              <p>Monte uma venda a prazo de forma manual. O estoque de peças do Atelier será atualizado automaticamente ao finalizar.</p>
            </section>

            <section className="customer-premium-target-card">
              <div>
                <span>Total Lançado</span>
                <small>Estoque e parcelas</small>
              </div>
              <strong style={{ color: '#f6d78b' }}>{formatCurrency(manualTotalAmount)}</strong>
              <div className="customer-premium-progress">
                <span style={{ width: manualItems.length > 0 ? '100%' : '0%' }} />
              </div>
            </section>
          </div>

          <div className="quick-actions" style={{ display: 'flex', gap: '12px', background: '#101117', padding: '16px', borderRadius: '16px', border: '1px solid rgba(226,232,240,0.08)' }}>
            <button className="customer-premium-secondary-button" type="button" onClick={() => changePageMode('wallet')} disabled={isCreatingManualNote} style={{ minHeight: '40px' }}>
              <ArrowLeft size={14} style={{ marginRight: '6px' }} /> Voltar para Carteira
            </button>
          </div>

          <div className="sales-checkout-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '22px', alignItems: 'start' }}>
            
            {/* Lançamento de Itens */}
            <section className="customer-premium-form-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <header style={{ borderBottom: '1px solid rgba(226,232,240,0.08)', paddingBottom: '14px' }}>
                <h2 style={{ fontSize: '1.1rem', color: '#fff', margin: 0, fontWeight: 500 }}>Pesquisa de produtos</h2>
                <p style={{ margin: 0, fontSize: '0.8rem', color: '#aeb8c8' }}>Pesquise e insira os produtos que compõem o parcelamento.</p>
              </header>

              <div className="customer-premium-form" style={{ padding: 0, display: 'grid', gap: '14px' }}>
                <div className="field-group">
                  <label htmlFor="manualProductSearch">Filtrar Produtos</label>
                  <div className="customer-premium-search-input" style={{ width: '100%' }}>
                    <Search size={16} />
                    <input
                      id="manualProductSearch"
                      value={manualProductSearch}
                      onChange={(event) => setManualProductSearch(event.target.value)}
                      placeholder="Pesquise por nome ou código do produto..."
                    />
                  </div>
                </div>

                <div className="field-group">
                  <label htmlFor="manualProductSelect">Selecione o Produto</label>
                  <select
                    id="manualProductSelect"
                    value={manualSelectedProductId}
                    onChange={(event) => {
                      setManualSelectedProductId(event.target.value)
                      const prod = manualProductOptions.find((p) => String(p.id) === event.target.value)
                      if (prod) {
                        setManualUnitPrice(prod.price.toFixed(2))
                      }
                    }}
                    style={{ minHeight: '48px', borderRadius: '12px' }}
                  >
                    <option value="">Selecione na lista...</option>
                    {manualProductOptions.map((product) => (
                      <option value={product.id} key={product.id}>
                        {product.name} ({product.code}) — Preço: {formatCurrency(product.price)} — Estoque: {product.stockQuantity} un.
                      </option>
                    ))}
                  </select>
                </div>

                <div className="customer-premium-form-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
                  <div className="field-group">
                    <label htmlFor="manualQuantity">Quantidade</label>
                    <input
                      id="manualQuantity"
                      inputMode="numeric"
                      value={manualQuantity}
                      onChange={(event) => setManualQuantity(event.target.value)}
                      style={{ minHeight: '48px', borderRadius: '12px' }}
                    />
                  </div>
                  <div className="field-group">
                    <label htmlFor="manualUnitPrice">Preço Unitário R$</label>
                    <CurrencyInput
                      id="manualUnitPrice"
                      value={manualUnitPrice}
                      onChange={(value) => setManualUnitPrice(value)}
                      style={{ minHeight: '48px', borderRadius: '12px' }}
                    />
                  </div>
                </div>

                <button 
                  type="button" 
                  className="customer-premium-primary-button" 
                  onClick={handleAddManualItem}
                  style={{ minHeight: '44px', width: '100%', marginTop: '10px' }}
                >
                  <PlusCircle size={16} style={{ marginRight: '6px' }} /> Inserir Item na Nota
                </button>
              </div>
            </section>

            {/* Configuração Financeira e Finalização */}
            <section className="customer-premium-form-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <header style={{ borderBottom: '1px solid rgba(226,232,240,0.08)', paddingBottom: '14px' }}>
                <h2 style={{ fontSize: '1.1rem', color: '#fff', margin: 0, fontWeight: 500 }}>Configuração da nota</h2>
                <p style={{ margin: 0, fontSize: '0.8rem', color: '#aeb8c8' }}>Revise o cliente associado e as parcelas.</p>
              </header>

              <form className="customer-premium-form" onSubmit={handleManualNoteSubmit} style={{ padding: 0, display: 'grid', gap: '14px' }}>
                <div className="field-group">
                  <label htmlFor="manualNoteCustomer">Cliente Associado</label>
                  <select
                    id="manualNoteCustomer"
                    value={manualNoteForm.customerId}
                    onChange={(event) => setManualNoteForm((current) => ({ ...current, customerId: event.target.value }))}
                    required
                    style={{ minHeight: '48px', borderRadius: '12px' }}
                  >
                    <option value="">Selecione o cliente na base de dados...</option>
                    {customers.map((customer) => (
                      <option value={customer.id} key={customer.id}>{customer.name}</option>
                    ))}
                  </select>
                </div>

                <div className="customer-premium-form-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
                  <div className="field-group">
                    <label htmlFor="manualDiscount">Desconto R$</label>
                    <CurrencyInput
                      id="manualDiscount"
                      value={manualNoteForm.discountAmount}
                      onChange={(value) => setManualNoteForm((current) => ({ ...current, discountAmount: value }))}
                    />
                  </div>
                  <div className="field-group">
                    <label htmlFor="manualInstallments">Quantidade Parcelas</label>
                    <select
                      id="manualInstallments"
                      value={manualNoteForm.installments}
                      onChange={(event) => setManualNoteForm((current) => ({ ...current, installments: event.target.value }))}
                      style={{ minHeight: '48px', borderRadius: '12px' }}
                    >
                      {[1, 2, 3, 4, 5, 6, 8, 10, 12].map((c) => (
                        <option value={c} key={c}>{c}x</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="field-group">
                  <label htmlFor="manualFirstDueDate">Primeiro Vencimento</label>
                  <input
                    id="manualFirstDueDate"
                    type="date"
                    value={manualNoteForm.firstDueDate}
                    onChange={(event) => setManualNoteForm((current) => ({ ...current, firstDueDate: event.target.value }))}
                    required
                    style={{ colorScheme: 'dark', minHeight: '48px', borderRadius: '12px' }}
                  />
                </div>

                {/* Resumo de itens adicionados */}
                <div style={{ borderTop: '1px solid rgba(226,232,240,0.06)', paddingTop: '14px' }}>
                  <span style={{ fontSize: '0.62rem', color: '#7b8493', textTransform: 'uppercase', fontWeight: 900 }}>Itens na Nota</span>
                  {manualItems.length === 0 ? (
                    <div style={{ color: '#7b8493', fontSize: '0.8rem', padding: '16px 0' }}>Nenhum item inserido ainda.</div>
                  ) : (
                    <div style={{ display: 'grid', gap: '8px', marginTop: '6px', maxHeight: '180px', overflowY: 'auto' }}>
                      {manualItems.map((item) => (
                        <div key={item.productId} style={{ background: '#0d1016', border: '1px solid rgba(226,232,240,0.05)', borderRadius: '10px', padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <strong style={{ color: '#fff', fontSize: '0.85rem', display: 'block' }}>{item.name}</strong>
                            <small style={{ color: '#7b8493', fontSize: '0.7rem' }}>Código: {item.code} — {item.quantity} un. x {formatCurrency(item.unitPrice)}</small>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                            <strong style={{ color: '#f6d78b', fontSize: '0.85rem' }}>{formatCurrency(item.unitPrice * item.quantity)}</strong>
                            <button type="button" onClick={() => removeManualItem(item.productId, item.unitPrice)} style={{ border: 0, background: 'transparent', color: '#fb7185', cursor: 'pointer', fontSize: '0.75rem' }}>Excluir</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <button 
                  className="customer-premium-primary-button" 
                  type="submit" 
                  disabled={isCreatingManualNote || manualItems.length === 0}
                  style={{ minHeight: '44px', width: '100%', marginTop: '10px' }}
                >
                  <Save size={16} style={{ marginRight: '6px' }} />
                  {isCreatingManualNote ? 'Lançando Nota...' : 'Gerar e Finalizar Notas Promissórias'}
                </button>
              </form>
            </section>

          </div>
        </div>
      </main>
    )
  }

  /* TELA 3: RELATÓRIO DE INADIMPLÊNCIA / EXCEL */
  if (effectiveMode === 'report') {
    return (
      <main className="app-shell customer-premium-shell">
        <div className="app-container customer-premium-container">
          
          <div className="customer-premium-hero">
            <section className="customer-premium-banner">
              <div className="customer-premium-badges">
                <span>★ RELATÓRIO EXCEL</span>
                <strong>Exportação</strong>
              </div>
              <h1>Relatório de Inadimplência</h1>
              <p>Exporte a carteira de promissórias ou filtre devedores para gerar arquivos Excel consolidados.</p>
            </section>
          </div>

          <div className="quick-actions" style={{ display: 'flex', gap: '12px', background: '#101117', padding: '16px', borderRadius: '16px', border: '1px solid rgba(226,232,240,0.08)' }}>
            <button className="customer-premium-secondary-button" type="button" onClick={() => changePageMode('wallet')} style={{ minHeight: '40px' }}>
              <ArrowLeft size={14} style={{ marginRight: '6px' }} /> Voltar para Carteira
            </button>
            <button 
              className="customer-premium-primary-button" 
              type="button" 
              onClick={handleExportReport} 
              disabled={isExportingReport}
              style={{ minHeight: '40px' }}
            >
              <FileDown size={14} style={{ marginRight: '6px' }} /> Exportar Toda a Carteira (Excel)
            </button>
          </div>

          {/* Grid de Inadimplência */}
          <section className="customer-premium-list-panel" style={{ padding: '24px' }}>
            <header style={{ marginBottom: '20px' }}>
              <h2 style={{ fontSize: '1.1rem', color: '#fff', margin: 0, fontWeight: 500 }}>Divisão de Atrasos por Período</h2>
              <p style={{ margin: 0, fontSize: '0.8rem', color: '#aeb8c8' }}>Veja a quantidade de notas promissórias e valores totais pendentes agrupados por faixas de dias.</p>
            </header>

            <div className="customer-premium-card-grid">
              {delinquencyReport.length === 0 ? (
                <div className="product-empty">Nenhuma faixa de atraso encontrada na base de dados.</div>
              ) : (
                delinquencyReport.map((range, index) => (
                  <article key={index} className="customer-premium-card" style={{ borderLeft: '4px solid #fb7185' }}>
                    <div className="customer-premium-card-header">
                      <div>
                        <h3 style={{ fontSize: '0.9rem', color: '#fff', margin: '0 0 4px' }}>Atraso: {range.daysRange} dias</h3>
                        <span style={{ fontSize: '0.68rem', background: '#151922', padding: '2px 6px', borderRadius: '4px', color: '#fb7185', fontWeight: 'bold' }}>
                          Inadimplente
                        </span>
                      </div>
                      <strong className="customer-premium-status" style={{ border: '1px solid rgba(251,113,133,0.3)', background: 'rgba(251,113,133,0.1)', color: '#fb7185' }}>
                        {range.count} nota(s)
                      </strong>
                    </div>

                    <div className="customer-premium-contact-box" style={{ marginTop: '10px' }}>
                      <div>
                        <span>Valor Total em Atraso</span>
                        <strong style={{ color: '#fb7185', fontSize: '1.15rem' }}>{formatCurrency(range.amount)}</strong>
                      </div>
                    </div>
                  </article>
                ))
              )}
            </div>
          </section>
        </div>
      </main>
    )
  }

  const diasAtraso = selectedNote ? getDaysInArrears(selectedNote.dueDate) : 0
  const valorPrincipal = Number(paymentAmount) || 0
  const taxaJuros = Number(interestRate) || 0
  const montanteJuros = valorPrincipal * (taxaJuros / 100) * diasAtraso
  const valorTotalBaixa = valorPrincipal + montanteJuros

  /* TELA 1: CARTEIRA DE COBRANÇA (WALLET) - TELA PRINCIPAL */
  return (
    <main className="app-shell customer-premium-shell">
      <div className="app-container customer-premium-container">
        
        {/* Banner do Topo */}
        <div className="customer-premium-hero">
          <section className="customer-premium-banner">
            <div className="customer-premium-badges">
              <span>★ RECEBÍVEIS</span>
              <strong>{notes.length} parcela(s) encontradas</strong>
            </div>
            <h1>Carteira de notas promissórias</h1>
            <p>Gerencie o faturamento a prazo, liquidações, registros de cobrança e renegociações de parcelas do Atelier.</p>
          </section>

          <section className="customer-premium-target-card">
            <div>
              <span>Vence Hoje</span>
              <small>Foco do dia</small>
            </div>
            <strong style={{ color: '#f6d78b' }}>{formatCurrency(metrics.dueTodayAmount)}</strong>
            <div className="customer-premium-progress">
              <span style={{ width: notes.length > 0 ? '100%' : '0%' }} />
            </div>
          </section>
        </div>

        {/* Métricas e Botões Rápidos */}
        <div className="customer-premium-metrics">
          <article>
            <div>
              <span>Saldo em aberto</span>
              <strong>{formatCurrency(metrics.openAmount)}</strong>
            </div>
            <ReceiptText size={19} aria-hidden="true" />
          </article>

          <article style={{ borderColor: metrics.overdueAmount > 0 ? 'rgba(251,113,133,0.4)' : undefined }}>
            <div>
              <span>Total vencido</span>
              <strong style={{ color: metrics.overdueAmount > 0 ? '#fb7185' : '#fff' }}>{formatCurrency(metrics.overdueAmount)}</strong>
            </div>
            <AlertCircle size={19} aria-hidden="true" style={{ color: '#fb7185', background: 'rgba(251,113,133,0.1)' }} />
          </article>

          <article>
            <div>
              <span>Vence hoje</span>
              <strong style={{ color: '#f6d78b' }}>{formatCurrency(metrics.dueTodayAmount)}</strong>
            </div>
            <CalendarClock size={19} aria-hidden="true" style={{ color: '#d7ad55', background: 'rgba(215, 173, 85, 0.1)' }} />
          </article>

          <article>
            <div>
              <span>Total recebido</span>
              <strong style={{ color: '#2dd4bf' }}>{formatCurrency(metrics.paidAmount)}</strong>
            </div>
            <CheckCircle2 size={19} aria-hidden="true" style={{ color: '#2dd4bf', background: 'rgba(45, 212, 191, 0.1)' }} />
          </article>
        </div>

        {/* Ações e Sub-Navegação */}
        <div className="quick-actions" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#101117', padding: '16px', borderRadius: '16px', border: '1px solid rgba(226,232,240,0.08)' }}>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button 
              className={listMode === 'due-today' ? 'customer-premium-primary-button' : 'customer-premium-secondary-button'} 
              type="button" 
              onClick={showDueToday}
              style={{ minHeight: '38px', fontSize: '0.72rem' }}
            >
              Vencem Hoje
            </button>
            <button 
              className={listMode === 'custom' ? 'customer-premium-primary-button' : 'customer-premium-secondary-button'} 
              type="button" 
              onClick={() => void loadNotes(filters)}
              style={{ minHeight: '38px', fontSize: '0.72rem' }}
            >
              Exibir Filtradas / Todas
            </button>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button 
              className="customer-premium-primary-button" 
              type="button" 
              onClick={() => changePageMode('manual-create')}
              style={{ minHeight: '38px', fontSize: '0.72rem' }}
            >
              <PlusCircle size={14} style={{ marginRight: '6px' }} /> Novo Lançamento Manual
            </button>
            <button 
              className="customer-premium-secondary-button" 
              type="button" 
              onClick={() => changePageMode('report')}
              style={{ minHeight: '38px', fontSize: '0.72rem' }}
            >
              <FileDown size={14} style={{ marginRight: '6px' }} /> Relatório Inadimplência
            </button>
          </div>
        </div>

        {/* Layout da Carteira (Filtro e Grid Lado a Lado) */}
        <div className="sales-checkout-grid" style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '22px', alignItems: 'start' }}>
          
          {/* COLUNA ESQUERDA: Busca, Filtros e Lista */}
          <div style={{ display: 'grid', gap: '22px' }}>
            
            {/* Filtros da Carteira */}
            <section className="customer-premium-form-panel" style={{ padding: '24px' }}>
              <header style={{ borderBottom: '1px solid rgba(226,232,240,0.08)', paddingBottom: '14px', marginBottom: '16px' }}>
                <h2 style={{ fontSize: '1rem', color: '#fff', margin: 0, fontWeight: 500 }}>Filtros da carteira</h2>
              </header>

              <form className="customer-premium-search" onSubmit={handleFilterSubmit} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto auto', gap: '12px', alignItems: 'end' }}>
                <div className="field-group">
                  <label htmlFor="filterStatus">Status</label>
                  <select
                    id="filterStatus"
                    value={draftFilters.status}
                    onChange={(event) => setDraftFilters((current) => ({ ...current, status: event.target.value }))}
                    style={{ minHeight: '48px', borderRadius: '12px' }}
                  >
                    <option value="">Todos</option>
                    <option value="PENDING">Pendente</option>
                    <option value="PARTIALLY_PAID">Parcial</option>
                    <option value="PAID">Pago</option>
                    <option value="OVERDUE">Vencido</option>
                    <option value="CANCELLED">Cancelado</option>
                  </select>
                </div>

                <div className="field-group">
                  <label htmlFor="filterCustomer">Cliente</label>
                  <select
                    id="filterCustomer"
                    value={draftFilters.customerId}
                    onChange={(event) => setDraftFilters((current) => ({ ...current, customerId: event.target.value }))}
                    style={{ minHeight: '48px', borderRadius: '12px' }}
                  >
                    <option value="">Todos</option>
                    {customers.map((c) => (
                      <option value={c.id} key={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div className="field-group">
                  <label htmlFor="filterSearch">Busca rápida</label>
                  <div className="customer-premium-search-input" style={{ width: '100%' }}>
                    <Search size={16} />
                    <input
                      id="filterSearch"
                      value={searchTerm}
                      onChange={(event) => setSearchTerm(event.target.value)}
                      placeholder="Cliente, CPF ou Venda..."
                    />
                  </div>
                </div>

                <button className="customer-premium-primary-button" type="submit" style={{ minHeight: '48px' }}>
                  Filtrar
                </button>
                
                <button className="customer-premium-secondary-button" type="button" onClick={clearFilters} style={{ minHeight: '48px' }}>
                  Limpar
                </button>
              </form>
            </section>

            {/* Listagem de Notas Promissórias */}
            <section className="customer-premium-list-panel" style={{ padding: '24px' }}>
              <header style={{ borderBottom: '1px solid rgba(226,232,240,0.08)', paddingBottom: '14px', marginBottom: '16px' }}>
                <h2 style={{ fontSize: '1rem', color: '#fff', margin: 0, fontWeight: 500 }}>
                  {listMode === 'due-today' ? 'Parcelas vencendo hoje' : 'Todas as parcelas filtradas'}
                </h2>
              </header>

              {isLoading ? (
                <div className="product-empty">Carregando carteira de recebíveis...</div>
              ) : filteredNotes.length === 0 ? (
                <div className="product-empty" style={{ background: '#0d1016', borderRadius: '16px', padding: '40px' }}>Nenhuma nota promissória pendente para o filtro selecionado.</div>
              ) : (
                <div style={{ display: 'grid', gap: '12px' }}>
                  {notePagination.pageItems.map((note) => {
                    const isSelected = selectedNote?.id === note.id
                    return (
                      <div 
                        key={note.id}
                        onClick={() => setSelectedNote(note)}
                        style={{
                          background: isSelected ? 'rgba(215, 173, 85, 0.05)' : '#0d1016',
                          border: isSelected ? '1px solid rgba(215, 173, 85, 0.55)' : '1px solid rgba(226, 232, 240, 0.06)',
                          borderRadius: '12px',
                          padding: '14px 18px',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          cursor: 'pointer',
                          transition: 'all 0.2s'
                        }}
                      >
                        <div style={{ display: 'grid', gap: '3px' }}>
                          <span style={{ fontSize: '0.62rem', background: '#151922', color: '#aeb8c8', fontFamily: 'monospace', padding: '2px 6px', borderRadius: '4px', width: 'fit-content' }}>
                            Nota #{note.id}
                          </span>
                          <strong style={{ color: '#fff', fontSize: '0.9rem' }}>{note.customer.name}</strong>
                          <small style={{ color: '#7b8493', fontSize: '0.72rem' }}>
                            Vence em: {note.dueDate.split('-').reverse().join('/')} — {note.saleId ? `Venda #${note.saleId}` : 'Nota Avulsa'}
                          </small>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                          <div style={{ textAlign: 'right' }}>
                            <span style={{ fontSize: '0.62rem', color: '#707b8c', textTransform: 'uppercase', display: 'block' }}>Saldo Devedor</span>
                            <strong style={{ color: '#f6d78b', fontSize: '0.95rem' }}>{formatCurrency(note.remainingAmount)}</strong>
                          </div>
                          
                          <span 
                            className="status-badge" 
                            style={{ 
                              ...getStatusBadgeStyle(note.status),
                              fontSize: '0.62rem',
                              fontWeight: 900,
                              textTransform: 'uppercase',
                              padding: '2px 8px',
                              borderRadius: '4px'
                            }}
                          >
                            {statusLabels[note.status]}
                          </span>
                        </div>
                      </div>
                    )
                  })}

                  <PaginationControls
                    itemLabel="notas"
                    page={notePagination.page}
                    pageSize={notePagination.pageSize}
                    totalItems={notePagination.totalItems}
                    totalPages={notePagination.totalPages}
                    onPageChange={notePagination.setPage}
                  />
                </div>
              )}
            </section>
          </div>

          {/* COLUNA DIREITA: Painel de Cobrança / Baixa (Nota Selecionada) */}
          <div style={{ display: 'grid', gap: '22px' }}>
            
            {/* Calendário Compacto */}
            <section className="customer-premium-form-panel" style={{ padding: '24px' }}>
              <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(226,232,240,0.08)', paddingBottom: '10px', marginBottom: '14px' }}>
                <h3 style={{ fontSize: '0.9rem', color: '#fff', margin: 0, fontWeight: 500 }}>Vencimentos no mês</h3>
                <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                  <button type="button" className="customer-premium-secondary-button" onClick={() => setCalendarMonth((current) => shiftMonth(current, -1))} style={{ minHeight: '26px', padding: '0 8px', fontSize: '0.6rem' }}>&lt;</button>
                  <span style={{ fontSize: '0.72rem', color: '#fff', fontWeight: 'bold', padding: '0 4px' }}>
                    {new Date(`${calendarMonth}-01T00:00:00`).toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' })}
                  </span>
                  <button type="button" className="customer-premium-secondary-button" onClick={() => setCalendarMonth((current) => shiftMonth(current, 1))} style={{ minHeight: '26px', padding: '0 8px', fontSize: '0.6rem' }}>&gt;</button>
                </div>
              </header>

              <div className="calendar-weekdays" style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', textAlign: 'center', fontSize: '0.62rem', color: '#7b8493', textTransform: 'uppercase', fontWeight: 900, marginBottom: '6px' }}>
                {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((day) => <span key={day}>{day}</span>)}
              </div>
              <div className="collection-calendar-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px' }}>
                {calendarDays.map((day, index) => {
                  const total = day.date ? calendarTotals.get(day.date) : undefined
                  const isSelected = day.date === selectedCalendarDate
                  return (
                    <button
                      key={day.date || `cal-empty-${index}`}
                      type="button"
                      disabled={day.muted}
                      onClick={() => handleCalendarDateClick(day.date)}
                      style={{
                        minHeight: '34px',
                        background: isSelected ? 'rgba(215, 173, 85, 0.25)' : total ? 'rgba(215, 173, 85, 0.08)' : '#0d1016',
                        border: isSelected ? '1px solid #d7ad55' : total ? '1px solid rgba(215, 173, 85, 0.25)' : '1px solid rgba(226, 232, 240, 0.04)',
                        borderRadius: '6px',
                        color: day.muted ? '#7b8493' : '#fff',
                        cursor: day.muted ? 'default' : 'pointer',
                        fontSize: '0.75rem',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        position: 'relative'
                      }}
                    >
                      <span>{day.day || ''}</span>
                      {total ? <span style={{ width: '4px', height: '4px', borderRadius: '50%', background: '#f6d78b', marginTop: '2px' }} /> : null}
                    </button>
                  )
                })}
              </div>
            </section>

            {/* Painel da Nota Selecionada */}
            {selectedNote ? (
              <section className="customer-premium-form-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
                
                {/* Cabeçalho da Nota */}
                <header style={{ borderBottom: '1px solid rgba(226,232,240,0.08)', paddingBottom: '14px' }}>
                  <span style={{ fontSize: '0.62rem', background: '#151922', color: '#aeb8c8', fontFamily: 'monospace', padding: '2px 6px', borderRadius: '4px', width: 'fit-content' }}>
                    Parcela selecionada: #{selectedNote.id}
                  </span>
                  <h2 style={{ fontSize: '1.2rem', color: '#fff', margin: '4px 0 2px', fontWeight: 500 }}>{selectedNote.customer.name}</h2>
                  <p style={{ margin: 0, fontSize: '0.78rem', color: '#aeb8c8' }}>
                    Vencimento em: <strong>{selectedNote.dueDate.split('-').reverse().join('/')}</strong>
                  </p>
                </header>

                {/* Dados Consolidados */}
                <div className="customer-premium-contact-box" style={{ padding: '12px' }}>
                  <div>
                    <span>Total da Parcela</span>
                    <strong>{formatCurrency(selectedNote.amount)}</strong>
                  </div>
                  <div>
                    <span>Saldo Recebido</span>
                    <strong>{formatCurrency(selectedNote.paidAmount)}</strong>
                  </div>
                  <div>
                    <span>Saldo Restante</span>
                    <strong style={{ color: '#f6d78b', fontSize: '1.1rem' }}>{formatCurrency(selectedNote.remainingAmount)}</strong>
                  </div>
                  {selectedNote.customer.phone && (
                    <div>
                      <span>Telefone</span>
                      <strong>{maskPhone(selectedNote.customer.phone)}</strong>
                    </div>
                  )}
                </div>

                {/* Ações de Impressão e WhatsApp */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <button className="customer-premium-secondary-button" type="button" onClick={handlePrintNote} style={{ minHeight: '34px', fontSize: '0.65rem' }}>
                    <Printer size={12} /> Imprimir Promissória
                  </button>
                  <button className="customer-premium-secondary-button" type="button" onClick={handleWhatsappMessage} style={{ minHeight: '34px', fontSize: '0.65rem', background: 'rgba(37, 211, 102, 0.08)', border: '1px solid rgba(37, 211, 102, 0.25)', color: '#25D366' }}>
                    <MessageCircle size={12} /> WhatsApp Cobrança
                  </button>
                </div>

                {/* Histórico de Pagamentos */}
                <div style={{ borderTop: '1px solid rgba(226,232,240,0.06)', paddingTop: '14px' }}>
                  <span style={{ fontSize: '0.62rem', color: '#7b8493', textTransform: 'uppercase', fontWeight: 900 }}>Histórico de Recebimentos</span>
                  {payments.length === 0 ? (
                    <div style={{ color: '#7b8493', fontSize: '0.72rem', padding: '8px 0' }}>Nenhum pagamento recebido nesta parcela.</div>
                  ) : (
                    <div style={{ display: 'grid', gap: '6px', marginTop: '6px' }}>
                      {payments.map((p) => (
                        <div key={p.id} style={{ background: '#0d1016', borderRadius: '8px', padding: '8px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <strong style={{ color: '#fff', fontSize: '0.75rem', display: 'block' }}>Recebimento #{p.id}</strong>
                            <small style={{ color: '#7b8493', fontSize: '0.68rem' }}>Método: {paymentLabels[p.paymentMethod]} — {formatNullableDateTime(p.paidAt)}</small>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <strong style={{ color: '#2dd4bf', fontSize: '0.78rem' }}>+{formatCurrency(p.amount)}</strong>
                            {p.interestAmount > 0 && <small style={{ display: 'block', fontSize: '0.65rem', color: '#fb7185' }}>Juros: {formatCurrency(p.interestAmount)}</small>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Seção de Baixa / Recebimento */}
                {selectedNote.remainingAmount > 0 && (
                  <div style={{ borderTop: '1px solid rgba(226,232,240,0.06)', paddingTop: '14px', display: 'grid', gap: '12px' }}>
                    <span style={{ fontSize: '0.62rem', color: '#f6d78b', textTransform: 'uppercase', fontWeight: 900 }}>Registrar Pagamento / Baixa</span>
                    
                    <div className="customer-premium-form-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                      <div className="field-group">
                        <label htmlFor="payMethod">Forma de Pagamento</label>
                        <select
                          id="payMethod"
                          value={paymentMethod}
                          onChange={(e) => setPaymentMethod(e.target.value as Exclude<PaymentMethod, 'PROMISSORY_NOTE'>)}
                          style={{ minHeight: '38px', borderRadius: '8px', padding: '0 8px', fontSize: '0.75rem' }}
                        >
                          <option value="CASH">Dinheiro</option>
                          <option value="PIX">Pix</option>
                          <option value="DEBIT_CARD">Débito</option>
                          <option value="CREDIT_CARD">Crédito</option>
                        </select>
                      </div>

                      <div className="field-group" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                        <label style={{ fontSize: '0.62rem', color: '#7b8493', textTransform: 'uppercase', fontWeight: 900, marginBottom: '4px' }}>Dias em Atraso</label>
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          padding: '6px 12px',
                          borderRadius: '8px',
                          fontSize: '0.75rem',
                          fontWeight: 'bold',
                          width: 'fit-content',
                          background: diasAtraso > 0 ? 'rgba(251,113,133,0.1)' : 'rgba(45,212,191,0.1)',
                          border: diasAtraso > 0 ? '1px solid rgba(251,113,133,0.3)' : '1px solid rgba(45,212,191,0.3)',
                          color: diasAtraso > 0 ? '#fb7185' : '#2dd4bf'
                        }}>
                          {diasAtraso > 0 ? `${diasAtraso} dia(s) em atraso` : 'Em dia'}
                        </span>
                      </div>
                    </div>

                    <div className="customer-premium-form-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                      <div className="field-group">
                        <label htmlFor="interestRateInput">Juros % (ao dia)</label>
                        <PercentInput
                          id="interestRateInput"
                          value={interestRate}
                          onChange={(val) => setInterestRate(val)}
                          style={{ minHeight: '38px', borderRadius: '8px', padding: '0 8px', fontSize: '0.75rem' }}
                        />
                      </div>

                      <div className="field-group">
                        <label htmlFor="payAmount">Valor da Baixa R$</label>
                        <CurrencyInput
                          id="payAmount"
                          value={paymentAmount}
                          onChange={(val) => setPaymentAmount(val)}
                          style={{ minHeight: '38px', borderRadius: '8px', padding: '0 8px', fontSize: '0.75rem' }}
                        />
                      </div>
                    </div>

                    <div className="customer-premium-form-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '10px', background: 'rgba(215, 173, 85, 0.04)', border: '1px solid rgba(215, 173, 85, 0.1)', padding: '12px', borderRadius: '8px', marginTop: '4px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <span style={{ fontSize: '0.62rem', color: '#7b8493', textTransform: 'uppercase', fontWeight: 900 }}>Valor Juros</span>
                        <strong style={{ fontSize: '1rem', color: montanteJuros > 0 ? '#fb7185' : '#aeb8c8' }}>
                          {formatCurrency(montanteJuros)}
                        </strong>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', textAlign: 'right' }}>
                        <span style={{ fontSize: '0.62rem', color: '#f6d78b', textTransform: 'uppercase', fontWeight: 900 }}>Total a Baixar</span>
                        <strong style={{ fontSize: '1.1rem', color: '#2dd4bf' }}>
                          {formatCurrency(valorTotalBaixa)}
                        </strong>
                      </div>
                    </div>

                    <button 
                      type="button" 
                      className="customer-premium-primary-button" 
                      onClick={handlePay} 
                      disabled={isPaying}
                      style={{ minHeight: '38px', width: '100%', marginTop: '4px' }}
                    >
                      {isPaying ? 'Registrando...' : 'Confirmar e Baixar Parcela'}
                    </button>
                  </div>
                )}



              </section>
            ) : (
              <div className="product-empty" style={{ background: '#0d1016', borderRadius: '16px', padding: '40px' }}>Selecione uma nota promissória na carteira para realizar baixas ou registrar cobranças.</div>
            )}
          </div>

        </div>

      </div>
    </main>
  )
}
