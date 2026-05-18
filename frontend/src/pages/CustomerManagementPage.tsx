import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { UserRound, UsersRound } from 'lucide-react'
import { Metric } from '../components/Metric'
import { PageHeader } from '../components/PageHeader'
import { createCustomer, getCustomerPage, updateCustomer } from '../services/customerService'
import type { Customer, CustomerPayload } from '../types/customer'
import { getErrorMessage } from '../utils/errors'
import { useAppMessage } from '../hooks/useAppMessage'
import { PaginationControls } from '../components/PaginationControls'
import { maskCpf, maskPhone } from '../utils/masks'

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

export function CustomerManagementPage() {
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

  const activeCustomers = useMemo(() => customers.filter((customer) => customer.active).length, [customers])

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
      setErrorMessage(getErrorMessage(error, 'Nao foi possivel carregar clientes.'))
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
    window.scrollTo({ top: 0, behavior: 'smooth' })
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
        message: 'Cadastro salvo com sucesso.',
      })
      resetForm()
      await loadCustomers(appliedSearch, customerPage)
    } catch (error) {
      const message = getErrorMessage(error, 'Nao foi possivel salvar cliente.')
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
    <main className="app-shell">
      <div className="app-container">
        <PageHeader
          eyebrow="Clientes"
          title="Cadastro de clientes"
          subtitle="Mantenha os dados usados nas vendas a prazo e na impressao das notas promissorias."
          metricLabel="Ativos"
          metricValue={String(activeCustomers)}
          status={`${customerTotal} cliente(s) encontrados`}
        />

        <div className="metric-grid metric-grid--3">
          <Metric label="Clientes ativos" value={String(activeCustomers)} tone="gold" icon={UsersRound} />
          <Metric label="Com CPF" value={String(customers.filter((customer) => customer.cpf).length)} icon={UserRound} />
          <Metric label="Com telefone" value={String(customers.filter((customer) => customer.phone).length)} />
        </div>

        <div className="content-grid">
          <section className="product-form-panel customer-form-panel">
            <header className="section-header">
              <div>
                <h2>{editingCustomerId === null ? 'Novo cliente' : 'Editar cliente'}</h2>
                <p>Operadores podem cadastrar clientes durante a venda ou por esta tela.</p>
              </div>
            </header>

            <form className="product-form" onSubmit={handleSubmit}>
              <div className="form-grid">
                <div className="field-group field-group--full">
                  <label htmlFor="customerName">Nome</label>
                  <input
                    id="customerName"
                    value={form.name ?? ''}
                    onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                    placeholder="Nome completo"
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
                  <label htmlFor="customerPhone">Telefone</label>
                  <input
                    id="customerPhone"
                    value={form.phone ?? ''}
                    onChange={(event) => setForm((current) => ({ ...current, phone: maskPhone(event.target.value) }))}
                    inputMode="numeric"
                    placeholder="11 9999-9999"
                  />
                </div>
                <div className="field-group">
                  <label htmlFor="customerEmail">Email</label>
                  <input
                    id="customerEmail"
                    value={form.email ?? ''}
                    onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                    placeholder="Opcional"
                  />
                </div>
                <div className="field-group">
                  <label htmlFor="customerActive">Status</label>
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
                  <label htmlFor="customerBirthDate">Aniversario</label>
                  <input
                    id="customerBirthDate"
                    type="date"
                    value={form.birthDate ?? ''}
                    onChange={(event) => setForm((current) => ({ ...current, birthDate: event.target.value }))}
                  />
                </div>
                <div className="field-group field-group--full">
                  <label htmlFor="customerAddress">Endereco</label>
                  <input
                    id="customerAddress"
                    value={form.address ?? ''}
                    onChange={(event) => setForm((current) => ({ ...current, address: event.target.value }))}
                    placeholder="Rua, numero, bairro"
                  />
                </div>
              </div>

              {errorMessage ? <div className="feedback-message feedback-message--error">{errorMessage}</div> : null}

              <div className="form-actions">
                <button className="action-button" type="submit" disabled={isSaving}>
                  {isSaving ? 'Salvando...' : 'Salvar cliente'}
                </button>
                <button className="secondary-button" type="button" onClick={resetForm} disabled={isSaving}>
                  Limpar
                </button>
              </div>
            </form>
          </section>

          <section className="product-list-panel customer-list-panel">
            <header className="section-header">
              <div>
                <h2>Clientes</h2>
                <p>Busca rapida por nome para vincular vendas a prazo.</p>
              </div>
            </header>

            <form className="history-filter-form" onSubmit={handleSearchSubmit}>
              <div className="field-group">
                <label htmlFor="customerListSearch">Buscar</label>
                <input
                  id="customerListSearch"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Nome do cliente"
                />
              </div>
              <button className="secondary-button" type="submit" disabled={isLoading}>Buscar</button>
            </form>

            {isLoading ? (
              <div className="product-empty">Carregando clientes...</div>
            ) : customers.length === 0 ? (
              <div className="product-empty">Nenhum cliente encontrado.</div>
            ) : (
              <div className="product-list customer-card-list">
                {customers.map((customer) => (
                  <article className="product-card customer-card" key={customer.id}>
                    <div className="product-card-header">
                      <div>
                        <h3>{customer.name}</h3>
                        <span className="product-card-code">{customer.cpf ? maskCpf(customer.cpf) : 'Sem CPF'}</span>
                      </div>
                      <span className={`status-badge ${customer.active ? 'status-badge--up' : 'status-badge--down'}`}>
                        {customer.active ? 'Ativo' : 'Inativo'}
                      </span>
                    </div>
                    <div className="customer-card-contact">
                      <span>Telefone</span>
                      <strong>{customer.phone ? maskPhone(customer.phone) : 'Nao informado'}</strong>
                    </div>
                    <div className="product-card-actions">
                      <button className="secondary-button" type="button" onClick={() => handleEdit(customer)}>
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
          </section>
        </div>
      </div>
    </main>
  )
}
