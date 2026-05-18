import { useDeferredValue, useEffect, useState, type FormEvent } from 'react'
import type { LucideIcon } from 'lucide-react'
import {
  AlertTriangle,
  BadgeDollarSign,
  Boxes,
  CircleSlash,
  Clock3,
  Package,
  PackageCheck,
  Barcode,
  Shirt,
  ShoppingBag,
  Sparkles,
  Tag,
} from 'lucide-react'
import {
  createProduct,
  getBulkLabelsUrl,
  getProductCategories,
  getProductPage,
  updateProductActivation,
} from '../services/productService'
import type { Product, ProductCategory, ProductPage, ProductPageFilters, ProductPayload } from '../types/product'
import { getErrorMessage } from '../utils/errors'
import { formatCurrency, formatDateTime } from '../utils/formatters'
import { useAppMessage } from '../hooks/useAppMessage'
import { CurrencyInput } from '../components/CurrencyInput'
import { Metric } from '../components/Metric'
import { PageHeader } from '../components/PageHeader'

type ProductFormState = {
  name: string
  code: string
  categoryId: string
  price: string
  stockQuantity: string
  active: 'true' | 'false'
}

const initialFormState: ProductFormState = {
  name: '',
  code: '',
  categoryId: '',
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
  categoryId: '',
  lowStockThreshold: '5',
  sort: 'createdAt',
  direction: 'desc',
  size: 12,
}

function toPayload(form: ProductFormState): ProductPayload {
  return {
    name: form.name.trim(),
    code: form.code.trim().toUpperCase(),
    categoryId: Number(form.categoryId),
    price: Number(form.price),
    stockQuantity: Number(form.stockQuantity),
    active: form.active === 'true',
  }
}

function validateForm(form: ProductFormState) {
  if (!form.name.trim()) {
    return 'Informe o nome do produto.'
  }

  if (!form.categoryId) {
    return 'Escolha a categoria do produto.'
  }

  if (Number.isNaN(Number(form.price)) || Number(form.price) <= 0) {
    return 'Informe um preco maior que zero.'
  }

  if (!Number.isInteger(Number(form.stockQuantity)) || Number(form.stockQuantity) < 0) {
    return 'Informe um estoque valido.'
  }

  return null
}

function getBarcodeUrl(productId: number) {
  return `/api/products/${productId}/barcode`
}

function getBarcodeDownloadName(product: Product) {
  return `${product.code.toLowerCase()}-barcode.png`
}

function getLabelUrl(productId: number) {
  return `/api/products/${productId}/label`
}

function getStockLabelsUrl(productId: number) {
  return getBulkLabelsUrl([productId])
}

