type PaginationControlsProps = {
  itemLabel: string
  page: number
  pageSize: number
  totalItems: number
  totalPages: number
  onPageChange: (page: number) => void
}

export function PaginationControls({
  itemLabel,
  page,
  pageSize,
  totalItems,
  totalPages,
  onPageChange,
}: PaginationControlsProps) {
  if (totalItems <= pageSize) {
    return null
  }

  const startItem = page * pageSize + 1
  const endItem = Math.min((page + 1) * pageSize, totalItems)

  return (
    <nav className="pagination-controls" aria-label={`Paginacao de ${itemLabel}`}>
      <span>
        {startItem}-{endItem} de {totalItems} {itemLabel}
      </span>
      <div>
        <button
          className="secondary-button"
          type="button"
          disabled={page === 0}
          onClick={() => onPageChange(Math.max(page - 1, 0))}
        >
          Anterior
        </button>
        <strong>
          {page + 1}/{totalPages}
        </strong>
        <button
          className="secondary-button"
          type="button"
          disabled={page + 1 >= totalPages}
          onClick={() => onPageChange(Math.min(page + 1, totalPages - 1))}
        >
          Proxima
        </button>
      </div>
    </nav>
  )
}
