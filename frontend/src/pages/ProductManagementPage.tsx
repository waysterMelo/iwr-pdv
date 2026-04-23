import { useEffect, useState, type FormEvent } from 'react'
import { HealthStatusCard } from '../components/HealthStatusCard'
import { getHealthStatus, HttpRequestError } from '../services/healthService'
import {
  createProduct,
  getProducts,
  updateProduct,
  updateProductActivation,
} from '../services/productService'
import type { HealthStatus } from '../types/health'
import type { Product, ProductPayload } from '../types/product'

type ProductFormState = {
  name: string
  code: string
  price: string
  stockQuantity: string
  active: 'true' | 'false'
}

const initialFormState: ProductFormState = {
  name: '',
  code: '',
  price: '',
  stockQuantity: '',
  active: 'true',
}

const acceptanceItems = [
  'Gerar codigo no padrao IWR-000001 quando o campo ficar vazio.',
  'Manter unicidade do codigo do produto.',
  'Exibir QR Code do identificador do produto na tela.',
  'Buscar por nome ou codigo.',
  'Bloquear dados invalidos no backend e no frontend.',
]

function getErrorMessage(error: unknown) {
  if (error instanceof HttpRequestError) {
    return error.message
  }

  if (error instanceof Error) {
    return error.message
  }

  return 'Nao foi possivel concluir a operacao.'
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value))
}

function toPayload(form: ProductFormState): ProductPayload {
  return {
    name: form.name.trim(),
    code: form.code.trim().toUpperCase(),
    price: Number(form.price),
    stockQuantity: Number(form.stockQuantity),
    active: form.active === 'true',
  }
}

function toFormState(product: Product): ProductFormState {
  return {
    name: product.name,
    code: product.code,
    price: product.price.toFixed(2),
    stockQuantity: String(product.stockQuantity),
    active: String(product.active) as 'true' | 'false',
  }
}

function validateForm(form: ProductFormState) {
  if (!form.name.trim()) {
    return 'Informe o nome do produto.'
  }

  if (Number.isNaN(Number(form.price)) || Number(form.price) <= 0) {
    return 'Informe um preco maior que zero.'
  }

  if (!Number.isInteger(Number(form.stockQuantity)) || Number(form.stockQuantity) < 0) {
    return 'Informe um estoque valido.'
  }

  return null
}

