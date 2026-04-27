import { useEffect, useState, type FormEvent } from 'react'
import { useAppMessage } from '../hooks/useAppMessage'
import { CurrencyInput } from '../components/CurrencyInput'
import {
  createProductBatch,
  getBatchLabelsUrl,
  getProductBatches,
  markBatchCataloged,
  markBatchLabelsPrinted,
  markBatchSentToStore,
} from '../services/catalogingService'
import { getProductCategories } from '../services/productService'
import type { ProductBatch, ProductBatchPayload, ProductBatchStatus } from '../types/cataloging'
import type { ProductCategory } from '../types/product'
import { getErrorMessage } from '../utils/errors'
import { formatCurrency, formatDateTime } from '../utils/formatters'

type ProductRow = {
  localId: number
  name: string
  code: string
  categoryId: string
  price: string
  stockQuantity: string
  active: 'true' | 'false'
}

const emptyRow = (localId: number): ProductRow => ({
  localId,
  name: '',
  code: '',
  categoryId: '',
  price: '',
  stockQuantity: '1',
  active: 'true',
})

const statusLabels: Record<ProductBatchStatus, string> = {
  DRAFT: 'Rascunho',
  LABELS_PRINTED: 'Etiquetas impressas',
  CATALOGED: 'Catalogado',
  SENT_TO_STORE: 'Enviado a loja',
}

const statusSteps: Array<{ status: ProductBatchStatus; label: string }> = [
  { status: 'DRAFT', label: 'Criado' },
  { status: 'LABELS_PRINTED', label: 'Impresso' },
  { status: 'CATALOGED', label: 'Catalogado' },
  { status: 'SENT_TO_STORE', label: 'Loja' },
]

function getStatusStepClassName(batchStatus: ProductBatchStatus, stepStatus: ProductBatchStatus) {
  const batchIndex = statusSteps.findIndex((step) => step.status === batchStatus)
  const stepIndex = statusSteps.findIndex((step) => step.status === stepStatus)

  return stepIndex <= batchIndex ? 'batch-progress-step batch-progress-step--done' : 'batch-progress-step'
}

function toPayload(batchName: string, rows: ProductRow[]): ProductBatchPayload {
  return {
    name: batchName.trim(),
    items: rows.map((row) => ({
      name: row.name.trim(),
      code: row.code.trim().toUpperCase(),
      categoryId: Number(row.categoryId),
      price: Number(row.price),
      stockQuantity: Number(row.stockQuantity),
      active: row.active === 'true',
    })),
  }
}

function validateRows(batchName: string, rows: ProductRow[]) {
  if (!batchName.trim()) {
    return 'Informe o nome do lote.'
  }

  for (const [index, row] of rows.entries()) {
    const line = index + 1
    if (!row.name.trim()) {
      return `Informe o nome do produto na linha ${line}.`
    }

    if (!row.categoryId) {
      return `Escolha a categoria na linha ${line}.`
    }

    if (Number.isNaN(Number(row.price)) || Number(row.price) <= 0) {
      return `Informe um preco valido na linha ${line}.`
    }

    if (!Number.isInteger(Number(row.stockQuantity)) || Number(row.stockQuantity) <= 0) {
      return `Informe uma quantidade maior que zero na linha ${line}.`
    }
  }

  return null
}

