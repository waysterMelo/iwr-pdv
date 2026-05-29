import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { BadgeDollarSign, CalendarClock, Package, UserRound, Barcode, CheckCircle2, Printer, ChevronDown, ChevronUp, Plus, Minus, X } from 'lucide-react'
import { getCartItemTotal, useSalesCart } from '../hooks/useSalesCart'
import { createCustomer, getCustomers } from '../services/customerService'
import { getPromissoryNotesBySalePrintUrl } from '../services/promissoryNoteService'
import { getSaleReceiptUrl } from '../services/saleService'
import type { Customer } from '../types/customer'
import type { PromissoryInstallmentPayload } from '../types/promissoryNote'
import type { PaymentMethod, Sale } from '../types/sale'
import { formatCurrency } from '../utils/formatters'
import { CurrencyInput } from '../components/CurrencyInput'
import { PaginationControls } from '../components/PaginationControls'
import { useAppMessage } from '../hooks/useAppMessage'
import { usePagination } from '../hooks/usePagination'
import { maskCpf, maskPhone } from '../utils/masks'

type CustomerFormState = {
  name: string
  cpf: string
  phone: string
  email: string
  address: string
  addressStreet: string
  addressNumber: string
  addressNeighborhood: string
  addressComplement: string
  addressCity: string
  addressState: string
  addressZipCode: string
}

type InstallmentDraft = {
  dueDate: string
  amount: string
}

const initialCustomerForm: CustomerFormState = {
  name: '',
  cpf: '',
  phone: '',
  email: '',
  address: '',
  addressStreet: '',
  addressNumber: '',
  addressNeighborhood: '',
  addressComplement: '',
  addressCity: '',
  addressState: '',
  addressZipCode: '',
}

function toDateInputValue(date: Date) {
  return date.toISOString().slice(0, 10)
}

function defaultDueDate(index: number) {
  const date = new Date()
  date.setDate(date.getDate() + 30 * (index + 1))
  return toDateInputValue(date)
}

function splitAmount(total: number, count: number) {
  const totalCents = Math.round(total * 100)
  const base = Math.floor(totalCents / count)
  const remainder = totalCents % count

  return Array.from({ length: count }, (_, index) => ((base + (index < remainder ? 1 : 0)) / 100).toFixed(2))
}

