import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { Edit3, FileText, Phone, RotateCcw, Save, Search, UserCheck, UserPlus, X, Gift, Mail, MapPin, DollarSign, TrendingUp, AlertTriangle, Receipt, CreditCard, Sparkles } from 'lucide-react'
import { createCustomer, getCustomerPage, getCustomerProfile, getCustomers, updateCustomer } from '../services/customerService'
import type { Customer, CustomerPayload, CustomerProfile } from '../types/customer'
import { getErrorMessage } from '../utils/errors'
import { useAppMessage } from '../hooks/useAppMessage'
import { PaginationControls } from '../components/PaginationControls'
import { maskCpf, maskPhone } from '../utils/masks'
import { formatCurrency, formatNullableDateTime } from '../utils/formatters'

const initialForm: CustomerPayload = {
  name: '',
  cpf: '',
  phone: '',
  email: '',
  address: '',
  birthDate: '',
  active: true,
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
  }
}

type CustomerManagementMode = 'create' | 'list' | 'profile'

type CustomerManagementPageProps = {
  mode?: CustomerManagementMode
}

export function CustomerManagementPage({ mode = 'list' }: CustomerManagementPageProps) {
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
  const [selectedProfileCustomerId, setSelectedProfileCustomerId] = useState('')
  const [customerProfile, setCustomerProfile] = useState<CustomerProfile | null>(null)
  const [isProfileLoading, setIsProfileLoading] = useState(false)

  const activeCustomers = useMemo(() => customers.filter((customer) => customer.active).length, [customers])
  const showForm = mode === 'create'
  const showList = mode === 'list'
  const showProfile = mode === 'profile'

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

  return (
    <main className="app-shell customer-premium-shell">
      <div className="app-container customer-premium-container">
        {!showProfile ? (
          <>
            <div className="customer-premium-hero">
              <section className="customer-premium-banner">
                <div className="customer-premium-badges">
                  <span>★ CLIENTES</span>
                  <strong>{customerTotal} cliente(s) encontrados</strong>
                </div>
                <h1>{showForm ? 'Cadastrar cliente' : 'Clientes cadastrados'}</h1>
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

        <div className={showProfile ? 'content-grid' : 'customer-premium-content'}>
          {showForm ? (
            <section className="customer-premium-form-panel" style={{ background: 'linear-gradient(135deg, rgba(215, 173, 85, 0.18), rgba(16, 17, 23, 0.98))', borderColor: 'rgba(215, 173, 85, 0.45)' }}>
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
            <section className="customer-premium-list-panel">
              <header>
                <div>
                  <h2>Clientes</h2>
                  <p>Busca rápida por nome ou CPF para vincular vendas a prazo.</p>
                </div>
              </header>

              <form className="customer-premium-search" onSubmit={handleSearchSubmit}>
                <div className="field-group">
                  <label htmlFor="customerListSearch">Buscar</label>
                  <div className="customer-premium-search-input">
                    <Search size={16} aria-hidden="true" />
                    <input
                      id="customerListSearch"
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Nome do cliente ou CPF..."
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
                      >
                        <X size={15} aria-hidden="true" />
                      </button>
                    ) : null}
                  </div>
                </div>
                <button className="customer-premium-secondary-button" type="submit" disabled={isLoading}>Buscar</button>
              </form>

              {isLoading ? (
                <div className="product-empty">Carregando clientes...</div>
              ) : customers.length === 0 ? (
                <div className="product-empty">Nenhum cliente encontrado.</div>
              ) : (
                <div className="customer-premium-card-grid">
                  {customers.map((customer) => (
                    <article className="customer-premium-card" key={customer.id}>
                      <div className="customer-premium-card-header">
                        <div>
                          <h3>{customer.name}</h3>
                          <span>{customer.cpf ? maskCpf(customer.cpf) : 'Sem CPF'}</span>
                        </div>
                        <strong className={customer.active ? 'customer-premium-status customer-premium-status--active' : 'customer-premium-status'}>
                          {customer.active ? 'Ativo' : 'Inativo'}
                        </strong>
                      </div>
                      <div className="customer-premium-contact-box">
                        <div>
                          <span>Telefone</span>
                          <strong>{customer.phone ? maskPhone(customer.phone) : 'Não informado'}</strong>
                        </div>
                        <div>
                          <span>Email</span>
                          <strong>{customer.email || 'Não informado'}</strong>
                        </div>
                      </div>
                      <div className="customer-premium-card-actions">
                        <button type="button" onClick={() => handleEdit(customer)}>
                          <Edit3 size={14} aria-hidden="true" />
                          Editar
                        </button>
                      </div>
                    </article>
                  ))}
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

              <footer className="customer-premium-list-footer">
                <span>Exibindo {customers.length} de {customerTotal} registros cadastrados</span>
                <strong>Sincronizado com o Atelier</strong>
              </footer>
            </section>
          ) : null}

          {showProfile ? (
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

              <div className="history-filter-form customer-profile-search" style={{ gap: '16px', background: '#0d1016', padding: '18px', borderRadius: '14px', border: '1px solid rgba(226,232,240,0.08)', margin: '20px 0' }}>
                <div className="field-group" style={{ flex: 1 }}>
                  <label htmlFor="customerProfileSearch" style={{ color: '#f6d78b', fontWeight: 900, fontSize: '0.62rem', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Filtrar Lista</label>
                  <input
                    id="customerProfileSearch"
                    value={profileSearch}
                    onChange={(event) => setProfileSearch(event.target.value)}
                    placeholder="Filtrar por nome do cliente..."
                    style={{ background: '#0d1016', color: '#fff', border: '1px solid rgba(226,232,240,0.12)', borderRadius: '12px', minHeight: '48px', padding: '0 16px' }}
                  />
                </div>
                <div className="field-group" style={{ flex: 1 }}>
                  <label htmlFor="customerProfileSelect" style={{ color: '#f6d78b', fontWeight: 900, fontSize: '0.62rem', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Selecione o Cliente</label>
                  <select
                    id="customerProfileSelect"
                    value={selectedProfileCustomerId}
                    onChange={(event) => {
                      setSelectedProfileCustomerId(event.target.value)
                      if (!event.target.value) {
                        setCustomerProfile(null)
                      }
                    }}
                    style={{ background: '#0d1016', color: '#fff', border: '1px solid rgba(226,232,240,0.12)', borderRadius: '12px', minHeight: '48px', padding: '0 16px', width: '100%' }}
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
                <div className="product-empty" style={{ background: '#0d1016', borderRadius: '16px', padding: '40px' }}>Selecione um cliente para visualizar o perfil completo.</div>
              ) : (
                <div className="cart-list" style={{ display: 'grid', gap: '22px' }}>
                  <article className="cart-item" style={{ background: '#101117', border: '1px solid rgba(226,232,240,0.08)', borderRadius: '16px', padding: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div className="cart-item-main">
                      <span style={{ display: 'inline-block', background: '#151922', padding: '4px 8px', borderRadius: '6px', fontSize: '0.7rem', color: '#b9c4d4', fontFamily: 'monospace', marginBottom: '8px' }}>
                        {customerProfile.customer.cpf ? maskCpf(customerProfile.customer.cpf) : 'Sem CPF'}
                      </span>
                      <h3 style={{ margin: '0 0 6px', fontSize: '1.25rem', color: '#fff', fontWeight: 500 }}>{customerProfile.customer.name}</h3>
                      <small style={{ color: '#aeb8c8', display: 'block', fontSize: '0.85rem' }}>
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
                        <strong style={{ display: 'block', fontSize: '1.5rem', color: '#f6d78b', marginTop: '4px' }}>{formatCurrency(customerProfile.totalPurchasedAmount)}</strong>
                      </div>
                    </div>
                  </article>

                  <div className="promissory-mini-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
                    <div className="promissory-mini-card" style={{ background: '#101117', border: '1px solid rgba(226,232,240,0.08)', borderRadius: '16px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <span style={{ fontSize: '0.65rem', textTransform: 'uppercase', color: '#aeb8c8', fontWeight: 900 }}>Valor em Aberto</span>
                      <strong style={{ fontSize: '1.5rem', color: '#f2cf7a' }}>{formatCurrency(customerProfile.openPromissoryAmount)}</strong>
                      <small style={{ fontSize: '0.75rem', color: '#707b8c' }}>{customerProfile.openPromissoryCount} nota(s) em aberto</small>
                    </div>
                    <div className="promissory-mini-card" style={{ background: '#101117', border: '1px solid rgba(251,113,133,0.2)', borderRadius: '16px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <span style={{ fontSize: '0.65rem', textTransform: 'uppercase', color: '#fecdd3', fontWeight: 900 }}>Valor Vencido</span>
                      <strong style={{ fontSize: '1.5rem', color: '#fb7185' }}>{formatCurrency(customerProfile.overduePromissoryAmount)}</strong>
                      <small style={{ fontSize: '0.75rem', color: '#fb7185' }}>{customerProfile.overduePromissoryCount} nota(s) atrasada(s)</small>
                    </div>
                    <div className="promissory-mini-card" style={{ background: '#101117', border: '1px solid rgba(45,212,191,0.2)', borderRadius: '16px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <span style={{ fontSize: '0.65rem', textTransform: 'uppercase', color: '#8ff2e7', fontWeight: 900 }}>Total Pago</span>
                      <strong style={{ fontSize: '1.5rem', color: '#2dd4bf' }}>{formatCurrency(customerProfile.paidPromissoryAmount)}</strong>
                      <small style={{ fontSize: '0.75rem', color: '#707b8c' }}>Liquidado com sucesso</small>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '22px' }}>
                    <section className="promissory-detail-section" style={{ background: '#101117', border: '1px solid rgba(226,232,240,0.08)', borderRadius: '16px', padding: '24px' }}>
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
                            <div className="promissory-history-item" key={item.productId} style={{ background: '#0d1016', border: '1px solid rgba(226,232,240,0.06)', borderRadius: '12px', padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <div>
                                <strong style={{ color: '#fff', fontSize: '0.9rem', display: 'block' }}>{item.productName}</strong>
                                <small style={{ color: '#707b8c', fontSize: '0.75rem' }}>Código: {item.productCode} — {item.quantity} un.</small>
                              </div>
                              <div style={{ textAlign: 'right' }}>
                                <span style={{ fontSize: '0.65rem', textTransform: 'uppercase', color: '#707b8c', display: 'block' }}>Total</span>
                                <strong style={{ color: '#f6d78b', fontSize: '0.95rem' }}>{formatCurrency(item.totalAmount)}</strong>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </section>

                    <section className="promissory-detail-section" style={{ background: '#101117', border: '1px solid rgba(226,232,240,0.08)', borderRadius: '16px', padding: '24px' }}>
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
                            <div className="promissory-history-item" key={sale.id} style={{ background: '#0d1016', border: '1px solid rgba(226,232,240,0.06)', borderRadius: '12px', padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <div>
                                <strong style={{ color: '#fff', fontSize: '0.9rem', display: 'block' }}>Venda #{sale.id}</strong>
                                <small style={{ color: '#707b8c', fontSize: '0.75rem' }}>Realizada em: {formatNullableDateTime(sale.soldAt)} — Método: {sale.paymentMethod}</small>
                              </div>
                              <strong style={{ color: '#f6d78b', fontSize: '0.95rem' }}>{formatCurrency(sale.totalAmount)}</strong>
                            </div>
                          ))}
                        </div>
                      )}
                    </section>

                    <section className="promissory-detail-section" style={{ background: '#101117', border: '1px solid rgba(226,232,240,0.08)', borderRadius: '16px', padding: '24px' }}>
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
                            <div className="promissory-history-item" key={note.id} style={{ background: '#0d1016', border: '1px solid rgba(226,232,240,0.06)', borderRadius: '12px', padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
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
          ) : null}
        </div>
      </div>

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
