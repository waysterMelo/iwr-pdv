import { useCallback, useEffect, useMemo, useState, useRef, type FormEvent } from 'react'
import { AlertTriangle, CheckCircle2, Clock, Copy, CreditCard, DollarSign, Download, Edit3, Eye, FileText, Gift, Heart, Mail, MapPin, Phone, Printer, Receipt, RotateCcw, Save, Search, ShoppingBag, TrendingUp, UserCheck, UserPlus, Users, X } from 'lucide-react'
import { createCustomer, downloadCustomerProfileExcelReport, getCustomerPage, getCustomerProfile, getCustomers, updateCustomer } from '../services/customerService'
import { getSaleReceiptUrl } from '../services/saleService'
import { getPromissoryNotePrintUrl, getPromissoryPaymentReceiptUrl } from '../services/promissoryNoteService'
import type { Customer, CustomerPayload, CustomerProfile, CustomerProfileInsight, CustomerPromissoryNote } from '../types/customer'
import type { PromissoryNoteStatus } from '../types/promissoryNote'
import type { Sale, SaleStatus } from '../types/sale'
import { getErrorMessage } from '../utils/errors'
import { useAppMessage } from '../hooks/useAppMessage'
import { PaginationControls } from '../components/PaginationControls'
import { PageHeader } from '../components/PageHeader'
import { usePagination } from '../hooks/usePagination'
import { maskCpf, maskPhone } from '../utils/masks'
import { formatCurrency, formatNullableDateTime } from '../utils/formatters'
import { formatPaymentMethod } from '../utils/paymentMethods'

const initialForm: CustomerPayload = {
  name: '',
  cpf: '',
  phone: '',
  email: '',
  address: '',
  birthDate: '',
  active: true,
  observations: '',
  creditLimit: undefined,
}

function toForm(customer: Customer): CustomerPayload {
  return {
    name: customer.name,
    cpf: customer.cpf ?? '',
    phone: customer.phone ?? '',
    email: customer.email ?? '',
    address: customer.address ?? '',
    birthDate: customer.birthDate ?? '',
    active: customer.active,
    observations: customer.observations ?? '',
    creditLimit: customer.creditLimit ?? undefined,
  }
}

type CustomerManagementMode = 'create' | 'list' | 'profile'

type CustomerManagementPageProps = {
  mode?: CustomerManagementMode
  initialProfileCustomerId?: number | null
  onViewChange?: (view: 'customer-profile', customerId?: number) => void
}
type ProfileTab = 'summary' | 'timeline' | 'sales' | 'products' | 'notes' | 'cancelled'

type ProfileFilters = {
  startDate: string
  endDate: string
  saleStatus: SaleStatus | ''
  noteStatus: PromissoryNoteStatus | ''
  query: string
  onlyOverdue: boolean
  onlyOpenBalance: boolean
  minAmount: string
  maxAmount: string
}

const initialProfileFilters: ProfileFilters = {
  startDate: '',
  endDate: '',
  saleStatus: '',
  noteStatus: '',
  query: '',
  onlyOverdue: false,
  onlyOpenBalance: false,
  minAmount: '',
  maxAmount: '',
}

const noteStatusLabels: Record<PromissoryNoteStatus, string> = {
  PENDING: 'Pendente',
  PARTIALLY_PAID: 'Parcial',
  PAID: 'Paga',
  OVERDUE: 'Vencida',
  CANCELLED: 'Cancelada',
}

const insightAppearance: Record<CustomerProfileInsight['severity'], { background: string; border: string; color: string; Icon: typeof AlertTriangle }> = {
  INFO: { background: 'rgba(59,130,246,0.13)', border: '#3b82f6', color: '#bfdbfe', Icon: TrendingUp },
  SUCCESS: { background: 'rgba(45,212,191,0.13)', border: '#2dd4bf', color: '#99f6e4', Icon: CheckCircle2 },
  WARNING: { background: 'rgba(245,158,11,0.14)', border: '#f59e0b', color: '#fde68a', Icon: AlertTriangle },
  DANGER: { background: 'rgba(239,68,68,0.14)', border: '#ef4444', color: '#fecaca', Icon: AlertTriangle },
}

function formatDate(value: string | null | undefined) {
  return value ? value.split('-').reverse().join('/') : '-'
}

function normalizeSearch(value: string) {
  return value.trim().toLowerCase()
}

function saleMatchesQuery(sale: Sale, query: string) {
  if (!query) return true
  const haystack = [
    String(sale.id),
    sale.paymentMethod,
    sale.items.map((item) => `${item.productName} ${item.productCode}`).join(' '),
  ].join(' ').toLowerCase()

  return haystack.includes(query)
}