function getCategoryIcon(icon: string): LucideIcon {
  const icons: Record<string, LucideIcon> = {
    dress: Sparkles,
    shirt: Shirt,
    pants: Package,
    skirt: Sparkles,
    bag: ShoppingBag,
    sparkles: Sparkles,
    tag: Tag,
  }

  return icons[icon] ?? Boxes
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

type ProductManagementPageProps = {
  onEditProduct: (productId: number) => void
}

export function ProductManagementPage({ onEditProduct }: ProductManagementPageProps) {
  const { confirm, notify } = useAppMessage()
  const [productPage, setProductPage] = useState<ProductPage>(() => buildEmptyProductPage(initialFilters.size))
  const [filters, setFilters] = useState<ProductPageFilters>(initialFilters)
  const deferredFilters = useDeferredValue(filters)
  const [categories, setCategories] = useState<ProductCategory[]>([])
  const [page, setPage] = useState(0)
  const [isAdvancedFiltersOpen, setIsAdvancedFiltersOpen] = useState(false)
  const [form, setForm] = useState<ProductFormState>(initialFormState)
  const [formErrorMessage, setFormErrorMessage] = useState<string | null>(null)
  const [formSuccessMessage, setFormSuccessMessage] = useState<string | null>(null)
  const [listErrorMessage, setListErrorMessage] = useState<string | null>(null)
  const [isProductsLoading, setIsProductsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [busyProductId, setBusyProductId] = useState<number | null>(null)
  const [selectedBarcodeProduct, setSelectedBarcodeProduct] = useState<Product | null>(null)
  const [selectedLabelProduct, setSelectedLabelProduct] = useState<Product | null>(null)
  const [copiedProductId, setCopiedProductId] = useState<number | null>(null)
  const [selectedProductIds, setSelectedProductIds] = useState<Set<number>>(new Set())

  const products = productPage.content
  const lowStockThreshold = Number(filters.lowStockThreshold) || 5
  const lowStockProducts = products.filter(
    (product) => product.stockQuantity > 0 && product.stockQuantity <= lowStockThreshold,
  ).length
  const outOfStockProducts = products.filter((product) => product.stockQuantity === 0).length
  const inventoryValue = products.reduce(
    (sum, product) => sum + product.price * product.stockQuantity,
    0,
  )
  const selectedCategory = categories.find((category) => String(category.id) === filters.categoryId) ?? null

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

  useEffect(() => {
    const controller = new AbortController()

    async function loadCategories() {
      try {
        const response = await getProductCategories(controller.signal)
        setCategories(response)
        setListErrorMessage(null)
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          return
        }

        setListErrorMessage(getErrorMessage(error, 'Nao foi possivel carregar as categorias.'))
      }
    }

    void loadCategories()

    return () => controller.abort()
  }, [])

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
    if (clearMessages) {
      setFormErrorMessage(null)
      setFormSuccessMessage(null)
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormSuccessMessage(null)

    const validationMessage = validateForm(form)

    if (validationMessage) {
      setFormErrorMessage(validationMessage)
      notify({
        type: 'warning',
        title: 'Revise o produto',
        message: validationMessage,
      })
      return
    }

    setIsSaving(true)
    setFormErrorMessage(null)

    try {
      const payload = toPayload(form)

      const createdProduct = await createProduct(payload)
      resetForm(false)
      setFormSuccessMessage('Produto cadastrado com sucesso.')
      setFormErrorMessage(null)
      await loadProducts(filters, page)
      if (createdProduct.stockQuantity > 0) {
        const shouldPrintLabels = await confirm({
          type: 'success',
          title: 'Produto cadastrado',
          message: `Produto ${createdProduct.code} cadastrado com estoque ${createdProduct.stockQuantity}. Deseja imprimir as etiquetas agora?`,
          confirmLabel: `Imprimir ${createdProduct.stockQuantity}`,
          cancelLabel: 'Depois',
        })

        if (shouldPrintLabels) {
          handlePrintStockLabels(createdProduct)
        }
      } else {
        notify({
          type: 'success',
          title: 'Produto cadastrado',
          message: 'Produto cadastrado sem estoque para impressao.',
        })
      }
    } catch (error) {
      const message = getErrorMessage(error)
      setFormErrorMessage(message)
      notify({
        type: 'error',
        title: 'Erro ao salvar produto',
        message,
      })
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
      const message = getErrorMessage(error)
      setListErrorMessage(message)
      notify({
        type: 'error',
        title: 'Erro ao atualizar produto',
        message,
      })
    } finally {
      setBusyProductId(null)
    }
  }

  async function handleCopyCode(product: Product) {
    try {
      await navigator.clipboard.writeText(product.code)
      setCopiedProductId(product.id)
      notify({
        type: 'success',
        title: 'Codigo copiado',
        message: `Codigo ${product.code} copiado para a area de transferencia.`,
      })
      window.setTimeout(() => setCopiedProductId(null), 1800)
    } catch {
      setListErrorMessage('Nao foi possivel copiar o codigo do produto.')
      notify({
        type: 'error',
        title: 'Erro ao copiar',
        message: 'Nao foi possivel copiar o codigo do produto.',
      })
    }
  }

  function handlePrintLabel(product: Product) {
    const printWindow = window.open(getLabelUrl(product.id), '_blank')
    printWindow?.addEventListener('load', () => {
      printWindow.print()
    })
  }

  function handlePrintStockLabels(product: Product) {
    const printWindow = window.open(getStockLabelsUrl(product.id), '_blank')
    printWindow?.addEventListener('load', () => {
      printWindow.print()
    })
  }

  return (
    <main className="app-shell">
      <div className="app-container">
        <PageHeader
          eyebrow="Estoque"
          title="Gestao completa de produtos"
          subtitle="Cadastre, filtre, ordene e acompanhe estoque com foco em operacao de loja: produtos ativos, ruptura, estoque baixo, codigo de barras e etiquetas prontas para venda."
          metricLabel="Valor nesta pagina"
          metricValue={formatCurrency(inventoryValue)}
          status={`${productPage.totalElements} produto(s)`}
        />

        <div className="metric-grid metric-grid--4">
          <Metric label="Itens na pagina" value={String(products.length)} icon={Package} />
          <Metric label="Estoque total" value={String(products.reduce((sum, p) => sum + p.stockQuantity, 0))} tone="gold" icon={Boxes} />
          <Metric label="Estoque baixo" value={String(lowStockProducts)} tone={lowStockProducts > 0 ? 'warning' : 'default'} icon={AlertTriangle} />
          <Metric label="Sem estoque" value={String(outOfStockProducts)} tone={outOfStockProducts > 0 ? 'danger' : 'default'} icon={CircleSlash} />
        </div>

        <div className="content-grid">
          <section className="product-form-panel product-form-panel--new-product product-form-panel--offwhite">
            <header className="section-header product-form-header">
              <div>
                <h2>Novo produto</h2>
                <p>Deixe o codigo vazio para gerar automaticamente no padrao da loja.</p>
              </div>
            </header>

            <form className="product-form" onSubmit={handleSubmit}>
              <div className="form-grid">
                <div className="field-group field-group--full product-field product-field--name">
                  <label htmlFor="name">Nome</label>
                  <input
                    id="name"
                    value={form.name}
                    onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                    placeholder="Ex.: Vestido midi floral"
                  />
                </div>

                <div className="field-group product-field product-field--code">
                  <label htmlFor="code">Codigo</label>
                  <input
                    id="code"
                    value={form.code}
                    onChange={(event) => setForm((current) => ({ ...current, code: event.target.value.toUpperCase() }))}
                    placeholder="Opcional. Ex.: IWR-000001"
                  />
                  <small className="field-hint">Se ficar vazio, o sistema gera automaticamente.</small>
                </div>

                <div className="field-group product-field product-field--category">
                  <label htmlFor="categoryId">Categoria</label>
                  <select
                    id="categoryId"
                    value={form.categoryId}
                    onChange={(event) => setForm((current) => ({ ...current, categoryId: event.target.value }))}
                  >
                    <option value="">Escolha a categoria</option>
                    {categories.map((category) => (
                      <option value={category.id} key={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="field-group product-field product-field--price">
                  <label htmlFor="price">Preco</label>
                  <CurrencyInput
                    id="price"
                    value={form.price}
                    onChange={(value) => setForm((current) => ({ ...current, price: value }))}
                    placeholder="R$ 79,90"
                  />
                </div>

                <div className="field-group product-field product-field--stock">
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

                <div className="field-group product-field product-field--status">
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

              <div className="form-actions product-form-actions">
                <button className="action-button" type="submit" disabled={isSaving}>
                  {isSaving
                    ? 'Salvando...'
                    : 'Cadastrar produto'}
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
                <p>Busca global com paginacao. Use filtros avancados apenas quando precisar refinar a lista.</p>
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
                <label htmlFor="categoryFilter">Categoria</label>
                <select
                  id="categoryFilter"
                  value={filters.categoryId}
                  onChange={(event) => updateFilter('categoryId', event.target.value)}
                >
                  <option value="">Todas</option>
                  {categories.map((category) => (
                    <option value={category.id} key={category.id}>
                      {category.name}
                    </option>
                  ))}
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

              <button className="secondary-button" type="button" onClick={() => setIsAdvancedFiltersOpen((current) => !current)}>
                {isAdvancedFiltersOpen ? 'Ocultar avancados' : 'Filtros avancados'}
              </button>

              <button className="secondary-button" type="button" onClick={clearFilters}>
                Limpar filtros
              </button>
            </section>

            {isAdvancedFiltersOpen ? (
            <section className="inventory-toolbar inventory-toolbar--advanced" aria-label="Filtros avancados de estoque">
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
            </section>
            ) : null}

            <div className="inventory-result-bar">
              <span>
                {isProductsLoading
                  ? 'Atualizando listagem...'
                  : `${productPage.totalElements} produto(s) encontrados${
                      selectedCategory ? ` em ${selectedCategory.name}` : ''
                    }`}
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                {selectedProductIds.size > 0 ? (
                  <>
                    <span style={{ fontSize: '0.85rem', color: 'var(--color-gold)' }}>
                      {selectedProductIds.size} selecionado(s)
                    </span>
                    <a
                      className="action-button"
                      href={getBulkLabelsUrl(Array.from(selectedProductIds))}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ textDecoration: 'none', fontSize: '0.85rem', padding: '6px 14px' }}
                    >
                      Imprimir etiquetas
                    </a>
                    <button
                      className="secondary-button"
                      type="button"
                      onClick={() => setSelectedProductIds(new Set())}
                      style={{ fontSize: '0.85rem', padding: '6px 14px' }}
                    >
                      Limpar selecao
                    </button>
                  </>
                ) : null}
                <strong>
                  Pagina {productPage.totalPages === 0 ? 0 : productPage.page + 1} de {productPage.totalPages}
                </strong>
              </div>
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
                products.map((product) => {
                  const themeColors = ['var(--color-gold)', 'var(--color-gold-soft)', 'var(--color-muted)', 'var(--color-green)']
                  const cardColor = themeColors[product.id % themeColors.length]
                  
                  return (
                  <article className="product-card" style={{ borderLeft: `4px solid ${cardColor}` }} key={product.id}>
                    <div className="product-card-header">
                      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={selectedProductIds.has(product.id)}
                          onChange={(event) => {
                            setSelectedProductIds((current) => {
                              const next = new Set(current)
                              if (event.target.checked) {
                                next.add(product.id)
                              } else {
                                next.delete(product.id)
                              }
                              return next
                            })
                          }}
                          aria-label={`Selecionar ${product.name}`}
                          style={{ width: '16px', height: '16px', accentColor: 'var(--color-gold)' }}
                        />
                      </label>
                      <div>
                        <h3>{product.name}</h3>
                        <span className="product-card-code">{product.code}</span>
                        <span className="product-category-chip">
                          {(() => {
                            const CategoryIcon = getCategoryIcon(product.categoryIcon)
                            return <CategoryIcon size={14} strokeWidth={2.3} aria-hidden="true" />
                          })()}
                          {product.categoryName}
                        </span>
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
                        <span><BadgeDollarSign size={14} strokeWidth={2.3} aria-hidden="true" />Preco</span>
                        <strong>{formatCurrency(product.price)}</strong>
                      </div>
                      <div>
                        <span><PackageCheck size={14} strokeWidth={2.3} aria-hidden="true" />Estoque</span>
                        <strong>{product.stockQuantity}</strong>
                      </div>
                      <div>
                        <span><Boxes size={14} strokeWidth={2.3} aria-hidden="true" />Total estoque</span>
                        <strong>{formatCurrency(product.price * product.stockQuantity)}</strong>
                      </div>
                      <div>
                        <span><Clock3 size={14} strokeWidth={2.3} aria-hidden="true" />Atualizado</span>
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
                        onClick={() => setSelectedBarcodeProduct(product)}
                        aria-label={`Ampliar codigo de barras do produto ${product.code}`}
                      >
                        <img
                          className="product-qr-image"
                          src={getBarcodeUrl(product.id)}
                          alt={`Codigo de barras do produto ${product.code}`}
                          loading="lazy"
                        />
                      </button>
                      <div className="product-qr-content">
                        <div className="product-qr-copy">
                          <span><Barcode size={14} strokeWidth={2.3} aria-hidden="true" />Codigo de barras</span>
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
                            href={getBarcodeUrl(product.id)}
                            download={getBarcodeDownloadName(product)}
                            title="Baixar codigo de barras"
                            aria-label={`Baixar codigo de barras do produto ${product.code}`}
                          >
                            Baixar
                          </a>
                        </div>
                      </div>
                    </div>

                    <div className="product-card-actions">
                      <button className="secondary-button" type="button" onClick={() => onEditProduct(product.id)}>
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
                        className="secondary-button"
                        type="button"
                        disabled={product.stockQuantity <= 0}
                        onClick={() => handlePrintStockLabels(product)}
                      >
                        Imprimir estoque
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
                )})
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

      {selectedBarcodeProduct ? (
        <div
          className="qr-modal-backdrop"
          role="presentation"
          onClick={() => setSelectedBarcodeProduct(null)}
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
                <span className="eyebrow">Codigo de barras</span>
                <h2 id="qr-modal-title">{selectedBarcodeProduct.name}</h2>
                <p>{selectedBarcodeProduct.code}</p>
              </div>
              <button
                className="icon-button icon-button--close"
                type="button"
                onClick={() => setSelectedBarcodeProduct(null)}
                aria-label="Fechar visualizacao do codigo de barras"
              >
                Fechar
              </button>
            </header>
            <img
              className="qr-modal-image"
              src={getBarcodeUrl(selectedBarcodeProduct.id)}
              alt={`Codigo de barras ampliado do produto ${selectedBarcodeProduct.code}`}
            />
            <div className="qr-modal-actions">
              <button
                className="secondary-button"
                type="button"
                onClick={() => void handleCopyCode(selectedBarcodeProduct)}
              >
                {copiedProductId === selectedBarcodeProduct.id ? 'Codigo copiado' : 'Copiar codigo'}
              </button>
              <a
                className="action-button action-button--link"
                href={getBarcodeUrl(selectedBarcodeProduct.id)}
                download={getBarcodeDownloadName(selectedBarcodeProduct)}
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
                Imprimir 1 etiqueta
              </button>
              <button
                className="action-button"
                type="button"
                disabled={selectedLabelProduct.stockQuantity <= 0}
                onClick={() => handlePrintStockLabels(selectedLabelProduct)}
              >
                Imprimir estoque ({selectedLabelProduct.stockQuantity})
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  )
}
