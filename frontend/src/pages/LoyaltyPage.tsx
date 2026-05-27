import { useCallback, useEffect, useMemo, useState } from 'react'
import { Cake, CalendarDays, Gift, Sparkles, X, MessageSquare, Copy, UserCheck, Phone, Mail, Search } from 'lucide-react'
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
  return `${days} dia(s)`
}

type LoyaltyPageProps = {
  onViewChange?: (view: any) => void
}

export function LoyaltyPage({ onViewChange }: LoyaltyPageProps) {
  const { notify } = useAppMessage()
  const [customers, setCustomers] = useState<Customer[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  
  // Controle de Filtros e Modal
  const [aniversariosFiltro, setAniversariosFiltro] = useState<'todos' | 'hoje' | 'proximos'>('todos')
  const [congratulateClient, setCongratulateClient] = useState<BirthdayCustomer | null>(null)
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
  const nextSevenDaysCount = birthdayCustomers.filter((customer) => customer.daysUntilBirthday <= 7).length

  // Filtragem dos clientes baseada no botão selecionado
  const filteredCustomers = useMemo(() => {
    return birthdayCustomers.filter((customer) => {
      if (aniversariosFiltro === 'hoje') return customer.daysUntilBirthday === 0
      if (aniversariosFiltro === 'proximos') return customer.daysUntilBirthday >= 0 && customer.daysUntilBirthday <= 7
      return true
    })
  }, [birthdayCustomers, aniversariosFiltro])

  const birthdayPagination = usePagination(filteredCustomers, 6)

  // Mensagens Customizadas de Felicitações para WhatsApp/Clipboard
  const getCongratulatoryMessage = () => {
    if (!congratulateClient) return '';
    const nomePrimeiro = congratulateClient.name.split(' ')[0];
    const capitalNome = nomePrimeiro.charAt(0).toUpperCase() + nomePrimeiro.slice(1);
    
    if (selectedTemplate === 'classico') {
      return `Olá, ${capitalNome}! Nós do Atelier IWR desejamos a você um dia extraordinário e um feliz aniversário! É uma honra tê-lo como nosso cliente. Que este novo ciclo traga muito sucesso e sofisticação para sua vida.`;
    }
    if (selectedTemplate === 'promocional') {
      return `Prezado ${capitalNome}, celebramos o seu dia especial! Para tornar seu aniversário ainda mais marcante, o Atelier IWR preparou um presente exclusivo: 10% de desconto em qualquer peça sob medida durante esta semana. Aguardamos sua visita para um brinde!`;
    }
    return `Feliz aniversário, ${capitalNome}! Que o seu dia seja repleto de sorrisos, elegância e ótimas companhias. Um abraço especial de toda a equipe IWR Atelier PDV!`;
  };

  useEffect(() => {
    if (congratulateClient) {
      setCustomMessage(getCongratulatoryMessage())
    }
  }, [congratulateClient, selectedTemplate])

  const handleCopyMessage = () => {
    const text = customMessage;
    navigator.clipboard.writeText(text)
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
  };

  const handleSendWhatsApp = () => {
    if (!congratulateClient || !congratulateClient.phone) return;
    const text = encodeURIComponent(customMessage);
    const cleanPhone = congratulateClient.phone.replace(/\D/g, '');
    window.open(`https://api.whatsapp.com/send?phone=55${cleanPhone}&text=${text}`, '_blank');
    notify({
      type: 'info',
      title: 'WhatsApp Aberto',
      message: 'Redirecionando para o chat do cliente...',
    })
    setCongratulateClient(null);
  };

  return (
    <main className="app-shell customer-premium-shell">
      <style>{`
        .customer-premium-card {
          background: rgba(255, 250, 235, 0.72) !important;
          border: 1px solid rgba(91, 58, 10, 0.16) !important;
          border-radius: 16px !important;
          padding: 18px !important;
          box-shadow: 0 12px 28px rgba(91, 58, 10, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.72) !important;
          transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1), border-color 0.25s ease !important;
          color: #211609 !important;
        }
        .customer-premium-card:hover {
          transform: translateY(-3px) scale(1.01);
          border-color: rgba(33, 22, 9, 0.34) !important;
          box-shadow: 0 12px 28px rgba(91, 58, 10, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.72) !important;
        }
        .customer-premium-card--today {
          background: linear-gradient(135deg, #f9e7b5 0%, #e2c074 100%) !important;
          border: 2px solid #5b3a0a !important;
          box-shadow: 0 16px 36px rgba(91, 58, 10, 0.22), inset 0 1px 0 rgba(255, 255, 255, 0.8) !important;
        }
        .customer-premium-list-panel {
          background: radial-gradient(circle at 90% 0%, rgba(255, 255, 255, 0.46), transparent 32%), linear-gradient(135deg, #f8dc91 0%, #d8ad53 50%, #b97e24 100%) !important;
          color: #211609 !important;
          border: 1px solid rgba(91, 58, 10, 0.22) !important;
          border-radius: 18px !important;
          padding: 22px !important;
          box-shadow: 0 26px 64px rgba(91, 58, 10, 0.26), inset 0 1px 0 rgba(255, 255, 255, 0.58) !important;
        }
        .customer-premium-felicitar-btn:hover {
          transform: scale(1.02);
          box-shadow: 0 4px 12px rgba(215, 173, 85, 0.3) !important;
        }
      `}</style>
      <div className="app-container customer-premium-container">
        
        {/* Banner do Topo */}
        <div className="customer-premium-hero">
          <section className="customer-premium-banner">
            <div className="customer-premium-badges">
              <span>★ FIDELIDADE</span>
              <strong>{birthdayCustomers.length} data(s) cadastrada(s)</strong>
            </div>
            <h1>Aniversariantes de clientes</h1>
            <p>Acompanhe datas especiais para relacionamento, ofertas e atendimento personalizado do Atelier.</p>
          </section>

          <section className="customer-premium-target-card">
            <div>
              <span>Próximos 7 Dias</span>
              <small>Fidelidade</small>
            </div>
            <strong>{nextSevenDaysCount}</strong>
            <div className="customer-premium-progress">
              <span style={{ width: `${Math.min((nextSevenDaysCount / (birthdayCustomers.length || 1)) * 100, 100)}%` }} />
            </div>
          </section>
        </div>

        {/* Métricas Interativas (Grid 3 Colunas) */}
        <div className="customer-premium-metrics">
          <article 
            onClick={() => setAniversariosFiltro('hoje')}
            style={{ 
              cursor: 'pointer',
              borderColor: aniversariosFiltro === 'hoje' ? 'rgba(215, 173, 85, 0.65)' : 'rgba(226, 232, 240, 0.1)',
              background: aniversariosFiltro === 'hoje' ? 'rgba(215, 173, 85, 0.08)' : undefined
            }}
          >
            <div>
              <span>Hoje</span>
              <strong>{todayCount}</strong>
            </div>
            <Gift size={19} aria-hidden="true" />
          </article>

          <article 
            onClick={() => setAniversariosFiltro('proximos')}
            style={{ 
              cursor: 'pointer',
              borderColor: aniversariosFiltro === 'proximos' ? 'rgba(215, 173, 85, 0.65)' : 'rgba(226, 232, 240, 0.1)',
              background: aniversariosFiltro === 'proximos' ? 'rgba(215, 173, 85, 0.08)' : undefined
            }}
          >
            <div>
              <span>Próximos 7 dias</span>
              <strong>{nextSevenDaysCount}</strong>
            </div>
            <CalendarDays size={19} aria-hidden="true" />
          </article>

          <article 
            onClick={() => setAniversariosFiltro('todos')}
            style={{ 
              cursor: 'pointer',
              borderColor: aniversariosFiltro === 'todos' ? 'rgba(215, 173, 85, 0.65)' : 'rgba(226, 232, 240, 0.1)',
              background: aniversariosFiltro === 'todos' ? 'rgba(215, 173, 85, 0.08)' : undefined
            }}
          >
            <div>
              <span>Com data cadastrada</span>
              <strong>{birthdayCustomers.length}</strong>
            </div>
            <UserCheck size={19} aria-hidden="true" />
          </article>
        </div>

        {errorMessage ? <div className="feedback-message feedback-message--error">{errorMessage}</div> : null}

        {/* Painel da Listagem */}
        <section className="customer-premium-list-panel">
          <header className="section-header" style={{ borderBottom: '1px solid rgba(33, 22, 9, 0.12)', paddingBottom: '20px', display: 'flex', justifyContent: 'space-between', gap: '20px', flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <span aria-hidden="true" style={{ background: 'rgba(91, 58, 10, 0.12)', padding: '10px', borderRadius: '12px', color: '#5b3a0a', display: 'inline-flex' }}>
                <Gift size={22} strokeWidth={2.4} />
              </span>
              <div>
                <h2 style={{ margin: 0, fontSize: '1.25rem', color: '#16120A' }}>Calendário de Relacionamento</h2>
                <p style={{ margin: '4px 0 0', fontSize: '0.82rem', color: '#4B3A16' }}>Clientes ordenados pelo próximo aniversário de acordo com a seleção.</p>
              </div>
            </div>
          </header>

          {isLoading ? (
            <div className="product-empty">Carregando aniversariantes...</div>
          ) : filteredCustomers.length === 0 ? (
            <div className="product-empty" style={{ background: 'var(--surface-elevated)', color: 'var(--text-secondary)', borderRadius: '16px', padding: '40px', border: '1px solid var(--border-gold)' }}>Nenhum aniversariante cadastrado neste período.</div>
          ) : (
            <div className="customer-premium-card-grid" style={{ marginTop: '20px' }}>
              {birthdayPagination.pageItems.map((customer) => {
                const isToday = customer.daysUntilBirthday === 0;
                const isNextWeek = customer.daysUntilBirthday > 0 && customer.daysUntilBirthday <= 7;
                return (
                  <article 
                    className={isToday ? "customer-premium-card customer-premium-card--today" : "customer-premium-card"}
                    key={customer.id}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      minHeight: '260px'
                    }}
                  >
                    <div>
                      <div className="customer-premium-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
                        <div>
                          <h3 style={{ margin: '0 0 4px', fontSize: '1.1rem', color: '#16120A', fontWeight: 600 }}>{customer.name}</h3>
                          <span className="product-card-code" style={{ fontSize: '0.72rem', display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#5b3a0a', fontFamily: 'monospace' }}>
                            <Cake size={12} />
                            {formatBirthDate(customer.birthDate as string)}
                          </span>
                        </div>
                        <strong className={isToday || isNextWeek ? 'customer-premium-status customer-premium-status--active' : 'customer-premium-status'} style={{ display: 'inline-block', padding: '2px 8px', borderRadius: '4px', fontSize: '0.62rem', fontWeight: 'bold', textTransform: 'uppercase' }}>
                          {birthdayStatus(customer.daysUntilBirthday)}
                        </strong>
                      </div>
                      
                      <div className="customer-premium-contact-box" style={{ background: 'rgba(33, 22, 9, 0.05)', padding: '12px', borderRadius: '10px', display: 'grid', gap: '8px', marginBottom: '14px', border: '1px solid rgba(33, 22, 9, 0.08)' }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Phone size={13} style={{ color: '#5b3a0a' }} />
                            <span style={{ color: '#4B3A16', fontSize: '0.64rem', fontWeight: 900, textTransform: 'uppercase' }}>Tel</span>
                          </div>
                          <strong>{customer.phone ? maskPhone(customer.phone) : 'Não informado'}</strong>
                        </div>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Mail size={13} style={{ color: '#5b3a0a' }} />
                            <span style={{ color: '#4B3A16', fontSize: '0.64rem', fontWeight: 900, textTransform: 'uppercase' }}>E-mail</span>
                          </div>
                          <strong style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '180px' }}>{customer.email || 'Não informado'}</strong>
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '8px', marginTop: 'auto' }}>
                      <button
                        type="button"
                        className="customer-premium-secondary-button"
                        onClick={() => {
                          setCongratulateClient(customer)
                          setSelectedTemplate('classico')
                        }}
                        style={{
                          flex: 1.2,
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
                        <Sparkles size={13} />
                        Felicitar
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          localStorage.setItem('selected_profile_customer_id', String(customer.id));
                          if (onViewChange) {
                            onViewChange('customer-profile');
                          }
                        }}
                        className="customer-premium-primary-button"
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
                        <Search size={13} />
                        Ficha
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}

          {!isLoading && filteredCustomers.length > 0 && (
            <>
              <PaginationControls
                itemLabel="clientes"
                page={birthdayPagination.page}
                pageSize={birthdayPagination.pageSize}
                totalItems={birthdayPagination.totalItems}
                totalPages={birthdayPagination.totalPages}
                onPageChange={birthdayPagination.setPage}
              />
              
              <footer className="customer-premium-list-footer" style={{ marginTop: '20px' }}>
                <span>Exibindo {birthdayPagination.pageItems.length} de {filteredCustomers.length} registros</span>
                <strong>Fidelidade Atelier IWR</strong>
              </footer>
            </>
          )}
        </section>
      </div>

      {/* Modal Interativo de Felicitações */}
      {congratulateClient !== null && (
        <div className="customer-premium-modal-backdrop" role="presentation">
          <section className="customer-premium-edit-modal" role="dialog" aria-modal="true" aria-labelledby="congratulateTitle" style={{ maxWidth: '600px' }}>
            <header>
              <div>
                <h2 id="congratulateTitle">Enviar Felicitações</h2>
                <p>Envie uma mensagem sofisticada para <strong>{congratulateClient.name}</strong>.</p>
              </div>
              <button type="button" onClick={() => setCongratulateClient(null)} aria-label="Fechar modal">
                <X size={20} aria-hidden="true" />
              </button>
            </header>

            <div style={{ padding: '24px', display: 'grid', gap: '20px' }}>
              <div className="field-group">
                <label style={{ color: '#5b3a0a', fontWeight: 900, fontSize: '0.62rem', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '8px', display: 'block' }}>
                  Escolha o Modelo de Mensagem
                </label>
                <div style={{ display: 'flex', gap: '10px' }}>
                  {(['classico', 'promocional', 'divertido'] as SelectedTemplate[]).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setSelectedTemplate(t)}
                      style={{
                        flex: 1,
                        padding: '12px',
                        borderRadius: '10px',
                        fontSize: '0.75rem',
                        fontWeight: 900,
                        textTransform: 'uppercase',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        border: selectedTemplate === t ? '1px solid #211609' : '1px solid rgba(33, 22, 9, 0.12)',
                        background: selectedTemplate === t ? 'rgba(33, 22, 9, 0.15)' : 'rgba(33, 22, 9, 0.05)',
                        color: selectedTemplate === t ? '#211609' : 'rgba(33, 22, 9, 0.65)'
                      }}
                    >
                      {t === 'classico' ? 'Clássico' : t === 'promocional' ? 'Promocional' : 'Elegante'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="field-group">
                <label style={{ color: '#5b3a0a', fontWeight: 900, fontSize: '0.62rem', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '8px', display: 'block' }}>
                  Visualização da Mensagem
                </label>
                <textarea
                  value={customMessage}
                  onChange={(e) => setCustomMessage(e.target.value)}
                  style={{
                    width: '100%',
                    minHeight: '120px',
                    background: 'rgba(0, 0, 0, 0.55)',
                    color: 'var(--text-secondary)',
                    border: '1px solid var(--border-gold)',
                    borderRadius: '12px',
                    padding: '16px',
                    fontSize: '0.85rem',
                    lineHeight: '1.6',
                    resize: 'none',
                    outline: 'none'
                  }}
                />
              </div>

              <div className="customer-premium-actions" style={{ display: 'flex', gap: '12px' }}>
                <button 
                  type="button" 
                  className="customer-premium-primary-button" 
                  onClick={handleCopyMessage}
                  style={{ flex: 1 }}
                >
                  <Copy size={16} aria-hidden="true" />
                  Copiar Texto
                </button>
                {congratulateClient.phone ? (
                  <button 
                    type="button" 
                    className="customer-premium-primary-button" 
                    onClick={handleSendWhatsApp}
                    style={{ flex: 1, background: 'linear-gradient(135deg, #25D366, #128C7E)', border: '1px solid rgba(37, 211, 102, 0.4)', color: '#fff' }}
                  >
                    <MessageSquare size={16} aria-hidden="true" />
                    Enviar WhatsApp
                  </button>
                ) : null}
                <button 
                  type="button" 
                  className="customer-premium-secondary-button" 
                  onClick={() => setCongratulateClient(null)}
                >
                  Cancelar
                </button>
              </div>
            </div>
          </section>
        </div>
      )}
    </main>
  )
}



