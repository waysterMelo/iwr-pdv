import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  ArrowUpRight,
  Cake,
  CalendarDays,
  Clock,
  Copy,
  Gift,
  HeartHandshake,
  Mail,
  MessageSquare,
  Phone,
  Search,
  Sparkles,
  UserCheck,
} from 'lucide-react'
import { PaginationControls } from '../components/PaginationControls'
import { getCustomerBirthdays } from '../services/customerService'
import type { Customer } from '../types/customer'
import { getErrorMessage } from '../utils/errors'
import { usePagination } from '../hooks/usePagination'
import { maskPhone } from '../utils/masks'
import { useAppMessage } from '../hooks/useAppMessage'

type BirthdayCustomer = Customer & {
  nextBirthday: Date
  daysUntilBirthday: number
}

type SelectedTemplate = 'classico' | 'promocional' | 'divertido'
type BirthdayFilter = 'hoje' | 'proximos' | 'todos' | 'semTelefone'

type LoyaltyPageProps = {
  onViewChange?: (view: 'customer-profile', customerId?: number) => void
}

function toLocalBirthDate(value: string) {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, month - 1, day)
}

function startOfToday() {
  const today = new Date()
  return new Date(today.getFullYear(), today.getMonth(), today.getDate())
}

function getNextBirthday(value: string, today = startOfToday()) {
  const birthDate = toLocalBirthDate(value)
  const next = new Date(today.getFullYear(), birthDate.getMonth(), birthDate.getDate())

  if (next < today) {
    next.setFullYear(today.getFullYear() + 1)
  }

  return next
}

function getDaysUntilBirthday(value: string) {
  const today = startOfToday()
  const nextBirthday = getNextBirthday(value, today)
  const millisecondsPerDay = 24 * 60 * 60 * 1000
  return Math.round((nextBirthday.getTime() - today.getTime()) / millisecondsPerDay)
}

function formatBirthDate(value: string) {
  const date = toLocalBirthDate(value)
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'long' }).format(date)
}

function birthdayStatus(days: number) {
  if (days === 0) return 'Hoje'
  if (days === 1) return 'Amanhã'
  return `${days} dias`
}

function firstName(name: string) {
  const [first] = name.trim().split(/\s+/)
  return first ? first.charAt(0).toUpperCase() + first.slice(1).toLowerCase() : 'cliente'
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((piece) => piece[0]?.toUpperCase())
    .join('') || 'C'
}