export function ProductManagementPage() {
  const [health, setHealth] = useState<HealthStatus | null>(null)
  const [healthErrorMessage, setHealthErrorMessage] = useState<string | null>(null)
  const [isHealthLoading, setIsHealthLoading] = useState(true)
  const [products, setProducts] = useState<Product[]>([])
  const [search, setSearch] = useState('')
  const [searchDraft, setSearchDraft] = useState('')
  const [form, setForm] = useState<ProductFormState>(initialFormState)
  const [editingProductId, setEditingProductId] = useState<number | null>(null)
  const [formErrorMessage, setFormErrorMessage] = useState<string | null>(null)
  const [formSuccessMessage, setFormSuccessMessage] = useState<string | null>(null)
  const [listErrorMessage, setListErrorMessage] = useState<string | null>(null)
  const [isProductsLoading, setIsProductsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [busyProductId, setBusyProductId] = useState<number | null>(null)

  const activeProducts = products.filter((product) => product.active).length
  const inactiveProducts = products.length - activeProducts
  const totalStock = products.reduce((sum, product) => sum + product.stockQuantity, 0)

  async function loadHealth(signal?: AbortSignal) {
    setIsHealthLoading(true)

    try {
      const response = await getHealthStatus(signal)
      setHealth(response)
      setHealthErrorMessage(null)
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return
      }

      setHealthErrorMessage(getErrorMessage(error))
    } finally {
      setIsHealthLoading(false)
    }
  }

  async function loadProducts(currentSearch: string, signal?: AbortSignal) {
    setIsProductsLoading(true)

    try {
      const response = await getProducts(currentSearch)

      if (signal?.aborted) {
        return
      }

      setProducts(response)
      setListErrorMessage(null)
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return
      }

      setListErrorMessage(getErrorMessage(error))
    } finally {
      setIsProductsLoading(false)
    }
  }

  useEffect(() => {
    const controller = new AbortController()
    void loadHealth(controller.signal)
    void loadProducts(search, controller.signal)

    return () => controller.abort()
  }, [search])

  function resetForm(clearMessages = true) {
    setForm(initialFormState)
    setEditingProductId(null)
    if (clearMessages) {
      setFormErrorMessage(null)
      setFormSuccessMessage(null)
    }
  }

  function handleEdit(product: Product) {
    setEditingProductId(product.id)
    setForm(toFormState(product))
    setFormErrorMessage(null)
    setFormSuccessMessage(null)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormSuccessMessage(null)

    const validationMessage = validateForm(form)

    if (validationMessage) {
      setFormErrorMessage(validationMessage)
      return
    }

    setIsSaving(true)
    setFormErrorMessage(null)

    try {
      const payload = toPayload(form)

      if (editingProductId === null) {
        await createProduct(payload)
        resetForm(false)
        setFormSuccessMessage('Produto cadastrado com sucesso.')
      } else {
        await updateProduct(editingProductId, payload)
        resetForm(false)
        setFormSuccessMessage('Produto atualizado com sucesso.')
      }

      setFormErrorMessage(null)
      await loadProducts(search)
    } catch (error) {
      setFormErrorMessage(getErrorMessage(error))
    } finally {
      setIsSaving(false)
    }
  }

  async function handleToggleActivation(product: Product) {
    setBusyProductId(product.id)

    try {
      await updateProductActivation(product.id, { active: !product.active })
      await loadProducts(search)
    } catch (error) {
      setListErrorMessage(getErrorMessage(error))
    } finally {
      setBusyProductId(null)
    }
  }

  return (
    <main className="app-shell">
      <div className="app-container">
        <section className="hero-panel">
          <header className="hero-header">
            <div className="hero-copy">
              <span className="eyebrow">Sprint 2 em andamento</span>
              <h1>Codigo unico e QR Code dos produtos</h1>
              <p>
                O cadastro de produtos agora evolui com identificacao unica no padrao da
                loja e geracao de QR Code pronta para leitura no caixa.
              </p>
            </div>

            <div className="hero-highlight">
              <div className="metric-pill">
                <strong>{products.length}</strong>
                <span>produtos carregados</span>
              </div>
              <div className="metric-pill">
                <strong>{activeProducts}</strong>
                <span>ativos para venda</span>
              </div>
              <div className="metric-pill">
                <strong>{products.filter((product) => product.code.startsWith('IWR-')).length}</strong>
                <span>codigos prontos para QR</span>
              </div>
            </div>
          </header>

          <div className="stats-grid">
            <article className="stat-card">
              <strong>{inactiveProducts}</strong>
              <span>produtos inativos</span>
            </article>
            <article className="stat-card">
              <strong>{totalStock}</strong>
              <span>itens em estoque</span>
            </article>
            <article className="stat-card">
              <strong>{health?.status ?? '...'}</strong>
              <span>status geral do backend</span>
            </article>
          </div>
        </section>

        <div className="content-grid">
          <section className="product-form-panel">
            <header className="section-header">
              <div>
                <h2>{editingProductId === null ? 'Novo produto' : 'Editar produto'}</h2>
                <p>Deixe o codigo vazio para gerar automaticamente no padrao da Sprint 2.</p>
              </div>
            </header>

            <form className="product-form" onSubmit={handleSubmit}>
              <div className="form-grid">
                <div className="field-group field-group--full">
                  <label htmlFor="name">Nome</label>
                  <input
                    id="name"
                    value={form.name}
                    onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                    placeholder="Ex.: Vestido midi floral"
                  />
                </div>

                <div className="field-group">
                  <label htmlFor="code">Codigo</label>
                  <input
                    id="code"
                    value={form.code}
                    onChange={(event) => setForm((current) => ({ ...current, code: event.target.value.toUpperCase() }))}
                    placeholder="Opcional. Ex.: IWR-000001"
                  />
                  <small className="field-hint">Se ficar vazio, o sistema gera automaticamente.</small>
                </div>

                <div className="field-group">
                  <label htmlFor="price">Preco</label>
                  <input
                    id="price"
                    inputMode="decimal"
                    value={form.price}
                    onChange={(event) => setForm((current) => ({ ...current, price: event.target.value }))}
                    placeholder="79.90"
                  />
                </div>

                <div className="field-group">
                  <label htmlFor="stockQuantity">Estoque</label>
                  <input
                    id="stockQuantity"
                    inputMode="numeric"
                    value={form.stockQuantity}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, stockQuantity: event.target.value }))
                    }
                    placeholder="0"
                  />
                </div>

                <div className="field-group">
                  <label htmlFor="active">Status</label>
                  <select
                    id="active"
                    value={form.active}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        active: event.target.value as 'true' | 'false',
                      }))
                    }
                  >
                    <option value="true">Ativo</option>
                    <option value="false">Inativo</option>
                  </select>
                </div>
              </div>

              {formErrorMessage ? (
                <div className="feedback-message feedback-message--error">{formErrorMessage}</div>
              ) : null}

              {formSuccessMessage ? (
                <div className="feedback-message feedback-message--success">{formSuccessMessage}</div>
              ) : null}

              <div className="form-actions">
                <button className="action-button" type="submit" disabled={isSaving}>
                  {isSaving
                    ? 'Salvando...'
                    : editingProductId === null
                      ? 'Cadastrar produto'
                      : 'Salvar alteracoes'}
                </button>
                <button
                  className="secondary-button"
                  type="button"
                  onClick={() => resetForm()}
                  disabled={isSaving}
                >
                  Limpar formulario
                </button>
              </div>
            </form>
          </section>

          <section className="product-list-panel">
            <header className="section-header">
              <div>
                <h2>Produtos cadastrados</h2>
                <p>Busque por nome ou codigo e edite sem sair da tela.</p>
              </div>
            </header>

            <div className="list-toolbar">
              <input
                className="search-input"
                value={searchDraft}
                onChange={(event) => setSearchDraft(event.target.value)}
                placeholder="Buscar por nome ou codigo"
              />
              <button className="action-button" type="button" onClick={() => setSearch(searchDraft)}>
                Buscar
              </button>
              <button
                className="secondary-button"
                type="button"
                onClick={() => {
                  setSearchDraft('')
                  setSearch('')
                }}
              >
                Limpar busca
              </button>
            </div>

            {listErrorMessage ? (
              <div className="feedback-message feedback-message--error">{listErrorMessage}</div>
            ) : null}

            <div className="product-list">
              {isProductsLoading ? (
                <div className="product-empty">Carregando produtos...</div>
              ) : products.length === 0 ? (
                <div className="product-empty">Nenhum produto encontrado para o filtro atual.</div>
              ) : (
                products.map((product) => (
                  <article className="product-card" key={product.id}>
                    <div className="product-card-header">
                      <div>
                        <h3>{product.name}</h3>
                        <span className="product-card-code">{product.code}</span>
                      </div>
                      <span
                        className={`status-badge ${
                          product.active ? 'status-badge--up' : 'status-badge--down'
                        }`}
                      >
                        {product.active ? 'Ativo' : 'Inativo'}
                      </span>
                    </div>

                    <div className="product-card-grid">
                      <div>
                        <span>Preco</span>
                        <strong>{formatCurrency(product.price)}</strong>
                      </div>
                      <div>
                        <span>Estoque</span>
                        <strong>{product.stockQuantity}</strong>
                      </div>
                      <div>
                        <span>Atualizado</span>
                        <strong>{formatDate(product.updatedAt)}</strong>
                      </div>
                    </div>

                    <div className="product-card-meta">
                      Criado em {formatDate(product.createdAt)}
                    </div>

                    <div className="product-qr-block">
                      <img
                        className="product-qr-image"
                        src={`/api/products/${product.id}/qr-code`}
                        alt={`QR Code do produto ${product.code}`}
                        loading="lazy"
                      />
                      <div className="product-qr-copy">
                        <span>QR Code</span>
                        <strong>{product.code}</strong>
                      </div>
                    </div>

                    <div className="product-card-actions">
                      <button className="secondary-button" type="button" onClick={() => handleEdit(product)}>
                        Editar
                      </button>
                      <button
                        className="action-button"
                        type="button"
                        disabled={busyProductId === product.id}
                        onClick={() => void handleToggleActivation(product)}
                      >
                        {busyProductId === product.id
                          ? 'Atualizando...'
                          : product.active
                            ? 'Inativar'
                            : 'Ativar'}
                      </button>
                    </div>
                  </article>
                ))
              )}
            </div>
          </section>
        </div>

        <HealthStatusCard
          health={health}
          errorMessage={healthErrorMessage}
          isLoading={isHealthLoading}
          onRefresh={() => void loadHealth()}
        />

        <section className="acceptance-card">
          <h2>Criterios de aceite da Sprint 2</h2>
          <p>
            Agora o modulo precisa identificar cada produto com clareza e preparar a
            leitura por QR Code sem perder a simplicidade operacional.
          </p>
          <ul className="acceptance-list">
            {acceptanceItems.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  )
}