export function SalesCheckoutPage() {
  const { confirm } = useAppMessage()
  const [isFakeScannerOpen, setIsFakeScannerOpen] = useState(false)
  const [fakeScanStatus, setFakeScanStatus] = useState<'idle' | 'scanning' | 'success'>('idle')
  const [scanCode, setScanCode] = useState('')
  const [receiptSale, setReceiptSale] = useState<Sale | null>(null)
  const receiptFrameRef = useRef<HTMLIFrameElement>(null)
  const checkout = useSalesCart()
  const [customers, setCustomers] = useState<Customer[]>([])
  const [customerSearch, setCustomerSearch] = useState('')
  const [isCustomerDropdownOpen, setIsCustomerDropdownOpen] = useState(false)
  const [selectedCustomerId, setSelectedCustomerId] = useState('')
  const [customerForm, setCustomerForm] = useState<CustomerFormState>(initialCustomerForm)
  const [installmentCount, setInstallmentCount] = useState(1)
  const [installments, setInstallments] = useState<InstallmentDraft[]>([])
  const [isSavingCustomer, setIsSavingCustomer] = useState(false)
  
  // Controle do Accordion para novo cadastro rápido no checkout
  const [isCustomerFormOpen, setIsCustomerFormOpen] = useState(false)

  const selectedCustomer = useMemo(
    () => customers.find((customer) => String(customer.id) === selectedCustomerId) ?? null,
    [customers, selectedCustomerId],
  )
  const cartPagination = usePagination(checkout.cartItems, 6)

  useEffect(() => {
    const timeoutId = window.setTimeout(async () => {
      try {
        setCustomers(await getCustomers(customerSearch))
      } catch {
        setCustomers([])
      }
    }, 180)

    return () => window.clearTimeout(timeoutId)
  }, [customerSearch])

  useEffect(() => {
    if (checkout.paymentMethod !== 'PROMISSORY_NOTE') {
      return
    }

    const timeoutId = window.setTimeout(() => {
      const values = splitAmount(checkout.totalAmount, installmentCount)
      setInstallments((current) =>
        values.map((amount, index) => ({
          amount,
          dueDate: current[index]?.dueDate ?? defaultDueDate(index),
        })),
      )
    }, 0)

    return () => window.clearTimeout(timeoutId)
  }, [checkout.paymentMethod, checkout.totalAmount, installmentCount])

  function handleOpenFakeScanner() {
    setIsFakeScannerOpen(true)
    setFakeScanStatus('scanning')
    setScanCode('')
  }

  async function handleCodeScanned(code: string) {
    if (!code.trim()) return
    setFakeScanStatus('success')
    setTimeout(async () => {
      setIsFakeScannerOpen(false)
      setFakeScanStatus('idle')
      await checkout.addProductCodeToCart(code.trim().toUpperCase())
    }, 1500)
  }

  function clearCart() {
    checkout.clearCart()
  }

  async function handleCloseSale() {
    if (checkout.cartItems.length === 0) {
      checkout.showMessage('Adicione pelo menos um item antes de finalizar a venda.', 'error')
      return
    }

    const confirmed = await confirm({
      type: 'warning',
      title: 'Finalizar venda?',
      message: `Confirma o fechamento da venda no valor de ${formatCurrency(checkout.totalAmount)}?`,
      confirmLabel: 'Finalizar',
      cancelLabel: 'Revisar',
    })
    if (!confirmed) {
      return
    }

    const promissoryInstallments = toPromissoryInstallments()
    const sale = await checkout.finalizeSale(
      checkout.paymentMethod === 'PROMISSORY_NOTE'
        ? {
            customerId: selectedCustomer?.id,
            promissoryInstallments,
          }
        : {},
    )

    if (sale) {
      setReceiptSale(sale)
      setSelectedCustomerId('')
      setCustomerSearch('')
      setInstallmentCount(1)
      setInstallments([])
      setCustomerForm(initialCustomerForm)
      setIsCustomerFormOpen(false)
    }
  }

  function toPromissoryInstallments(): PromissoryInstallmentPayload[] {
    return installments.map((installment) => ({
      dueDate: installment.dueDate,
      amount: Number(installment.amount),
    }))
  }

  async function handleCreateCustomer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!customerForm.name.trim()) {
      checkout.showMessage('Informe o nome do cliente.', 'error')
      return
    }

    setIsSavingCustomer(true)

    try {
      const customer = await createCustomer({
        name: customerForm.name.trim(),
        cpf: customerForm.cpf.trim() || undefined,
        phone: customerForm.phone.trim() || undefined,
        email: customerForm.email.trim() || undefined,
        address: customerForm.address.trim() || undefined,
        addressStreet: customerForm.addressStreet.trim() || undefined,
        addressNumber: customerForm.addressNumber.trim() || undefined,
        addressNeighborhood: customerForm.addressNeighborhood.trim() || undefined,
        addressComplement: customerForm.addressComplement.trim() || undefined,
        addressCity: customerForm.addressCity.trim() || undefined,
        addressState: customerForm.addressState.trim().toUpperCase() || undefined,
        addressZipCode: customerForm.addressZipCode.trim() || undefined,
        active: true,
      })
      setCustomers((current) => [customer, ...current.filter((item) => item.id !== customer.id)])
      setSelectedCustomerId(String(customer.id))
      setCustomerForm(initialCustomerForm)
      setIsCustomerFormOpen(false)
      checkout.showMessage('Cliente cadastrado para esta venda.', 'success')
    } catch (error) {
      checkout.showMessage(error instanceof Error ? error.message : 'Não foi possível cadastrar o cliente.', 'error')
    } finally {
      setIsSavingCustomer(false)
    }
  }

  return (
    <main className="app-shell customer-premium-shell">
      <div className="app-container customer-premium-container">
        
        {/* Banner de Destaque */}
        <div className="customer-premium-hero">
          <section className="customer-premium-banner">
            <div className="customer-premium-badges">
              <span>★ OPERAÇÃO PDV</span>
              <strong>Atelier IWR</strong>
            </div>
            <h1>Venda por código</h1>
            <p>Digite ou leia a etiqueta do produto para montar a venda, finalizar no backend e baixar o estoque automaticamente.</p>
          </section>

          <section className="customer-premium-target-card">
            <div>
              <span>Subtotal</span>
              <small>Total da venda</small>
            </div>
            <strong style={{ color: 'var(--gold-strong)' }}>{formatCurrency(checkout.totalAmount)}</strong>
            <div className="customer-premium-progress">
              <span style={{ width: checkout.totalAmount > 0 ? '100%' : '0%' }} />
            </div>
          </section>
        </div>

        {/* Barra de Ações Rápidas */}
        <div className="quick-actions" style={{ display: 'flex', gap: '12px', background: 'var(--surface-elevated)', padding: '16px', borderRadius: '16px', border: '1px solid rgba(226,232,240,0.08)' }}>
          <button className="customer-premium-primary-button" type="button" onClick={clearCart} style={{ minHeight: '40px' }}>
            Nova venda
          </button>
          <button
            className="customer-premium-secondary-button"
            type="button"
            disabled={!checkout.lastSale}
            onClick={() => checkout.lastSale && setReceiptSale(checkout.lastSale)}
            style={{ minHeight: '40px' }}
          >
            Imprimir última
          </button>
          <button
            className="customer-premium-secondary-button"
            type="button"
            onClick={handleOpenFakeScanner}
            disabled={checkout.isSearching || fakeScanStatus !== 'idle'}
            style={{ minHeight: '40px' }}
          >
            Buscar produto
          </button>
        </div>

        {/* Grid de Checkout */}
        <div className="sales-checkout-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '22px', alignItems: 'start' }}>
          
          {/* LADO ESQUERDO: Leitor e Pagamento */}
          <div style={{ display: 'grid', gap: '22px' }}>
            
            {/* Seção do Leitor */}
            <section className="customer-premium-form-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(226,232,240,0.08)', paddingBottom: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Barcode size={22} style={{ color: 'var(--gold-strong)' }} />
                  <div>
                    <h2 style={{ fontSize: '1.1rem', color: '#fff', margin: 0, fontWeight: 500 }}>Leitor de código</h2>
                    <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Simule a leitura de um código de barras de luxo.</p>
                  </div>
                </div>
              </header>

              <button 
                type="button" 
                onClick={handleOpenFakeScanner}
                disabled={checkout.isSearching || fakeScanStatus !== 'idle'}
                style={{ 
                  background: 'var(--surface-dark)',
                  border: '2px dashed rgba(215, 173, 85, 0.35)',
                  borderRadius: '16px',
                  height: '140px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '12px',
                  cursor: 'pointer',
                  color: 'var(--text-muted)',
                  transition: 'all 0.2s ease',
                  position: 'relative',
                  overflow: 'hidden'
                }}
                onMouseOver={(e) => { e.currentTarget.style.borderColor = 'rgba(215,173,85,0.85)'; e.currentTarget.style.color = '#fff' }}
                onMouseOut={(e) => { e.currentTarget.style.borderColor = 'rgba(215,173,85,0.35)'; e.currentTarget.style.color = '#7b8493' }}
              >
                <Barcode size={50} style={{ color: 'var(--gold-strong)' }} />
                <span style={{ fontSize: '0.75rem', fontWeight: 900, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Toque para ler código</span>
                {/* Feixe a laser vermelho animado contínuo */}
                <div style={{ 
                  position: 'absolute', 
                  top: 0, 
                  left: 0, 
                  right: 0, 
                  height: '2px', 
                  background: '#ef4444', 
                  boxShadow: '0 0 10px 2px rgba(239, 68, 68, 0.8)',
                  animation: 'continuous-laser 2s linear infinite' 
                }} />
                <style>{`
                  @keyframes continuous-laser {
                    0% { transform: translateY(0); }
                    50% { transform: translateY(138px); }
                    100% { transform: translateY(0); }
                  }
                `}</style>
              </button>

              {checkout.message ? (
                <div
                  className={`feedback-message scanner-feedback ${
                    checkout.messageType === 'success' ? 'feedback-message--success' : 'feedback-message--error'
                  }`}
                  style={{ marginTop: '8px' }}
                >
                  {checkout.message}
                </div>
              ) : null}
            </section>

            {/* Seção de Pagamento */}
            <section className="customer-premium-form-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <header style={{ display: 'flex', alignItems: 'center', gap: '10px', borderBottom: '1px solid rgba(226,232,240,0.08)', paddingBottom: '14px' }}>
                <BadgeDollarSign size={22} style={{ color: 'var(--gold-strong)' }} />
                <div>
                  <h2 style={{ fontSize: '1.1rem', color: '#fff', margin: 0, fontWeight: 500 }}>Pagamento</h2>
                  <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Revise subtotal, desconto e forma de pagamento.</p>
                </div>
              </header>

              <div className="customer-premium-form" style={{ padding: 0, display: 'grid', gap: '18px' }}>
                <div className="customer-premium-form-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
                  <div className="field-group">
                    <label htmlFor="paymentMethod">Forma de pagamento</label>
                    <select
                      id="paymentMethod"
                      value={checkout.paymentMethod}
                      onChange={(event) => checkout.setPaymentMethod(event.target.value as PaymentMethod)}
                    >
                      <option value="CASH">Dinheiro</option>
                      <option value="PIX">Pix</option>
                      <option value="DEBIT_CARD">Cartão Débito</option>
                      <option value="CREDIT_CARD">Cartão Crédito</option>
                      <option value="PROMISSORY_NOTE">Nota Promissória</option>
                    </select>
                  </div>
                  <div className="field-group">
                    <label htmlFor="discountAmount">Desconto R$</label>
                    <CurrencyInput
                      id="discountAmount"
                      value={checkout.discountAmount}
                      onChange={(value) => checkout.setDiscountAmount(value)}
                    />
                  </div>
                </div>

                <div className="customer-premium-form-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
                  {checkout.paymentMethod === 'CASH' ? (
                    <div className="field-group">
                      <label htmlFor="amountReceived">Valor recebido</label>
                      <CurrencyInput
                        id="amountReceived"
                        value={checkout.amountReceived}
                        onChange={(value) => checkout.setAmountReceived(value)}
                        placeholder="R$ 0,00"
                      />
                    </div>
                  ) : <div />}
                  <div className="field-group" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    <label style={{ color: '#707b8c', fontSize: '0.62rem', fontWeight: 900, textTransform: 'uppercase' }}>Troco</label>
                    <strong style={{ fontSize: '1.55rem', color: '#2dd4bf', display: 'block', marginTop: '4px' }}>{formatCurrency(checkout.changeAmount)}</strong>
                  </div>
                </div>
              </div>

              {/* Acordeão de Nota Promissória */}
              {checkout.paymentMethod === 'PROMISSORY_NOTE' ? (
                <section style={{ background: 'var(--surface-dark)', border: '1px solid rgba(215, 173, 85, 0.2)', borderRadius: '14px', padding: '18px', display: 'grid', gap: '16px', marginTop: '10px' }}>
                  <header style={{ borderBottom: '1px solid rgba(226,232,240,0.06)', paddingBottom: '10px' }}>
                    <h3 style={{ margin: 0, fontSize: '0.9rem', color: 'var(--gold-strong)', fontWeight: 500 }}>Venda por Promissória</h3>
                    <p style={{ margin: '2px 0 0', fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Associe a venda a um cliente para gerar as parcelas.</p>
                  </header>

                  <div className="field-group" style={{ position: 'relative' }}>
                    <label htmlFor="customerSearch">Buscar Cliente</label>
                    <input
                      id="customerSearch"
                      value={customerSearch}
                      onChange={(event) => {
                        setCustomerSearch(event.target.value)
                        if (selectedCustomerId) {
                          setSelectedCustomerId('') 
                        }
                      }}
                      onFocus={() => setIsCustomerDropdownOpen(true)}
                      onBlur={() => setTimeout(() => setIsCustomerDropdownOpen(false), 200)}
                      placeholder="Nome, CPF ou telefone..."
                      autoComplete="off"
                    />
                    {isCustomerDropdownOpen && customers.length > 0 && customerSearch.trim().length > 0 && (
                      <ul className="customer-dropdown" style={{ background: 'var(--surface-elevated)', border: '1px solid rgba(226,232,240,0.12)', borderRadius: '12px', zIndex: 10 }}>
                        {customers.map((customer) => (
                          <li 
                            key={customer.id} 
                            className="customer-dropdown-item"
                            onClick={() => { 
                              setSelectedCustomerId(String(customer.id))
                              setCustomerSearch(customer.name)
                              setIsCustomerDropdownOpen(false)
                            }}
                            style={{ padding: '10px 14px', borderBottom: '1px solid rgba(226,232,240,0.04)', cursor: 'pointer' }}
                          >
                            <div className="customer-dropdown-name" style={{ color: '#fff', fontSize: '0.85rem', fontWeight: 'bold' }}>{customer.name}</div>
                            <div className="customer-dropdown-doc" style={{ color: 'var(--text-secondary)', fontSize: '0.7rem' }}>
                              {[
                                customer.cpf ? maskCpf(customer.cpf) : '',
                                customer.phone ? maskPhone(customer.phone) : ''
                              ].filter(Boolean).join(' - ') || 'Sem documento informado'}
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  {/* Card Premium de Cliente Selecionado */}
                  {selectedCustomer ? (
                    <div style={{ background: 'var(--surface-elevated)', border: '1px solid rgba(215,173,85,0.4)', borderRadius: '12px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <span style={{ fontSize: '0.62rem', fontWeight: 900, textTransform: 'uppercase', color: 'var(--gold-strong)', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                        <UserRound size={12} /> Cliente Selecionado
                      </span>
                      <strong style={{ color: '#fff', fontSize: '0.95rem' }}>{selectedCustomer.name}</strong>
                      <small style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>
                        {[
                          selectedCustomer.cpf ? maskCpf(selectedCustomer.cpf) : '',
                          selectedCustomer.phone ? maskPhone(selectedCustomer.phone) : '',
                        ].filter(Boolean).join(' — ') || 'Sem documento'}
                      </small>
                    </div>
                  ) : null}

                  {/* Accordion: Expandir formulário de cadastro rápido */}
                  {!selectedCustomer ? (
                    <div style={{ display: 'grid', gap: '8px' }}>
                      <button 
                        type="button"
                        onClick={() => setIsCustomerFormOpen(!isCustomerFormOpen)}
                        style={{
                          width: '100%',
                          minHeight: '38px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          background: 'rgba(255,255,255,0.02)',
                          border: '1px solid rgba(226,232,240,0.08)',
                          borderRadius: '10px',
                          padding: '0 14px',
                          cursor: 'pointer',
                          color: 'var(--gold-strong)',
                          fontSize: '0.75rem',
                          fontWeight: 'bold',
                          transition: 'all 0.2s'
                        }}
                      >
                        <span>Cadastrar Novo Cliente</span>
                        {isCustomerFormOpen ? <ChevronUp size={16} style={{ color: 'var(--gold-strong)' }} /> : <ChevronDown size={16} style={{ color: '#7e8794' }} />}
                      </button>

                      {isCustomerFormOpen && (
                        <form className="customer-premium-form" onSubmit={handleCreateCustomer} style={{ padding: '12px 0 0', display: 'grid', gap: '14px' }}>
                          <div className="customer-premium-form-grid" style={{ gridTemplateColumns: '1fr' }}>
                            <div className="field-group">
                              <label htmlFor="newCustomerName">Nome Completo</label>
                              <input
                                id="newCustomerName"
                                value={customerForm.name}
                                onChange={(event) => setCustomerForm((current) => ({ ...current, name: event.target.value }))}
                                placeholder="Nome completo"
                                required
                              />
                            </div>
                          </div>
                          <div className="customer-premium-form-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
                            <div className="field-group">
                              <label htmlFor="newCustomerCpf">CPF</label>
                              <input
                                id="newCustomerCpf"
                                value={customerForm.cpf}
                                onChange={(event) => setCustomerForm((current) => ({ ...current, cpf: maskCpf(event.target.value) }))}
                                inputMode="numeric"
                                placeholder="000.000.000-00"
                              />
                            </div>
                            <div className="field-group">
                              <label htmlFor="newCustomerPhone">Telefone</label>
                              <input
                                id="newCustomerPhone"
                                value={customerForm.phone}
                                onChange={(event) => setCustomerForm((current) => ({ ...current, phone: maskPhone(event.target.value) }))}
                                inputMode="numeric"
                                placeholder="11 99999-9999"
                              />
                            </div>
                          </div>
                          <div className="customer-premium-form-grid" style={{ gridTemplateColumns: '1fr' }}>
                            <div className="field-group">
                              <label htmlFor="newCustomerEmail">Email</label>
                              <input
                                id="newCustomerEmail"
                                value={customerForm.email}
                                onChange={(event) => setCustomerForm((current) => ({ ...current, email: event.target.value }))}
                                placeholder="Opcional"
                              />
                            </div>
                          </div>
                          <div className="customer-premium-form-grid" style={{ gridTemplateColumns: '1fr' }}>
                            <div className="field-group">
                              <label htmlFor="newCustomerAddress">Endereço Residencial</label>
                              <div className="structured-address-grid">
                                <input id="newCustomerAddressStreet" value={customerForm.addressStreet} onChange={(event) => setCustomerForm((current) => ({ ...current, addressStreet: event.target.value }))} placeholder="Rua / avenida" />
                                <input id="newCustomerAddressNumber" value={customerForm.addressNumber} onChange={(event) => setCustomerForm((current) => ({ ...current, addressNumber: event.target.value }))} placeholder="Numero" />
                                <input id="newCustomerAddressNeighborhood" value={customerForm.addressNeighborhood} onChange={(event) => setCustomerForm((current) => ({ ...current, addressNeighborhood: event.target.value }))} placeholder="Bairro" />
                                <input id="newCustomerAddressComplement" value={customerForm.addressComplement} onChange={(event) => setCustomerForm((current) => ({ ...current, addressComplement: event.target.value }))} placeholder="Complemento" />
                                <input id="newCustomerAddressCity" value={customerForm.addressCity} onChange={(event) => setCustomerForm((current) => ({ ...current, addressCity: event.target.value }))} placeholder="Cidade" />
                                <input id="newCustomerAddressState" value={customerForm.addressState} onChange={(event) => setCustomerForm((current) => ({ ...current, addressState: event.target.value.toUpperCase().slice(0, 2) }))} placeholder="UF" maxLength={2} />
                                <input id="newCustomerAddressZipCode" value={customerForm.addressZipCode} onChange={(event) => setCustomerForm((current) => ({ ...current, addressZipCode: event.target.value }))} placeholder="CEP" />
                              </div>
                              <input
                                id="newCustomerAddress"
                                value={customerForm.address}
                                onChange={(event) => setCustomerForm((current) => ({ ...current, address: event.target.value }))}
                                placeholder="Endereco completo opcional"
                              />
                            </div>
                          </div>
                          <button className="customer-premium-primary-button" type="submit" disabled={isSavingCustomer} style={{ minHeight: '40px' }}>
                            {isSavingCustomer ? 'Salvando...' : 'Salvar e selecionar cliente'}
                          </button>
                        </form>
                      )}
                    </div>
                  ) : null}

                  {/* Parcelas */}
                  <div style={{ borderTop: '1px solid rgba(226,232,240,0.06)', paddingTop: '14px', display: 'grid', gap: '14px' }}>
                    <div className="installment-toolbar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div className="field-group" style={{ margin: 0, width: '120px' }}>
                        <label htmlFor="installmentCount">Parcelas</label>
                        <select
                          id="installmentCount"
                          value={installmentCount}
                          onChange={(event) => setInstallmentCount(Number(event.target.value))}
                          style={{ minHeight: '38px', padding: '0 10px', borderRadius: '10px' }}
                        >
                          {[1, 2, 3, 4, 5, 6, 8, 10, 12].map((count) => (
                            <option value={count} key={count}>{count}x</option>
                          ))}
                        </select>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 900 }}>Total Parcelado</span>
                        <strong style={{ display: 'block', fontSize: '1.25rem', color: 'var(--gold-strong)', marginTop: '2px' }}>
                          {formatCurrency(installments.reduce((sum, item) => sum + Number(item.amount), 0))}
                        </strong>
                      </div>
                    </div>

                    <div className="installment-list" style={{ display: 'grid', gap: '10px', maxHeight: '180px', overflowY: 'auto', paddingRight: '4px' }}>
                      {installments.map((installment, index) => (
                        <article className="installment-row" key={index} style={{ background: 'var(--surface-elevated)', border: '1px solid rgba(226,232,240,0.05)', borderRadius: '10px', padding: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.72rem', color: '#fff', fontWeight: 'bold' }}>
                            <CalendarClock size={13} style={{ color: 'var(--gold-strong)' }} /> Parc. {index + 1}
                          </span>
                          <div className="field-group" style={{ margin: 0, width: '120px' }}>
                            <input
                              id={`installmentDueDate-${index}`}
                              type="date"
                              value={installment.dueDate}
                              onChange={(event) =>
                                setInstallments((current) =>
                                  current.map((item, itemIndex) =>
                                    itemIndex === index ? { ...item, dueDate: event.target.value } : item,
                                  ),
                                )
                              }
                              style={{ minHeight: '34px', fontSize: '0.75rem', padding: '0 8px', borderRadius: '8px', colorScheme: 'dark' }}
                            />
                          </div>
                           <div className="field-group" style={{ margin: 0, width: '100px' }}>
                             <CurrencyInput
                               id={`installmentAmount-${index}`}
                               value={installment.amount}
                               onChange={(value) =>
                                 setInstallments((current) => {
                                   if (index === 0 && current.length > 1) {
                                     const novoValorPrimeira = Number(value) || 0
                                     const totalVenda = checkout.totalAmount
                                     
                                     const valorPrimeiraValido = Math.min(novoValorPrimeira, totalVenda)
                                     const restante = Math.max(0, totalVenda - valorPrimeiraValido)
                                     const quantiaRestantes = current.length - 1
                                     
                                     const valoresRestantes = splitAmount(restante, quantiaRestantes)
                                     
                                     return current.map((item, itemIndex) => {
                                       if (itemIndex === 0) {
                                         return { ...item, amount: valorPrimeiraValido.toFixed(2) }
                                       } else {
                                         return { ...item, amount: valoresRestantes[itemIndex - 1] }
                                       }
                                     })
                                   }
                                   
                                   return current.map((item, itemIndex) =>
                                     itemIndex === index ? { ...item, amount: value } : item,
                                   )
                                 })
                               }
                               style={{ minHeight: '34px', fontSize: '0.75rem', padding: '0 8px', borderRadius: '8px' }}
                             />
                           </div>
                        </article>
                      ))}
                    </div>
                  </div>
                </section>
              ) : null}
            </section>
          </div>

          {/* LADO DIREITO: Resumo da Venda (Carrinho) */}
          <section className="customer-premium-form-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px', minHeight: '480px' }}>
            <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(226,232,240,0.08)', paddingBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Package size={22} style={{ color: 'var(--gold-strong)' }} />
                <div>
                  <h2 style={{ fontSize: '1.1rem', color: '#fff', margin: 0, fontWeight: 500 }}>Resumo da venda</h2>
                  <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Conferência rápida do carrinho de compras.</p>
                </div>
              </div>
              <button
                className="customer-premium-secondary-button"
                type="button"
                onClick={clearCart}
                disabled={checkout.cartItems.length === 0}
                style={{ minHeight: '32px', padding: '0 12px', fontSize: '0.62rem' }}
              >
                Limpar carrinho
              </button>
            </header>

            {/* Totais do Carrinho */}
            <div className="sales-summary-totals" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', background: 'var(--surface-dark)', padding: '14px', borderRadius: '12px', border: '1px solid rgba(226,232,240,0.06)' }}>
              <div>
                <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 900 }}>Itens</span>
                <strong style={{ display: 'block', fontSize: '1.25rem', color: '#fff', marginTop: '2px' }}>{checkout.totalItems}</strong>
              </div>
              <div>
                <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 900 }}>Desconto</span>
                <strong style={{ display: 'block', fontSize: '1.25rem', color: '#fff', marginTop: '2px' }}>{formatCurrency(checkout.parsedDiscountAmount)}</strong>
              </div>
              <div>
                <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 900 }}>Total Geral</span>
                <strong style={{ display: 'block', fontSize: '1.25rem', color: 'var(--gold-strong)', marginTop: '2px' }}>{formatCurrency(checkout.totalAmount)}</strong>
              </div>
            </div>

            {/* Lista do Carrinho Gold Soft */}
            {checkout.cartItems.length === 0 ? (
              <div className="product-empty" style={{ background: 'var(--surface-dark)', borderRadius: '16px', padding: '40px', textAlign: 'center', color: 'var(--text-muted)', marginTop: '10px' }}>
                Nenhum item no carrinho. Leia um código ou busque um produto para começar.
              </div>
            ) : (
              <div className="cart-list" style={{ display: 'grid', gap: '12px', marginTop: '10px' }}>
                {cartPagination.pageItems.map((item) => (
                  <article 
                    className="cart-item" 
                    key={item.product.id} 
                    style={{ 
                      background: 'var(--surface-dark)', 
                      border: '1px solid rgba(226,232,240,0.06)', 
                      borderRadius: '12px', 
                      padding: '14px', 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'space-between',
                      gap: '12px'
                    }}
                  >
                    <div className="cart-item-main" style={{ display: 'grid', gap: '2px', minWidth: 0, flex: 1 }}>
                      <span style={{ fontFamily: 'monospace', fontSize: '0.68rem', color: 'var(--gold-strong)', background: 'var(--surface-elevated)', padding: '2px 6px', borderRadius: '4px', width: 'fit-content' }}>
                        {item.product.code}
                      </span>
                      <strong style={{ color: '#fff', fontSize: '0.85rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.product.name}</strong>
                      <small style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>Estoque: {item.product.stockQuantity}</small>
                    </div>

                    {/* Controles de Quantidade circulares dourados */}
                    <div className="cart-quantity" style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--surface-elevated)', padding: '4px', borderRadius: '8px', border: '1px solid rgba(226,232,240,0.08)' }}>
                      <button
                        className="icon-button"
                        type="button"
                        onClick={() => checkout.updateQuantity(item.product.id, item.quantity - 1)}
                        style={{
                          width: '26px',
                          height: '26px',
                          borderRadius: '50%',
                          background: 'rgba(215, 173, 85, 0.1)',
                          border: '1px solid rgba(215, 173, 85, 0.3)',
                          color: 'var(--gold-strong)',
                          cursor: 'pointer',
                          display: 'grid',
                          placeItems: 'center',
                          fontSize: '0.85rem',
                          fontWeight: 'bold',
                          transition: 'all 0.15s'
                        }}
                        onMouseOver={(e) => { e.currentTarget.style.background = 'rgba(215,173,85,0.25)' }}
                        onMouseOut={(e) => { e.currentTarget.style.background = 'rgba(215, 173, 85, 0.1)' }}
                      >
                        <Minus size={11} strokeWidth={3} />
                      </button>
                      
                      <input
                        value={item.quantity}
                        inputMode="numeric"
                        onChange={(event) => checkout.updateQuantity(item.product.id, Number(event.target.value))}
                        style={{
                          width: '32px',
                          textAlign: 'center',
                          background: 'transparent',
                          border: 0,
                          color: '#fff',
                          fontSize: '0.85rem',
                          fontWeight: 'bold',
                          padding: 0
                        }}
                      />
                      
                      <button
                        className="icon-button"
                        type="button"
                        onClick={() => checkout.updateQuantity(item.product.id, item.quantity + 1)}
                        style={{
                          width: '26px',
                          height: '26px',
                          borderRadius: '50%',
                          background: 'rgba(215, 173, 85, 0.1)',
                          border: '1px solid rgba(215, 173, 85, 0.3)',
                          color: 'var(--gold-strong)',
                          cursor: 'pointer',
                          display: 'grid',
                          placeItems: 'center',
                          fontSize: '0.85rem',
                          fontWeight: 'bold',
                          transition: 'all 0.15s'
                        }}
                        onMouseOver={(e) => { e.currentTarget.style.background = 'rgba(215,173,85,0.25)' }}
                        onMouseOut={(e) => { e.currentTarget.style.background = 'rgba(215, 173, 85, 0.1)' }}
                      >
                        <Plus size={11} strokeWidth={3} />
                      </button>
                    </div>

                    <div className="cart-price" style={{ textAlign: 'right', minWidth: '70px' }}>
                      <span style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-muted)' }}>{formatCurrency(item.product.price)}</span>
                      <strong style={{ display: 'block', fontSize: '0.85rem', color: 'var(--gold-strong)', marginTop: '2px' }}>{formatCurrency(getCartItemTotal(item))}</strong>
                    </div>
                  </article>
                ))}
                <PaginationControls
                  itemLabel="itens"
                  page={cartPagination.page}
                  pageSize={cartPagination.pageSize}
                  totalItems={cartPagination.totalItems}
                  totalPages={cartPagination.totalPages}
                  onPageChange={cartPagination.setPage}
                />
              </div>
            )}
          </section>
        </div>

        {/* Rodapé Flutuante de Fechamento */}
        <section className="checkout-footer-panel" style={{ background: 'var(--surface-elevated)', border: '1px solid rgba(226,232,240,0.08)', borderRadius: '16px', padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '22px' }}>
          <div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block' }}>
              Subtotal: {formatCurrency(checkout.subtotalAmount)} — Desconto: {formatCurrency(checkout.parsedDiscountAmount)}
            </span>
            <strong style={{ fontSize: '1.65rem', color: 'var(--gold-strong)', marginTop: '4px', display: 'block' }}>
              {formatCurrency(checkout.totalAmount)}
            </strong>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            {checkout.lastSale ? (
              <button 
                type="button" 
                onClick={() => setReceiptSale(checkout.lastSale)}
                style={{
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid rgba(226,232,240,0.1)',
                  borderRadius: '10px',
                  padding: '8px 16px',
                  fontSize: '0.72rem',
                  fontWeight: 900,
                  textTransform: 'uppercase',
                  color: '#fff',
                  cursor: 'pointer'
                }}
              >
                Recibo #{checkout.lastSale.id}
              </button>
            ) : null}

            <button
              className="customer-premium-primary-button"
              type="button"
              disabled={checkout.cartItems.length === 0 || checkout.isClosingSale}
              onClick={() => void handleCloseSale()}
              style={{ minHeight: '44px', padding: '0 26px' }}
            >
              {checkout.isClosingSale ? 'Finalizando...' : 'Finalizar Venda'}
            </button>
          </div>
        </section>
      </div>

      {/* Modal Premium de Recibo */}
      {receiptSale ? (
        <div className="customer-premium-modal-backdrop" role="presentation" onClick={() => setReceiptSale(null)}>
          <section
            className="customer-premium-edit-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="receipt-modal-title"
            onClick={(event) => event.stopPropagation()}
            style={{ width: 'min(820px, 100%)' }}
          >
            <header>
              <div>
                <span style={{ fontSize: '0.62rem', fontWeight: 900, color: '#2dd4bf', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>★ Venda Finalizada</span>
                <h2 id="receipt-modal-title" style={{ fontSize: '1.25rem' }}>Recibo da venda #{receiptSale.id}</h2>
                <p>Total Geral: <strong style={{ color: 'var(--gold-strong)' }}>{formatCurrency(receiptSale.totalAmount)}</strong></p>
              </div>
              <button type="button" onClick={() => setReceiptSale(null)} aria-label="Fechar recibo" style={{ border: '1px solid rgba(226,232,240,0.1)', background: 'rgba(226,232,240,0.04)', borderRadius: '8px', padding: '8px', cursor: 'pointer' }}>
                <X size={18} aria-hidden="true" />
              </button>
            </header>
            
            <iframe
              className="receipt-preview-frame"
              ref={receiptFrameRef}
              src={receiptSale.paymentMethod === 'PROMISSORY_NOTE' ? getPromissoryNotesBySalePrintUrl(receiptSale.id) : getSaleReceiptUrl(receiptSale.id)}
              title={`Recibo da venda ${receiptSale.id}`}
              style={{ width: '100%', height: '480px', border: 0, background: '#fff' }}
            />
            
            <div className="qr-modal-actions" style={{ padding: '20px 24px', display: 'flex', justifyContent: 'flex-end', gap: '12px', borderTop: '1px solid rgba(226,232,240,0.08)' }}>
              <button
                className="customer-premium-secondary-button"
                type="button"
                onClick={() => receiptFrameRef.current?.contentWindow?.print()}
                style={{ minHeight: '38px', fontSize: '0.72rem' }}
              >
                <Printer size={14} style={{ marginRight: '6px' }} />
                {receiptSale.paymentMethod === 'PROMISSORY_NOTE' ? 'Imprimir promissórias' : 'Imprimir recibo'}
              </button>
              <a
                className="customer-premium-primary-button"
                href={receiptSale.paymentMethod === 'PROMISSORY_NOTE' ? getPromissoryNotesBySalePrintUrl(receiptSale.id) : getSaleReceiptUrl(receiptSale.id)}
                target="_blank"
                rel="noreferrer"
                style={{ minHeight: '38px', display: 'inline-flex', alignItems: 'center', textDecoration: 'none', color: 'var(--gold-strong)', fontSize: '0.72rem' }}
              >
                Abrir em nova aba
              </a>
            </div>
          </section>
        </div>
      ) : null}

      {/* Modal Simulador de Scanner QR/Código */}
      {isFakeScannerOpen ? (
        <div className="customer-premium-modal-backdrop" role="presentation" style={{ zIndex: 100 }} onClick={() => setIsFakeScannerOpen(false)}>
          <section className="customer-premium-edit-modal" style={{ width: '400px', padding: '32px', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '24px' }} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ fontSize: '1.25rem', color: '#fff', margin: 0, fontWeight: 500 }}>
              {fakeScanStatus === 'scanning' ? 'Lendo código...' : 'Código lido com sucesso!'}
            </h2>
            <div style={{ height: '140px', position: 'relative', background: 'var(--surface-dark)', border: '1px solid rgba(226,232,240,0.08)', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
               {fakeScanStatus === 'scanning' ? (
                 <>
                   <Barcode size={80} style={{ color: 'rgba(215,173,85,0.35)' }} />
                   {/* Feixe de laser animado vermelho simulado */}
                   <div style={{ 
                     position: 'absolute', 
                     top: 0, 
                     left: 0, 
                     right: 0, 
                     height: '3px', 
                     background: '#ef4444', 
                     boxShadow: '0 0 15px 3px rgba(239, 68, 68, 0.7)',
                     animation: 'scan-line 1.2s ease-in-out infinite alternate' 
                   }} />
                   <style>{`
                     @keyframes scan-line {
                       0% { transform: translateY(0); }
                       100% { transform: translateY(136px); }
                     }
                   `}</style>
                   <input
                     autoFocus
                     onBlur={(e) => e.target.focus()}
                     value={scanCode}
                     onChange={(e) => setScanCode(e.target.value)}
                     onKeyDown={(e) => {
                       if (e.key === 'Enter') {
                         e.preventDefault()
                         void handleCodeScanned(scanCode)
                       }
                     }}
                     style={{ position: 'absolute', opacity: 0, pointerEvents: 'none' }}
                     aria-hidden="true"
                   />
                 </>
               ) : (
                 <CheckCircle2 size={80} style={{ color: '#2dd4bf' }} />
               )}
            </div>
            {fakeScanStatus === 'success' ? (
               <p style={{ margin: 0, color: '#2dd4bf', fontSize: '0.85rem' }}>Adicionando item ao carrinho...</p>
            ) : (
               <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Simule a leitura inserindo o código do produto e apertando <strong>Enter</strong>.</p>
            )}
            {fakeScanStatus === 'scanning' && (
               <button className="customer-premium-secondary-button" type="button" onClick={() => setIsFakeScannerOpen(false)} style={{ minHeight: '38px', fontSize: '0.72rem' }}>
                 Cancelar
               </button>
            )}
          </section>
        </div>
      ) : null}
    </main>
  )
}