export function LoyaltyPage({ onViewChange }: LoyaltyPageProps) {
  const { notify } = useAppMessage()
  const [customers, setCustomers] = useState<Customer[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [birthdayFilter, setBirthdayFilter] = useState<BirthdayFilter>('hoje')
  const [searchTerm, setSearchTerm] = useState('')
  const [messageCustomer, setMessageCustomer] = useState<BirthdayCustomer | null>(null)
  const [selectedTemplate, setSelectedTemplate] = useState<SelectedTemplate>('classico')
  const [customMessage, setCustomMessage] = useState('')

  const loadCustomers = useCallback(async () => {
    setIsLoading(true)
    try {
      setCustomers(await getCustomerBirthdays())
      setErrorMessage(null)
    } catch (error) {
      setErrorMessage(getErrorMessage(error, 'Não foi possível carregar aniversariantes.'))
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadCustomers()
    }, 0)

    return () => window.clearTimeout(timeoutId)
  }, [loadCustomers])

  const birthdayCustomers = useMemo<BirthdayCustomer[]>(() => {
    return customers
      .filter((customer) => customer.birthDate)
      .map((customer) => ({
        ...customer,
        nextBirthday: getNextBirthday(customer.birthDate as string),
        daysUntilBirthday: getDaysUntilBirthday(customer.birthDate as string),
      }))
      .sort((first, second) => first.daysUntilBirthday - second.daysUntilBirthday || first.name.localeCompare(second.name))
  }, [customers])

  const todayCount = birthdayCustomers.filter((customer) => customer.daysUntilBirthday === 0).length
  const nextSevenDaysCount = birthdayCustomers.filter((customer) => customer.daysUntilBirthday >= 0 && customer.daysUntilBirthday <= 7).length
  const missingPhoneCount = birthdayCustomers.filter((customer) => !customer.phone).length

  const filteredCustomers = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase()

    return birthdayCustomers.filter((customer) => {
      if (birthdayFilter === 'hoje' && customer.daysUntilBirthday !== 0) return false
      if (birthdayFilter === 'proximos' && (customer.daysUntilBirthday < 0 || customer.daysUntilBirthday > 7)) return false
      if (birthdayFilter === 'semTelefone' && customer.phone) return false

      if (!normalizedSearch) return true

      return [customer.name, customer.phone, customer.email]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalizedSearch))
    })
  }, [birthdayCustomers, birthdayFilter, searchTerm])

  const birthdayPagination = usePagination(filteredCustomers, 6)
  const activeMessageCustomer = messageCustomer ?? filteredCustomers[0] ?? birthdayCustomers[0] ?? null
  const contactProgress = birthdayCustomers.length === 0 ? 0 : Math.min((nextSevenDaysCount / birthdayCustomers.length) * 100, 100)

  const getCongratulatoryMessage = useCallback((customer: BirthdayCustomer | null, template: SelectedTemplate) => {
    if (!customer) return ''

    const name = firstName(customer.name)

    if (template === 'classico') {
      return `Olá, ${name}! Nós do Atelier IWR desejamos a você um feliz aniversário. Que este novo ciclo seja marcado por saúde, conquistas e bons momentos. É uma satisfação ter você como cliente.`
    }

    if (template === 'promocional') {
      return `Prezado(a) ${name}, celebramos o seu dia especial! Para tornar seu aniversário ainda mais marcante, o Atelier IWR preparou uma condição especial para você durante esta semana. Será um prazer receber sua visita.`
    }

    return `Feliz aniversário, ${name}! Que o seu dia seja leve, especial e cheio de boas surpresas. Um abraço de toda a equipe IWR Atelier PDV.`
  }, [])

  useEffect(() => {
    setCustomMessage(getCongratulatoryMessage(activeMessageCustomer, selectedTemplate))
  }, [activeMessageCustomer, selectedTemplate, getCongratulatoryMessage])

  function handleSelectMessageCustomer(customer: BirthdayCustomer) {
    setMessageCustomer(customer)
    setSelectedTemplate('classico')
  }

  function handleCopyMessage() {
    if (!customMessage) return

    navigator.clipboard.writeText(customMessage)
      .then(() => {
        notify({
          type: 'success',
          title: 'Mensagem copiada',
          message: 'Mensagem de felicitação copiada para a área de transferência.',
        })
      })
      .catch(() => {
        notify({
          type: 'error',
          title: 'Erro ao copiar',
          message: 'Não foi possível copiar a mensagem automaticamente.',
        })
      })
  }

  function handleSendWhatsApp() {
    if (!activeMessageCustomer?.phone || !customMessage) return

    const text = encodeURIComponent(customMessage)
    const cleanPhone = activeMessageCustomer.phone.replace(/\D/g, '')
    window.open(`https://api.whatsapp.com/send?phone=55${cleanPhone}&text=${text}`, '_blank')
    notify({
      type: 'info',
      title: 'WhatsApp aberto',
      message: 'Redirecionando para o chat do cliente.',
    })
  }

  return (
    <main className="app-shell loyalty-v2-shell">
      <section className="loyalty-v2-page">
        <div className="loyalty-v2-hero">
          <section className="loyalty-v2-banner">
            <div className="loyalty-v2-badges">
              <span>★ Fidelidade</span>
              <strong>Agenda de relacionamento</strong>
            </div>
            <h1>Aniversariantes</h1>
            <p>
              Acompanhe datas especiais, priorize contatos de hoje e envie mensagens personalizadas para fortalecer
              o relacionamento com clientes.
            </p>
          </section>

          <section className="loyalty-v2-target">
            <div>
              <span>Próximos 7 dias</span>
              <small>Clientes para contato ativo</small>
            </div>
            <strong>{nextSevenDaysCount}</strong>
            <div className="loyalty-v2-progress">
              <span style={{ width: `${contactProgress}%` }} />
            </div>
          </section>
        </div>

        <section className="loyalty-v2-metrics" aria-label="Indicadores de aniversariantes">
          <button type="button" className="loyalty-v2-metric loyalty-v2-metric--green" onClick={() => setBirthdayFilter('hoje')}>
            <div><span>Aniversários hoje</span><strong>{todayCount}</strong></div>
            <Gift size={19} aria-hidden="true" />
          </button>
          <button type="button" className="loyalty-v2-metric loyalty-v2-metric--gold" onClick={() => setBirthdayFilter('proximos')}>
            <div><span>Próximos 7 dias</span><strong>{nextSevenDaysCount}</strong></div>
            <Clock size={19} aria-hidden="true" />
          </button>
          <button type="button" className="loyalty-v2-metric loyalty-v2-metric--violet" onClick={() => setBirthdayFilter('todos')}>
            <div><span>Com data cadastrada</span><strong>{birthdayCustomers.length}</strong></div>
            <UserCheck size={19} aria-hidden="true" />
          </button>
          <button type="button" className="loyalty-v2-metric loyalty-v2-metric--red" onClick={() => setBirthdayFilter('semTelefone')}>
            <div><span>Sem telefone</span><strong>{missingPhoneCount}</strong></div>
            <AlertTriangle size={19} aria-hidden="true" />
          </button>
        </section>

        <section className="loyalty-v2-toolbar">
          <label className="loyalty-v2-search">
            <Search size={18} aria-hidden="true" />
            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Buscar cliente, telefone ou e-mail..."
            />
          </label>

          <div className="loyalty-v2-filters" aria-label="Filtros rápidos">
            <button type="button" className={birthdayFilter === 'hoje' ? 'loyalty-v2-chip loyalty-v2-chip--active' : 'loyalty-v2-chip'} onClick={() => setBirthdayFilter('hoje')}>Hoje</button>
            <button type="button" className={birthdayFilter === 'proximos' ? 'loyalty-v2-chip loyalty-v2-chip--active' : 'loyalty-v2-chip'} onClick={() => setBirthdayFilter('proximos')}>7 dias</button>
            <button type="button" className={birthdayFilter === 'todos' ? 'loyalty-v2-chip loyalty-v2-chip--active' : 'loyalty-v2-chip'} onClick={() => setBirthdayFilter('todos')}>Todos</button>
            <button type="button" className={birthdayFilter === 'semTelefone' ? 'loyalty-v2-chip loyalty-v2-chip--active' : 'loyalty-v2-chip'} onClick={() => setBirthdayFilter('semTelefone')}>Sem telefone</button>
          </div>
        </section>

        {errorMessage ? <div className="feedback-message feedback-message--error">{errorMessage}</div> : null}

        <section className="loyalty-v2-content-grid">
          <section className="loyalty-v2-panel">
            <header className="loyalty-v2-section-head">
              <div className="loyalty-v2-section-title">
                <span className="loyalty-v2-section-icon"><Cake size={18} aria-hidden="true" /></span>
                <div>
                  <h2>Carteira de aniversariantes</h2>
                  <p>Clientes ordenados por urgência de contato.</p>
                </div>
              </div>
              <span className="loyalty-v2-export-chip">{filteredCustomers.length} registro(s)</span>
            </header>

            {isLoading ? (
              <div className="loyalty-v2-empty">Carregando aniversariantes...</div>
            ) : filteredCustomers.length === 0 ? (
              <div className="loyalty-v2-empty">Nenhum aniversariante encontrado para o filtro selecionado.</div>
            ) : (
              <div className="loyalty-v2-card-grid">
                {birthdayPagination.pageItems.map((customer) => {
                  const isToday = customer.daysUntilBirthday === 0
                  const isNextWeek = customer.daysUntilBirthday > 0 && customer.daysUntilBirthday <= 7

                  return (
                    <article className="loyalty-v2-card" key={customer.id}>
                      <div className="loyalty-v2-card-top">
                        <div className="loyalty-v2-person">
                          <div className="loyalty-v2-avatar">{initials(customer.name)}</div>
                          <div>
                            <strong>{customer.name}</strong>
                            <small>{formatBirthDate(customer.birthDate as string)} • {customer.phone ? maskPhone(customer.phone) : 'Sem telefone'}</small>
                          </div>
                        </div>
                        <span className={isToday ? 'loyalty-v2-status loyalty-v2-status--today' : isNextWeek ? 'loyalty-v2-status loyalty-v2-status--soon' : 'loyalty-v2-status'}>
                          {birthdayStatus(customer.daysUntilBirthday)}
                        </span>
                      </div>

                      <div className="loyalty-v2-contact">
                        <span><Phone size={14} aria-hidden="true" /> {customer.phone ? maskPhone(customer.phone) : 'Telefone não informado'}</span>
                        <span><Mail size={14} aria-hidden="true" /> {customer.email || 'E-mail não informado'}</span>
                        <span><HeartHandshake size={14} aria-hidden="true" /> Oportunidade de relacionamento e fidelização.</span>
                      </div>

                      <div className="loyalty-v2-card-actions">
                        <button type="button" className="loyalty-v2-btn loyalty-v2-btn--gold" onClick={() => handleSelectMessageCustomer(customer)}>
                          <Sparkles size={14} aria-hidden="true" /> Mensagem
                        </button>
                        <button
                          type="button"
                          className="loyalty-v2-btn"
                          onClick={() => {
                            if (onViewChange) onViewChange('customer-profile', customer.id)
                          }}
                        >
                          <ArrowUpRight size={14} aria-hidden="true" /> Perfil
                        </button>
                      </div>
                    </article>
                  )
                })}
              </div>
            )}

            {!isLoading && filteredCustomers.length > 0 ? (
              <div className="loyalty-v2-pagination">
                <PaginationControls
                  itemLabel="clientes"
                  page={birthdayPagination.page}
                  pageSize={birthdayPagination.pageSize}
                  totalItems={birthdayPagination.totalItems}
                  totalPages={birthdayPagination.totalPages}
                  onPageChange={birthdayPagination.setPage}
                />
              </div>
            ) : null}
          </section>

          <aside className="loyalty-v2-message-panel">
            <header className="loyalty-v2-section-head">
              <div className="loyalty-v2-section-title">
                <span className="loyalty-v2-section-icon"><MessageSquare size={18} aria-hidden="true" /></span>
                <div>
                  <h2>Mensagem rápida</h2>
                  <p>Modelo pronto para WhatsApp.</p>
                </div>
              </div>
            </header>

            <div className="loyalty-v2-selected-customer">
              <span>Cliente selecionado</span>
              <strong>{activeMessageCustomer?.name ?? 'Nenhum cliente disponível'}</strong>
              <small>{activeMessageCustomer?.birthDate ? formatBirthDate(activeMessageCustomer.birthDate) : 'Sem data selecionada'}</small>
            </div>

            <div className="loyalty-v2-template-tabs">
              {(['classico', 'promocional', 'divertido'] as SelectedTemplate[]).map((template) => (
                <button
                  key={template}
                  type="button"
                  className={selectedTemplate === template ? 'loyalty-v2-template-tab loyalty-v2-template-tab--active' : 'loyalty-v2-template-tab'}
                  onClick={() => setSelectedTemplate(template)}
                >
                  {template === 'classico' ? 'Clássico' : template === 'promocional' ? 'Promoção' : 'Leve'}
                </button>
              ))}
            </div>

            <textarea
              className="loyalty-v2-textarea"
              value={customMessage}
              onChange={(event) => setCustomMessage(event.target.value)}
              placeholder="Selecione um cliente para gerar uma mensagem."
            />

            <div className="loyalty-v2-message-actions">
              <button type="button" className="loyalty-v2-btn loyalty-v2-btn--gold" onClick={handleCopyMessage} disabled={!customMessage}>
                <Copy size={15} aria-hidden="true" /> Copiar
              </button>
              <button type="button" className="loyalty-v2-btn" onClick={handleSendWhatsApp} disabled={!activeMessageCustomer?.phone || !customMessage}>
                <MessageSquare size={15} aria-hidden="true" /> WhatsApp
              </button>
            </div>

            <div className="loyalty-v2-timeline">
              <div className="loyalty-v2-timeline-row"><span>Hoje</span><div><strong>{todayCount} contato(s) prioritário(s)</strong><small>Clientes com aniversário hoje</small></div><Gift size={16} /></div>
              <div className="loyalty-v2-timeline-row"><span>7 dias</span><div><strong>{nextSevenDaysCount} oportunidade(s)</strong><small>Campanha ativa de relacionamento</small></div><CalendarDays size={16} /></div>
              <div className="loyalty-v2-timeline-row"><span>Base</span><div><strong>{birthdayCustomers.length} registro(s)</strong><small>Clientes com data cadastrada</small></div><UserCheck size={16} /></div>
            </div>
          </aside>
        </section>
      </section>
    </main>
  )
}