export function CustomerManagementPage({ mode = 'list', initialProfileCustomerId, onViewChange }: CustomerManagementPageProps) {
  const { notify } = useAppMessage()
  const [customers, setCustomers] = useState<Customer[]>([])
  const [form, setForm] = useState<CustomerPayload>(initialForm)
  const [editingCustomerId, setEditingCustomerId] = useState<number | null>(null)
  const [search, setSearch] = useState('')
  const [appliedSearch, setAppliedSearch] = useState('')
  const [customerPage, setCustomerPage] = useState(0)
  const [customerTotal, setCustomerTotal] = useState(0)
  const [customerTotalPages, setCustomerTotalPages] = useState(1)
  const customerPageSize = 6
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [profileSearch, setProfileSearch] = useState('')
  const [profileOptions, setProfileOptions] = useState<Customer[]>([])
  const [selectedProfileCustomerId, setSelectedProfileCustomerId] = useState(() => {
    return initialProfileCustomerId ? String(initialProfileCustomerId) : localStorage.getItem('selected_profile_customer_id') || ''
  })
  const [customerProfile, setCustomerProfile] = useState<CustomerProfile | null>(null)
  const [isProfileLoading, setIsProfileLoading] = useState(false)
  const [isProfileExporting, setIsProfileExporting] = useState(false)
  const [profileTab, setProfileTab] = useState<ProfileTab>('summary')
  const [profileFilters, setProfileFilters] = useState<ProfileFilters>(initialProfileFilters)
  const [isSavingObs, setIsSavingObs] = useState(false)
  const [groupBySale, setGroupBySale] = useState(false)
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null)
  const [receiptTitle, setReceiptTitle] = useState<string>('')
  const receiptFrameRef = useRef<HTMLIFrameElement>(null)
  const [hoverPrintProfile, setHoverPrintProfile] = useState(false)
  const [hoverExportProfile, setHoverExportProfile] = useState(false)

  const activeCustomers = useMemo(() => customers.filter((customer) => customer.active).length, [customers])
  const showForm = mode === 'create'
  const showList = mode === 'list'
  const showProfile = mode === 'profile'
  const profileFilterQuery = normalizeSearch(profileFilters.query)
  const profileSales = customerProfile?.sales ?? customerProfile?.latestSales ?? []
  const profilePurchasedItems = customerProfile?.purchasedItems ?? []
  const profilePromissoryNotes = customerProfile?.promissoryNotes ?? []
  const filteredSales = useMemo(() => {
    if (!customerProfile) return []

    return profileSales.filter((sale) => {
      const saleDate = sale.soldAt.slice(0, 10)
      const hasOpenNotes = profilePromissoryNotes.some((n) => n.saleId === sale.id && n.remainingAmount > 0)
      
      return (!profileFilters.startDate || saleDate >= profileFilters.startDate)
        && (!profileFilters.endDate || saleDate <= profileFilters.endDate)
        && (!profileFilters.saleStatus || sale.status === profileFilters.saleStatus)
        && (!profileFilters.minAmount || sale.totalAmount >= Number(profileFilters.minAmount))
        && (!profileFilters.maxAmount || sale.totalAmount <= Number(profileFilters.maxAmount))
        && (!profileFilters.onlyOpenBalance || hasOpenNotes)
        && saleMatchesQuery(sale, profileFilterQuery)
    })
  }, [customerProfile, profileFilterQuery, profileFilters.endDate, profileFilters.saleStatus, profileFilters.startDate, profileFilters.minAmount, profileFilters.maxAmount, profileFilters.onlyOpenBalance, profileSales, profilePromissoryNotes])
  const filteredCancelledSales = useMemo(() => (
    filteredSales.filter((sale) => sale.status === 'CANCELLED')
  ), [filteredSales])
  const filteredCompletedSales = useMemo(() => (
    filteredSales.filter((sale) => sale.status === 'COMPLETED')
  ), [filteredSales])
  const filteredPurchasedItems = useMemo(() => {
    if (!customerProfile) return []

    return profilePurchasedItems.filter((item) => {
      if (!profileFilterQuery) return true
      return `${item.productName} ${item.productCode}`.toLowerCase().includes(profileFilterQuery)
    })
  }, [customerProfile, profileFilterQuery, profilePurchasedItems])
  const filteredNotes = useMemo(() => {
    if (!customerProfile) return []

    return profilePromissoryNotes.filter((note) => {
      return (!profileFilters.startDate || note.dueDate >= profileFilters.startDate)
        && (!profileFilters.endDate || note.dueDate <= profileFilters.endDate)
        && (!profileFilters.noteStatus || note.status === profileFilters.noteStatus)
        && (!profileFilters.onlyOverdue || note.status === 'OVERDUE')
        && (!profileFilters.onlyOpenBalance || note.remainingAmount > 0)
        && (!profileFilters.minAmount || note.amount >= Number(profileFilters.minAmount))
        && (!profileFilters.maxAmount || note.amount <= Number(profileFilters.maxAmount))
        && (!profileFilterQuery || [
          String(note.id),
          note.saleId ? String(note.saleId) : 'avulsa',
          (note.saleItems ?? []).map((item) => `${item.productName} ${item.productCode}`).join(' '),
        ].join(' ').toLowerCase().includes(profileFilterQuery))
    })
  }, [customerProfile, profileFilterQuery, profileFilters.endDate, profileFilters.noteStatus, profileFilters.startDate, profileFilters.onlyOverdue, profileFilters.onlyOpenBalance, profileFilters.minAmount, profileFilters.maxAmount, profilePromissoryNotes])
  const completedProfileSales = useMemo(() => (
    profileSales.filter((sale) => sale.status === 'COMPLETED')
  ), [profileSales])
  const cancelledProfileSales = useMemo(() => (
    profileSales.filter((sale) => sale.status === 'CANCELLED')
  ), [profileSales])
  const openProfileNotes = useMemo(() => (
    profilePromissoryNotes.filter((note) => ['PENDING', 'PARTIALLY_PAID', 'OVERDUE'].includes(note.status))
  ), [profilePromissoryNotes])
  const overdueProfileNotes = useMemo(() => (
    profilePromissoryNotes.filter((note) => note.status === 'OVERDUE')
  ), [profilePromissoryNotes])
  const paidProfileNotes = useMemo(() => (
    profilePromissoryNotes.filter((note) => note.status === 'PAID')
  ), [profilePromissoryNotes])
  const totalPurchasedAmount = customerProfile?.totalPurchasedAmount ?? completedProfileSales.reduce((total, sale) => total + sale.totalAmount, 0)
  const openPromissoryAmount = customerProfile?.openPromissoryAmount ?? openProfileNotes.reduce((total, note) => total + note.remainingAmount, 0)
  const overduePromissoryAmount = customerProfile?.overduePromissoryAmount ?? overdueProfileNotes.reduce((total, note) => total + note.remainingAmount, 0)
  const paidPromissoryAmount = customerProfile?.paidPromissoryAmount ?? profilePromissoryNotes.reduce((total, note) => total + note.paidAmount, 0)
  const completedSaleCount = customerProfile?.completedSaleCount ?? completedProfileSales.length
  const cancelledSaleCount = customerProfile?.cancelledSaleCount ?? cancelledProfileSales.length
  const openPromissoryCount = customerProfile?.openPromissoryCount ?? openProfileNotes.length
  const overduePromissoryCount = customerProfile?.overduePromissoryCount ?? overdueProfileNotes.length
  const paidPromissoryCount = customerProfile?.paidPromissoryCount ?? paidProfileNotes.length
  const averageTicketAmount = customerProfile?.averageTicketAmount ?? (completedSaleCount > 0 ? totalPurchasedAmount / completedSaleCount : 0)
  const filteredCancelledNotes = useMemo(() => (
    filteredNotes.filter((note) => note.status === 'CANCELLED')
  ), [filteredNotes])
  const completedSalesPagination = usePagination(filteredCompletedSales, 8)
  const purchasedItemsPagination = usePagination(filteredPurchasedItems, 8)
  const notesPagination = usePagination(filteredNotes, 8)
  const cancelledSalesPagination = usePagination(filteredCancelledSales, 8)
  const cancelledNotesPagination = usePagination(filteredCancelledNotes, 8)

  const clientScores = useMemo(() => {
    if (!customerProfile) return []
    const scores: string[] = []
    
    const hasOverdue = overdueProfileNotes.length > 0
    if (!hasOverdue) {
      scores.push('Em dia')
    } else {
      const maxOverdueDays = Math.max(...overdueProfileNotes.map((n) => n.daysOverdue || 0))
      if (maxOverdueDays > 10) {
        scores.push('Inadimplente')
      } else {
        scores.push('Atenção')
      }
    }
    
    if (completedSaleCount >= 4) {
      scores.push('Cliente recorrente')
    }
    
    if (averageTicketAmount > 300 || totalPurchasedAmount > 1500) {
      scores.push('Alto valor')
    }

    if (customerProfile.customer.birthDate) {
      const birth = new Date(customerProfile.customer.birthDate)
      const today = new Date()
      if (birth.getMonth() === today.getMonth() && Math.abs(birth.getDate() - today.getDate()) <= 7) {
        scores.push('Aniversariante')
      }
    }
    
    return scores
  }, [customerProfile, overdueProfileNotes, completedSaleCount, averageTicketAmount, totalPurchasedAmount])
  const fallbackProfileInsights = useMemo<CustomerProfileInsight[]>(() => {
    if (!customerProfile) return []

    const insights: CustomerProfileInsight[] = []
    const latestSale = profileSales[0]
    const daysSinceLatestSale = latestSale
      ? Math.floor((Date.now() - new Date(latestSale.soldAt).getTime()) / (1000 * 60 * 60 * 24))
      : null
    const maxOverdueDays = overdueProfileNotes.length > 0
      ? Math.max(...overdueProfileNotes.map((note) => note.daysOverdue || 0))
      : 0

    if (overdueProfileNotes.length > 0) {
      insights.push({
        code: 'OVERDUE_BALANCE_FALLBACK',
        severity: 'WARNING',
        title: 'Parcelas vencidas',
        message: `${overdueProfileNotes.length} parcela(s) vencida(s), somando ${formatCurrency(overduePromissoryAmount)}. Maior atraso: ${maxOverdueDays} dia(s).`,
        recommendedAction: 'Priorize cobranca antes de liberar nova venda a prazo.',
      })
    }

    if (maxOverdueDays > 30) {
      insights.push({
        code: 'CREDIT_SUSPENSION_RECOMMENDED_FALLBACK',
        severity: 'DANGER',
        title: 'Risco alto de credito',
        message: 'Existe atraso superior a 30 dias no historico financeiro do cliente.',
        recommendedAction: 'Suspenda novas vendas a prazo ate negociar ou receber a pendencia.',
      })
    }

    if (openPromissoryAmount > 0 && daysSinceLatestSale !== null && daysSinceLatestSale < 10) {
      insights.push({
        code: 'RECENT_OPEN_BALANCE_FALLBACK',
        severity: 'WARNING',
        title: 'Debito ativo recente',
        message: `Cliente comprou ha ${daysSinceLatestSale} dia(s) e ainda possui ${formatCurrency(openPromissoryAmount)} em aberto.`,
        recommendedAction: 'Confirme o combinado de pagamento antes de uma nova venda.',
      })
    }

    if (daysSinceLatestSale !== null && daysSinceLatestSale > 60) {
      insights.push({
        code: 'COMMERCIAL_REACTIVATION_FALLBACK',
        severity: 'INFO',
        title: 'Cliente inativo',
        message: `Sem compras registradas ha ${daysSinceLatestSale} dia(s).`,
        recommendedAction: 'Enviar contato de reativacao com oferta ou novidade relevante.',
      })
    }

    if (customerProfile.customer.birthDate) {
      const birthDate = new Date(customerProfile.customer.birthDate)
      const today = new Date()
      if (birthDate.getMonth() === today.getMonth()) {
        insights.push({
          code: 'BIRTHDAY_MONTH_FALLBACK',
          severity: 'INFO',
          title: 'Aniversario no mes',
          message: 'Cliente faz aniversario neste mes.',
          recommendedAction: 'Ofereca uma condicao especial para fortalecer o relacionamento.',
        })
      }
    }

    if (customerProfile.customer.creditLimit && openPromissoryAmount > customerProfile.customer.creditLimit) {
      insights.push({
        code: 'CREDIT_LIMIT_EXCEEDED_FALLBACK',
        severity: 'DANGER',
        title: 'Limite de credito excedido',
        message: `${formatCurrency(openPromissoryAmount)} em aberto para limite de ${formatCurrency(customerProfile.customer.creditLimit)}.`,
        recommendedAction: 'Receba parte do saldo ou ajuste o limite antes de vender a prazo.',
      })
    }

    if (overdueProfileNotes.length === 0 && openPromissoryAmount === 0 && completedSaleCount > 0) {
      insights.push({
        code: 'GOOD_PAYER_FALLBACK',
        severity: 'SUCCESS',
        title: 'Bom pagador',
        message: 'Cliente sem pendencias em aberto e com compras concluidas.',
        recommendedAction: 'Perfil apto para relacionamento comercial normal.',
      })
    }

    if (insights.length === 0) {
      insights.push({
        code: 'NO_HISTORY_FALLBACK',
        severity: 'INFO',
        title: 'Historico insuficiente',
        message: 'Ainda nao ha volume suficiente para gerar alertas financeiros.',
        recommendedAction: 'Acompanhe as proximas compras para classificar o perfil.',
      })
    }

    return insights
  }, [customerProfile, completedSaleCount, openPromissoryAmount, overdueProfileNotes, overduePromissoryAmount, profileSales])
  const profileInsights = customerProfile?.insights?.length ? customerProfile.insights : fallbackProfileInsights

  const consolidatedWhatsappMessage = useMemo(() => {
    if (!customerProfile) return ''
    const customer = customerProfile.customer
    const openNotes = profilePromissoryNotes.filter((n) => ['PENDING', 'PARTIALLY_PAID', 'OVERDUE'].includes(n.status))
    
    if (openNotes.length === 0) {
      return encodeURIComponent(`Olá, *${customer.name}*! Tudo bem?\n\nPassando para informar que não constam pendências financeiras em seu nome no Atelier. Agradecemos a preferência!`)
    }
    
    let text = `Olá, *${customer.name}*! Tudo bem?\n\nPassando para enviar o resumo financeiro consolidado do seu perfil no Atelier:\n\n`
    text += `• Total de parcelas em aberto: *${openNotes.length} parcela(s)*\n`
    
    if (overdueProfileNotes.length > 0) {
      const maxOverdueDays = Math.max(...overdueProfileNotes.map((n) => n.daysOverdue || 0))
      text += `• Parcelas vencidas: *${overdueProfileNotes.length} parcela(s)* (atraso de até *${maxOverdueDays} dia(s)*)\n`
      text += `• Total já vencido: *${formatCurrency(overduePromissoryAmount)}*\n`
    }
    
    text += `• Valor total em aberto: *${formatCurrency(openPromissoryAmount)}*\n\n`
    text += `Como prefere realizar o pagamento? Aceitamos PIX, dinheiro ou cartão.\nSe tiver alguma dúvida ou quiser o detalhamento das parcelas, estamos à inteira disposição!`
    
    return encodeURIComponent(text)
  }, [customerProfile, profilePromissoryNotes, overdueProfileNotes, openPromissoryAmount, overduePromissoryAmount])

  const handlePrintProfile = useCallback(() => {
    if (!customerProfile) return
    const customer = customerProfile.customer
    const printWindow = window.open('', '_blank')
    if (!printWindow) {
      notify({ type: 'error', title: 'Erro ao imprimir', message: 'Pop-up bloqueado pelo navegador.' })
      return
    }

    const scoresHtml = clientScores.map((score) => `
      <span style="display:inline-block;padding:4px 8px;margin-right:6px;border-radius:4px;font-size:0.8rem;font-weight:bold;background:#eaeaea;color:#333;">
        ${score}
      </span>
    `).join('')

    const salesRows = filteredCompletedSales.map((sale) => `
      <tr>
        <td>#${sale.id}</td>
        <td>${formatNullableDateTime(sale.soldAt)}</td>
        <td>${formatPaymentMethod(sale.paymentMethod)}</td>
        <td>${formatCurrency(sale.totalAmount)}</td>
        <td>${sale.operator?.displayName || '-'}</td>
      </tr>
    `).join('')

    const notesRows = filteredNotes.map((note) => `
      <tr>
        <td>#${note.id}</td>
        <td>${note.saleId ? `#${note.saleId}` : 'Avulsa'}</td>
        <td>${note.installmentNumber}/${note.totalInstallments}</td>
        <td>${noteStatusLabels[note.status as PromissoryNoteStatus] || note.status}</td>
        <td>${formatDate(note.dueDate)}</td>
        <td>${formatCurrency(note.amount)}</td>
        <td>${formatCurrency(note.remainingAmount)}</td>
      </tr>
    `).join('')

    const productsRows = filteredPurchasedItems.slice(0, 10).map((item) => `
      <tr>
        <td>${item.productName}</td>
        <td>${item.productCode}</td>
        <td>${item.quantity} un</td>
        <td>${formatCurrency(item.totalAmount)}</td>
        <td>${formatNullableDateTime(item.lastPurchaseAt)}</td>
      </tr>
    `).join('')

    printWindow.document.write(`
      <html>
        <head>
          <title>Ficha do Cliente - ${customer.name}</title>
          <style>
            body { font-family: sans-serif; color: #333; padding: 20px; line-height: 1.4; }
            h1, h2, h3 { margin-top: 0; }
            .section { border: 1px solid #ccc; padding: 15px; border-radius: 8px; margin-bottom: 20px; }
            .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
            .metrics { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 20px; }
            .metric-card { border: 1px solid #ddd; padding: 10px; border-radius: 6px; text-align: center; background: #fafafa; }
            .metric-card strong { display: block; font-size: 1.2rem; margin-top: 5px; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 0.9rem; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f2f2f2; }
            .badge-bar { margin: 10px 0; }
          </style>
        </head>
        <body>
          <div style="text-align:center;margin-bottom:20px;">
            <h2>Ficha Administrativa do Cliente</h2>
            <p>Gerada em: ${new Date().toLocaleString('pt-BR')}</p>
          </div>
          
          <div class="section">
            <h3>Dados Cadastrais</h3>
            <div class="grid">
              <div>
                <p><strong>Nome:</strong> ${customer.name}</p>
                <p><strong>CPF:</strong> ${customer.cpf ? maskCpf(customer.cpf) : 'Não informado'}</p>
                <p><strong>Telefone:</strong> ${customer.phone ? maskPhone(customer.phone) : 'Não informado'}</p>
                <p><strong>Email:</strong> ${customer.email || 'Não informado'}</p>
              </div>
              <div>
                <p><strong>Endereço:</strong> ${customer.address || 'Não informado'}</p>
                <p><strong>Aniversário:</strong> ${customer.birthDate ? formatDate(customer.birthDate) : 'Não informado'}</p>
                <p><strong>Limite de Crédito:</strong> ${customer.creditLimit ? formatCurrency(customer.creditLimit) : 'Sem limite'}</p>
                <div class="badge-bar"><strong>Tags/Score:</strong> ${scoresHtml || 'Sem classificações'}</div>
              </div>
            </div>
            ${customer.observations ? `<div style="margin-top:10px;padding:8px;background:#fcf8e3;border-left:4px solid #f0ad4e;"><strong>Observações:</strong> ${customer.observations}</div>` : ''}
          </div>

          <div class="metrics">
            <div class="metric-card">Total Comprado<strong>${formatCurrency(totalPurchasedAmount)}</strong></div>
            <div class="metric-card">Saldo em Aberto<strong>${formatCurrency(openPromissoryAmount)}</strong></div>
            <div class="metric-card">Valor Vencido<strong>${formatCurrency(overduePromissoryAmount)}</strong></div>
            <div class="metric-card">Total Pago<strong>${formatCurrency(paidPromissoryAmount)}</strong></div>
          </div>

          <div class="section">
            <h3>Notas Promissórias Pendentes/Vencidas</h3>
            ${notesRows ? `
              <table>
                <thead>
                  <tr>
                    <th>Nota</th>
                    <th>Venda</th>
                    <th>Parcela</th>
                    <th>Status</th>
                    <th>Vencimento</th>
                    <th>Valor Nota</th>
                    <th>Saldo Devedor</th>
                  </tr>
                </thead>
                <tbody>
                  ${notesRows}
                </tbody>
              </table>
            ` : '<p>Nenhuma nota promissória pendente.</p>'}
          </div>

          <div class="section">
            <h3>Últimas Compras</h3>
            ${salesRows ? `
              <table>
                <thead>
                  <tr>
                    <th>Venda</th>
                    <th>Data</th>
                    <th>Forma Pagto</th>
                    <th>Total</th>
                    <th>Operador</th>
                  </tr>
                </thead>
                <tbody>
                  ${salesRows}
                </tbody>
              </table>
            ` : '<p>Nenhuma compra realizada.</p>'}
          </div>

          <div class="section">
            <h3>Produtos Mais Comprados</h3>
            ${productsRows ? `
              <table>
                <thead>
                  <tr>
                    <th>Produto</th>
                    <th>Código</th>
                    <th>Qtd Comprada</th>
                    <th>Valor Total</th>
                    <th>Última Compra</th>
                  </tr>
                </thead>
                <tbody>
                  ${productsRows}
                </tbody>
              </table>
            ` : '<p>Nenhum produto no histórico.</p>'}
          </div>

          <script>
            window.onload = function() {
              window.print();
              setTimeout(function() { window.close(); }, 500);
            }
          </script>
        </body>
      </html>
    `)
    printWindow.document.close()
  }, [customerProfile, clientScores, filteredCompletedSales, filteredNotes, filteredPurchasedItems, totalPurchasedAmount, openPromissoryAmount, overduePromissoryAmount, paidPromissoryAmount, notify])

  const timelineEvents = useMemo(() => {
    if (!customerProfile) return []

    const events: { id: string; type: string; date: string; title: string; description: string; value?: number; icon: any; color: string }[] = []

    profileSales.forEach((sale) => {
      events.push({
        id: `sale-${sale.id}`,
        type: 'sale',
        date: sale.soldAt,
        title: sale.status === 'CANCELLED' ? `Compra #${sale.id} Cancelada` : `Compra #${sale.id}`,
        description: sale.status === 'CANCELLED' 
          ? `Venda cancelada. Motivo: ${sale.cancellationReason || 'Não informado'}` 
          : `Efetuada via ${formatPaymentMethod(sale.paymentMethod)}. Operador: ${sale.operator?.displayName || '-'}`,
        value: sale.totalAmount,
        icon: sale.status === 'CANCELLED' ? X : ShoppingBag,
        color: sale.status === 'CANCELLED' ? '#fb7185' : '#f6d78b'
      })
    })

    profilePromissoryNotes.forEach((note) => {
      events.push({
        id: `note-created-${note.id}`,
        type: 'promissory_created',
        date: note.createdAt,
        title: `Nota Promissória #${note.id} Gerada`,
        description: `Parcela ${note.installmentNumber}/${note.totalInstallments} referente à Venda ${note.saleId ? `#${note.saleId}` : 'Avulsa'}`,
        value: note.amount,
        icon: FileText,
        color: 'var(--text-secondary)'
      })

      if (note.status !== 'CANCELLED') {
        events.push({
          id: `note-due-${note.id}`,
          type: 'due',
          date: note.dueDate + 'T23:59:59',
          title: `Vencimento da Nota #${note.id}`,
          description: `Vencimento da Parcela ${note.installmentNumber}/${note.totalInstallments}. Status atual: ${noteStatusLabels[note.status as PromissoryNoteStatus]}`,
          value: note.remainingAmount,
          icon: Clock,
          color: note.status === 'OVERDUE' ? '#fb7185' : '#f2cf7a'
        })
      }

      if (note.payments && note.payments.length > 0) {
        note.payments.forEach((payment) => {
          events.push({
            id: `payment-${payment.id}`,
            type: 'payment',
            date: payment.paidAt,
            title: `Pagamento da Nota #${note.id}`,
            description: `Baixa recebida via ${formatPaymentMethod(payment.paymentMethod)}. Recebido por: ${payment.paidBy?.displayName || '-'}`,
            value: payment.totalReceived,
            icon: CheckCircle2,
            color: '#2dd4bf'
          })
        })
      }
    })

    return events.sort((a, b) => b.date.localeCompare(a.date))
  }, [customerProfile, profileSales, profilePromissoryNotes])

  const timelinePagination = usePagination(timelineEvents, 8)

  const handleSaveObservations = async (newObs: string) => {
    if (!customerProfile) return
    setIsSavingObs(true)
    try {
      const payload: CustomerPayload = {
        ...toForm(customerProfile.customer),
        observations: newObs,
      }
      await updateCustomer(customerProfile.customer.id, payload)
      setCustomerProfile((current) => current ? {
        ...current,
        customer: {
          ...current.customer,
          observations: newObs
        }
      } : null)
      notify({ type: 'success', title: 'Observação salva', message: 'Observações internas salvas com sucesso.' })
    } catch (err) {
      notify({ type: 'error', title: 'Erro ao salvar', message: getErrorMessage(err, 'Não foi possível salvar as observações.') })
    } finally {
      setIsSavingObs(false)
    }
  }

  const promissoryNotesGroupedBySale = useMemo(() => {
    if (!customerProfile) return []
    const groups: Record<string, { saleId: number | null; saleTotal: number; saleDate: string | null; notes: CustomerPromissoryNote[] }> = {}
    
    filteredNotes.forEach((note) => {
      const key = note.saleId ? String(note.saleId) : 'avulsa'
      if (!groups[key]) {
        const sale = profileSales.find((s) => s.id === note.saleId)
        groups[key] = {
          saleId: note.saleId,
          saleTotal: sale ? sale.totalAmount : note.amount,
          saleDate: sale ? sale.soldAt : note.createdAt,
          notes: []
        }
      }
      groups[key].notes.push(note)
    })
    
    return Object.values(groups).sort((a, b) => {
      if (!a.saleDate || !b.saleDate) return 0
      return b.saleDate.localeCompare(a.saleDate)
    })
  }, [customerProfile, filteredNotes, profileSales])

  const loadCustomers = useCallback(async (nextSearch = appliedSearch, nextPage = customerPage) => {
    setIsLoading(true)
    try {
      const response = await getCustomerPage(nextSearch, nextPage, customerPageSize)
      setCustomers(response.content)
      setCustomerPage(response.page)
      setCustomerTotal(response.totalElements)
      setCustomerTotalPages(Math.max(response.totalPages, 1))
      setErrorMessage(null)
    } catch (error) {
      setErrorMessage(getErrorMessage(error, 'Não foi possível carregar clientes.'))
    } finally {
      setIsLoading(false)
    }
  }, [appliedSearch, customerPage])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadCustomers(appliedSearch, customerPage)
    }, 0)

    return () => window.clearTimeout(timeoutId)
  }, [appliedSearch, customerPage, loadCustomers])

  useEffect(() => {
    if (!showProfile) {
      return
    }

    const timeoutId = window.setTimeout(() => {
      getCustomers(profileSearch)
        .then(setProfileOptions)
        .catch(() => setProfileOptions([]))
    }, 180)

    return () => window.clearTimeout(timeoutId)
  }, [profileSearch, showProfile])

  useEffect(() => {
    if (selectedProfileCustomerId) {
      localStorage.setItem('selected_profile_customer_id', selectedProfileCustomerId)
    } else {
      localStorage.removeItem('selected_profile_customer_id')
    }
  }, [selectedProfileCustomerId])

  useEffect(() => {
    if (!selectedProfileCustomerId) {
      return
    }

    const timeoutId = window.setTimeout(() => {
      setIsProfileLoading(true)
      getCustomerProfile(Number(selectedProfileCustomerId))
        .then((profile) => {
          setCustomerProfile(profile)
          setErrorMessage(null)
        })
        .catch((error) => setErrorMessage(getErrorMessage(error, 'Não foi possível carregar o perfil do cliente.')))
        .finally(() => setIsProfileLoading(false))
    }, 0)

    return () => window.clearTimeout(timeoutId)
  }, [selectedProfileCustomerId])

  function resetForm() {
    setEditingCustomerId(null)
    setForm(initialForm)
    setErrorMessage(null)
  }

  function handleEdit(customer: Customer) {
    setEditingCustomerId(customer.id)
    setForm({
      ...toForm(customer),
      cpf: maskCpf(customer.cpf ?? ''),
      phone: maskPhone(customer.phone ?? ''),
    })
  }

  function closeEditModal() {
    setEditingCustomerId(null)
    setForm(initialForm)
    setErrorMessage(null)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!form.name?.trim()) {
      setErrorMessage('Informe o nome do cliente.')
      return
    }

    setIsSaving(true)
    try {
      const payload = {
        ...form,
        name: form.name.trim(),
        cpf: form.cpf?.trim() || undefined,
        phone: form.phone?.trim() || undefined,
        email: form.email?.trim() || undefined,
        address: form.address?.trim() || undefined,
        birthDate: form.birthDate || undefined,
        observations: form.observations?.trim() || undefined,
        creditLimit: form.creditLimit !== undefined && form.creditLimit !== null ? Number(form.creditLimit) : undefined,
      }

      if (editingCustomerId === null) {
        await createCustomer(payload)
      } else {
        await updateCustomer(editingCustomerId, payload)
      }

      notify({
        type: 'success',
        title: editingCustomerId === null ? 'Cliente cadastrado' : 'Cliente atualizado',
        message: 'Cadastro salvo com sucesso no Atelier.',
      })
      resetForm()
      await loadCustomers(appliedSearch, customerPage)
    } catch (error) {
      const message = getErrorMessage(error, 'Não foi possível salvar o cliente.')
      setErrorMessage(message)
      notify({ type: 'error', title: 'Erro ao salvar cliente', message })
    } finally {
      setIsSaving(false)
    }
  }

  function handleSearchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setAppliedSearch(search)
    setCustomerPage(0)
  }

  async function handleProfileExport() {
    if (!customerProfile) return

    setIsProfileExporting(true)
    try {
      await downloadCustomerProfileExcelReport(customerProfile.customer.id, {
        startDate: profileFilters.startDate || undefined,
        endDate: profileFilters.endDate || undefined,
        saleStatus: profileFilters.saleStatus,
        noteStatus: profileFilters.noteStatus,
      })
      notify({
        type: 'success',
        title: 'Relatorio exportado',
        message: 'A consulta completa do cliente foi baixada em CSV compativel com Excel.',
      })
    } catch (error) {
      const message = getErrorMessage(error, 'Nao foi possivel exportar a consulta do cliente.')
      notify({ type: 'error', title: 'Erro ao exportar', message })
    } finally {
      setIsProfileExporting(false)
    }
  }

  return (
    <main className="app-shell customer-premium-shell">
      <style>{`
        .customer-premium-card {
          background: rgba(255, 250, 235, 0.72) !important;
          border: 1px solid rgba(215, 173, 85, 0.16) !important;
          border-radius: 16px !important;
          padding: 18px !important;
          box-shadow: 0 12px 28px rgba(215, 173, 85, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.72) !important;
          transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1), border-color 0.25s ease !important;
          color: #211609 !important;
        }
        .customer-premium-card:hover {
          transform: translateY(-3px) scale(1.01);
          border-color: rgba(215, 173, 85, 0.34) !important;
          box-shadow: 0 12px 28px rgba(215, 173, 85, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.72) !important;
        }
        .customer-premium-list-panel {
          background: radial-gradient(circle at 90% 0%, rgba(255, 255, 255, 0.46), transparent 32%), linear-gradient(135deg, #f8dc91 0%, #d8ad53 50%, #b97e24 100%) !important;
          color: #211609 !important;
          border: 1px solid rgba(215, 173, 85, 0.22) !important;
          border-radius: 18px !important;
          padding: 22px !important;
          box-shadow: 0 26px 64px rgba(215, 173, 85, 0.26), inset 0 1px 0 rgba(255, 255, 255, 0.58) !important;
        }
        .customer-premium-edit-btn:hover, .customer-premium-felicitar-btn:hover {
          transform: scale(1.02);
          box-shadow: 0 4px 12px rgba(215, 173, 85, 0.3) !important;
        }
        .product-premium-card:hover {
          transform: translateY(-3px);
          border-color: rgba(215, 173, 85, 0.45) !important;
          box-shadow: 0 8px 25px rgba(215, 173, 85, 0.12) !important;
        }
      `}</style>
      <div className="app-container customer-premium-container">
        {!showProfile ? (
          <>
            <div className="customer-premium-hero">
              <section className="customer-premium-banner">
                <div className="customer-premium-badges">
                  <span>★ CLIENTES</span>
                  <strong>{customerTotal} cliente(s) encontrados</strong>
                </div>
                <h1>{showForm ? 'Cadastrar cliente' : 'Listar / editar clientes'}</h1>
                <p>Mantenha os dados usados nas vendas a prazo e na impressão das notas promissórias.</p>
              </section>

              <section className="customer-premium-target-card">
                <div>
                  <span>Ativos</span>
                  <small>Meta 100</small>
                </div>
                <strong>{activeCustomers}</strong>
                <div className="customer-premium-progress">
                  <span style={{ width: `${Math.min((activeCustomers / 100) * 100, 100)}%` }} />
                </div>
              </section>
            </div>

            <div className="customer-premium-metrics">
              <article>
                <div>
                  <span>Clientes ativos</span>
                  <strong>{activeCustomers}</strong>
                </div>
                <UserCheck size={19} aria-hidden="true" />
              </article>
              <article>
                <div>
                  <span>Com CPF</span>
                  <strong>{customers.filter((customer) => customer.cpf).length}</strong>
                </div>
                <FileText size={19} aria-hidden="true" />
              </article>
              <article>
                <div>
                  <span>Com telefone</span>
                  <strong>{customers.filter((customer) => customer.phone).length}</strong>
                </div>
                <Phone size={19} aria-hidden="true" />
              </article>
            </div>
          </>
        ) : null}

        {showProfile ? (
          <PageHeader
            eyebrow="Clientes"
            title="Consulta completa do cliente"
            subtitle="Visão administrativa com compras, linha do tempo, produtos, promissórias e análise de risco."
            metricLabel="Análise"
            metricValue={customerProfile ? 'Ativa' : 'Selecione'}
            status="Somente ADMIN"
          />
        ) : null}

        <div className={showProfile ? 'content-grid' : 'customer-premium-content'}>
          {showForm ? (
            <section className="customer-premium-form-panel customer-entry-panel">
              <header>
                <UserPlus size={26} aria-hidden="true" />
                <div>
                  <h2>{editingCustomerId === null ? 'Novo cliente' : 'Editar cliente'}</h2>
                  <p>Operadores podem cadastrar clientes durante a venda ou por esta tela.</p>
                </div>
              </header>

              <form className="customer-premium-form" onSubmit={handleSubmit}>
                <div className="customer-premium-form-grid">
                  <div className="field-group field-group--full">
                    <label htmlFor="customerName">Nome Completo</label>
                    <input
                      id="customerName"
                      value={form.name ?? ''}
                      onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                      placeholder="Nome completo do cliente"
                      required
                    />
                  </div>
                  <div className="field-group">
                    <label htmlFor="customerCpf">CPF</label>
                    <input
                      id="customerCpf"
                      value={form.cpf ?? ''}
                      onChange={(event) => setForm((current) => ({ ...current, cpf: maskCpf(event.target.value) }))}
                      inputMode="numeric"
                      placeholder="000.000.000-00"
                    />
                  </div>
                  <div className="field-group">
                    <label htmlFor="customerPhone">Telefone para Contato</label>
                    <input
                      id="customerPhone"
                      value={form.phone ?? ''}
                      onChange={(event) => setForm((current) => ({ ...current, phone: maskPhone(event.target.value) }))}
                      inputMode="numeric"
                      placeholder="11 99999-9999"
                    />
                  </div>
                  <div className="field-group">
                    <label htmlFor="customerEmail">Email</label>
                    <input
                      id="customerEmail"
                      type="email"
                      value={form.email ?? ''}
                      onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                      placeholder="exemplo@iwr.com"
                    />
                  </div>
                  <div className="field-group">
                    <label htmlFor="customerActive">Status da Conta</label>
                    <select
                      id="customerActive"
                      value={form.active === false ? 'false' : 'true'}
                      onChange={(event) => setForm((current) => ({ ...current, active: event.target.value === 'true' }))}
                    >
                      <option value="true">Ativo</option>
                      <option value="false">Inativo</option>
                    </select>
                  </div>
                  <div className="field-group">
                    <label htmlFor="customerBirthDate">Data de Aniversário</label>
                    <input
                      id="customerBirthDate"
                      type="date"
                      value={form.birthDate ?? ''}
                      onChange={(event) => setForm((current) => ({ ...current, birthDate: event.target.value }))}
                      style={{ colorScheme: 'dark' }}
                    />
                  </div>
                  <div className="field-group field-group--full">
                    <label htmlFor="customerAddress">Endereço Residencial</label>
                    <input
                      id="customerAddress"
                      value={form.address ?? ''}
                      onChange={(event) => setForm((current) => ({ ...current, address: event.target.value }))}
                      placeholder="Rua, número, bairro e cidade"
                    />
                  </div>
                  <div className="field-group">
                    <label htmlFor="customerCreditLimit">Limite de Crédito (R$)</label>
                    <input
                      id="customerCreditLimit"
                      type="number"
                      step="0.01"
                      min="0"
                      value={form.creditLimit ?? ''}
                      onChange={(event) => setForm((current) => ({ ...current, creditLimit: event.target.value ? Number(event.target.value) : undefined }))}
                      placeholder="Sem limite"
                    />
                  </div>
                  <div className="field-group field-group--full">
                    <label htmlFor="customerObservations">Observações Internas</label>
                    <textarea
                      id="customerObservations"
                      value={form.observations ?? ''}
                      onChange={(event) => setForm((current) => ({ ...current, observations: event.target.value }))}
                      placeholder="Preferências, histórico de negociação, restrições..."
                      rows={3}
                      style={{ background: 'rgba(0, 0, 0, 0.65)', color: '#fff', border: '1px solid rgba(215, 173, 85, 0.35)', borderRadius: '12px', padding: '12px', width: '100%', resize: 'vertical' }}
                    />
                  </div>
                </div>

                {errorMessage ? <div className="feedback-message feedback-message--error">{errorMessage}</div> : null}

                <div className="customer-premium-actions">
                  <button className="customer-premium-primary-button" type="submit" disabled={isSaving}>
                    <Save size={16} aria-hidden="true" />
                    {isSaving ? 'Salvando...' : 'Salvar cliente'}
                  </button>
                  <button className="customer-premium-secondary-button" type="button" onClick={resetForm} disabled={isSaving}>
                    <RotateCcw size={16} aria-hidden="true" />
                    Limpar
                  </button>
                </div>
              </form>
            </section>
          ) : null}

          {showList ? (
            <section className="customer-premium-list-panel customer-directory-panel">
              <header className="section-header" style={{ borderBottom: '1px solid rgba(226, 232, 240, 0.08)', paddingBottom: '20px', display: 'flex', justifyContent: 'space-between', gap: '20px', flexWrap: 'wrap', alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  <span aria-hidden="true" style={{ background: 'rgba(215, 173, 85, 0.12)', padding: '10px', borderRadius: '12px', color: 'var(--gold-strong)', display: 'inline-flex' }}>
                    <Users size={22} strokeWidth={2.4} />
                  </span>
                  <div>
                    <h2 style={{ margin: 0, fontSize: '1.25rem', color: '#fff' }}>Listar / editar clientes</h2>
                    <p style={{ margin: '4px 0 0', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>Busca rápida por nome ou CPF para visualizar e gerenciar perfis no sistema.</p>
                  </div>
                </div>
              </header>

              <form className="customer-premium-search" onSubmit={handleSearchSubmit} style={{ gap: '16px', background: 'rgba(255, 255, 255, 0.03)', padding: '18px', borderRadius: '14px', border: '1px solid rgba(215, 173, 85, 0.25)', margin: '20px 0', display: 'flex', flexWrap: 'wrap', alignItems: 'end' }}>
                <div className="field-group" style={{ flex: 1, minWidth: '200px' }}>
                  <label htmlFor="customerListSearch" style={{ color: 'var(--gold-strong)', fontWeight: 'bold', fontSize: '0.68rem', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '8px', display: 'block' }}>Buscar Cliente</label>
                  <div className="customer-premium-search-input" style={{ position: 'relative' }}>
                    <Search size={16} aria-hidden="true" style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: '#d7ad55' }} />
                    <input
                      id="customerListSearch"
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Nome do cliente ou CPF..."
                      style={{ paddingLeft: '44px', width: '100%', height: '52px', background: 'rgba(0,0,0,0.55)', border: '1px solid rgba(215, 173, 85, 0.35)', borderRadius: '12px', color: '#fff' }}
                    />
                    {search ? (
                      <button
                        type="button"
                        onClick={() => {
                          setSearch('')
                          setAppliedSearch('')
                          setCustomerPage(0)
                        }}
                        aria-label="Limpar busca"
                        style={{ position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
                      >
                        <X size={15} aria-hidden="true" />
                      </button>
                    ) : null}
                  </div>
                </div>
                <button className="customer-premium-primary-button" type="submit" disabled={isLoading} style={{ height: '52px', padding: '0 24px', textTransform: 'uppercase', fontWeight: 'bold' }}>
                  Buscar
                </button>
              </form>

              {isLoading ? (
                <div className="product-empty">Carregando clientes...</div>
              ) : customers.length === 0 ? (
                <div className="product-empty">Nenhum cliente encontrado.</div>
              ) : (
                <div className="customer-premium-card-grid" style={{ marginTop: '20px' }}>
                  {customers.map((customer) => {
                    const isProfileComplete = Boolean(customer.cpf && customer.phone && customer.email && customer.address);
                    return (
                      <article className="customer-premium-card" key={customer.id} style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: '260px' }}>
                        <div>
                          <div className="customer-premium-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
                            <div>
                              <h3 style={{ margin: '0 0 4px', fontSize: '1.1rem', color: '#fff', fontWeight: 600 }}>{customer.name}</h3>
                              <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
                                {customer.cpf ? maskCpf(customer.cpf) : 'Sem CPF'}
                              </span>
                            </div>
                            <div style={{ display: 'flex', gap: '6px', flexDirection: 'column', alignItems: 'flex-end' }}>
                              <strong className={customer.active ? 'customer-premium-status customer-premium-status--active' : 'customer-premium-status'} style={{ display: 'inline-block', padding: '2px 8px', borderRadius: '4px', fontSize: '0.62rem', fontWeight: 'bold', textTransform: 'uppercase' }}>
                                {customer.active ? 'Ativo' : 'Inativo'}
                              </strong>
                              <span style={{
                                display: 'inline-block',
                                padding: '2px 8px',
                                borderRadius: '4px',
                                fontSize: '0.62rem',
                                fontWeight: 'bold',
                                textTransform: 'uppercase',
                                background: isProfileComplete ? 'rgba(45,212,191,0.15)' : 'rgba(245,158,11,0.15)',
                                color: isProfileComplete ? '#2dd4bf' : '#fbbf24',
                                border: isProfileComplete ? '1px solid rgba(45,212,191,0.25)' : '1px solid rgba(245,158,11,0.25)'
                              }}>
                                {isProfileComplete ? '★ Premium' : 'Básico'}
                              </span>
                            </div>
                          </div>
                          
                          <div className="customer-premium-contact-box" style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '12px', borderRadius: '10px', display: 'grid', gap: '8px', marginBottom: '14px', border: '1px solid rgba(255, 255, 255, 0.04)' }}>
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Phone size={13} style={{ color: '#d7ad55' }} />
                                <span style={{ color: '#94a3b8', fontSize: '0.64rem', fontWeight: 900, textTransform: 'uppercase' }}>Tel</span>
                              </div>
                              <strong>{customer.phone ? maskPhone(customer.phone) : 'Não informado'}</strong>
                            </div>
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Mail size={13} style={{ color: '#d7ad55' }} />
                                <span style={{ color: '#94a3b8', fontSize: '0.64rem', fontWeight: 900, textTransform: 'uppercase' }}>E-mail</span>
                              </div>
                              <strong style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '180px' }}>{customer.email || 'Não informado'}</strong>
                            </div>
                            {customer.birthDate && (
                              <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <Gift size={13} style={{ color: '#d7ad55' }} />
                                  <span style={{ color: '#94a3b8', fontSize: '0.64rem', fontWeight: 900, textTransform: 'uppercase' }}>Aniversário</span>
                                </div>
                                <strong>{customer.birthDate.split('-').reverse().join('/')}</strong>
                              </div>
                            )}
                          </div>
                        </div>

                        <div style={{ display: 'flex', gap: '8px', marginTop: 'auto' }}>
                          <button
                            type="button"
                            onClick={() => handleEdit(customer)}
                            className="customer-premium-secondary-button"
                            style={{
                              flex: 1,
                              display: 'flex',
                              justifyContent: 'center',
                              alignItems: 'center',
                              gap: '6px',
                              padding: '8px 12px',
                              fontSize: '0.75rem',
                              fontWeight: 'bold',
                              borderRadius: '10px'
                            }}
                          >
                            <Edit3 size={13} />
                            Editar
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (onViewChange) {
                                onViewChange('customer-profile', customer.id);
                              }
                            }}
                            className="customer-premium-primary-button"
                            style={{
                              flex: 1.4,
                              display: 'flex',
                              justifyContent: 'center',
                              alignItems: 'center',
                              gap: '6px',
                              padding: '8px 12px',
                              fontSize: '0.75rem',
                              fontWeight: 'bold',
                              borderRadius: '10px'
                            }}
                          >
                            <Search size={13} />
                            Ficha Completa
                          </button>
                        </div>
                      </article>
                    );
                  })}
                  <PaginationControls
                    itemLabel="clientes"
                    page={customerPage}
                    pageSize={customerPageSize}
                    totalItems={customerTotal}
                    totalPages={customerTotalPages}
                    onPageChange={setCustomerPage}
                  />
                </div>
              )}

              <footer className="customer-premium-list-footer" style={{ marginTop: '20px' }}>
                <span>Exibindo {customers.length} de {customerTotal} registros cadastrados</span>
                <strong>Sincronizado com o Atelier</strong>
              </footer>
            </section>
          ) : null}

          {showProfile ? (
            <section className="customer-premium-list-panel customer-list-panel relationship-client-panel">
              <header className="section-header relationship-client-header">
                <div className="relationship-client-title">
                  <span className="relationship-client-icon" aria-hidden="true">
                    <Search size={22} strokeWidth={2.4} />
                  </span>
                  <div>
                    <h2>Seleção e análise</h2>
                    <p>Escolha o cliente e aplique filtros para auditar compras, produtos e promissórias.</p>
                  </div>
                </div>

                {customerProfile && (
                  <div className="relationship-client-actions">
                    <button
                      type="button"
                      onClick={handlePrintProfile}
                      onMouseEnter={() => setHoverPrintProfile(true)}
                      onMouseLeave={() => setHoverPrintProfile(false)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        background: 'linear-gradient(135deg, #e5ba6b, #c6943c)',
                        color: '#080b12',
                        border: 'none',
                        borderRadius: '12px',
                        padding: '10px 20px',
                        fontWeight: 'bold',
                        fontSize: '0.8rem',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                        cursor: 'pointer',
                        boxShadow: hoverPrintProfile
                          ? '0 6px 20px rgba(215, 173, 85, 0.4)'
                          : '0 4px 15px rgba(215, 173, 85, 0.25)',
                        transform: hoverPrintProfile ? 'scale(1.03)' : 'scale(1)',
                        transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)'
                      }}
                    >
                      <Printer size={16} strokeWidth={2.5} style={{ color: '#080b12' }} />
                      Ficha Impressa
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleProfileExport()}
                      disabled={isProfileExporting}
                      onMouseEnter={() => setHoverExportProfile(true)}
                      onMouseLeave={() => setHoverExportProfile(false)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        background: hoverExportProfile ? 'rgba(16, 185, 129, 0.14)' : 'rgba(16, 185, 129, 0.06)',
                        color: '#10b981',
                        border: hoverExportProfile ? '1px solid rgba(16, 185, 129, 0.7)' : '1px solid rgba(16, 185, 129, 0.35)',
                        borderRadius: '12px',
                        padding: '10px 20px',
                        fontWeight: 'bold',
                        fontSize: '0.8rem',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                        cursor: 'pointer',
                        transform: hoverExportProfile ? 'scale(1.03)' : 'scale(1)',
                        transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                        boxShadow: '0 4px 15px rgba(0, 0, 0, 0.15)',
                        opacity: isProfileExporting ? 0.6 : 1
                      }}
                    >
                      <Download size={16} strokeWidth={2.5} style={{ color: '#10b981' }} />
                      {isProfileExporting ? 'Exportando...' : 'Excel (CSV)'}
                    </button>
                  </div>
                )}
              </header>

              <div className="history-filter-form customer-profile-search" style={{ gap: '16px', background: 'rgba(255, 255, 255, 0.03)', padding: '18px', borderRadius: '14px', border: '1px solid rgba(215, 173, 85, 0.35)', margin: '20px 0', display: 'flex', flexWrap: 'wrap' }}>
                <div className="field-group" style={{ flex: 1, minWidth: '200px' }}>
                  <label htmlFor="customerProfileSearch">Filtrar lista de clientes</label>
                  <input
                    id="customerProfileSearch"
                    value={profileSearch}
                    onChange={(event) => setProfileSearch(event.target.value)}
                    placeholder="Filtrar por nome do cliente..."
                  />
                </div>
                <div className="field-group" style={{ flex: 1, minWidth: '250px' }}>
                  <label htmlFor="customerProfileSelect">Cliente selecionado para análise</label>
                  <select
                    id="customerProfileSelect"
                    value={selectedProfileCustomerId}
                    onChange={(event) => {
                      setSelectedProfileCustomerId(event.target.value)
                      setProfileTab('summary')
                      setProfileFilters(initialProfileFilters)
                      setGroupBySale(false)
                      if (!event.target.value) setCustomerProfile(null)
                    }}
                  >
                    <option value="">Selecione um cliente para consulta...</option>
                    {profileOptions.map((customer) => (
                      <option value={customer.id} key={customer.id}>{customer.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {customerProfile ? (
                <div className="history-filter-form customer-profile-filter-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', background: 'rgba(255, 255, 255, 0.03)', padding: '16px', borderRadius: '14px', border: '1px solid rgba(215, 173, 85, 0.35)', marginBottom: '20px' }}>
                  <div className="field-group">
                    <label htmlFor="profileStartDate">Início Venc./Compra</label>
                    <input id="profileStartDate" type="date" value={profileFilters.startDate} onChange={(event) => setProfileFilters((current) => ({ ...current, startDate: event.target.value }))} style={{ colorScheme: 'dark' }} />
                  </div>
                  <div className="field-group">
                    <label htmlFor="profileEndDate">Fim Venc./Compra</label>
                    <input id="profileEndDate" type="date" value={profileFilters.endDate} onChange={(event) => setProfileFilters((current) => ({ ...current, endDate: event.target.value }))} style={{ colorScheme: 'dark' }} />
                  </div>
                  <div className="field-group">
                    <label htmlFor="profileSaleStatus">Status da Venda</label>
                    <select id="profileSaleStatus" value={profileFilters.saleStatus} onChange={(event) => setProfileFilters((current) => ({ ...current, saleStatus: event.target.value as SaleStatus | '' }))}>
                      <option value="">Todas</option>
                      <option value="COMPLETED">Concluídas</option>
                      <option value="CANCELLED">Canceladas</option>
                    </select>
                  </div>
                  <div className="field-group">
                    <label htmlFor="profileNoteStatus">Status da Promissória</label>
                    <select id="profileNoteStatus" value={profileFilters.noteStatus} onChange={(event) => setProfileFilters((current) => ({ ...current, noteStatus: event.target.value as PromissoryNoteStatus | '' }))}>
                      <option value="">Todas</option>
                      <option value="PENDING">Pendentes</option>
                      <option value="PARTIALLY_PAID">Parciais</option>
                      <option value="PAID">Pagas</option>
                      <option value="OVERDUE">Vencidas</option>
                      <option value="CANCELLED">Canceladas</option>
                    </select>
                  </div>
                  <div className="field-group">
                    <label htmlFor="profileMinAmount">Valor Mínimo (R$)</label>
                    <input id="profileMinAmount" type="number" value={profileFilters.minAmount} onChange={(event) => setProfileFilters((current) => ({ ...current, minAmount: event.target.value }))} placeholder="Min" />
                  </div>
                  <div className="field-group">
                    <label htmlFor="profileMaxAmount">Valor Máximo (R$)</label>
                    <input id="profileMaxAmount" type="number" value={profileFilters.maxAmount} onChange={(event) => setProfileFilters((current) => ({ ...current, maxAmount: event.target.value }))} placeholder="Max" />
                  </div>
                  <div className="field-group customer-profile-checkboxes" style={{ gridColumn: 'span 2', display: 'flex', gap: '16px', alignItems: 'center', marginTop: '10px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '0.8rem', color: '#cbd5e1' }}>
                      <input type="checkbox" checked={profileFilters.onlyOverdue} onChange={(e) => setProfileFilters(curr => ({ ...curr, onlyOverdue: e.target.checked }))} />
                      Apenas vencidas
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '0.8rem', color: '#cbd5e1' }}>
                      <input type="checkbox" checked={profileFilters.onlyOpenBalance} onChange={(e) => setProfileFilters(curr => ({ ...curr, onlyOpenBalance: e.target.checked }))} />
                      Apenas com saldo aberto
                    </label>
                  </div>
                  <div className="field-group" style={{ gridColumn: 'span 2' }}>
                    <label htmlFor="profileQuery">Busca por Produto ou Código</label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <input id="profileQuery" style={{ flex: 1 }} value={profileFilters.query} onChange={(event) => setProfileFilters((current) => ({ ...current, query: event.target.value }))} placeholder="Buscar..." />
                      <button className="customer-premium-secondary-button" type="button" onClick={() => setProfileFilters(initialProfileFilters)} style={{ minHeight: 'auto', padding: '0 12px' }}>
                        Limpar
                      </button>
                    </div>
                  </div>
                </div>
              ) : null}

              {isProfileLoading ? (
                <div className="product-empty">Carregando perfil do cliente...</div>
              ) : !customerProfile ? (
                <div className="product-empty" style={{ background: 'rgba(255, 255, 255, 0.03)', borderRadius: '16px', padding: '40px', border: '1px solid rgba(215, 173, 85, 0.35)', color: 'var(--gold-strong)' }}>Selecione um cliente para visualizar o perfil completo.</div>
              ) : (
                <div style={{ display: 'grid', gap: '20px' }}>
                  {/* Perfil e Scores */}
                  <article className="cart-item customer-profile-summary-card" style={{ background: '#f8f5ed', border: '1px solid rgba(75,59,22,0.14)', borderRadius: '14px', padding: '22px', display: 'flex', justifyContent: 'space-between', gap: '20px', flexWrap: 'wrap', color: '#211609' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '8px' }}>
                        <span style={{ display: 'inline-block', background: 'rgba(33, 22, 9, 0.08)', padding: '4px 8px', borderRadius: '6px', fontSize: '0.7rem', color: '#5f4b1d', fontFamily: 'monospace' }}>
                          {customerProfile.customer.cpf ? maskCpf(customerProfile.customer.cpf) : 'Sem CPF'}
                        </span>
                        
                        {clientScores.map((score) => {
                          let style = { background: 'rgba(74,85,104,0.2)', color: '#a0aec0', border: 'none' }
                          if (score === 'Em dia') style = { background: 'rgba(45,212,191,0.15)', color: '#2dd4bf', border: '1px solid rgba(45,212,191,0.25)' }
                          if (score === 'Atenção') style = { background: 'rgba(245,158,11,0.15)', color: '#fbbf24', border: '1px solid rgba(245,158,11,0.25)' }
                          if (score === 'Inadimplente') style = { background: 'rgba(239,68,68,0.15)', color: '#f87171', border: '1px solid rgba(239,68,68,0.25)' }
                          if (score === 'Cliente recorrente') style = { background: 'rgba(99,102,241,0.15)', color: '#818cf8', border: '1px solid rgba(99,102,241,0.25)' }
                          if (score === 'Alto valor') style = { background: 'rgba(215,173,85,0.15)', color: 'var(--gold-strong)', border: '1px solid rgba(215,173,85,0.35)' }
                          if (score === 'Aniversariante') style = { background: 'rgba(244,63,94,0.15)', color: '#fb7185', border: '1px solid rgba(244,63,94,0.25)' }

                          return (
                            <span key={score} style={{ display: 'inline-block', padding: '3px 8px', borderRadius: '6px', fontSize: '0.66rem', fontWeight: 'bold', textTransform: 'uppercase', ...style }}>
                              {score}
                            </span>
                          )
                        })}
                      </div>
                      <h3 style={{ margin: '0 0 8px', color: '#211609', fontSize: '1.4rem' }}>{customerProfile.customer.name}</h3>
                      <small style={{ color: '#5f4b1d', display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
                        <span><Phone size={12} style={{ marginRight: '5px', verticalAlign: 'middle', color: '#d7ad55' }} />{customerProfile.customer.phone ? maskPhone(customerProfile.customer.phone) : 'Sem telefone'}</span>
                        {customerProfile.customer.email ? <span><Mail size={12} style={{ marginRight: '5px', verticalAlign: 'middle', color: '#d7ad55' }} />{customerProfile.customer.email}</span> : null}
                        {customerProfile.customer.birthDate ? <span><Gift size={12} style={{ marginRight: '5px', verticalAlign: 'middle', color: '#d7ad55' }} />{formatDate(customerProfile.customer.birthDate)}</span> : null}
                      </small>
                      {customerProfile.customer.address ? <p style={{ margin: '8px 0 0', color: '#6e5a2a', fontSize: '0.82rem' }}><MapPin size={12} style={{ marginRight: '5px', verticalAlign: 'middle', color: '#d7ad55' }} />{customerProfile.customer.address}</p> : null}
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(120px, 1fr))', gap: '12px', minWidth: '300px' }}>
                      <strong style={{ color: 'var(--gold-strong)', fontSize: '1.2rem' }}>{formatCurrency(totalPurchasedAmount)}<span style={{ display: 'block', color: '#94a3b8', fontSize: '0.68rem', textTransform: 'uppercase', fontWeight: 'normal' }}>Total comprado</span></strong>
                      <strong style={{ color: '#fb7185', fontSize: '1.2rem' }}>{formatCurrency(openPromissoryAmount)}<span style={{ display: 'block', color: '#94a3b8', fontSize: '0.68rem', textTransform: 'uppercase', fontWeight: 'normal' }}>Saldo aberto</span></strong>
                      <strong style={{ color: '#fb7185', fontSize: '1.2rem' }}>{formatCurrency(overduePromissoryAmount)}<span style={{ display: 'block', color: '#94a3b8', fontSize: '0.68rem', textTransform: 'uppercase', fontWeight: 'normal' }}>Vencido</span></strong>
                      <strong style={{ color: '#2dd4bf', fontSize: '1.2rem' }}>{formatCurrency(paidPromissoryAmount)}<span style={{ display: 'block', color: '#94a3b8', fontSize: '0.68rem', textTransform: 'uppercase', fontWeight: 'normal' }}>Pago</span></strong>
                    </div>
                  </article>

                  {/* Limite de Crédito Rápido */}
                  {customerProfile.customer.creditLimit ? (
                    <article style={{ background: '#111622', border: '1px solid rgba(226,232,240,0.08)', padding: '16px', borderRadius: '12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '0.8rem', color: '#b9c4d4' }}>
                        <span>
                          <CreditCard size={14} style={{ verticalAlign: 'middle', marginRight: '6px', color: '#d7ad55' }} />
                          Limite de Crédito Consumido
                        </span>
                        <strong style={{ color: openPromissoryAmount > customerProfile.customer.creditLimit ? '#fb7185' : '#2dd4bf' }}>
                          {formatCurrency(openPromissoryAmount)} / {formatCurrency(customerProfile.customer.creditLimit)} ({Math.min(Math.round((openPromissoryAmount / customerProfile.customer.creditLimit) * 100), 100)}%)
                        </strong>
                      </div>
                      <div style={{ width: '100%', height: '8px', background: '#0b0d13', borderRadius: '10px', overflow: 'hidden' }}>
                        <div
                          style={{
                            height: '100%',
                            width: `${Math.min((openPromissoryAmount / customerProfile.customer.creditLimit) * 100, 100)}%`,
                            background: openPromissoryAmount > customerProfile.customer.creditLimit ? 'linear-gradient(90deg, #fb7185, #f43f5e)' : 'linear-gradient(90deg, #2dd4bf, #0d9488)',
                            borderRadius: '10px',
                            transition: 'width 0.4s ease'
                          }}
                        />
                      </div>
                      {openPromissoryAmount > customerProfile.customer.creditLimit ? (
                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginTop: '8px', color: '#fb7185', fontSize: '0.75rem', fontWeight: 'bold' }}>
                          <AlertTriangle size={13} />
                          Aviso: O cliente excedeu o limite de crédito contratado!
                        </div>
                      ) : null}
                    </article>
                  ) : null}

                  {/* Mini-Métricas adicionais */}
                  <div className="promissory-mini-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '12px' }}>
                    {[
                      ['Compras', completedSaleCount, `${formatCurrency(averageTicketAmount)} ticket médio`, Receipt],
                      ['Canceladas', cancelledSaleCount, 'vendas separadas', X],
                      ['Abertas', openPromissoryCount, formatCurrency(openPromissoryAmount), DollarSign],
                      ['Vencidas', overduePromissoryCount, formatCurrency(overduePromissoryAmount), CreditCard],
                      ['Pagas', paidPromissoryCount, formatCurrency(paidPromissoryAmount), UserCheck],
                    ].map(([label, value, caption, Icon]) => {
                      const MetricIcon = Icon as typeof Receipt
                      return (
                        <div className="promissory-mini-card" key={String(label)} style={{ background: '#111827', border: '1px solid rgba(226,232,240,0.10)', borderRadius: '10px', padding: '16px' }}>
                          <MetricIcon size={16} style={{ color: '#d7ad55', marginBottom: '8px' }} />
                          <span style={{ display: 'block', fontSize: '0.66rem', textTransform: 'uppercase', color: 'var(--text-secondary)', fontWeight: 900 }}>{String(label)}</span>
                          <strong style={{ display: 'block', fontSize: '1.35rem', color: '#fff' }}>{String(value)}</strong>
                          <small style={{ color: '#707b8c', fontSize: '0.72rem' }}>{String(caption)}</small>
                        </div>
                      )
                    })}
                  </div>

                  {/* Seleção de Abas */}
                  <div className="customer-profile-tabs" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', background: 'rgba(255, 255, 255, 0.03)', padding: '6px', borderRadius: '12px', border: '1px solid rgba(215, 173, 85, 0.35)' }}>
                    {[
                      ['summary', 'Painel de Controle'],
                      ['timeline', `Linha do Tempo (${timelineEvents.length})`],
                      ['sales', `Compras (${filteredCompletedSales.length})`],
                      ['products', `Produtos (${filteredPurchasedItems.length})`],
                      ['notes', `Promissórias (${filteredNotes.length})`],
                      ['cancelled', `Cancelados (${filteredCancelledSales.length})`],
                    ].map(([tab, label]) => (
                      <button key={tab} className={profileTab === tab ? 'customer-premium-primary-button' : 'customer-premium-secondary-button'} style={{ border: 'none', margin: 0 }} type="button" onClick={() => setProfileTab(tab as ProfileTab)}>
                        {String(label)}
                      </button>
                    ))}
                  </div>

                  {/* Aba Resumo / Painel de Controle */}
                  {profileTab === 'summary' ? (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
                      {/* Lado Esquerdo: Alertas, Cobrança e Análise */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        {/* Bloco de Cobrança WhatsApp Consolidado */}
                        <section style={{ background: '#101620', border: '1px solid rgba(45,212,191,0.12)', borderRadius: '14px', padding: '20px' }}>
                          <h3 style={{ color: '#2dd4bf', margin: '0 0 12px', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <CheckCircle2 size={16} />
                            Resumo de Cobrança (Pronto)
                          </h3>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.86rem', color: '#e5e7eb', marginBottom: '16px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <span style={{ color: '#94a3b8' }}>Total em Aberto:</span>
                              <strong>{formatCurrency(openPromissoryAmount)}</strong>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <span style={{ color: '#94a3b8' }}>Parcelas Vencidas:</span>
                              <strong style={{ color: '#fb7185' }}>{overduePromissoryCount} nota(s) ({formatCurrency(overduePromissoryAmount)})</strong>
                            </div>
                            {overdueProfileNotes.length > 0 && (
                              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ color: '#94a3b8' }}>Dias de Atraso (Máx):</span>
                                <strong style={{ color: '#fb7185' }}>{Math.max(...overdueProfileNotes.map((n) => n.daysOverdue || 0))} dia(s)</strong>
                              </div>
                            )}
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <span style={{ color: '#94a3b8' }}>Última Compra:</span>
                              <strong>{profileSales.length > 0 ? formatNullableDateTime(profileSales[0].soldAt).slice(0, 10) : 'Sem registro'}</strong>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <span style={{ color: '#94a3b8' }}>Último Pagamento:</span>
                              <strong>
                                {profilePromissoryNotes.flatMap((n) => n.payments ?? []).length > 0 
                                  ? formatNullableDateTime(profilePromissoryNotes.flatMap((n) => n.payments ?? [])[0].paidAt).slice(0, 10) 
                                  : 'Sem registro'}
                              </strong>
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button
                              type="button"
                              className="customer-premium-primary-button"
                              onClick={() => {
                                navigator.clipboard.writeText(decodeURIComponent(consolidatedWhatsappMessage))
                                notify({ type: 'success', title: 'Mensagem copiada', message: 'Mensagem de cobrança copiada para a área de transferência.' })
                              }}
                              style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '6px' }}
                            >
                              <Copy size={14} />
                              Copiar Mensagem
                            </button>
                            {customerProfile.customer.phone ? (
                              <a
                                href={`https://wa.me/55${customerProfile.customer.phone.replace(/\D/g, '')}?text=${consolidatedWhatsappMessage}`}
                                target="_blank"
                                rel="noreferrer"
                                className="customer-premium-secondary-button"
                                style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px', background: '#25D366', color: '#fff', borderColor: '#25D366' }}
                              >
                                Chamar no Whats
                              </a>
                            ) : null}
                          </div>
                        </section>

                        {/* Alertas Inteligentes */}
                        <section style={{ background: '#101620', border: '1px solid rgba(226,232,240,0.1)', borderRadius: '14px', padding: '20px' }}>
                          <h3 style={{ color: '#f8fafc', margin: '0 0 12px', fontSize: '1rem' }}>Alertas e Insights</h3>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {profileInsights.map((insight) => {
                              const appearance = insightAppearance[insight.severity] ?? insightAppearance.INFO
                              const InsightIcon = appearance.Icon

                              return (
                                <div key={insight.code} style={{ background: appearance.background, borderLeft: `4px solid ${appearance.border}`, padding: '12px', borderRadius: '8px', fontSize: '0.82rem', color: appearance.color }}>
                                  <strong style={{ display: 'flex', alignItems: 'center', gap: '8px', color: appearance.color }}>
                                    <InsightIcon size={15} />
                                    {insight.title}
                                  </strong>
                                  <p style={{ margin: '6px 0 0', color: '#e5e7eb', lineHeight: 1.45 }}>{insight.message}</p>
                                  {insight.recommendedAction ? (
                                    <small style={{ display: 'block', marginTop: '8px', color: '#cbd5e1' }}>
                                      Acao recomendada: {insight.recommendedAction}
                                    </small>
                                  ) : null}
                                </div>
                              )
                            })}
                          </div>
                        </section>
                      </div>

                      {/* Lado Direito: Análise Financeira, Observações e Ações */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        {/* Análise Financeira Detalhada */}
                        <section style={{ background: '#101620', border: '1px solid rgba(226,232,240,0.1)', borderRadius: '14px', padding: '20px' }}>
                          <h3 style={{ color: '#f8fafc', margin: '0 0 12px', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <TrendingUp size={16} style={{ color: '#d7ad55' }} />
                            Análise Financeira
                          </h3>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '0.82rem' }}>
                            <div style={{ background: '#0b0d13', padding: '10px', borderRadius: '8px' }}>
                              <span style={{ color: '#707b8c', display: 'block' }}>Maior Venda</span>
                              <strong style={{ color: '#fff', fontSize: '1rem' }}>
                                {formatCurrency(profileSales.length > 0 ? Math.max(...profileSales.filter(s => s.status === 'COMPLETED').map(s => s.totalAmount)) : 0)}
                              </strong>
                            </div>
                            <div style={{ background: '#0b0d13', padding: '10px', borderRadius: '8px' }}>
                              <span style={{ color: '#707b8c', display: 'block' }}>Economia (Descontos)</span>
                              <strong style={{ color: '#2dd4bf', fontSize: '1rem' }}>{formatCurrency(customerProfile.totalDiscountAmount)}</strong>
                            </div>
                            <div style={{ background: '#0b0d13', padding: '10px', borderRadius: '8px' }}>
                              <span style={{ color: '#707b8c', display: 'block' }}>Taxa de Quitação</span>
                              <strong style={{ color: 'var(--gold-strong)', fontSize: '1rem' }}>
                                {totalPurchasedAmount > 0 
                                  ? `${Math.round((paidPromissoryAmount / totalPurchasedAmount) * 100)}%` 
                                  : '0%'}
                              </strong>
                            </div>
                            <div style={{ background: '#0b0d13', padding: '10px', borderRadius: '8px' }}>
                              <span style={{ color: '#707b8c', display: 'block' }}>Média de Compras</span>
                              <strong style={{ color: '#fff', fontSize: '1rem' }}>
                                {completedSaleCount > 0 
                                  ? `${Math.round(totalPurchasedAmount / completedSaleCount)} un` 
                                  : '0 un'}
                              </strong>
                            </div>
                          </div>
                        </section>

                        {/* Observações Internas Administrativas */}
                        <section style={{ background: '#101620', border: '1px solid rgba(226,232,240,0.1)', borderRadius: '14px', padding: '20px' }}>
                          <h3 style={{ color: '#f8fafc', margin: '0 0 12px', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <FileText size={16} style={{ color: '#d7ad55' }} />
                            Anotações Administrativas
                          </h3>
                          <textarea
                            style={{ width: '100%', background: '#0b0d13', color: '#fff', border: '1px solid rgba(226,232,240,0.12)', borderRadius: '8px', padding: '10px', fontSize: '0.85rem', resize: 'vertical' }}
                            rows={4}
                            placeholder="Adicione acordos de parcelamento, restrições internas, preferências do cliente..."
                            defaultValue={customerProfile.customer.observations || ''}
                            onBlur={(e) => void handleSaveObservations(e.target.value)}
                            disabled={isSavingObs}
                          />
                          <small style={{ color: '#707b8c', display: 'block', marginTop: '4px' }}>
                            As anotações são salvas automaticamente quando você clica fora da caixa de texto.
                          </small>
                        </section>
                      </div>
                    </div>
                  ) : null}

                  {/* Aba Linha do Tempo */}
                  {profileTab === 'timeline' ? (
                    <section style={{ background: 'var(--surface-elevated)', border: '1px solid rgba(226,232,240,0.08)', borderRadius: '16px', padding: '22px' }}>
                      <header style={{ marginBottom: '20px' }}>
                        <h3 style={{ color: '#fff', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <Clock size={18} style={{ color: '#d7ad55' }} />
                          Linha do Tempo do Cliente
                        </h3>
                        <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: '#707b8c' }}>Ordem cronológica reversa de compras, pagamentos e eventos financeiros.</p>
                      </header>
                      
                      {timelinePagination.pageItems.length === 0 ? (
                        <div className="product-empty">Nenhum evento registrado no histórico.</div>
                      ) : (
                        <div style={{ position: 'relative', borderLeft: '2px dashed rgba(226,232,240,0.1)', marginLeft: '12px', paddingLeft: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                          {timelinePagination.pageItems.map((event) => {
                            const EventIcon = event.icon
                            return (
                              <article key={event.id} style={{ position: 'relative' }}>
                                <span style={{ position: 'absolute', left: '-33px', top: '2px', background: '#080b12', border: `2px solid ${event.color}`, borderRadius: '50%', padding: '5px', display: 'flex', justifyContent: 'center', alignItems: 'center', color: event.color }}>
                                  <EventIcon size={12} />
                                </span>
                                <div>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '10px', flexWrap: 'wrap' }}>
                                    <strong style={{ color: '#fff', fontSize: '0.92rem' }}>{event.title}</strong>
                                    <small style={{ color: '#707b8c', fontSize: '0.75rem' }}>{formatNullableDateTime(event.date)}</small>
                                  </div>
                                  <p style={{ margin: '4px 0 0', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>{event.description}</p>
                                  {event.value !== undefined && (
                                    <strong style={{ display: 'inline-block', marginTop: '6px', fontSize: '0.85rem', color: event.color }}>
                                      {formatCurrency(event.value)}
                                    </strong>
                                  )}
                                  
                                  {/* Atalho ver comprovante de venda da timeline */}
                                  {event.type === 'sale' && !event.title.includes('Cancelada') && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const saleId = Number(event.id.replace('sale-', ''))
                                        setReceiptUrl(getSaleReceiptUrl(saleId))
                                        setReceiptTitle(`Recibo da venda #${saleId}`)
                                      }}
                                      style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'none', border: 'none', color: '#d7ad55', fontSize: '0.75rem', cursor: 'pointer', padding: '4px 0', marginTop: '4px' }}
                                    >
                                      <Eye size={12} /> Ver Comprovante
                                    </button>
                                  )}
                                  
                                  {/* Atalho ver recibo de pagamento na timeline */}
                                  {event.type === 'payment' && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const paymentId = Number(event.id.replace('payment-', ''))
                                        setReceiptUrl(getPromissoryPaymentReceiptUrl(paymentId))
                                        setReceiptTitle(`Comprovante de pagamento #${paymentId}`)
                                      }}
                                      style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'none', border: 'none', color: '#2dd4bf', fontSize: '0.75rem', cursor: 'pointer', padding: '4px 0', marginTop: '4px' }}
                                    >
                                      <Eye size={12} /> Ver Recibo
                                    </button>
                                  )}
                                </div>
                              </article>
                            )
                          })}
                        </div>
                      )}
                    </section>
                  ) : null}

                  {/* Aba Compras */}
                  {profileTab === 'sales' ? (
                    <section className="promissory-detail-section" style={{ background: 'var(--surface-elevated)', border: '1px solid rgba(226,232,240,0.08)', borderRadius: '16px', padding: '22px' }}>
                      <header className="section-header" style={{ marginBottom: '16px' }}><h3 style={{ color: '#fff', margin: 0 }}>Compras</h3></header>
                      {filteredCompletedSales.length === 0 ? <div className="product-empty">Nenhuma compra encontrada.</div> : completedSalesPagination.pageItems.map((sale) => (
                        <details className="promissory-history-item" key={sale.id} style={{ background: 'var(--surface-dark)', border: '1px solid rgba(226,232,240,0.06)', borderRadius: '12px', padding: '14px', marginBottom: '10px' }}>
                          <summary style={{ cursor: 'pointer', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span>Venda #{sale.id} - {formatNullableDateTime(sale.soldAt)} - {formatPaymentMethod(sale.paymentMethod)} - {formatCurrency(sale.totalAmount)}</span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                setReceiptUrl(getSaleReceiptUrl(sale.id))
                                setReceiptTitle(`Recibo da venda #${sale.id}`)
                              }}
                              style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(215,173,85,0.1)', border: '1px solid rgba(215,173,85,0.2)', color: '#d7ad55', fontSize: '0.75rem', cursor: 'pointer', padding: '4px 8px', borderRadius: '6px' }}
                            >
                              <Eye size={12} /> Comprovante
                            </button>
                          </summary>
                          <div style={{ display: 'grid', gap: '8px', marginTop: '12px' }}>
                            {sale.items.map((item) => <div key={item.id} style={{ color: 'var(--text-secondary)' }}>{item.quantity}x {item.productName} ({item.productCode}) - {formatCurrency(item.subtotal)}</div>)}
                            <small style={{ color: '#707b8c' }}>Desconto: {formatCurrency(sale.discountAmount)} | Operador: {sale.operator?.displayName ?? '-'}</small>
                          </div>
                        </details>
                      ))}
                      <PaginationControls itemLabel="compras" page={completedSalesPagination.page} pageSize={completedSalesPagination.pageSize} totalItems={completedSalesPagination.totalItems} totalPages={completedSalesPagination.totalPages} onPageChange={completedSalesPagination.setPage} />
                    </section>
                  ) : null}

                  {/* Aba Produtos Favoritos */}
                  {profileTab === 'products' ? (
                    <section className="promissory-detail-section" style={{ background: 'var(--surface-elevated)', border: '1px solid rgba(226,232,240,0.08)', borderRadius: '16px', padding: '22px' }}>
                      <header className="section-header" style={{ marginBottom: '20px' }}>
                        <h3 style={{ color: '#fff', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <Heart size={16} style={{ color: '#fb7185' }} />
                          Favoritos do Cliente
                        </h3>
                        <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: '#707b8c' }}>Ranqueamento dos itens mais comprados pelo cliente.</p>
                      </header>
                      
                      {filteredPurchasedItems.length > 0 && (
                        <div style={{ background: 'var(--surface-dark)', padding: '18px', borderRadius: '12px', border: '1px solid rgba(226,232,240,0.06)', marginBottom: '20px' }}>
                          <h4 style={{ margin: '0 0 12px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Top 5 Produtos mais Comprados:</h4>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                            {filteredPurchasedItems
                              .slice(0, 5)
                              .map((item, index) => {
                                const maxQty = Math.max(...filteredPurchasedItems.map(i => i.quantity))
                                const percentage = maxQty > 0 ? (item.quantity / maxQty) * 100 : 0
                                return (
                                  <div key={item.productId}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '4px' }}>
                                      <span><strong>#{index + 1}</strong> - {item.productName} ({item.productCode})</span>
                                      <strong>{item.quantity} un. ({formatCurrency(item.totalAmount)})</strong>
                                    </div>
                                    <div style={{ width: '100%', height: '6px', background: '#111827', borderRadius: '4px', overflow: 'hidden' }}>
                                      <div style={{ height: '100%', width: `${percentage}%`, background: 'linear-gradient(90deg, #d7ad55, #f59e0b)', borderRadius: '4px' }} />
                                    </div>
                                  </div>
                                )
                              })}
                          </div>
                        </div>
                      )}

                      {filteredPurchasedItems.length === 0 ? <div className="product-empty">Nenhum produto encontrado.</div> : (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px', marginBottom: '18px' }}>
                          {purchasedItemsPagination.pageItems.map((item) => (
                            <div 
                              className="product-premium-card" 
                              key={item.productId} 
                              style={{ 
                                background: 'var(--surface-dark)', 
                                border: '1px solid rgba(215, 173, 85, 0.12)', 
                                borderRadius: '16px', 
                                padding: '16px', 
                                display: 'flex', 
                                flexDirection: 'column', 
                                justifyContent: 'space-between',
                                gap: '12px',
                                position: 'relative',
                                boxShadow: '0 4px 15px rgba(0,0,0,0.18)',
                                transition: 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1), border-color 0.25s ease'
                              }}
                            >
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
                                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                                  <span style={{ background: 'rgba(215, 173, 85, 0.1)', padding: '8px', borderRadius: '12px', color: '#d7ad55', display: 'inline-flex' }}>
                                    <ShoppingBag size={18} />
                                  </span>
                                  <div>
                                    <strong style={{ color: '#fff', fontSize: '0.88rem', display: 'block' }}>{item.productName}</strong>
                                    <span style={{ fontSize: '0.72rem', color: '#707b8c', display: 'block', marginTop: '2px' }}>Cód: {item.productCode}</span>
                                  </div>
                                </div>
                                <span style={{ background: 'rgba(215, 173, 85, 0.15)', color: '#e5ba6b', fontSize: '0.72rem', fontWeight: 'bold', padding: '4px 10px', borderRadius: '50px' }}>
                                  {item.quantity} un.
                                </span>
                              </div>
                              
                              <div style={{ borderTop: '1px solid rgba(226,232,240,0.05)', paddingTop: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem' }}>
                                <div>
                                  <span style={{ color: '#707b8c', display: 'block', fontSize: '0.65rem' }}>ÚLTIMA COMPRA</span>
                                  <strong style={{ color: '#cbd5e1' }}>{formatNullableDateTime(item.lastPurchaseAt).slice(0, 10)}</strong>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                  <span style={{ color: '#707b8c', display: 'block', fontSize: '0.65rem' }}>VALOR TOTAL</span>
                                  <strong style={{ color: '#2dd4bf', fontSize: '0.85rem' }}>{formatCurrency(item.totalAmount)}</strong>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      <PaginationControls itemLabel="produtos" page={purchasedItemsPagination.page} pageSize={purchasedItemsPagination.pageSize} totalItems={purchasedItemsPagination.totalItems} totalPages={purchasedItemsPagination.totalPages} onPageChange={purchasedItemsPagination.setPage} />
                    </section>
                  ) : null}

                  {/* Aba Promissórias */}
                  {profileTab === 'notes' ? (
                    <section className="promissory-detail-section" style={{ background: 'var(--surface-elevated)', border: '1px solid rgba(226,232,240,0.08)', borderRadius: '16px', padding: '22px' }}>
                      <header className="section-header" style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '16px', flexWrap: 'wrap' }}>
                        <h3 style={{ color: '#fff', margin: 0 }}>Promissórias</h3>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.8rem', color: '#cbd5e1' }}>
                          <input type="checkbox" checked={groupBySale} onChange={(e) => setGroupBySale(e.target.checked)} />
                          Agrupar parcelas por venda original
                        </label>
                      </header>

                      {filteredNotes.length === 0 ? (
                        <div className="product-empty">Nenhuma promissória encontrada.</div>
                      ) : groupBySale ? (
                        // Renderização agrupada por venda original
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                          {promissoryNotesGroupedBySale.map((group) => {
                            const totalPago = group.notes.reduce((sum, n) => sum + n.paidAmount, 0)
                            const totalAberto = group.notes.reduce((sum, n) => sum + (['PENDING', 'PARTIALLY_PAID', 'OVERDUE'].includes(n.status) ? n.remainingAmount : 0), 0)
                            const vencidas = group.notes.filter((n) => n.status === 'OVERDUE').length
                            
                            return (
                              <article key={group.saleId || 'avulsas'} style={{ background: '#0c0f16', border: '1px solid rgba(226,232,240,0.06)', borderRadius: '12px', padding: '16px' }}>
                                <header style={{ borderBottom: '1px solid rgba(226,232,240,0.05)', paddingBottom: '10px', marginBottom: '12px', display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
                                  <div>
                                    <strong style={{ color: '#fff', fontSize: '0.9rem' }}>
                                      {group.saleId ? `Venda #${group.saleId}` : 'Promissórias Avulsas'}
                                    </strong>
                                    <span style={{ fontSize: '0.75rem', color: '#707b8c', marginLeft: '10px' }}>
                                      Realizada em: {group.saleDate ? formatDate(group.saleDate.slice(0, 10)) : '-'}
                                    </span>
                                  </div>
                                  <div style={{ display: 'flex', gap: '12px', fontSize: '0.8rem' }}>
                                    <span>Total: <strong style={{ color: 'var(--gold-strong)' }}>{formatCurrency(group.saleTotal)}</strong></span>
                                    <span>Pago: <strong style={{ color: '#2dd4bf' }}>{formatCurrency(totalPago)}</strong></span>
                                    <span>Aberto: <strong style={{ color: totalAberto > 0 ? '#fb7185' : '#2dd4bf' }}>{formatCurrency(totalAberto)}</strong></span>
                                    {vencidas > 0 && <span style={{ color: '#fb7185', fontWeight: 'bold' }}>({vencidas} vencida!)</span>}
                                  </div>
                                </header>
                                <div style={{ display: 'grid', gap: '10px' }}>
                                  {group.notes.map((note) => (
                                    <details className="promissory-history-item" key={note.id} style={{ background: '#0e121a', border: '1px solid rgba(226,232,240,0.05)', borderRadius: '10px', padding: '12px' }}>
                                      <summary style={{ cursor: 'pointer', color: note.status === 'OVERDUE' ? '#fb7185' : '#fff', display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
                                        <span>Parcela {note.installmentNumber}/{note.totalInstallments} - {noteStatusLabels[note.status as PromissoryNoteStatus]} - Venc. {formatDate(note.dueDate)}</span>
                                        <strong>Saldo {formatCurrency(note.remainingAmount)}</strong>
                                      </summary>
                                      <div style={{ display: 'grid', gap: '10px', marginTop: '12px', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
                                          <span>Código Promissória: #{note.id} | Valor original: {formatCurrency(note.amount)}</span>
                                          <div style={{ display: 'flex', gap: '6px' }}>
                                            <a
                                              href={getPromissoryNotePrintUrl(note.id)}
                                              target="_blank"
                                              rel="noreferrer"
                                              className="customer-premium-secondary-button"
                                              style={{ padding: '2px 8px', fontSize: '0.72rem', minHeight: 'auto' }}
                                            >
                                              Imprimir Nota
                                            </a>
                                          </div>
                                        </div>
                                        {(note.saleItems ?? []).map((item: any) => <div key={item.id}>{item.quantity}x {item.productName} ({item.productCode}) - {formatCurrency(item.subtotal)}</div>)}
                                        
                                        {/* Tabela de baixas/pagamentos parciais ricos */}
                                        <div style={{ background: '#080a0e', borderRadius: '8px', padding: '10px', marginTop: '8px' }}>
                                          <strong style={{ display: 'block', marginBottom: '6px', fontSize: '0.75rem', color: '#f8fafc' }}>Histórico de Baixas e Amortizações:</strong>
                                          {(note.payments ?? []).length === 0 ? (
                                            <small style={{ color: '#707b8c' }}>Nenhum pagamento parcial registrado.</small>
                                          ) : (
                                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.72rem', color: '#cbd5e1' }}>
                                              <thead>
                                                <tr style={{ borderBottom: '1px solid rgba(226,232,240,0.1)' }}>
                                                  <th style={{ padding: '4px', textAlign: 'left' }}>Data</th>
                                                  <th style={{ padding: '4px', textAlign: 'left' }}>Forma</th>
                                                  <th style={{ padding: '4px', textAlign: 'right' }}>Principal</th>
                                                  <th style={{ padding: '4px', textAlign: 'right' }}>Juros/Multa</th>
                                                  <th style={{ padding: '4px', textAlign: 'right' }}>Total</th>
                                                  <th style={{ padding: '4px', textAlign: 'left' }}>Operador</th>
                                                  <th style={{ padding: '4px', textAlign: 'center' }}>Ação</th>
                                                </tr>
                                              </thead>
                                              <tbody>
                                                {note.payments.map((p: any) => (
                                                  <tr key={p.id} style={{ borderBottom: '1px solid rgba(226,232,240,0.05)' }}>
                                                    <td style={{ padding: '4px' }}>{formatNullableDateTime(p.paidAt)}</td>
                                                    <td style={{ padding: '4px' }}>{formatPaymentMethod(p.paymentMethod)}</td>
                                                    <td style={{ padding: '4px', textAlign: 'right' }}>{formatCurrency(p.amount)}</td>
                                                    <td style={{ padding: '4px', textAlign: 'right' }}>{formatCurrency((p.interestAmount || 0) + (p.penaltyAmount || 0))}</td>
                                                    <td style={{ padding: '4px', textAlign: 'right', color: '#2dd4bf', fontWeight: 'bold' }}>{formatCurrency(p.totalReceived)}</td>
                                                    <td style={{ padding: '4px' }}>{p.paidBy?.displayName || '-'}</td>
                                                    <td style={{ padding: '4px', textAlign: 'center' }}>
                                                      <button
                                                        type="button"
                                                        onClick={() => {
                                                          setReceiptUrl(getPromissoryPaymentReceiptUrl(p.id))
                                                          setReceiptTitle(`Comprovante de pagamento #${p.id}`)
                                                        }}
                                                        style={{ background: 'none', border: 'none', color: '#2dd4bf', cursor: 'pointer', padding: 0 }}
                                                      >
                                                        <Eye size={12} />
                                                      </button>
                                                    </td>
                                                  </tr>
                                                ))}
                                              </tbody>
                                            </table>
                                          )}
                                        </div>
                                      </div>
                                    </details>
                                  ))}
                                </div>
                              </article>
                            )
                          })}
                        </div>
                      ) : (
                        // Renderização corrida das promissórias (original mas com melhorias)
                        notesPagination.pageItems.map((note) => (
                          <details className="promissory-history-item" key={note.id} style={{ background: 'var(--surface-dark)', border: '1px solid rgba(226,232,240,0.06)', borderRadius: '12px', padding: '14px', marginBottom: '10px' }}>
                            <summary style={{ cursor: 'pointer', color: note.status === 'OVERDUE' ? '#fb7185' : '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span>Nota #{note.id} - {noteStatusLabels[note.status as PromissoryNoteStatus]} - Venc. {formatDate(note.dueDate)}</span>
                              <strong>Saldo {formatCurrency(note.remainingAmount)}</strong>
                            </summary>
                            <div style={{ display: 'grid', gap: '10px', marginTop: '12px', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
                                <span>Venda: {note.saleId ? `#${note.saleId}` : 'Avulsa'} | Parcela {note.installmentNumber}/{note.totalInstallments} | Valor: {formatCurrency(note.amount)}</span>
                                <div style={{ display: 'flex', gap: '6px' }}>
                                  <a
                                    href={getPromissoryNotePrintUrl(note.id)}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="customer-premium-secondary-button"
                                    style={{ padding: '2px 8px', fontSize: '0.72rem', minHeight: 'auto' }}
                                  >
                                    Imprimir Nota
                                  </a>
                                </div>
                              </div>
                              {(note.saleItems ?? []).map((item: any) => <div key={item.id}>{item.quantity}x {item.productName} ({item.productCode}) - {formatCurrency(item.subtotal)}</div>)}
                              
                              {/* Tabela de baixas/pagamentos parciais ricos */}
                              <div style={{ background: '#080a0e', borderRadius: '8px', padding: '10px', marginTop: '8px' }}>
                                <strong style={{ display: 'block', marginBottom: '6px', fontSize: '0.75rem', color: '#f8fafc' }}>Histórico de Baixas e Amortizações:</strong>
                                {(note.payments ?? []).length === 0 ? (
                                  <small style={{ color: '#707b8c' }}>Nenhum pagamento parcial registrado.</small>
                                ) : (
                                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.72rem', color: '#cbd5e1' }}>
                                    <thead>
                                      <tr style={{ borderBottom: '1px solid rgba(226,232,240,0.1)' }}>
                                        <th style={{ padding: '4px', textAlign: 'left' }}>Data</th>
                                        <th style={{ padding: '4px', textAlign: 'left' }}>Forma</th>
                                        <th style={{ padding: '4px', textAlign: 'right' }}>Principal</th>
                                        <th style={{ padding: '4px', textAlign: 'right' }}>Juros/Multa</th>
                                        <th style={{ padding: '4px', textAlign: 'right' }}>Total</th>
                                        <th style={{ padding: '4px', textAlign: 'left' }}>Operador</th>
                                        <th style={{ padding: '4px', textAlign: 'center' }}>Ação</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {note.payments.map((p: any) => (
                                        <tr key={p.id} style={{ borderBottom: '1px solid rgba(226,232,240,0.05)' }}>
                                          <td style={{ padding: '4px' }}>{formatNullableDateTime(p.paidAt)}</td>
                                          <td style={{ padding: '4px' }}>{formatPaymentMethod(p.paymentMethod)}</td>
                                          <td style={{ padding: '4px', textAlign: 'right' }}>{formatCurrency(p.amount)}</td>
                                          <td style={{ padding: '4px', textAlign: 'right' }}>{formatCurrency((p.interestAmount || 0) + (p.penaltyAmount || 0))}</td>
                                          <td style={{ padding: '4px', textAlign: 'right', color: '#2dd4bf', fontWeight: 'bold' }}>{formatCurrency(p.totalReceived)}</td>
                                          <td style={{ padding: '4px' }}>{p.paidBy?.displayName || '-'}</td>
                                          <td style={{ padding: '4px', textAlign: 'center' }}>
                                            <button
                                              type="button"
                                              onClick={() => {
                                                setReceiptUrl(getPromissoryPaymentReceiptUrl(p.id))
                                                setReceiptTitle(`Comprovante de pagamento #${p.id}`)
                                              }}
                                              style={{ background: 'none', border: 'none', color: '#2dd4bf', cursor: 'pointer', padding: 0 }}
                                            >
                                              <Eye size={12} />
                                            </button>
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                )}
                              </div>
                            </div>
                          </details>
                        ))
                      )}
                      {!groupBySale && <PaginationControls itemLabel="promissórias" page={notesPagination.page} pageSize={notesPagination.pageSize} totalItems={notesPagination.totalItems} totalPages={notesPagination.totalPages} onPageChange={notesPagination.setPage} />}
                    </section>
                  ) : null}

                  {/* Aba Cancelados */}
                  {profileTab === 'cancelled' ? (
                    <section className="promissory-detail-section" style={{ background: 'var(--surface-elevated)', border: '1px solid rgba(226,232,240,0.08)', borderRadius: '16px', padding: '22px' }}>
                      <header className="section-header" style={{ marginBottom: '16px' }}><h3 style={{ color: '#fff', margin: 0 }}>Cancelados</h3></header>
                      {filteredCancelledSales.length === 0 && filteredCancelledNotes.length === 0 ? <div className="product-empty">Nenhum cancelamento encontrado.</div> : null}
                      {cancelledSalesPagination.pageItems.map((sale) => (
                        <div key={sale.id} className="promissory-history-item" style={{ background: 'var(--surface-dark)', border: '1px solid rgba(251,113,133,0.18)', borderRadius: '12px', padding: '14px', marginBottom: '10px' }}>
                          <strong style={{ color: '#fff' }}>Venda #{sale.id} - {formatCurrency(sale.totalAmount)}</strong>
                          <small style={{ display: 'block', color: '#fb7185' }}>{formatNullableDateTime(sale.cancelledAt)} - {sale.cancellationReason ?? 'Sem motivo registrado'}</small>
                        </div>
                      ))}
                      <PaginationControls itemLabel="vendas canceladas" page={cancelledSalesPagination.page} pageSize={cancelledSalesPagination.pageSize} totalItems={cancelledSalesPagination.totalItems} totalPages={cancelledSalesPagination.totalPages} onPageChange={cancelledSalesPagination.setPage} />
                      {cancelledNotesPagination.pageItems.map((note) => (
                        <div key={note.id} className="promissory-history-item" style={{ background: 'var(--surface-dark)', border: '1px solid rgba(251,113,133,0.18)', borderRadius: '12px', padding: '14px', marginBottom: '10px' }}>
                          <strong style={{ color: '#fff' }}>Nota #{note.id} cancelada</strong>
                          <small style={{ display: 'block', color: '#fb7185' }}>Venda: {note.saleId ?? 'Avulsa'} | Valor: {formatCurrency(note.amount)}</small>
                        </div>
                      ))}
                      <PaginationControls itemLabel="promissórias canceladas" page={cancelledNotesPagination.page} pageSize={cancelledNotesPagination.pageSize} totalItems={cancelledNotesPagination.totalItems} totalPages={cancelledNotesPagination.totalPages} onPageChange={cancelledNotesPagination.setPage} />
                    </section>
                  ) : null}
                </div>
              )}
            </section>
          ) : null}

          {/* Legacy profile implementation disabled after the complete admin consultation redesign.
            <section className="product-list-panel customer-list-panel relationship-client-panel">
              <header className="section-header relationship-client-header" style={{ borderBottom: '1px solid rgba(226, 232, 240, 0.08)', paddingBottom: '20px' }}>
                <div className="relationship-client-title">
                  <span className="relationship-client-icon" aria-hidden="true">
                    <Search size={22} strokeWidth={2.4} />
                  </span>
                  <div>
                    <h2>Consulta completa do cliente</h2>
                    <p>Pesquise e selecione um cliente para ver compras, itens, notas e valores em aberto.</p>
                  </div>
                </div>
              </header>

              <div className="history-filter-form customer-profile-search" style={{ gap: '16px', background: 'var(--surface-dark)', padding: '18px', borderRadius: '14px', border: '1px solid rgba(226,232,240,0.08)', margin: '20px 0' }}>
                <div className="field-group" style={{ flex: 1 }}>
                  <label htmlFor="customerProfileSearch" style={{ color: 'var(--gold-strong)', fontWeight: 900, fontSize: '0.62rem', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Filtrar Lista</label>
                  <input
                    id="customerProfileSearch"
                    value={profileSearch}
                    onChange={(event) => setProfileSearch(event.target.value)}
                    placeholder="Filtrar por nome do cliente..."
                    style={{ background: 'var(--surface-dark)', color: '#fff', border: '1px solid rgba(226,232,240,0.12)', borderRadius: '12px', minHeight: '48px', padding: '0 16px' }}
                  />
                </div>
                <div className="field-group" style={{ flex: 1 }}>
                  <label htmlFor="customerProfileSelect" style={{ color: 'var(--gold-strong)', fontWeight: 900, fontSize: '0.62rem', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Selecione o Cliente</label>
                  <select
                    id="customerProfileSelect"
                    value={selectedProfileCustomerId}
                    onChange={(event) => {
                      setSelectedProfileCustomerId(event.target.value)
                      if (!event.target.value) {
                        setCustomerProfile(null)
                      }
                    }}
                    style={{ background: 'var(--surface-dark)', color: '#fff', border: '1px solid rgba(226,232,240,0.12)', borderRadius: '12px', minHeight: '48px', padding: '0 16px', width: '100%' }}
                  >
                    <option value="">Selecione um cliente para consulta...</option>
                    {profileOptions.map((customer) => (
                      <option value={customer.id} key={customer.id}>{customer.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {isProfileLoading ? (
                <div className="product-empty">Carregando perfil do cliente...</div>
              ) : !customerProfile ? (
                <div className="product-empty" style={{ background: 'var(--surface-dark)', borderRadius: '16px', padding: '40px' }}>Selecione um cliente para visualizar o perfil completo.</div>
              ) : (
                <div className="cart-list" style={{ display: 'grid', gap: '22px' }}>
                  <article className="cart-item" style={{ background: 'var(--surface-elevated)', border: '1px solid rgba(226,232,240,0.08)', borderRadius: '16px', padding: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div className="cart-item-main">
                      <span style={{ display: 'inline-block', background: 'var(--surface-elevated)', padding: '4px 8px', borderRadius: '6px', fontSize: '0.7rem', color: '#b9c4d4', fontFamily: 'monospace', marginBottom: '8px' }}>
                        {customerProfile.customer.cpf ? maskCpf(customerProfile.customer.cpf) : 'Sem CPF'}
                      </span>
                      <h3 style={{ margin: '0 0 6px', fontSize: '1.25rem', color: '#fff', fontWeight: 500 }}>{customerProfile.customer.name}</h3>
                      <small style={{ color: 'var(--text-secondary)', display: 'block', fontSize: '0.85rem' }}>
                        <Phone size={12} style={{ marginRight: '6px', verticalAlign: 'middle', color: '#d7ad55' }} />
                        {customerProfile.customer.phone ? maskPhone(customerProfile.customer.phone) : 'Sem telefone cadastrado'}
                        {customerProfile.customer.email && (
                          <span style={{ marginLeft: '16px' }}>
                            <Mail size={12} style={{ marginRight: '6px', verticalAlign: 'middle', color: '#d7ad55' }} />
                            {customerProfile.customer.email}
                          </span>
                        )}
                        {customerProfile.customer.birthDate && (
                          <span style={{ marginLeft: '16px' }}>
                            <Gift size={12} style={{ marginRight: '6px', verticalAlign: 'middle', color: '#d7ad55' }} />
                            Aniversário: {customerProfile.customer.birthDate.split('-').reverse().join('/')}
                          </span>
                        )}
                      </small>
                      {customerProfile.customer.address && (
                        <p style={{ margin: '8px 0 0 0', fontSize: '0.8rem', color: '#8d98a8' }}>
                          <MapPin size={12} style={{ marginRight: '6px', verticalAlign: 'middle', color: '#d7ad55' }} />
                          {customerProfile.customer.address}
                        </p>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: '20px' }}>
                      <div className="cart-price" style={{ textAlign: 'center' }}>
                        <span style={{ fontSize: '0.65rem', textTransform: 'uppercase', color: '#707b8c', fontWeight: 900 }}>Compras</span>
                        <strong style={{ display: 'block', fontSize: '1.5rem', color: '#fff', marginTop: '4px' }}>{customerProfile.saleCount}</strong>
                      </div>
                      <div className="cart-price" style={{ textAlign: 'center' }}>
                        <span style={{ fontSize: '0.65rem', textTransform: 'uppercase', color: '#707b8c', fontWeight: 900 }}>Total Comprado</span>
                        <strong style={{ display: 'block', fontSize: '1.5rem', color: 'var(--gold-strong)', marginTop: '4px' }}>{formatCurrency(customerProfile.totalPurchasedAmount)}</strong>
                      </div>
                    </div>
                  </article>

                  <div className="promissory-mini-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
                    <div className="promissory-mini-card" style={{ background: 'var(--surface-elevated)', border: '1px solid rgba(226,232,240,0.08)', borderRadius: '16px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <span style={{ fontSize: '0.65rem', textTransform: 'uppercase', color: 'var(--text-secondary)', fontWeight: 900 }}>Valor em Aberto</span>
                      <strong style={{ fontSize: '1.5rem', color: '#f2cf7a' }}>{formatCurrency(customerProfile.openPromissoryAmount)}</strong>
                      <small style={{ fontSize: '0.75rem', color: '#707b8c' }}>{customerProfile.openPromissoryCount} nota(s) em aberto</small>
                    </div>
                    <div className="promissory-mini-card" style={{ background: 'var(--surface-elevated)', border: '1px solid rgba(251,113,133,0.2)', borderRadius: '16px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <span style={{ fontSize: '0.65rem', textTransform: 'uppercase', color: '#fecdd3', fontWeight: 900 }}>Valor Vencido</span>
                      <strong style={{ fontSize: '1.5rem', color: '#fb7185' }}>{formatCurrency(customerProfile.overduePromissoryAmount)}</strong>
                      <small style={{ fontSize: '0.75rem', color: '#fb7185' }}>{customerProfile.overduePromissoryCount} nota(s) atrasada(s)</small>
                    </div>
                    <div className="promissory-mini-card" style={{ background: 'var(--surface-elevated)', border: '1px solid rgba(45,212,191,0.2)', borderRadius: '16px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <span style={{ fontSize: '0.65rem', textTransform: 'uppercase', color: '#8ff2e7', fontWeight: 900 }}>Total Pago</span>
                      <strong style={{ fontSize: '1.5rem', color: '#2dd4bf' }}>{formatCurrency(customerProfile.paidPromissoryAmount)}</strong>
                      <small style={{ fontSize: '0.75rem', color: '#707b8c' }}>Liquidado com sucesso</small>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '22px' }}>
                    <section className="promissory-detail-section" style={{ background: 'var(--surface-elevated)', border: '1px solid rgba(226,232,240,0.08)', borderRadius: '16px', padding: '24px' }}>
                      <header className="section-header" style={{ marginBottom: '20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <CreditCard size={18} style={{ color: '#d7ad55' }} />
                          <h2 style={{ fontSize: '1.1rem', color: '#fff', margin: 0, fontWeight: 500 }}>Itens Comprados</h2>
                        </div>
                        <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: '#707b8c' }}>{customerProfile.purchasedItems.length} produto(s) no histórico de vendas.</p>
                      </header>
                      {customerProfile.purchasedItems.length === 0 ? (
                        <div className="product-empty">Nenhum produto comprado cadastrado.</div>
                      ) : (
                        <div className="promissory-history-list" style={{ display: 'grid', gap: '12px' }}>
                          {customerProfile.purchasedItems.map((item) => (
                            <div className="promissory-history-item" key={item.productId} style={{ background: 'var(--surface-dark)', border: '1px solid rgba(226,232,240,0.06)', borderRadius: '12px', padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <div>
                                <strong style={{ color: '#fff', fontSize: '0.9rem', display: 'block' }}>{item.productName}</strong>
                                <small style={{ color: '#707b8c', fontSize: '0.75rem' }}>Código: {item.productCode} — {item.quantity} un.</small>
                              </div>
                              <div style={{ textAlign: 'right' }}>
                                <span style={{ fontSize: '0.65rem', textTransform: 'uppercase', color: '#707b8c', display: 'block' }}>Total</span>
                                <strong style={{ color: 'var(--gold-strong)', fontSize: '0.95rem' }}>{formatCurrency(item.totalAmount)}</strong>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </section>

                    <section className="promissory-detail-section" style={{ background: 'var(--surface-elevated)', border: '1px solid rgba(226,232,240,0.08)', borderRadius: '16px', padding: '24px' }}>
                      <header className="section-header" style={{ marginBottom: '20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <Receipt size={18} style={{ color: '#d7ad55' }} />
                          <h2 style={{ fontSize: '1.1rem', color: '#fff', margin: 0, fontWeight: 500 }}>Compras Recentes</h2>
                        </div>
                        <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: '#707b8c' }}>{customerProfile.latestSales.length} registro(s) de vendas.</p>
                      </header>
                      {customerProfile.latestSales.length === 0 ? (
                        <div className="product-empty">Nenhuma compra encontrada.</div>
                      ) : (
                        <div className="promissory-history-list" style={{ display: 'grid', gap: '12px' }}>
                          {customerProfile.latestSales.map((sale) => (
                            <div className="promissory-history-item" key={sale.id} style={{ background: 'var(--surface-dark)', border: '1px solid rgba(226,232,240,0.06)', borderRadius: '12px', padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <div>
                                <strong style={{ color: '#fff', fontSize: '0.9rem', display: 'block' }}>Venda #{sale.id}</strong>
                                <small style={{ color: '#707b8c', fontSize: '0.75rem' }}>Realizada em: {formatNullableDateTime(sale.soldAt)} — Método: {formatPaymentMethod(sale.paymentMethod)}</small>
                              </div>
                              <strong style={{ color: 'var(--gold-strong)', fontSize: '0.95rem' }}>{formatCurrency(sale.totalAmount)}</strong>
                            </div>
                          ))}
                        </div>
                      )}
                    </section>

                    <section className="promissory-detail-section" style={{ background: 'var(--surface-elevated)', border: '1px solid rgba(226,232,240,0.08)', borderRadius: '16px', padding: '24px' }}>
                      <header className="section-header" style={{ marginBottom: '20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <DollarSign size={18} style={{ color: '#d7ad55' }} />
                          <h2 style={{ fontSize: '1.1rem', color: '#fff', margin: 0, fontWeight: 500 }}>Notas Promissórias</h2>
                        </div>
                        <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: '#707b8c' }}>{customerProfile.promissoryNotes.length} parcela(s) vinculadas.</p>
                      </header>
                      {customerProfile.promissoryNotes.length === 0 ? (
                        <div className="product-empty">Nenhuma nota promissória registrada para o cliente.</div>
                      ) : (
                        <div className="promissory-history-list" style={{ display: 'grid', gap: '12px' }}>
                          {customerProfile.promissoryNotes.map((note) => (
                            <div className="promissory-history-item" key={note.id} style={{ background: 'var(--surface-dark)', border: '1px solid rgba(226,232,240,0.06)', borderRadius: '12px', padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <div>
                                <strong style={{ color: '#fff', fontSize: '0.9rem', display: 'block' }}>Nota #{note.id}</strong>
                                <small style={{ color: note.status === 'OVERDUE' ? '#fb7185' : '#707b8c', fontSize: '0.75rem', fontWeight: note.status === 'OVERDUE' ? 'bold' : 'normal' }}>
                                  Vencimento: {note.dueDate.split('-').reverse().join('/')} — {note.status === 'PAID' ? 'Pago' : note.status === 'OVERDUE' ? 'Vencido/Atrasado' : 'Pendente'}
                                </small>
                              </div>
                              <div style={{ textAlign: 'right' }}>
                                <span style={{ fontSize: '0.65rem', textTransform: 'uppercase', color: '#707b8c', display: 'block' }}>Saldo Devedor</span>
                                <strong style={{ color: note.remainingAmount > 0 ? '#fb7185' : '#2dd4bf', fontSize: '0.95rem' }}>{formatCurrency(note.remainingAmount)}</strong>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </section>
                  </div>
                </div>
              )}
            </section>
          */}
        </div>
      </div>
      
      {receiptUrl ? (
        <div className="customer-premium-modal-backdrop" role="presentation" onClick={() => setReceiptUrl(null)}>
          <section className="customer-premium-edit-modal" role="dialog" aria-modal="true" aria-labelledby="receipt-modal-title" style={{ maxWidth: '640px', width: '90%', background: '#0a0d14', border: '1px solid rgba(226,232,240,0.1)', borderRadius: '16px', padding: '20px' }} onClick={(e) => e.stopPropagation()}>
            <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(226,232,240,0.08)', paddingBottom: '14px', marginBottom: '16px' }}>
              <div>
                <h2 id="receipt-modal-title" style={{ fontSize: '1.2rem', color: '#fff', margin: 0 }}>{receiptTitle}</h2>
              </div>
              <button type="button" onClick={() => setReceiptUrl(null)} aria-label="Fechar comprovante" style={{ border: '1px solid rgba(226,232,240,0.1)', background: 'rgba(226,232,240,0.04)', borderRadius: '8px', padding: '6px', cursor: 'pointer', color: '#fff' }}>
                <X size={16} />
              </button>
            </header>
            <iframe
              className="receipt-preview-frame"
              ref={receiptFrameRef}
              src={receiptUrl}
              title={receiptTitle}
              style={{ width: '100%', height: '480px', border: 'none', background: '#fff', borderRadius: '8px' }}
            />
            <footer style={{ marginTop: '16px', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button className="customer-premium-primary-button" type="button" onClick={() => receiptFrameRef.current?.contentWindow?.print()} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Printer size={14} /> Imprimir
              </button>
              <button className="customer-premium-secondary-button" type="button" onClick={() => setReceiptUrl(null)}>
                Fechar
              </button>
            </footer>
          </section>
        </div>
      ) : null}

      {showList && editingCustomerId !== null ? (
        <div className="customer-premium-modal-backdrop" role="presentation">
          <section className="customer-premium-edit-modal" role="dialog" aria-modal="true" aria-labelledby="customerEditTitle">
            <header>
              <div>
                <h2 id="customerEditTitle">Editar cadastro</h2>
                <p>Ajuste os dados cadastrados no sistema do Atelier.</p>
              </div>
              <button type="button" onClick={closeEditModal} aria-label="Fechar edição">
                <X size={20} aria-hidden="true" />
              </button>
            </header>

            <form className="customer-premium-form" onSubmit={handleSubmit}>
              <div className="customer-premium-form-grid">
                <div className="field-group field-group--full">
                  <label htmlFor="customerEditName">Nome Completo</label>
                  <input
                    id="customerEditName"
                    value={form.name ?? ''}
                    onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                    placeholder="Nome completo"
                    required
                  />
                </div>
                <div className="field-group">
                  <label htmlFor="customerEditCpf">CPF</label>
                  <input
                    id="customerEditCpf"
                    value={form.cpf ?? ''}
                    onChange={(event) => setForm((current) => ({ ...current, cpf: maskCpf(event.target.value) }))}
                    inputMode="numeric"
                    placeholder="000.000.000-00"
                  />
                </div>
                <div className="field-group">
                  <label htmlFor="customerEditPhone">Telefone</label>
                  <input
                    id="customerEditPhone"
                    value={form.phone ?? ''}
                    onChange={(event) => setForm((current) => ({ ...current, phone: maskPhone(event.target.value) }))}
                    inputMode="numeric"
                    placeholder="11 99999-9999"
                  />
                </div>
                <div className="field-group">
                  <label htmlFor="customerEditEmail">Email</label>
                  <input
                    id="customerEditEmail"
                    type="email"
                    value={form.email ?? ''}
                    onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                    placeholder="Opcional"
                  />
                </div>
                <div className="field-group">
                  <label htmlFor="customerEditActive">Status</label>
                  <select
                    id="customerEditActive"
                    value={form.active === false ? 'false' : 'true'}
                    onChange={(event) => setForm((current) => ({ ...current, active: event.target.value === 'true' }))}
                  >
                    <option value="true">Ativo</option>
                    <option value="false">Inativo</option>
                  </select>
                </div>
                <div className="field-group">
                  <label htmlFor="customerEditBirthDate">Aniversário</label>
                  <input
                    id="customerEditBirthDate"
                    type="date"
                    value={form.birthDate ?? ''}
                    onChange={(event) => setForm((current) => ({ ...current, birthDate: event.target.value }))}
                    style={{ colorScheme: 'dark' }}
                  />
                </div>
                <div className="field-group field-group--full">
                  <label htmlFor="customerEditAddress">Endereço</label>
                  <input
                    id="customerEditAddress"
                    value={form.address ?? ''}
                    onChange={(event) => setForm((current) => ({ ...current, address: event.target.value }))}
                    placeholder="Rua, número, bairro"
                  />
                </div>
                <div className="field-group">
                  <label htmlFor="customerEditCreditLimit">Limite de Crédito (R$)</label>
                  <input
                    id="customerEditCreditLimit"
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.creditLimit ?? ''}
                    onChange={(event) => setForm((current) => ({ ...current, creditLimit: event.target.value ? Number(event.target.value) : undefined }))}
                    placeholder="Sem limite"
                  />
                </div>
                <div className="field-group field-group--full">
                  <label htmlFor="customerEditObservations">Observações Internas</label>
                  <textarea
                    id="customerEditObservations"
                    value={form.observations ?? ''}
                    onChange={(event) => setForm((current) => ({ ...current, observations: event.target.value }))}
                    placeholder="Preferências, acordos de negociação..."
                    rows={3}
                    style={{ background: 'var(--surface-dark)', color: '#fff', border: '1px solid rgba(226,232,240,0.12)', borderRadius: '12px', padding: '12px', width: '100%', resize: 'vertical' }}
                  />
                </div>
              </div>

              {errorMessage ? <div className="feedback-message feedback-message--error">{errorMessage}</div> : null}

              <div className="customer-premium-actions">
                <button className="customer-premium-primary-button" type="submit" disabled={isSaving}>
                  <Save size={16} aria-hidden="true" />
                  {isSaving ? 'Salvando...' : 'Salvar alterações'}
                </button>
                <button className="customer-premium-secondary-button" type="button" onClick={closeEditModal} disabled={isSaving}>
                  Cancelar
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}
    </main>
  )
}



