import { useDeferredValue, useEffect, useState, type FormEvent } from 'react'
import {
  createProduct,
  getProductPage,
  updateProduct,
  updateProductActivation,
} from '../services/productService'
import type { Product, ProductPage, ProductPageFilters, ProductPayload } from '../types/product'
import { getErrorMessage } from '../utils/errors'
import { formatCurrency, formatDateTime } from '../utils/formatters'
import { CurrencyInput } from '../components/CurrencyInput'

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

const initialFilters: ProductPageFilters = {
  search: '',
  active: 'ALL',
  stockStatus: 'ALL',
  minPrice: '',
  maxPrice: '',
  lowStockThreshold: '5',
  sort: 'createdAt',
  direction: 'desc',
  size: 12,
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

function getQrCodeUrl(productId: number) {
  return `/api/products/${productId}/qr-code`
}

function getQrDownloadName(product: Product) {
  return `${product.code.toLowerCase()}-qr-code.png`
}

function getLabelUrl(productId: number) {
  return `/api/products/${productId}/label`
}

function getStockStatusLabel(product: Product, lowStockThreshold: number) {
  if (product.stockQuantity === 0) {
    return 'Sem estoque'
  }

  if (product.stockQuantity <= lowStockThreshold) {
    return 'Estoque baixo'
  }

  return 'Em estoque'
}

function getStockStatusClassName(product: Product, lowStockThreshold: number) {
  if (product.stockQuantity === 0) {
    return 'stock-chip stock-chip--empty'
  }

  if (product.stockQuantity <= lowStockThreshold) {
    return 'stock-chip stock-chip--low'
  }

  return 'stock-chip stock-chip--ok'
}

function buildEmptyProductPage(size: number): ProductPage {
  return {
    content: [],
    page: 0,
    size,
    totalElements: 0,
    totalPages: 0,
    first: true,
    last: true,
  }
}

export function ProductManagementPage() {
  const [productPage, setProductPage] = useState<ProductPage>(() => buildEmptyProductPage(initialFilters.size))
  const [filters, setFilters] = useState<ProductPageFilters>(initialFilters)
  const deferredFilters = useDeferredValue(filters)
  const [page, setPage] = useState(0)
  const [form, setForm] = useState<ProductFormState>(initialFormState)
  const [editingProductId, setEditingProductId] = useState<number | null>(null)
  const [formErrorMessage, setFormErrorMessage] = useState<string | null>(null)
  const [formSuccessMessage, setFormSuccessMessage] = useState<string | null>(null)
  const [listErrorMessage, setListErrorMessage] = useState<string | null>(null)
  const [isProductsLoading, setIsProductsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [busyProductId, setBusyProductId] = useState<number | null>(null)
  const [selectedQrProduct, setSelectedQrProduct] = useState<Product | null>(null)
  const [selectedLabelProduct, setSelectedLabelProduct] = useState<Product | null>(null)
  const [copiedProductId, setCopiedProductId] = useState<number | null>(null)

  const products = productPage.content
  const lowStockThreshold = Number(filters.lowStockThreshold) || 5
  const activeProducts = products.filter((product) => product.active).length
  const lowStockProducts = products.filter(
    (product) => product.stockQuantity > 0 && product.stockQuantity <= lowStockThreshold,
  ).length
  const outOfStockProducts = products.filter((product) => product.stockQuantity === 0).length
  const inventoryValue = products.reduce(
    (sum, product) => sum + product.price * product.stockQuantity,
    0,
  )

  async function loadProducts(nextFilters: ProductPageFilters, nextPage: number, signal?: AbortSignal) {
    setIsProductsLoading(true)

    try {
      const response = await getProductPage(nextFilters, nextPage, signal)

      if (signal?.aborted) {
        return
      }

      setProductPage(response)
      setListErrorMessage(null)
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return
      }

      setListErrorMessage(getErrorMessage(error))
    } finally {
      if (!signal?.aborted) {
        setIsProductsLoading(false)
      }
    }
  }

  useEffect(() => {
    const controller = new AbortController()
    const timeoutId = window.setTimeout(() => {
      void loadProducts(deferredFilters, page, controller.signal)
    }, 220)

    return () => {
      window.clearTimeout(timeoutId)
      controller.abort()
    }
  }, [deferredFilters, page])

  function updateFilter<Key extends keyof ProductPageFilters>(key: Key, value: ProductPageFilters[Key]) {
    setPage(0)
    setFilters((current) => ({ ...current, [key]: value }))
  }

  function clearFilters() {
    setPage(0)
    setFilters(initialFilters)
  }

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
    window.scrollTo({ top: 0, behavior: 'smooth' })
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
      await loadProducts(filters, page)
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
      await loadProducts(filters, page)
    } catch (error) {
      setListErrorMessage(getErrorMessage(error))
    } finally {
      setBusyProductId(null)
    }
  }

  async function handleCopyCode(product: Product) {
    try {
      await navigator.clipboard.writeText(product.code)
      setCopiedProductId(product.id)
      window.setTimeout(() => setCopiedProductId(null), 1800)
    } catch {
      setListErrorMessage('Nao foi possivel copiar o codigo do produto.')
    }
  }

  function handlePrintLabel(product: Product) {
    const printWindow = window.open(getLabelUrl(product.id), '_blank')
    printWindow?.addEventListener('load', () => {
      printWindow.print()
    })
  }

  return (
    <main className="app-shell">
      <div className="app-container">
        <section className="hero-panel">
          <header className="hero-header">
            <div className="hero-copy">
              <span className="eyebrow">Estoque</span>
              <h1>Gestao completa de produtos</h1>
              <p>
                Cadastre, filtre, ordene e acompanhe estoque com foco em operacao de loja:
                produtos ativos, ruptura, estoque baixo, QR Code e etiquetas prontas para venda.
              </p>
            </div>

            <div className="hero-highlight">
              <div className="metric-pill">
                <strong>{productPage.totalElements}</strong>
                <span>produtos filtrados</span>
              </div>
              <div className="metric-pill">
                <strong>{activeProducts}</strong>
                <span>ativos nesta pagina</span>
              </div>
              <div className="metric-pill">
                <strong>{formatCurrency(inventoryValue)}</strong>
                <span>valor nesta pagina</span>
              </div>
            </div>
          </header>

          <div className="stats-grid">
            <article className="stat-card">
              <strong>{products.length}</strong>
              <span>itens na pagina</span>
            </article>
            <article className="stat-card">
              <strong>{lowStockProducts}</strong>
              <span>estoque baixo</span>
            </article>
            <article className="stat-card">
              <strong>{outOfStockProducts}</strong>
              <span>sem estoque</span>
            </article>
          </div>
        </section>

        <div className="content-grid">
          <section className="product-form-panel">
            <header className="section-header">
              <div>
                <h2>{editingProductId === null ? 'Novo produto' : 'Editar produto'}</h2>
                <p>Deixe o codigo vazio para gerar automaticamente no padrao da loja.</p>
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
                  <CurrencyInput
                    id="price"
                    value={form.price}
                    onChange={(value) => setForm((current) => ({ ...current, price: value }))}
                    placeholder="R$ 79,90"
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
                <p>Use filtros combinados para encontrar produtos, controlar ruptura e imprimir etiquetas.</p>
              </div>
            </header>

            <section className="inventory-toolbar" aria-label="Filtros de estoque">
              <div className="field-group field-group--wide">
                <label htmlFor="productSearch">Busca</label>
                <input
                  id="productSearch"
                  className="search-input"
                  value={filters.search}
                  onChange={(event) => updateFilter('search', event.target.value)}
                  placeholder="Nome ou codigo"
                />
              </div>

              <div className="field-group">
                <label htmlFor="activeFilter">Status</label>
                <select
                  id="activeFilter"
                  value={filters.active}
                  onChange={(event) => updateFilter('active', event.target.value as ProductPageFilters['active'])}
                >
                  <option value="ALL">Todos</option>
                  <option value="ACTIVE">Ativos</option>
                  <option value="INACTIVE">Inativos</option>
                </select>
              </div>

              <div className="field-group">
                <label htmlFor="stockFilter">Estoque</label>
                <select
                  id="stockFilter"
                  value={filters.stockStatus}
                  onChange={(event) =>
                    updateFilter('stockStatus', event.target.value as ProductPageFilters['stockStatus'])
                  }
                >
                  <option value="ALL">Todos</option>
                  <option value="IN_STOCK">Em estoque</option>
                  <option value="LOW_STOCK">Estoque baixo</option>
                  <option value="OUT_OF_STOCK">Sem estoque</option>
                </select>
              </div>

              <div className="field-group">
                <label htmlFor="minPrice">Preco min.</label>
                <input
                  id="minPrice"
                  inputMode="decimal"
                  value={filters.minPrice}
                  onChange={(event) => updateFilter('minPrice', event.target.value)}
                  placeholder="0.00"
                />
              </div>

              <div className="field-group">
                <label htmlFor="maxPrice">Preco max.</label>
                <input
                  id="maxPrice"
                  inputMode="decimal"
                  value={filters.maxPrice}
                  onChange={(event) => updateFilter('maxPrice', event.target.value)}
                  placeholder="999.00"
                />
              </div>

              <div className="field-group">
                <label htmlFor="lowStockThreshold">Minimo</label>
                <input
                  id="lowStockThreshold"
                  inputMode="numeric"
                  value={filters.lowStockThreshold}
                  onChange={(event) => updateFilter('lowStockThreshold', event.target.value)}
                />
              </div>

              <div className="field-group">
                <label htmlFor="sortField">Ordenar por</label>
                <select
                  id="sortField"
                  value={filters.sort}
                  onChange={(event) => updateFilter('sort', event.target.value as ProductPageFilters['sort'])}
                >
                  <option value="createdAt">Cadastro</option>
                  <option value="updatedAt">Atualizacao</option>
                  <option value="name">Nome</option>
                  <option value="code">Codigo</option>
                  <option value="price">Preco</option>
                  <option value="stockQuantity">Estoque</option>
                </select>
              </div>

              <div className="field-group">
                <label htmlFor="sortDirection">Direcao</label>
                <select
                  id="sortDirection"
                  value={filters.direction}
                  onChange={(event) => updateFilter('direction', event.target.value as ProductPageFilters['direction'])}
                >
                  <option value="desc">Maior primeiro</option>
                  <option value="asc">Menor primeiro</option>
                </select>
              </div>

              <div className="field-group">
                <label htmlFor="pageSize">Por pagina</label>
                <select
                  id="pageSize"
                  value={filters.size}
                  onChange={(event) => updateFilter('size', Number(event.target.value))}
                >
                  <option value={8}>8</option>
                  <option value={12}>12</option>
                  <option value={24}>24</option>
                  <option value={48}>48</option>
                </select>
              </div>

              <button className="secondary-button" type="button" onClick={clearFilters}>
                Limpar filtros
              </button>
            </section>

            <div className="inventory-result-bar">
              <span>
                {isProductsLoading
                  ? 'Atualizando listagem...'
                  : `${productPage.totalElements} produto(s) encontrados`}
              </span>
              <strong>
                Pagina {productPage.totalPages === 0 ? 0 : productPage.page + 1} de {productPage.totalPages}
              </strong>
            </div>

            {listErrorMessage ? (
              <div className="feedback-message feedback-message--error">{listErrorMessage}</div>
            ) : null}

            <div className="product-list">
              {isProductsLoading ? (
                <div className="product-empty">Carregando produtos...</div>
              ) : products.length === 0 ? (
                <div className="product-empty">Nenhum produto encontrado para os filtros atuais.</div>
              ) : (
                products.map((product) => (
                  <article className="product-card" key={product.id}>
                    <div className="product-card-header">
                      <div>
                        <h3>{product.name}</h3>
                        <span className="product-card-code">{product.code}</span>
                      </div>
                      <div className="product-card-badges">
                        <span className={getStockStatusClassName(product, lowStockThreshold)}>
                          {getStockStatusLabel(product, lowStockThreshold)}
                        </span>
                        <span
                          className={`status-badge ${
                            product.active ? 'status-badge--up' : 'status-badge--down'
                          }`}
                        >
                          {product.active ? 'Ativo' : 'Inativo'}
                        </span>
                      </div>
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
                        <span>Total estoque</span>
                        <strong>{formatCurrency(product.price * product.stockQuantity)}</strong>
                      </div>
                      <div>
                        <span>Atualizado</span>
                        <strong>{formatDateTime(product.updatedAt)}</strong>
                      </div>
                    </div>

                    <div className="product-card-meta">
                      Criado em {formatDateTime(product.createdAt)}
                    </div>

                    <div className="product-qr-block">
                      <button
                        className="product-qr-preview"
                        type="button"
                        onClick={() => setSelectedQrProduct(product)}
                        aria-label={`Ampliar QR Code do produto ${product.code}`}
                      >
                        <img
                          className="product-qr-image"
                          src={getQrCodeUrl(product.id)}
                          alt={`QR Code do produto ${product.code}`}
                          loading="lazy"
                        />
                      </button>
                      <div className="product-qr-content">
                        <div className="product-qr-copy">
                          <span>QR Code</span>
                          <strong>{product.code}</strong>
                        </div>
                        <div className="product-qr-actions">
                          <button
                            className="icon-button"
                            type="button"
                            title="Copiar codigo"
                            aria-label={`Copiar codigo ${product.code}`}
                            onClick={() => void handleCopyCode(product)}
                          >
                            {copiedProductId === product.id ? 'OK' : 'Copiar'}
                          </button>
                          <a
                            className="icon-link"
                            href={getQrCodeUrl(product.id)}
                            download={getQrDownloadName(product)}
                            title="Baixar QR Code"
                            aria-label={`Baixar QR Code do produto ${product.code}`}
                          >
                            Baixar
                          </a>
                        </div>
                      </div>
                    </div>

                    <div className="product-card-actions">
                      <button className="secondary-button" type="button" onClick={() => handleEdit(product)}>
                        Editar
                      </button>
                      <button
                        className="secondary-button"
                        type="button"
                        onClick={() => setSelectedLabelProduct(product)}
                      >
                        Etiqueta
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

            <footer className="pagination-bar">
              <button
                className="secondary-button"
                type="button"
                disabled={productPage.first || isProductsLoading}
                onClick={() => setPage((current) => Math.max(current - 1, 0))}
              >
                Anterior
              </button>
              <span>
                Mostrando {products.length} de {productPage.totalElements}
              </span>
              <button
                className="secondary-button"
                type="button"
                disabled={productPage.last || productPage.totalPages === 0 || isProductsLoading}
                onClick={() => setPage((current) => current + 1)}
              >
                Proxima
              </button>
            </footer>
          </section>
        </div>
      </div>

      {selectedQrProduct ? (
        <div
          className="qr-modal-backdrop"
          role="presentation"
          onClick={() => setSelectedQrProduct(null)}
        >
          <section
            className="qr-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="qr-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="qr-modal-header">
              <div>
                <span className="eyebrow">QR Code</span>
                <h2 id="qr-modal-title">{selectedQrProduct.name}</h2>
                <p>{selectedQrProduct.code}</p>
              </div>
              <button
                className="icon-button icon-button--close"
                type="button"
                onClick={() => setSelectedQrProduct(null)}
                aria-label="Fechar visualizacao do QR Code"
              >
                Fechar
              </button>
            </header>
            <img
              className="qr-modal-image"
              src={getQrCodeUrl(selectedQrProduct.id)}
              alt={`QR Code ampliado do produto ${selectedQrProduct.code}`}
            />
            <div className="qr-modal-actions">
              <button
                className="secondary-button"
                type="button"
                onClick={() => void handleCopyCode(selectedQrProduct)}
              >
                {copiedProductId === selectedQrProduct.id ? 'Codigo copiado' : 'Copiar codigo'}
              </button>
              <a
                className="action-button action-button--link"
                href={getQrCodeUrl(selectedQrProduct.id)}
                download={getQrDownloadName(selectedQrProduct)}
              >
                Baixar PNG
              </a>
            </div>
          </section>
        </div>
      ) : null}

      {selectedLabelProduct ? (
        <div
          className="qr-modal-backdrop"
          role="presentation"
          onClick={() => setSelectedLabelProduct(null)}
        >
          <section
            className="label-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="label-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="qr-modal-header">
              <div>
                <span className="eyebrow">Etiqueta</span>
                <h2 id="label-modal-title">{selectedLabelProduct.name}</h2>
                <p>{selectedLabelProduct.code}</p>
              </div>
              <button
                className="icon-button icon-button--close"
                type="button"
                onClick={() => setSelectedLabelProduct(null)}
                aria-label="Fechar visualizacao da etiqueta"
              >
                Fechar
              </button>
            </header>
            <iframe
              className="label-preview-frame"
              src={getLabelUrl(selectedLabelProduct.id)}
              title={`Etiqueta do produto ${selectedLabelProduct.code}`}
            />
            <div className="qr-modal-actions">
              <a
                className="secondary-button action-button--link"
                href={getLabelUrl(selectedLabelProduct.id)}
                target="_blank"
                rel="noreferrer"
              >
                Abrir etiqueta
              </a>
              <button
                className="action-button"
                type="button"
                onClick={() => handlePrintLabel(selectedLabelProduct)}
              >
                Imprimir etiqueta
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  )
}
