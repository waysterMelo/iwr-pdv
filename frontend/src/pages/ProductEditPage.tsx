import { useEffect, useState, type FormEvent } from 'react'
import { CurrencyInput } from '../components/CurrencyInput'
import { useAppMessage } from '../hooks/useAppMessage'
import {
  getProductById,
  getProductCategories,
  updateProduct,
} from '../services/productService'
import type { Product, ProductCategory, ProductPayload } from '../types/product'
import { getErrorMessage } from '../utils/errors'
import { formatCurrency, formatDateTime } from '../utils/formatters'

type ProductEditFormState = {
  name: string
  code: string
  categoryId: string
  price: string
  costPrice: string
  stockQuantity: string
  active: 'true' | 'false'
  lotDate: string
}

type ProductEditPageProps = {
  productId: number
  onBack: () => void
  onSaved: () => void
}

const emptyForm: ProductEditFormState = {
  name: '',
  code: '',
  categoryId: '',
  price: '',
  costPrice: '',
  stockQuantity: '',
  active: 'true',
  lotDate: '',
}

function toFormState(product: Product): ProductEditFormState {
  return {
    name: product.name,
    code: product.code,
    categoryId: String(product.categoryId),
    price: product.price.toFixed(2),
    costPrice: product.costPrice ? product.costPrice.toFixed(2) : '0.00',
    stockQuantity: String(product.stockQuantity),
    active: String(product.active) as 'true' | 'false',
    lotDate: product.lotDate ?? '',
  }
}

