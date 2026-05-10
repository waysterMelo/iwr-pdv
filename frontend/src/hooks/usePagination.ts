import { useEffect, useMemo, useState } from 'react'

export function usePagination<T>(items: T[], pageSize = 8) {
  const [page, setPage] = useState(0)
  const totalPages = Math.max(Math.ceil(items.length / pageSize), 1)

  useEffect(() => {
    setPage((current) => Math.min(current, totalPages - 1))
  }, [totalPages])

  const pageItems = useMemo(() => {
    const start = page * pageSize
    return items.slice(start, start + pageSize)
  }, [items, page, pageSize])

  return {
    page,
    pageItems,
    pageSize,
    setPage,
    totalPages,
    totalItems: items.length,
  }
}
