import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { BadgeDollarSign, CalendarClock, Package, Percent, ReceiptText, UserRound, Barcode, ScanLine, CheckCircle2, Printer } from 'lucide-react'
import { getCartItemTotal, useSalesCart } from '../hooks/useSalesCart'
import { createCustomer, getCustomers } from '../services/customerService'
import { getPromissoryNotesBySalePrintUrl } from '../services/promissoryNoteService'
import { getSaleReceiptUrl } from '../services/saleService'
import type { Customer } from '../types/customer'
import type { PromissoryInstallmentPayload } from '../types/promissoryNote'
import type { PaymentMethod, Sale } from '../types/sale'
import { formatCurrency } from '../utils/formatters'
import { CurrencyInput } from '../components/CurrencyInput'
import { PageHeader } from '../components/PageHeader'
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
        active: true,
      })
      setCustomers((current) => [customer, ...current.filter((item) => item.id !== customer.id)])
      setSelectedCustomerId(String(customer.id))
      setCustomerForm(initialCustomerForm)
      checkout.showMessage('Cliente cadastrado para esta venda.', 'success')
    } catch (error) {
      checkout.showMessage(error instanceof Error ? error.message : 'Nao foi possivel cadastrar o cliente.', 'error')
    } finally {
      setIsSavingCustomer(false)
    }
  }

  return (
    <main className="app-shell">
      <div className="app-container checkout-container">
        <PageHeader
          eyebrow="PDV"
          title="Caixa com leitura por codigo"
          subtitle="Leia o QR Code ou digite o codigo do produto para montar a venda, finalizar no backend e baixar estoque automaticamente."
          metricLabel="Total da venda"
          metricValue={formatCurrency(checkout.totalAmount)}
          status={checkout.cashRegister ? `Caixa #${checkout.cashRegister.id} aberto` : undefined}
        />

        <div className="quick-actions">
          <button className="quick-action quick-action--primary quick-action--new" type="button" onClick={clearCart}>
            Nova venda
          </button>
          <button
            className="quick-action quick-action--ghost quick-action--print"
            type="button"
            disabled={!checkout.lastSale}
            onClick={() => checkout.lastSale && setReceiptSale(checkout.lastSale)}
          >
            Imprimir ultima
          </button>
          <button
            className="quick-action quick-action--ghost quick-action--search"
            type="button"
            onClick={handleOpenFakeScanner}
            disabled={checkout.isSearching || fakeScanStatus !== 'idle'}
          >
            Buscar produto
          </button>
        </div>

        <section className="scanner-panel" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <header className="section-header" style={{ marginBottom: 0 }}>
            <div>
              <h2>Leitor de codigo</h2>
              <p>Simule a leitura de um codigo de barras clicando abaixo.</p>
            </div>
          </header>
          
          <button 
            type="button" 
            onClick={handleOpenFakeScanner}
            disabled={checkout.isSearching || fakeScanStatus !== 'idle'}
            style={{ 
              background: 'rgba(255,255,255,0.02)',
              border: '2px dashed var(--checkout-border)',
              borderRadius: '16px',
              height: '140px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '12px',
              cursor: 'pointer',
              color: 'var(--checkout-faint)',
              transition: 'all 0.2s ease'
            }}
            onMouseOver={(e) => { e.currentTarget.style.borderColor = 'var(--checkout-gold-soft)'; e.currentTarget.style.color = 'var(--checkout-text)' }}
            onMouseOut={(e) => { e.currentTarget.style.borderColor = 'var(--checkout-border)'; e.currentTarget.style.color = 'var(--checkout-faint)' }}
          >
            <Barcode size={64} strokeWidth={1} />
            <span style={{ fontSize: '0.875rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Clique para ler</span>
          </button>

          <button className="action-button" type="button" onClick={handleOpenFakeScanner} disabled={checkout.isSearching || fakeScanStatus !== 'idle'}>
            {checkout.isSearching ? 'Buscando...' : 'Adicionar'}
          </button>

          {checkout.message ? (
            <div
              className={`feedback-message scanner-feedback ${
                checkout.messageType === 'success' ? 'feedback-message--success' : 'feedback-message--error'
              }`}
            >
              {checkout.message}
            </div>
          ) : null}
        </section>

        <div className="sales-checkout-grid">
          <section className="scanner-panel sales-payment-panel">
            <header className="section-header">
              <div>
                <h2>Pagamento</h2>
                <p>Revise subtotal, desconto e forma de pagamento antes de finalizar.</p>
              </div>
            </header>
            <div className="form-grid">
              <div className="field-group">
                <label htmlFor="paymentMethod">Forma de pagamento</label>
                <select
                  id="paymentMethod"
                  value={checkout.paymentMethod}
                  onChange={(event) => checkout.setPaymentMethod(event.target.value as PaymentMethod)}
                >
                  <option value="CASH">Dinheiro</option>
                  <option value="PIX">Pix</option>
                  <option value="DEBIT_CARD">Cartao debito</option>
                  <option value="CREDIT_CARD">Cartao credito</option>
                  <option value="PROMISSORY_NOTE">Nota promissoria</option>
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
              ) : null}
              <div className="field-group">
                <label>Troco</label>
                <strong className="payment-total">{formatCurrency(checkout.changeAmount)}</strong>
              </div>
            </div>

            {checkout.paymentMethod === 'PROMISSORY_NOTE' ? (
              <section className="promissory-sale-box">
                <header className="section-header">
                  <div>
                    <h2>Nota promissoria</h2>
                    <p>Escolha o cliente e defina as datas de vencimento das parcelas.</p>
                  </div>
                </header>

                <div className="form-grid">
                  <div className="field-group field-group--full" style={{ position: 'relative' }}>
                    <label htmlFor="customerSearch">Buscar cliente</label>
                    <input
                      id="customerSearch"
                      value={customerSearch}
                      onChange={(event) => {
                        setCustomerSearch(event.target.value)
                        if (selectedCustomerId) {
                          setSelectedCustomerId('') // clear selection when typing
                        }
                      }}
                      onFocus={() => setIsCustomerDropdownOpen(true)}
                      onBlur={() => setTimeout(() => setIsCustomerDropdownOpen(false), 200)}
                      placeholder="Nome, CPF ou telefone"
                      autoComplete="off"
                    />
                    {isCustomerDropdownOpen && customers.length > 0 && customerSearch.trim().length > 0 && (
                      <ul className="customer-dropdown">
                        {customers.map((customer) => (
                          <li 
                            key={customer.id} 
                            className="customer-dropdown-item"
                            onClick={() => { 
                              setSelectedCustomerId(String(customer.id))
                              setCustomerSearch(customer.name)
                              setIsCustomerDropdownOpen(false)
                            }}
                          >
                            <div className="customer-dropdown-name">{customer.name}</div>
                            <div className="customer-dropdown-doc">
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
                  {selectedCustomer ? (
                    <div className="customer-inline-card field-group--full">
                      <span><UserRound size={14} strokeWidth={2.3} aria-hidden="true" />Cliente selecionado</span>
                      <strong>{selectedCustomer.name}</strong>
                      <small>
                        {[
                          selectedCustomer.cpf ? maskCpf(selectedCustomer.cpf) : '',
                          selectedCustomer.phone ? maskPhone(selectedCustomer.phone) : '',
                        ].filter(Boolean).join(' - ') || 'Sem documento informado'}
                      </small>
                    </div>
                  ) : null}
                </div>

                {!selectedCustomer ? (
                  <form className="customer-mini-form" onSubmit={handleCreateCustomer}>
                    <div className="form-grid">
                      <div className="field-group">
                        <label htmlFor="newCustomerName">Novo cliente</label>
                        <input
                          id="newCustomerName"
                          value={customerForm.name}
                          onChange={(event) => setCustomerForm((current) => ({ ...current, name: event.target.value }))}
                          placeholder="Nome completo"
                        />
                      </div>
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
                          placeholder="11 9999-9999"
                        />
                      </div>
                      <div className="field-group">
                        <label htmlFor="newCustomerEmail">Email</label>
                        <input
                          id="newCustomerEmail"
                          value={customerForm.email}
                          onChange={(event) => setCustomerForm((current) => ({ ...current, email: event.target.value }))}
                          placeholder="Opcional"
                        />
                      </div>
                      <div className="field-group field-group--full">
                        <label htmlFor="newCustomerAddress">Endereco</label>
                        <input
                          id="newCustomerAddress"
                          value={customerForm.address}
                          onChange={(event) => setCustomerForm((current) => ({ ...current, address: event.target.value }))}
                          placeholder="Rua, numero, bairro"
                        />
                      </div>
                    </div>
                    <button className="secondary-button" type="submit" disabled={isSavingCustomer}>
                      {isSavingCustomer ? 'Salvando...' : 'Cadastrar e selecionar cliente'}
                    </button>
                  </form>
                ) : null}

                <div className="installment-toolbar">
                  <div className="field-group">
                    <label htmlFor="installmentCount">Parcelas</label>
                    <select
                      id="installmentCount"
                      value={installmentCount}
                      onChange={(event) => setInstallmentCount(Number(event.target.value))}
                    >
                      {[1, 2, 3, 4, 5, 6, 8, 10, 12].map((count) => (
                        <option value={count} key={count}>{count}x</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <span>Total parcelado</span>
                    <strong>{formatCurrency(installments.reduce((sum, item) => sum + Number(item.amount), 0))}</strong>
                  </div>
                </div>

                <div className="installment-list">
                  {installments.map((installment, index) => (
                    <article className="installment-row" key={index}>
                      <span><CalendarClock size={14} strokeWidth={2.3} aria-hidden="true" />Parcela {index + 1}</span>
                      <div className="field-group">
                        <label htmlFor={`installmentDueDate-${index}`}>Vencimento</label>
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
                        />
                      </div>
                      <div className="field-group">
                        <label htmlFor={`installmentAmount-${index}`}>Valor</label>
                        <CurrencyInput
                          id={`installmentAmount-${index}`}
                          value={installment.amount}
                          onChange={(value) =>
                            setInstallments((current) =>
                              current.map((item, itemIndex) =>
                                itemIndex === index ? { ...item, amount: value } : item,
                              ),
                            )
                          }
                        />
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            ) : null}
          </section>

          <section className="cart-panel sales-summary-panel">
            <header className="section-header">
              <div>
                <h2>Resumo da venda</h2>
                <p>Conferencia rapida antes do fechamento.</p>
              </div>
              <button
                className="secondary-button"
                type="button"
                onClick={clearCart}
                disabled={checkout.cartItems.length === 0}
              >
                Limpar carrinho
              </button>
            </header>

            <div className="sales-summary-totals">
              <div>
                <span><Package size={14} strokeWidth={2.3} aria-hidden="true" />Itens</span>
                <strong>{checkout.totalItems}</strong>
              </div>
              <div>
                <span><Percent size={14} strokeWidth={2.3} aria-hidden="true" />Desconto</span>
                <strong>{formatCurrency(checkout.parsedDiscountAmount)}</strong>
              </div>
              <div>
                <span><BadgeDollarSign size={14} strokeWidth={2.3} aria-hidden="true" />Total</span>
                <strong>{formatCurrency(checkout.totalAmount)}</strong>
              </div>
            </div>

            {checkout.cartItems.length === 0 ? (
              <div className="product-empty">Nenhum item no carrinho. Leia uma etiqueta para comecar.</div>
            ) : (
              <div className="cart-list">
                {cartPagination.pageItems.map((item) => (
                  <article className="cart-item" key={item.product.id}>
                    <div className="cart-item-main">
                      <span>{item.product.code}</span>
                      <strong>{item.product.name}</strong>
                      <small>Estoque disponivel: {item.product.stockQuantity}</small>
                    </div>
                    <div className="cart-quantity">
                      <button
                        className="icon-button"
                        type="button"
                        onClick={() => checkout.updateQuantity(item.product.id, item.quantity - 1)}
                        aria-label={`Reduzir quantidade de ${item.product.name}`}
                      >
                        -
                      </button>
                      <input
                        aria-label={`Quantidade de ${item.product.name}`}
                        value={item.quantity}
                        inputMode="numeric"
                        onChange={(event) => checkout.updateQuantity(item.product.id, Number(event.target.value))}
                      />
                      <button
                        className="icon-button"
                        type="button"
                        onClick={() => checkout.updateQuantity(item.product.id, item.quantity + 1)}
                        aria-label={`Aumentar quantidade de ${item.product.name}`}
                      >
                        +
                      </button>
                    </div>
                    <div className="cart-price">
                      <span><ReceiptText size={14} strokeWidth={2.3} aria-hidden="true" />{formatCurrency(item.product.price)}</span>
                      <strong>{formatCurrency(getCartItemTotal(item))}</strong>
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

        <section className="checkout-footer-panel">
          <div>
            <span>
              Subtotal {formatCurrency(checkout.subtotalAmount)} - desconto{' '}
              {formatCurrency(checkout.parsedDiscountAmount)}
            </span>
            <strong>{formatCurrency(checkout.totalAmount)}</strong>
          </div>
          <button
            className="action-button"
            type="button"
            disabled={checkout.cartItems.length === 0 || checkout.isClosingSale || !checkout.cashRegister}
            onClick={() => void handleCloseSale()}
          >
            {checkout.isClosingSale ? 'Finalizando...' : 'Finalizar venda'}
          </button>
          {checkout.lastSale ? (
            <button className="icon-link" type="button" onClick={() => setReceiptSale(checkout.lastSale)}>
              Recibo #{checkout.lastSale.id}
            </button>
          ) : null}
        </section>
      </div>

      {receiptSale ? (
        <div
          className="qr-modal-backdrop"
          role="presentation"
          onClick={() => setReceiptSale(null)}
        >
          <section
            className="receipt-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="receipt-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="qr-modal-header">
              <div>
                <span className="eyebrow">Venda finalizada</span>
                <h2 id="receipt-modal-title">Recibo da venda #{receiptSale.id}</h2>
                <p>Total: {formatCurrency(receiptSale.totalAmount)}</p>
              </div>
              <button
                className="icon-button icon-button--close"
                type="button"
                onClick={() => setReceiptSale(null)}
                aria-label="Fechar recibo"
              >
                Fechar
              </button>
            </header>
            <iframe
              className="receipt-preview-frame"
              ref={receiptFrameRef}
              src={receiptSale.paymentMethod === 'PROMISSORY_NOTE' ? getPromissoryNotesBySalePrintUrl(receiptSale.id) : getSaleReceiptUrl(receiptSale.id)}
              title={`Recibo da venda ${receiptSale.id}`}
            />
            <div className="qr-modal-actions">
              <button
                className="secondary-button"
                type="button"
                onClick={() => receiptFrameRef.current?.contentWindow?.print()}
              >
                <Printer size={14} strokeWidth={2.3} aria-hidden="true" />
                {receiptSale.paymentMethod === 'PROMISSORY_NOTE' ? 'Imprimir promissorias' : 'Imprimir recibo'}
              </button>
              <a
                className="action-button action-button--link"
                href={receiptSale.paymentMethod === 'PROMISSORY_NOTE' ? getPromissoryNotesBySalePrintUrl(receiptSale.id) : getSaleReceiptUrl(receiptSale.id)}
                target="_blank"
                rel="noreferrer"
              >
                Abrir em nova aba
              </a>
              </div>
              </section>
              </div>
              ) : null}

      {isFakeScannerOpen ? (
        <div className="qr-modal-backdrop" role="presentation" style={{ zIndex: 100 }} onClick={() => setIsFakeScannerOpen(false)}>
          <section className="receipt-modal" style={{ width: '400px', padding: '32px', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '24px' }} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ fontSize: '1.5rem', color: 'var(--checkout-text)', margin: 0 }}>
              {fakeScanStatus === 'scanning' ? 'Lendo codigo...' : 'Codigo lido com sucesso!'}
            </h2>
            <div style={{ height: '140px', position: 'relative', background: 'rgba(0,0,0,0.2)', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
               {fakeScanStatus === 'scanning' ? (
                 <>
                   <Barcode size={80} strokeWidth={1} color="rgba(255,255,255,0.4)" />
                   <div style={{ 
                     position: 'absolute', 
                     top: 0, 
                     left: 0, 
                     right: 0, 
                     height: '4px', 
                     background: '#ef4444', 
                     boxShadow: '0 0 20px 4px rgba(239, 68, 68, 0.6)',
                     animation: 'scan-line 1s ease-in-out infinite alternate' 
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
                 <CheckCircle2 size={80} color="#34d399" />
               )}
            </div>
            {fakeScanStatus === 'success' ? (
               <p style={{ margin: 0, color: 'var(--checkout-success)' }}>Adicionando ao carrinho...</p>
            ) : (
               <p style={{ margin: 0, color: 'var(--checkout-muted)' }}>Posicione o codigo de barras no centro.</p>
            )}
            {fakeScanStatus === 'scanning' && (
               <button className="secondary-button" type="button" onClick={() => setIsFakeScannerOpen(false)}>
                 Cancelar
               </button>
            )}
          </section>
        </div>
      ) : null}
    </main>
  )
}