function toPayload(form: ProductEditFormState): ProductPayload {
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

function validateForm(form: ProductEditFormState) {
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

export function ProductEditPage({ productId, onBack, onSaved }: ProductEditPageProps) {
  const { notify } = useAppMessage()
  const [product, setProduct] = useState<Product | null>(null)
  const [categories, setCategories] = useState<ProductCategory[]>([])
  const [form, setForm] = useState<ProductEditFormState>(emptyForm)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    const controller = new AbortController()

    async function loadProduct() {
      try {
        const [nextProduct, nextCategories] = await Promise.all([
          getProductById(productId, controller.signal),
          getProductCategories(controller.signal),
        ])

        if (controller.signal.aborted) {
          return
        }

        setProduct(nextProduct)
        setForm(toFormState(nextProduct))
        setCategories(nextCategories)
        setErrorMessage(null)
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          return
        }

        setErrorMessage(getErrorMessage(error, 'Nao foi possivel carregar o produto.'))
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false)
        }
      }
    }

    void loadProduct()

    return () => controller.abort()
  }, [productId])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSuccessMessage(null)

    const validationMessage = validateForm(form)
    if (validationMessage) {
      setErrorMessage(validationMessage)
      notify({
        type: 'warning',
        title: 'Revise o produto',
        message: validationMessage,
      })
      return
    }

    setIsSaving(true)
    setErrorMessage(null)

    try {
      const updatedProduct = await updateProduct(productId, toPayload(form))
      setProduct(updatedProduct)
      setForm(toFormState(updatedProduct))
      setSuccessMessage('Produto atualizado com sucesso.')
      notify({
        type: 'success',
        title: 'Produto atualizado',
        message: 'Produto atualizado com sucesso.',
      })
      window.setTimeout(onSaved, 650)
    } catch (error) {
      const message = getErrorMessage(error, 'Nao foi possivel atualizar o produto.')
      setErrorMessage(message)
      notify({
        type: 'error',
        title: 'Erro ao atualizar produto',
        message,
      })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <main className="app-shell">
      <div className="app-container product-edit-container">
        <section className="hero-panel product-edit-hero">
          <header className="hero-header">
            <div className="hero-copy">
              <span className="eyebrow">Estoque</span>
              <h1>Editar produto</h1>
              <p>Atualize os dados do produto, categoria, preco, estoque, lote e status.</p>
            </div>

            <div className="checkout-summary">
              <span>Produto</span>
              <strong>{product?.code ?? `#${productId}`}</strong>
              <small>{product ? `Atualizado em ${formatDateTime(product.updatedAt)}` : 'Carregando dados'}</small>
            </div>
          </header>
        </section>

        <div className="product-edit-grid">
          <section className="product-form-panel product-edit-panel">
            <header className="section-header">
              <div>
                <h2>Dados principais</h2>
                <p>O codigo interno permanece automatico para leitura no PDV e etiquetas.</p>
              </div>
            </header>

            {isLoading ? (
              <div className="product-empty">Carregando produto...</div>
            ) : (
              <form className="product-form" onSubmit={handleSubmit}>                 <div className="form-grid product-edit-form-grid">
                  <div className="field-group field-group--full product-edit-field product-edit-field--featured">
                    <label htmlFor="editProductName">Nome do produto</label>
                    <input
                      id="editProductName"
                      value={form.name}
                      onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                      placeholder="Ex.: Vestido midi floral"
                    />
                  </div>

                  <div className="field-group product-edit-field">
                    <label htmlFor="editProductCategory">Categoria</label>
                    <select
                      id="editProductCategory"
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

                  <div className="field-group product-edit-field">
                    <label htmlFor="editProductStock">Estoque</label>
                    <input
                      id="editProductStock"
                      inputMode="numeric"
                      value={form.stockQuantity}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, stockQuantity: event.target.value }))
                      }
                      placeholder="0"
                    />
                  </div>

                  <div className="field-group product-edit-field">
                    <label htmlFor="editProductCostPrice">Preço de Custo</label>
                    <CurrencyInput
                      id="editProductCostPrice"
                      value={form.costPrice}
                      onChange={(value) => setForm((current) => ({ ...current, costPrice: value }))}
                      placeholder="R$ 0,00"
                    />
                  </div>

                  <div className="field-group product-edit-field">
                    <label htmlFor="editProductPrice">Preço</label>
                    <CurrencyInput
                      id="editProductPrice"
                      value={form.price}
                      onChange={(value) => setForm((current) => ({ ...current, price: value }))}
                      placeholder="R$ 0,00"
                    />
                  </div>

                  <div className="field-group product-edit-field">
                    <label htmlFor="editProductActive">Status</label>
                    <select
                      id="editProductActive"
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

                  <div className="field-group product-edit-field">
                    <label htmlFor="editProductLotDate">Lote</label>
                    <input
                      id="editProductLotDate"
                      type="date"
                      value={form.lotDate}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, lotDate: event.target.value }))
                      }
                    />
                  </div>
                </div>

                {errorMessage ? <div className="feedback-message feedback-message--error">{errorMessage}</div> : null}
                {successMessage ? (
                  <div className="feedback-message feedback-message--success">{successMessage}</div>
                ) : null}

                <div className="form-actions product-edit-actions">
                  <button className="action-button" type="submit" disabled={isSaving}>
                    {isSaving ? 'Salvando...' : 'Salvar produto'}
                  </button>
                  <button className="secondary-button" type="button" onClick={onBack} disabled={isSaving}>
                    Voltar para produtos
                  </button>
                </div>
              </form>
            )}
          </section>

          <aside className="product-list-panel product-edit-aside">
            <header className="section-header">
              <div>
                <h2>Resumo</h2>
                <p>Conferencia rapida antes de salvar.</p>
              </div>
            </header>

            <div className="product-edit-preview">
              {product ? (
                <img
                  className="product-qr-image"
                  src={getBarcodeUrl(product.id)}
                  alt={`Codigo de barras do produto ${product.code}`}
                />
              ) : null}
              <div>
                <span className="product-card-code">{form.code || 'Sem codigo'}</span>
                <h3>{form.name || 'Produto sem nome'}</h3>
                <p>{categories.find((category) => String(category.id) === form.categoryId)?.name ?? 'Sem categoria'}</p>
              </div>
            </div>

            <div className="product-card-grid product-edit-summary-grid">
              <div>
                <span>Preço Venda</span>
                <strong>{formatCurrency(Number(form.price) || 0)}</strong>
              </div>
              <div>
                <span>Preço Custo</span>
                <strong>{formatCurrency(Number(form.costPrice) || 0)}</strong>
              </div>
              <div>
                <span>Estoque</span>
                <strong>{Number(form.stockQuantity) || 0}</strong>
              </div>
              <div>
                <span>Custo Total</span>
                <strong>{formatCurrency((Number(form.costPrice) || 0) * (Number(form.stockQuantity) || 0))}</strong>
              </div>
              <div>
                <span>Total Venda</span>
                <strong>{formatCurrency((Number(form.price) || 0) * (Number(form.stockQuantity) || 0))}</strong>
              </div>
              <div>
                <span>Status</span>
                <strong>{form.active === 'true' ? 'Ativo' : 'Inativo'}</strong>
              </div>
              <div>
                <span>Lote</span>
                <strong>{form.lotDate ? form.lotDate.split('-').reverse().join('/') : '-'}</strong>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </main>
  )
}
