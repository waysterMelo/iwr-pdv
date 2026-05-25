import { useDeferredValue, useEffect, useState, type FormEvent } from 'react'
import type { LucideIcon } from 'lucide-react'
import {
  AlertTriangle,
  BadgeDollarSign,
  Boxes,
  CircleSlash,
  Clock3,
  Copy,
  Download,
  Edit3,
  Package,
  PackageCheck,
  Barcode,
  Printer,
  Shirt,
  ShoppingBag,
  Sparkles,
  Tag,
  Tags,
  X,
  Save,
  Search,
  RotateCcw,
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
  costPrice: string
  stockQuantity: string
  active: 'true' | 'false'
  lotDate: string
}

const initialFormState: ProductFormState = {
  name: '',
  code: '',
  categoryId: '',
  price: '',
  costPrice: '',
  stockQuantity: '',
  active: 'true',
  lotDate: '',
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
    costPrice: Number(form.costPrice) || 0,
    stockQuantity: Number(form.stockQuantity),
    active: form.active === 'true',
    lotDate: form.lotDate || null,
  }
}

function validateForm(form: ProductFormState) {
  if (!form.name.trim()) {
    return 'Informe o nome do produto.'
  }

  if (!form.categoryId) {
    return 'Escolha a categoria do produto.'
  }

  if (Number.isNaN(Number(form.costPrice)) || Number(form.costPrice) < 0) {
    return 'Informe um preço de custo maior ou igual a zero.'
  }

  if (Number.isNaN(Number(form.price)) || Number(form.price) <= 0) {
    return 'Informe um preço maior que zero.'
  }

  if (!Number.isInteger(Number(form.stockQuantity)) || Number(form.stockQuantity) < 0) {
    return 'Informe um estoque válido.'
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

export type ProductManagementMode = 'create' | 'list' | 'labels'

type ProductManagementPageProps = {
  onEditProduct: (productId: number) => void
  mode?: ProductManagementMode
}

export function ProductManagementPage({ onEditProduct, mode = 'list' }: ProductManagementPageProps) {
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
  const totalCostValue = products.reduce(
    (sum, product) => sum + (product.costPrice || 0) * product.stockQuantity,
    0,
  )
  const selectedCategory = categories.find((category) => String(category.id) === filters.categoryId) ?? null
  const showForm = mode === 'create'
  const showList = mode === 'list' || mode === 'labels'
  
  const headerTitle = mode === 'create' ? 'Cadastrar produto' : mode === 'labels' ? 'Etiquetas de produtos' : 'Produtos cadastrados'
  const headerSubtitle = mode === 'create'
    ? 'Cadastre o produto com categoria, preço, estoque e data de lote. O código interno será gerado automaticamente.'
    : mode === 'labels'
      ? 'Selecione produtos para imprimir etiquetas por unidade em estoque.'
      : 'Filtre, ordene e acompanhe o estoque com foco na operação do Atelier.'

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

        setListErrorMessage(getErrorMessage(error, 'Não foi possível carregar as categorias.'))
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
      setFormSuccessMessage('Produto cadastrado com sucesso no Atelier.')
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
          message: 'Produto cadastrado sem estoque para impressão.',
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
      notify({
        type: 'success',
        title: product.active ? 'Produto inativado' : 'Produto ativado',
        message: `O status do produto ${product.code} foi atualizado com sucesso.`,
      })
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
        title: 'Código copiado',
        message: `Código ${product.code} copiado para a área de transferência.`,
      })
      window.setTimeout(() => setCopiedProductId(null), 1800)
    } catch {
      setListErrorMessage('Não foi possível copiar o código do produto.')
      notify({
        type: 'error',
        title: 'Erro ao copiar',
        message: 'Não foi possível copiar o código do produto.',
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
    <main className="app-shell customer-premium-shell">
      <div className="app-container customer-premium-container">
        
        {/* Banner do Topo */}
        <div className="customer-premium-hero">
          <section className="customer-premium-banner">
            <div className="customer-premium-badges">
              <span>★ INVENTÁRIO</span>
              <strong>{productPage.totalElements} produto(s)</strong>
            </div>
            <h1>{headerTitle}</h1>
            <p>{headerSubtitle}</p>
          </section>

          {mode === 'list' && (
            <section className="customer-premium-target-card">
              <div>
                <span>Valor em Página</span>
                <small>Estoque precificado</small>
              </div>
              <strong style={{ color: '#f6d78b' }}>{formatCurrency(inventoryValue)}</strong>
              <div className="customer-premium-progress">
                <span style={{ width: products.length > 0 ? '100%' : '0%' }} />
              </div>
            </section>
          )}
        </div>

        {mode === 'list' && (
          <div className="customer-premium-metrics">
            <article>
              <div>
                <span>Custo total do lote</span>
                <strong style={{ color: '#fff' }}>{formatCurrency(totalCostValue)}</strong>
              </div>
              <BadgeDollarSign size={19} aria-hidden="true" style={{ color: '#d7ad55', background: 'rgba(215, 173, 85, 0.1)' }} />
            </article>

            <article>
              <div>
                <span>Estoque total</span>
                <strong style={{ color: '#f6d78b' }}>{products.reduce((sum, p) => sum + p.stockQuantity, 0)}</strong>
              </div>
              <Boxes size={19} aria-hidden="true" style={{ color: '#d7ad55', background: 'rgba(215, 173, 85, 0.1)' }} />
            </article>

            <article style={{ borderColor: lowStockProducts > 0 ? 'rgba(215, 173, 85, 0.5)' : undefined }}>
              <div>
                <span>Estoque baixo</span>
                <strong style={{ color: lowStockProducts > 0 ? '#f6d78b' : '#fff' }}>{lowStockProducts}</strong>
              </div>
              <AlertTriangle size={19} aria-hidden="true" style={{ color: '#d7ad55', background: 'rgba(215, 173, 85, 0.1)' }} />
            </article>

            <article style={{ borderColor: outOfStockProducts > 0 ? 'rgba(251, 113, 133, 0.4)' : undefined }}>
              <div>
                <span>Sem estoque</span>
                <strong style={{ color: outOfStockProducts > 0 ? '#fb7185' : '#fff' }}>{outOfStockProducts}</strong>
              </div>
              <CircleSlash size={19} aria-hidden="true" style={{ color: '#fb7185', background: 'rgba(251, 113, 133, 0.1)' }} />
            </article>
          </div>
        )}

        {/* Grid de Formulário e Lista */}
        <div className={showForm && showList ? 'content-grid' : 'customer-premium-content'}>
          
          {/* Formulário Novo Produto */}
          {showForm ? (
            <section className="customer-premium-form-panel">
              <header>
                <Package size={26} aria-hidden="true" />
                <div>
                  <h2>Novo produto</h2>
                  <p>O código interno é gerado automaticamente no padrão Atelier.</p>
                </div>
              </header>

              <form className="customer-premium-form" onSubmit={handleSubmit}>
                <div className="customer-premium-form-grid">
                  <div className="field-group field-group--full">
                    <label htmlFor="name">Nome do Produto</label>
                    <input
                      id="name"
                      value={form.name}
                      onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                      placeholder="Ex: Terno Slim Fit Azul Marinho"
                      required
                    />
                  </div>

                  <div className="field-group">
                    <label htmlFor="categoryId">Categoria</label>
                    <select
                      id="categoryId"
                      value={form.categoryId}
                      onChange={(event) => setForm((current) => ({ ...current, categoryId: event.target.value }))}
                      required
                    >
                      <option value="">Escolha a categoria</option>
                      {categories.map((category) => (
                        <option value={category.id} key={category.id}>
                          {category.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="field-group">
                    <label htmlFor="stockQuantity">Estoque Inicial</label>
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
                    <label htmlFor="costPrice">Preço de Custo R$</label>
                    <CurrencyInput
                      id="costPrice"
                      value={form.costPrice}
                      onChange={(value) => setForm((current) => ({ ...current, costPrice: value }))}
                      placeholder="R$ 0,00"
                    />
                  </div>

                  <div className="field-group">
                    <label htmlFor="price">Preço R$</label>
                    <CurrencyInput
                      id="price"
                      value={form.price}
                      onChange={(value) => setForm((current) => ({ ...current, price: value }))}
                      placeholder="R$ 0,00"
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

                  <div className="field-group">
                    <label htmlFor="lotDate">Data de Lote</label>
                    <input
                      id="lotDate"
                      type="date"
                      value={form.lotDate}
                      onChange={(event) => setForm((current) => ({ ...current, lotDate: event.target.value }))}
                      style={{ colorScheme: 'dark' }}
                    />
                  </div>
                </div>

                {formErrorMessage ? (
                  <div className="feedback-message feedback-message--error">{formErrorMessage}</div>
                ) : null}

                {formSuccessMessage ? (
                  <div className="feedback-message feedback-message--success">{formSuccessMessage}</div>
                ) : null}

                <div className="customer-premium-actions">
                  <button className="customer-premium-primary-button" type="submit" disabled={isSaving}>
                    <Save size={16} aria-hidden="true" />
                    {isSaving ? 'Salvando...' : 'Cadastrar produto'}
                  </button>
                  <button
                    className="customer-premium-secondary-button"
                    type="button"
                    onClick={() => resetForm()}
                    disabled={isSaving}
                  >
                    <RotateCcw size={16} aria-hidden="true" />
                    Limpar
                  </button>
                </div>
              </form>
            </section>
          ) : null}

          {/* Listagem de Estoque */}
          {showList ? (
            <section className="customer-premium-list-panel">
              <header>
                <div>
                  <h2>Produtos cadastrados</h2>
                  <p>Busca e monitoramento global de estoque de peças do Atelier.</p>
                </div>
              </header>

              {/* Filtros e Barra de Ferramentas */}
              <section className="customer-premium-search" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '16px', alignItems: 'end', background: '#101117', border: '1px solid rgba(226,232,240,0.08)', padding: '20px', borderRadius: '16px', marginBottom: '20px' }}>
                <div className="field-group" style={{ margin: 0 }}>
                  <label htmlFor="productSearch" style={{ color: '#f6d78b', fontWeight: 900, fontSize: '0.62rem', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '6px', display: 'block' }}>Buscar</label>
                  <div className="customer-premium-search-input" style={{ width: '100%', minHeight: '48px' }}>
                    <Search size={16} aria-hidden="true" />
                    <input
                      id="productSearch"
                      value={filters.search}
                      onChange={(event) => updateFilter('search', event.target.value)}
                      placeholder="Nome ou código interno..."
                      style={{ background: 'transparent', color: '#fff', border: 0, padding: '0 12px 0 36px', minHeight: '48px', width: '100%', outline: 'none' }}
                    />
                  </div>
                </div>

                <div className="field-group" style={{ margin: 0 }}>
                  <label htmlFor="categoryFilter" style={{ color: '#f6d78b', fontWeight: 900, fontSize: '0.62rem', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '6px', display: 'block' }}>Categoria</label>
                  <select
                    id="categoryFilter"
                    value={filters.categoryId}
                    onChange={(event) => updateFilter('categoryId', event.target.value)}
                    style={{ minHeight: '48px', borderRadius: '12px', background: '#0d1016', color: '#fff', border: '1px solid rgba(226,232,240,0.12)', padding: '0 16px', width: '100%', outline: 'none' }}
                  >
                    <option value="" style={{ background: '#0d1016' }}>Todas</option>
                    {categories.map((category) => (
                      <option value={category.id} key={category.id} style={{ background: '#0d1016' }}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="field-group" style={{ margin: 0 }}>
                  <label htmlFor="stockFilter" style={{ color: '#f6d78b', fontWeight: 900, fontSize: '0.62rem', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '6px', display: 'block' }}>Estoque</label>
                  <select
                    id="stockFilter"
                    value={filters.stockStatus}
                    onChange={(event) =>
                      updateFilter('stockStatus', event.target.value as ProductPageFilters['stockStatus'])
                    }
                    style={{ minHeight: '48px', borderRadius: '12px', background: '#0d1016', color: '#fff', border: '1px solid rgba(226,232,240,0.12)', padding: '0 16px', width: '100%', outline: 'none' }}
                  >
                    <option value="ALL" style={{ background: '#0d1016' }}>Todos</option>
                    <option value="IN_STOCK" style={{ background: '#0d1016' }}>Em estoque</option>
                    <option value="LOW_STOCK" style={{ background: '#0d1016' }}>Estoque baixo</option>
                    <option value="OUT_OF_STOCK" style={{ background: '#0d1016' }}>Sem estoque</option>
                  </select>
                </div>

                <button 
                  className="customer-premium-secondary-button" 
                  type="button" 
                  onClick={() => setIsAdvancedFiltersOpen((current) => !current)}
                  style={{ minHeight: '48px', padding: '0 20px' }}
                >
                  Filtros
                </button>

                <button 
                  className="customer-premium-secondary-button" 
                  type="button" 
                  onClick={clearFilters}
                  style={{ minHeight: '48px', padding: '0 20px' }}
                >
                  Limpar
                </button>
              </section>

              {/* Filtros Avançados Expansíveis */}
              {isAdvancedFiltersOpen ? (
                <section className="customer-premium-search" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '16px', background: '#101117', border: '1px solid rgba(226,232,240,0.08)', padding: '20px', borderRadius: '16px', marginBottom: '20px', marginTop: '16px' }}>
                  <div className="field-group" style={{ margin: 0 }}>
                    <label htmlFor="activeFilter" style={{ color: '#f6d78b', fontWeight: 900, fontSize: '0.62rem', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '6px', display: 'block' }}>Status</label>
                    <select
                      id="activeFilter"
                      value={filters.active}
                      onChange={(event) => updateFilter('active', event.target.value as ProductPageFilters['active'])}
                      style={{ minHeight: '44px', borderRadius: '12px', background: '#0d1016', color: '#fff', border: '1px solid rgba(226,232,240,0.12)', padding: '0 12px', width: '100%', outline: 'none' }}
                    >
                      <option value="ALL" style={{ background: '#0d1016' }}>Todos</option>
                      <option value="ACTIVE" style={{ background: '#0d1016' }}>Ativos</option>
                      <option value="INACTIVE" style={{ background: '#0d1016' }}>Inativos</option>
                    </select>
                  </div>

                  <div className="field-group" style={{ margin: 0 }}>
                    <label htmlFor="minPrice" style={{ color: '#f6d78b', fontWeight: 900, fontSize: '0.62rem', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '6px', display: 'block' }}>Preço mín.</label>
                    <input
                      id="minPrice"
                      inputMode="decimal"
                      value={filters.minPrice}
                      onChange={(event) => updateFilter('minPrice', event.target.value)}
                      placeholder="0.00"
                      style={{ minHeight: '44px', borderRadius: '12px', background: '#0d1016', color: '#fff', border: '1px solid rgba(226,232,240,0.12)', padding: '0 12px', width: '100%', outline: 'none' }}
                    />
                  </div>

                  <div className="field-group" style={{ margin: 0 }}>
                    <label htmlFor="maxPrice" style={{ color: '#f6d78b', fontWeight: 900, fontSize: '0.62rem', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '6px', display: 'block' }}>Preço máx.</label>
                    <input
                      id="maxPrice"
                      inputMode="decimal"
                      value={filters.maxPrice}
                      onChange={(event) => updateFilter('maxPrice', event.target.value)}
                      placeholder="999.00"
                      style={{ minHeight: '44px', borderRadius: '12px', background: '#0d1016', color: '#fff', border: '1px solid rgba(226,232,240,0.12)', padding: '0 12px', width: '100%', outline: 'none' }}
                    />
                  </div>

                  <div className="field-group" style={{ margin: 0 }}>
                    <label htmlFor="lowStockThreshold" style={{ color: '#f6d78b', fontWeight: 900, fontSize: '0.62rem', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '6px', display: 'block' }}>Min. Estoque Baixo</label>
                    <input
                      id="lowStockThreshold"
                      inputMode="numeric"
                      value={filters.lowStockThreshold}
                      onChange={(event) => updateFilter('lowStockThreshold', event.target.value)}
                      style={{ minHeight: '44px', borderRadius: '12px', background: '#0d1016', color: '#fff', border: '1px solid rgba(226,232,240,0.12)', padding: '0 12px', width: '100%', outline: 'none' }}
                    />
                  </div>

                  <div className="field-group" style={{ margin: 0 }}>
                    <label htmlFor="sortField" style={{ color: '#f6d78b', fontWeight: 900, fontSize: '0.62rem', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '6px', display: 'block' }}>Ordenar por</label>
                    <select
                      id="sortField"
                      value={filters.sort}
                      onChange={(event) => updateFilter('sort', event.target.value as ProductPageFilters['sort'])}
                      style={{ minHeight: '44px', borderRadius: '12px', background: '#0d1016', color: '#fff', border: '1px solid rgba(226,232,240,0.12)', padding: '0 12px', width: '100%', outline: 'none' }}
                    >
                      <option value="createdAt" style={{ background: '#0d1016' }}>Data de Cadastro</option>
                      <option value="updatedAt" style={{ background: '#0d1016' }}>Data de Atualização</option>
                      <option value="name" style={{ background: '#0d1016' }}>Nome do Produto</option>
                      <option value="code" style={{ background: '#0d1016' }}>Código</option>
                      <option value="price" style={{ background: '#0d1016' }}>Preço</option>
                      <option value="stockQuantity" style={{ background: '#0d1016' }}>Quantidade Estoque</option>
                    </select>
                  </div>

                  <div className="field-group" style={{ margin: 0 }}>
                    <label htmlFor="sortDirection" style={{ color: '#f6d78b', fontWeight: 900, fontSize: '0.62rem', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '6px', display: 'block' }}>Direção</label>
                    <select
                      id="sortDirection"
                      value={filters.direction}
                      onChange={(event) => updateFilter('direction', event.target.value as ProductPageFilters['direction'])}
                      style={{ minHeight: '44px', borderRadius: '12px', background: '#0d1016', color: '#fff', border: '1px solid rgba(226,232,240,0.12)', padding: '0 12px', width: '100%', outline: 'none' }}
                    >
                      <option value="desc" style={{ background: '#0d1016' }}>Decrescente</option>
                      <option value="asc" style={{ background: '#0d1016' }}>Crescente</option>
                    </select>
                  </div>

                  <div className="field-group" style={{ margin: 0 }}>
                    <label htmlFor="pageSize" style={{ color: '#f6d78b', fontWeight: 900, fontSize: '0.62rem', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '6px', display: 'block' }}>Por página</label>
                    <select
                      id="pageSize"
                      value={filters.size}
                      onChange={(event) => updateFilter('size', Number(event.target.value))}
                      style={{ minHeight: '44px', borderRadius: '12px', background: '#0d1016', color: '#fff', border: '1px solid rgba(226,232,240,0.12)', padding: '0 12px', width: '100%', outline: 'none' }}
                    >
                      <option value={8} style={{ background: '#0d1016' }}>8 itens</option>
                      <option value={12} style={{ background: '#0d1016' }}>12 itens</option>
                      <option value={24} style={{ background: '#0d1016' }}>24 itens</option>
                      <option value={48} style={{ background: '#0d1016' }}>48 itens</option>
                    </select>
                  </div>
                </section>
              ) : null}

              {/* Status de Resultados */}
              <div className="inventory-result-bar" style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 14px', background: '#0d1016', borderRadius: '12px', border: '1px solid rgba(226,232,240,0.06)' }}>
                <span style={{ fontSize: '0.72rem', color: '#aeb8c8' }}>
                  {isProductsLoading
                    ? 'Atualizando listagem...'
                    : `${productPage.totalElements} produto(s) encontrado(s)${
                        selectedCategory ? ` em ${selectedCategory.name}` : ''
                      }`}
                </span>
                <strong style={{ fontSize: '0.72rem', color: '#fff' }}>
                  Página {productPage.totalPages === 0 ? 0 : productPage.page + 1} de {productPage.totalPages}
                </strong>
              </div>

              {/* Barra de Múltipla Seleção de Etiquetas */}
              {selectedProductIds.size > 0 ? (
                <div className="product-selection-bar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#101117', border: '1px solid rgba(215,173,85,0.4)', padding: '14px 20px', borderRadius: '14px', marginTop: '10px' }} role="status">
                  <div>
                    <span className="selection-count" style={{ display: 'block', color: '#f6d78b', fontSize: '0.85rem', fontWeight: 'bold' }}>
                      {selectedProductIds.size} selecionado(s)
                    </span>
                    <strong style={{ color: '#aeb8c8', fontSize: '0.72rem', fontWeight: 'normal' }}>
                      Uma etiqueta por unidade em estoque de cada produto.
                    </strong>
                  </div>
                  <div className="product-selection-actions" style={{ display: 'flex', gap: '10px' }}>
                    <a
                      className="customer-premium-primary-button"
                      href={getBulkLabelsUrl(Array.from(selectedProductIds))}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ minHeight: '38px', display: 'inline-flex', alignItems: 'center', textDecoration: 'none', color: '#101117', fontSize: '0.72rem' }}
                    >
                      <Printer size={14} style={{ marginRight: '6px' }} />
                      Imprimir etiquetas
                    </a>
                    <button
                      className="customer-premium-secondary-button"
                      type="button"
                      onClick={() => setSelectedProductIds(new Set())}
                      style={{ minHeight: '38px', fontSize: '0.72rem' }}
                    >
                      <X size={14} style={{ marginRight: '6px' }} />
                      Limpar seleção
                    </button>
                  </div>
                </div>
              ) : null}

              {listErrorMessage ? (
                <div className="feedback-message feedback-message--error">{listErrorMessage}</div>
              ) : null}

              {/* Grid de Cartões de Produtos */}
              <div className="customer-premium-card-grid" style={{ marginTop: '20px' }}>
                {isProductsLoading ? (
                  <div className="product-empty">Carregando estoque de peças...</div>
                ) : products.length === 0 ? (
                  <div className="product-empty" style={{ background: '#0d1016', borderRadius: '16px', padding: '40px' }}>Nenhum produto cadastrado com os filtros ativos.</div>
                ) : (
                  products.map((product) => {
                    return (
                      <article
                        className="customer-premium-card"
                        style={{
                          borderLeft: product.active ? '4px solid #d7ad55' : '4px solid #7b8493',
                          borderTop: selectedProductIds.has(product.id) ? '1px solid #d7ad55' : undefined,
                          borderRight: selectedProductIds.has(product.id) ? '1px solid #d7ad55' : undefined,
                          borderBottom: selectedProductIds.has(product.id) ? '1px solid #d7ad55' : undefined,
                          borderColor: selectedProductIds.has(product.id) ? '#d7ad55' : undefined,
                          background: selectedProductIds.has(product.id) ? 'linear-gradient(180deg, rgba(215, 173, 85, 0.05), rgba(16, 17, 23, 0.98))' : '#0d1016',
                          boxShadow: selectedProductIds.has(product.id) ? '0 0 12px rgba(215, 173, 85, 0.18)' : undefined
                        }}
                        key={product.id}
                      >
                        <div className="customer-premium-card-header" style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%', minWidth: 0, alignItems: 'stretch' }}>
                          {/* Linha Superior: Checkbox + Título + Status do Estoque */}
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', width: '100%', minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0 }}>
                              <label className="product-select-control" style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', flexShrink: 0 }}>
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
                                  style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: '#d7ad55' }}
                                />
                                <Tags size={14} style={{ color: '#7b8493' }} />
                              </label>
                              <h3 style={{ fontSize: '0.9rem', color: '#fff', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 }}>
                                {product.name}
                              </h3>
                            </div>
                            <span className={getStockStatusClassName(product, lowStockThreshold)} style={{ fontSize: '0.62rem', fontWeight: 900, textTransform: 'uppercase', padding: '2px 8px', borderRadius: '4px', flexShrink: 0 }}>
                              {getStockStatusLabel(product, lowStockThreshold)}
                            </span>
                          </div>

                          {/* Linha Inferior: Código + Categoria + Status Ativo/Inativo */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', width: '100%' }}>
                            <span className="product-card-code" style={{ display: 'inline-block', background: '#151922', padding: '2px 6px', borderRadius: '4px', fontSize: '0.68rem', fontFamily: 'monospace', color: '#aeb8c8', flexShrink: 0 }}>
                              {product.code}
                            </span>
                            
                            <span className="product-category-chip" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.7rem', color: '#d7ad55', flexShrink: 0 }}>
                              {(() => {
                                const CategoryIcon = getCategoryIcon(product.categoryIcon)
                                return <CategoryIcon size={12} aria-hidden="true" />
                              })()}
                              {product.categoryName}
                            </span>

                            <span
                              className={`status-badge ${
                                product.active ? 'status-badge--up' : 'status-badge--down'
                              }`}
                              style={{ fontSize: '0.62rem', fontWeight: 900, textTransform: 'uppercase', padding: '2px 8px', borderRadius: '4px', marginLeft: 'auto', flexShrink: 0 }}
                            >
                              {product.active ? 'Ativo' : 'Inativo'}
                            </span>
                          </div>
                        </div>

                        {/* Dados Consolidados do Produto */}
                        <div className="customer-premium-contact-box">
                          <div>
                            <span>Preço de Venda</span>
                            <strong style={{ color: '#f6d78b' }}>{formatCurrency(product.price)}</strong>
                          </div>
                          <div>
                            <span>Estoque Disponível</span>
                            <strong>{product.stockQuantity} un.</strong>
                          </div>
                          <div>
                            <span>Total Financeiro</span>
                            <strong style={{ color: '#f6d78b' }}>{formatCurrency(product.price * product.stockQuantity)}</strong>
                          </div>
                          {product.lotDate && (
                            <div>
                              <span>Data de Lote</span>
                              <strong>{product.lotDate.split('-').reverse().join('/')}</strong>
                            </div>
                          )}
                        </div>

                        {/* Bloco de Código de Barras Compacto e Responsivo */}
                        <div className="product-qr-block" style={{ display: 'flex', flexDirection: 'column', gap: '10px', background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(226,232,240,0.05)', borderRadius: '12px', padding: '12px', width: '100%', minWidth: 0 }}>
                          {/* Parte Superior: Imagem + Texto do código */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', width: '100%', minWidth: 0 }}>
                            <button
                              className="product-qr-preview"
                              type="button"
                              onClick={() => setSelectedBarcodeProduct(product)}
                              aria-label={`Ampliar código de barras do produto ${product.code}`}
                              style={{ background: '#fff', border: 0, padding: '4px', borderRadius: '6px', cursor: 'pointer', flexShrink: 0 }}
                            >
                              <img
                                className="product-qr-image"
                                src={getBarcodeUrl(product.id)}
                                alt={`Código de barras ${product.code}`}
                                loading="lazy"
                                style={{ height: '32px', display: 'block' }}
                              />
                            </button>
                            <div className="product-qr-copy" style={{ minWidth: 0, flex: 1 }}>
                              <span style={{ fontSize: '0.62rem', color: '#7b8493', textTransform: 'uppercase', display: 'block', lineHeight: 1.2 }}>Código de barras</span>
                              <strong style={{ color: '#fff', fontSize: '0.78rem', fontFamily: 'monospace', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{product.code}</strong>
                            </div>
                          </div>

                          {/* Parte Inferior: Botões Copiar e Baixar (Flex 1 para cada) */}
                          <div className="product-qr-actions" style={{ display: 'flex', gap: '8px', width: '100%' }}>
                            <button
                              className="customer-premium-secondary-button"
                              type="button"
                              onClick={() => void handleCopyCode(product)}
                              style={{ minHeight: '28px', flex: 1, fontSize: '0.62rem', padding: '0 4px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                            >
                              {copiedProductId === product.id ? 'Copiado' : 'Copiar'}
                            </button>
                            <a
                              className="customer-premium-secondary-button"
                              href={getBarcodeUrl(product.id)}
                              download={getBarcodeDownloadName(product)}
                              style={{ minHeight: '28px', flex: 1, fontSize: '0.62rem', padding: '0 4px', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                            >
                              Baixar
                            </a>
                          </div>
                        </div>

                        {/* Ações do Card */}
                        <div className="customer-premium-card-actions" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
                          <button className="customer-premium-secondary-button" type="button" onClick={() => onEditProduct(product.id)} style={{ minHeight: '34px', fontSize: '0.65rem' }}>
                            <Edit3 size={12} /> Editar
                          </button>
                          <button
                            className="customer-premium-secondary-button"
                            type="button"
                            onClick={() => setSelectedLabelProduct(product)}
                            style={{ minHeight: '34px', fontSize: '0.65rem' }}
                          >
                            <Tag size={12} /> Etiqueta
                          </button>
                          <button
                            className="customer-premium-secondary-button"
                            type="button"
                            disabled={product.stockQuantity <= 0}
                            onClick={() => handlePrintStockLabels(product)}
                            style={{ minHeight: '34px', fontSize: '0.65rem', gridColumn: 'span 2' }}
                          >
                            <Printer size={12} /> Imprimir estoque ({product.stockQuantity})
                          </button>
                          <button
                            className="customer-premium-primary-button"
                            type="button"
                            disabled={busyProductId === product.id}
                            onClick={() => void handleToggleActivation(product)}
                            style={{ minHeight: '34px', fontSize: '0.65rem', gridColumn: 'span 2', background: product.active ? 'rgba(251,113,133,0.1)' : 'rgba(45,212,191,0.1)', border: product.active ? '1px solid rgba(251,113,133,0.3)' : '1px solid rgba(45,212,191,0.3)', color: product.active ? '#fb7185' : '#8ff2e7' }}
                          >
                            {product.active ? 'Inativar produto' : 'Ativar produto'}
                          </button>
                        </div>
                      </article>
                    )
                  })
                )}
              </div>

              {/* Paginação */}
              <footer className="pagination-bar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(226,232,240,0.08)', paddingTop: '20px', marginTop: '20px' }}>
                <button
                  className="customer-premium-secondary-button"
                  type="button"
                  disabled={productPage.first || isProductsLoading}
                  onClick={() => setPage((current) => Math.max(current - 1, 0))}
                  style={{ minHeight: '38px', fontSize: '0.72rem' }}
                >
                  Anterior
                </button>
                <span style={{ fontSize: '0.8rem', color: '#aeb8c8' }}>
                  Mostrando {products.length} de {productPage.totalElements} registros
                </span>
                <button
                  className="customer-premium-secondary-button"
                  type="button"
                  disabled={productPage.last || productPage.totalPages === 0 || isProductsLoading}
                  onClick={() => setPage((current) => current + 1)}
                  style={{ minHeight: '38px', fontSize: '0.72rem' }}
                >
                  Próxima
                </button>
              </footer>
            </section>
          ) : null}
        </div>
      </div>

      {/* Modal: Código de Barras Ampliado */}
      {selectedBarcodeProduct ? (
        <div className="customer-premium-modal-backdrop" role="presentation" onClick={() => setSelectedBarcodeProduct(null)}>
          <section
            className="customer-premium-edit-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="qr-modal-title"
            onClick={(event) => event.stopPropagation()}
            style={{ width: '400px', textAlign: 'center' }}
          >
            <header>
              <div>
                <span style={{ fontSize: '0.62rem', color: '#d7ad55', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Código de barras</span>
                <h2 id="qr-modal-title">{selectedBarcodeProduct.name}</h2>
                <p>Código Interno: <strong>{selectedBarcodeProduct.code}</strong></p>
              </div>
              <button type="button" onClick={() => setSelectedBarcodeProduct(null)} aria-label="Fechar" style={{ border: '1px solid rgba(226,232,240,0.1)', background: 'rgba(226,232,240,0.04)', borderRadius: '8px', padding: '6px', cursor: 'pointer' }}>
                <X size={18} aria-hidden="true" />
              </button>
            </header>
            
            <div style={{ background: '#fff', padding: '20px', borderRadius: '12px', display: 'inline-block', margin: '20px auto' }}>
              <img
                src={getBarcodeUrl(selectedBarcodeProduct.id)}
                alt={`Código de barras ${selectedBarcodeProduct.code}`}
                style={{ width: '100%', maxWidth: '280px', display: 'block' }}
              />
            </div>

            <div className="qr-modal-actions" style={{ padding: '16px 20px', display: 'flex', gap: '10px', justifyContent: 'center', borderTop: '1px solid rgba(226,232,240,0.08)' }}>
              <button
                className="customer-premium-secondary-button"
                type="button"
                onClick={() => void handleCopyCode(selectedBarcodeProduct)}
                style={{ minHeight: '38px', fontSize: '0.72rem', flex: 1 }}
              >
                {copiedProductId === selectedBarcodeProduct.id ? 'Código copiado' : 'Copiar código'}
              </button>
              <a
                className="customer-premium-primary-button"
                href={getBarcodeUrl(selectedBarcodeProduct.id)}
                download={getBarcodeDownloadName(selectedBarcodeProduct)}
                style={{ minHeight: '38px', display: 'inline-flex', alignItems: 'center', textDecoration: 'none', color: '#101117', fontSize: '0.72rem', flex: 1 }}
              >
                Baixar PNG
              </a>
            </div>
          </section>
        </div>
      ) : null}

      {/* Modal: Etiqueta Única / Lote */}
      {selectedLabelProduct ? (
        <div className="customer-premium-modal-backdrop" role="presentation" onClick={() => setSelectedLabelProduct(null)}>
          <section
            className="customer-premium-edit-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="label-modal-title"
            onClick={(event) => event.stopPropagation()}
            style={{ width: 'min(760px, 100%)' }}
          >
            <header>
              <div>
                <span style={{ fontSize: '0.62rem', color: '#d7ad55', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Impressão de Etiqueta</span>
                <h2 id="label-modal-title">{selectedLabelProduct.name}</h2>
                <p>Código: {selectedLabelProduct.code}</p>
              </div>
              <button type="button" onClick={() => setSelectedLabelProduct(null)} aria-label="Fechar" style={{ border: '1px solid rgba(226,232,240,0.1)', background: 'rgba(226,232,240,0.04)', borderRadius: '8px', padding: '6px', cursor: 'pointer' }}>
                <X size={18} aria-hidden="true" />
              </button>
            </header>

            <iframe
              className="label-preview-frame"
              src={getLabelUrl(selectedLabelProduct.id)}
              title={`Etiqueta do produto ${selectedLabelProduct.code}`}
              style={{ width: '100%', height: '360px', border: 0, background: '#fff' }}
            />

            <div className="qr-modal-actions" style={{ padding: '16px 20px', display: 'flex', gap: '10px', justifyContent: 'flex-end', borderTop: '1px solid rgba(226,232,240,0.08)' }}>
              <a
                className="customer-premium-secondary-button"
                href={getLabelUrl(selectedLabelProduct.id)}
                target="_blank"
                rel="noreferrer"
                style={{ minHeight: '38px', display: 'inline-flex', alignItems: 'center', textDecoration: 'none', color: '#fff', fontSize: '0.72rem' }}
              >
                Abrir em nova aba
              </a>
              <button
                className="customer-premium-primary-button"
                type="button"
                onClick={() => handlePrintLabel(selectedLabelProduct)}
                style={{ minHeight: '38px', fontSize: '0.72rem' }}
              >
                Imprimir 1 etiqueta
              </button>
              <button
                className="customer-premium-primary-button"
                type="button"
                disabled={selectedLabelProduct.stockQuantity <= 0}
                onClick={() => handlePrintStockLabels(selectedLabelProduct)}
                style={{ minHeight: '38px', fontSize: '0.72rem' }}
              >
                Imprimir lote ({selectedLabelProduct.stockQuantity})
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  )
}