export function CatalogingPage() {
  const { notify } = useAppMessage()
  const [categories, setCategories] = useState<ProductCategory[]>([])
  const [batches, setBatches] = useState<ProductBatch[]>([])
  const [batchName, setBatchName] = useState('')
  const [rows, setRows] = useState<ProductRow[]>(() => [emptyRow(1), emptyRow(2), emptyRow(3)])
  const [shipmentDates, setShipmentDates] = useState<Record<number, string>>({})
  const [shipmentNotes, setShipmentNotes] = useState<Record<number, string>>({})
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [busyBatchId, setBusyBatchId] = useState<number | null>(null)

  const totalPendingLabels = batches
    .filter((batch) => batch.status === 'DRAFT')
    .reduce((sum, batch) => sum + batch.totalPieces, 0)
  const totalCatalogedPieces = batches
    .filter((batch) => batch.status === 'CATALOGED' || batch.status === 'SENT_TO_STORE')
    .reduce((sum, batch) => sum + batch.totalPieces, 0)

  async function loadData(signal?: AbortSignal) {
    try {
      const [nextCategories, nextBatches] = await Promise.all([
        getProductCategories(signal),
        getProductBatches(signal),
      ])

      if (signal?.aborted) {
        return
      }

      setCategories(nextCategories)
      setBatches(nextBatches)
      setErrorMessage(null)
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return
      }

      setErrorMessage(getErrorMessage(error, 'Nao foi possivel carregar a catalogacao.'))
    } finally {
      if (!signal?.aborted) {
        setIsLoading(false)
      }
    }
  }

  useEffect(() => {
    const controller = new AbortController()
    const timeoutId = window.setTimeout(() => {
      void loadData(controller.signal)
    }, 0)

    return () => {
      window.clearTimeout(timeoutId)
      controller.abort()
    }
  }, [])

  function updateRow(localId: number, patch: Partial<ProductRow>) {
    setRows((current) => current.map((row) => (row.localId === localId ? { ...row, ...patch } : row)))
  }

  function addRow() {
    setRows((current) => [...current, emptyRow(Date.now())])
  }

  function removeRow(localId: number) {
    setRows((current) => (current.length === 1 ? current : current.filter((row) => row.localId !== localId)))
  }

  function resetForm() {
    setBatchName('')
    setRows([emptyRow(Date.now()), emptyRow(Date.now() + 1), emptyRow(Date.now() + 2)])
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSuccessMessage(null)

    const validation = validateRows(batchName, rows)
    if (validation) {
      setErrorMessage(validation)
      notify({
        type: 'warning',
        title: 'Revise o lote',
        message: validation,
      })
      return
    }

    setIsSaving(true)
    setErrorMessage(null)

    try {
      await createProductBatch(toPayload(batchName, rows))
      resetForm()
      setSuccessMessage('Lote cadastrado com produtos pronto para exportar etiquetas.')
      notify({
        type: 'success',
        title: 'Lote criado',
        message: 'Lote cadastrado com produtos pronto para exportar etiquetas.',
      })
      await loadData()
    } catch (error) {
      const message = getErrorMessage(error, 'Nao foi possivel criar o lote.')
      setErrorMessage(message)
      notify({
        type: 'error',
        title: 'Erro ao criar lote',
        message,
      })
    } finally {
      setIsSaving(false)
    }
  }

  async function updateBatch(batchId: number, action: () => Promise<ProductBatch>) {
    setBusyBatchId(batchId)
    setErrorMessage(null)
    setSuccessMessage(null)

    try {
      await action()
      await loadData()
      setSuccessMessage('Lote atualizado.')
      notify({
        type: 'success',
        title: 'Lote atualizado',
        message: 'Lote atualizado.',
      })
    } catch (error) {
      const message = getErrorMessage(error, 'Nao foi possivel atualizar o lote.')
      setErrorMessage(message)
      notify({
        type: 'error',
        title: 'Erro ao atualizar lote',
        message,
      })
    } finally {
      setBusyBatchId(null)
    }
  }

  function openLabels(batch: ProductBatch) {
    window.open(getBatchLabelsUrl(batch.id), '_blank')
  }

  return (
    <main className="app-shell">
      <div className="app-container">
        <section className="hero-panel">
          <header className="hero-header">
            <div className="hero-copy">
              <span className="eyebrow">Catalogacao</span>
              <h1>Lotes, etiquetas e envio a loja</h1>
              <p>
                Cadastre varias pecas de uma vez, exporte as etiquetas do lote e registre quando
                as roupas foram catalogadas e enviadas para a loja.
              </p>
            </div>

            <div className="hero-highlight">
              <div className="metric-pill">
                <strong>{batches.length}</strong>
                <span>lotes</span>
              </div>
              <div className="metric-pill">
                <strong>{totalPendingLabels}</strong>
                <span>etiquetas pendentes</span>
              </div>
              <div className="metric-pill">
                <strong>{totalCatalogedPieces}</strong>
                <span>pecas catalogadas</span>
              </div>
            </div>
          </header>
        </section>

        <section className="product-form-panel cataloging-form-panel">
          <header className="section-header">
            <div>
              <h2>Novo lote</h2>
              <p>Use codigo vazio para gerar automaticamente. A quantidade vira o numero de etiquetas.</p>
            </div>
          </header>

          <div className="cataloging-flow-strip" aria-label="Fluxo da catalogacao">
            <span>1. Cadastrar pecas</span>
            <span>2. Exportar etiquetas</span>
            <span>3. Marcar impresso</span>
            <span>4. Catalogar</span>
            <span>5. Enviar a loja</span>
          </div>

          <form className="product-form" onSubmit={handleSubmit}>
            <div className="field-group field-group--full cataloging-lot-name">
              <label htmlFor="batchName">Nome do lote</label>
              <input
                id="batchName"
                value={batchName}
                onChange={(event) => setBatchName(event.target.value)}
                placeholder="Ex.: Recebimento 26/04 - Verao"
              />
            </div>

            <div className="batch-table">
              {rows.map((row, index) => (
                <article className="batch-row" key={row.localId}>
                  <div className="cataloging-row-index">
                    <strong>Produto {index + 1}</strong>
                    <span>{row.code || 'Codigo automatico'}</span>
                  </div>

                  <label className="cataloging-cell cataloging-cell--name">
                    <span>Nome da peca</span>
                    <input
                      value={row.name}
                      onChange={(event) => updateRow(row.localId, { name: event.target.value })}
                      placeholder="Ex.: Vestido midi floral"
                      aria-label={`Nome do produto ${index + 1}`}
                    />
                  </label>

                  <label className="cataloging-cell">
                    <span>Codigo</span>
                    <input
                      value={row.code}
                      onChange={(event) => updateRow(row.localId, { code: event.target.value.toUpperCase() })}
                      placeholder="Automatico"
                      aria-label={`Codigo do produto ${index + 1}`}
                    />
                  </label>

                  <label className="cataloging-cell">
                    <span>Categoria</span>
                    <select
                      value={row.categoryId}
                      onChange={(event) => updateRow(row.localId, { categoryId: event.target.value })}
                      aria-label={`Categoria do produto ${index + 1}`}
                    >
                      <option value="">Escolha</option>
                      {categories.map((category) => (
                        <option value={category.id} key={category.id}>
                          {category.name}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="cataloging-cell">
                    <span>Preco</span>
                    <CurrencyInput
                      value={row.price}
                      onChange={(value) => updateRow(row.localId, { price: value })}
                      placeholder="R$ 0,00"
                      aria-label={`Preco do produto ${index + 1}`}
                    />
                  </label>

                  <label className="cataloging-cell cataloging-cell--qty">
                    <span>Qtd.</span>
                    <input
                      inputMode="numeric"
                      value={row.stockQuantity}
                      onChange={(event) => updateRow(row.localId, { stockQuantity: event.target.value })}
                      placeholder="1"
                      aria-label={`Quantidade do produto ${index + 1}`}
                    />
                  </label>

                  <div className="cataloging-row-actions">
                    <button className="secondary-button" type="button" onClick={() => removeRow(row.localId)}>
                      Remover
                    </button>
                  </div>
                </article>
              ))}
            </div>

            {errorMessage ? <div className="feedback-message feedback-message--error">{errorMessage}</div> : null}
            {successMessage ? (
              <div className="feedback-message feedback-message--success">{successMessage}</div>
            ) : null}

            <div className="form-actions">
              <button className="secondary-button" type="button" onClick={addRow}>
                Adicionar produto
              </button>
              <button className="action-button" type="submit" disabled={isSaving}>
                {isSaving ? 'Criando lote...' : 'Criar lote'}
              </button>
            </div>
          </form>
        </section>

        <section className="product-list-panel">
          <header className="section-header">
            <div>
              <h2>Lotes de catalogacao</h2>
              <p>Exporte etiquetas, marque impressao, catalogacao e envio fisico para loja.</p>
            </div>
          </header>

          <div className="product-list">
            {isLoading ? (
              <div className="product-empty">Carregando lotes...</div>
            ) : batches.length === 0 ? (
              <div className="product-empty">Nenhum lote cadastrado ainda.</div>
            ) : (
              batches.map((batch) => {
                const batchValue = batch.products.reduce(
                  (sum, product) => sum + product.price * product.stockQuantity,
                  0,
                )
                return (
                  <article className="product-card batch-card" key={batch.id}>
                    <div className="product-card-header">
                      <div>
                        <h3>{batch.name}</h3>
                        <span className="product-card-code">Lote #{batch.id}</span>
                      </div>
                      <div className="product-card-badges">
                        <span className="status-badge">{statusLabels[batch.status]}</span>
                      </div>
                    </div>

                    <div className="product-card-grid">
                      <div>
                        <span>Produtos</span>
                        <strong>{batch.totalProducts}</strong>
                      </div>
                      <div>
                        <span>Pecas</span>
                        <strong>{batch.totalPieces}</strong>
                      </div>
                      <div>
                        <span>Valor lote</span>
                        <strong>{formatCurrency(batchValue)}</strong>
                      </div>
                      <div>
                        <span>Criado em</span>
                        <strong>{formatDateTime(batch.createdAt)}</strong>
                      </div>
                    </div>

                    <div className="batch-timeline">
                      {statusSteps.map((step) => (
                        <span className={getStatusStepClassName(batch.status, step.status)} key={step.status}>
                          {step.label}
                        </span>
                      ))}
                    </div>

                    <div className="batch-dates-grid">
                      <div>
                        <span>Etiquetas impressas</span>
                        <strong>{batch.labelsPrintedAt ? formatDateTime(batch.labelsPrintedAt) : 'Pendente'}</strong>
                      </div>
                      <div>
                        <span>Catalogacao</span>
                        <strong>{batch.catalogedAt ? formatDateTime(batch.catalogedAt) : 'Pendente'}</strong>
                      </div>
                      <div>
                        <span>Envio para loja</span>
                        <strong>{batch.sentToStoreAt ?? 'Pendente'}</strong>
                      </div>
                    </div>

                    <div className="batch-products-preview">
                      <span>Produtos do lote</span>
                      <strong>
                        {batch.products.slice(0, 4).map((product) => product.name).join(', ')}
                        {batch.products.length > 4 ? ` +${batch.products.length - 4}` : ''}
                      </strong>
                    </div>

                    <div className="batch-shipment-row">
                      <label className="batch-shipment-field">
                        <span>Data de envio</span>
                        <input
                          type="date"
                          value={shipmentDates[batch.id] ?? ''}
                          onChange={(event) =>
                            setShipmentDates((current) => ({ ...current, [batch.id]: event.target.value }))
                          }
                          aria-label={`Data de envio do lote ${batch.id}`}
                        />
                      </label>
                      <label className="batch-shipment-field batch-shipment-field--note">
                        <span>Observacao</span>
                        <input
                          value={shipmentNotes[batch.id] ?? ''}
                          onChange={(event) =>
                            setShipmentNotes((current) => ({ ...current, [batch.id]: event.target.value }))
                          }
                          placeholder="Ex.: enviado com romaneio ou responsavel"
                          aria-label={`Observacao de envio do lote ${batch.id}`}
                        />
                      </label>
                    </div>

                    <div className="product-card-actions batch-action-bar">
                      <button className="secondary-button" type="button" onClick={() => openLabels(batch)}>
                        Exportar etiquetas
                      </button>
                      <button
                        className="secondary-button"
                        type="button"
                        disabled={busyBatchId === batch.id}
                        onClick={() => updateBatch(batch.id, () => markBatchLabelsPrinted(batch.id))}
                      >
                        Marcar impressas
                      </button>
                      <button
                        className="secondary-button"
                        type="button"
                        disabled={busyBatchId === batch.id}
                        onClick={() => updateBatch(batch.id, () => markBatchCataloged(batch.id))}
                      >
                        Catalogado
                      </button>
                      <button
                        className="action-button"
                        type="button"
                        disabled={busyBatchId === batch.id || !shipmentDates[batch.id]}
                        onClick={() =>
                          updateBatch(batch.id, () =>
                            markBatchSentToStore(batch.id, {
                              sentToStoreAt: shipmentDates[batch.id],
                              note: shipmentNotes[batch.id] ?? '',
                            }),
                          )
                        }
                      >
                        Enviado a loja
                      </button>
                    </div>
                  </article>
                )
              })
            )}
          </div>
        </section>
      </div>
    </main>
  )
}
