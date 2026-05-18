import { useCallback, useEffect, useMemo, useState } from 'react'
import { Cake, CalendarDays, Gift, HeartHandshake, MessageCircle, Phone, Sparkles } from 'lucide-react'
import { Metric } from '../components/Metric'
import { PageHeader } from '../components/PageHeader'
import { PaginationControls } from '../components/PaginationControls'
import { getCustomerBirthdays } from '../services/customerService'
import type { Customer } from '../types/customer'
import { getErrorMessage } from '../utils/errors'
import { usePagination } from '../hooks/usePagination'
import { maskPhone } from '../utils/masks'

type BirthdayCustomer = Customer & {
  nextBirthday: Date
  daysUntilBirthday: number
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
  if (days === 1) return 'Amanha'
  return `${days} dia(s)`
}

export function LoyaltyPage() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const loadCustomers = useCallback(async () => {
    setIsLoading(true)
    try {
      setCustomers(await getCustomerBirthdays())
      setErrorMessage(null)
    } catch (error) {
      setErrorMessage(getErrorMessage(error, 'Nao foi possivel carregar aniversariantes.'))
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
  const nextSevenDaysCount = birthdayCustomers.filter((customer) => customer.daysUntilBirthday <= 7).length
  const birthdayPagination = usePagination(birthdayCustomers, 8)

  return (
    <main className="app-shell">
      <div className="app-container">
        <PageHeader
          eyebrow="Fidelidade"
          title="Aniversariantes de clientes"
          subtitle="Acompanhe datas especiais para relacionamento, ofertas e atendimento personalizado."
          metricLabel="Proximos 7 dias"
          metricValue={String(nextSevenDaysCount)}
          status={`${birthdayCustomers.length} cliente(s) com aniversario`}
        />

        <div className="metric-grid metric-grid--3">
          <Metric label="Hoje" value={String(todayCount)} tone="gold" icon={Cake} />
          <Metric label="Proximos 7 dias" value={String(nextSevenDaysCount)} icon={Gift} />
          <Metric label="Com data cadastrada" value={String(birthdayCustomers.length)} icon={CalendarDays} />
        </div>

        {errorMessage ? <div className="feedback-message feedback-message--error">{errorMessage}</div> : null}

        <section className="product-list-panel relationship-client-panel">
          <header className="section-header relationship-client-header">
            <div className="relationship-client-title">
              <span className="relationship-client-icon" aria-hidden="true">
                <HeartHandshake size={22} strokeWidth={2.4} />
              </span>
              <div>
                <h2>Calendario de relacionamento</h2>
                <p>Clientes ordenados pelo proximo aniversario.</p>
              </div>
            </div>
            <div className="relationship-client-actions" aria-label="Resumo do relacionamento">
              <span>
                <Sparkles size={14} strokeWidth={2.4} aria-hidden="true" />
                {todayCount} hoje
              </span>
              <span>
                <Gift size={14} strokeWidth={2.4} aria-hidden="true" />
                {nextSevenDaysCount} proximos
              </span>
            </div>
          </header>

          {isLoading ? (
            <div className="product-empty">Carregando aniversariantes...</div>
          ) : birthdayCustomers.length === 0 ? (
            <div className="product-empty">Nenhum aniversario cadastrado.</div>
          ) : (
            <div className="product-list">
              {birthdayPagination.pageItems.map((customer) => (
                <article
                  className={
                    customer.daysUntilBirthday <= 7
                      ? 'product-card relationship-customer-card relationship-customer-card--hot'
                      : 'product-card relationship-customer-card'
                  }
                  key={customer.id}
                >
                  <div className="product-card-header">
                    <div>
                      <h3>{customer.name}</h3>
                      <span className="product-card-code">{formatBirthDate(customer.birthDate as string)}</span>
                    </div>
                    <span className={customer.daysUntilBirthday <= 7 ? 'status-badge status-badge--warning' : 'status-badge'}>
                      {birthdayStatus(customer.daysUntilBirthday)}
                    </span>
                  </div>
                  <div className="product-card-grid">
                    <div>
                      <span>Telefone</span>
                      <strong>
                        {customer.phone ? (
                          <>
                            <Phone size={14} strokeWidth={2.3} aria-hidden="true" />
                            {maskPhone(customer.phone)}
                          </>
                        ) : (
                          '-'
                        )}
                      </strong>
                    </div>
                    <div>
                      <span>Email</span>
                      <strong>{customer.email || '-'}</strong>
                    </div>
                    <div>
                      <span>Contato</span>
                      <strong>
                        {customer.phone ? (
                          <>
                            <MessageCircle size={14} strokeWidth={2.3} aria-hidden="true" />
                            WhatsApp
                          </>
                        ) : (
                          '-'
                        )}
                      </strong>
                    </div>
                  </div>
                </article>
              ))}
              <PaginationControls
                itemLabel="clientes"
                page={birthdayPagination.page}
                pageSize={birthdayPagination.pageSize}
                totalItems={birthdayPagination.totalItems}
                totalPages={birthdayPagination.totalPages}
                onPageChange={birthdayPagination.setPage}
              />
            </div>
          )}
        </section>
      </div>
    </main>
  )
}
