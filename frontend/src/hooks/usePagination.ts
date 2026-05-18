import { useMemo, useState } from 'react'

export function usePagination<T>(items: T[], pageSize = 8) {
  const [page, setPage] = useState(0)
  const totalPages = Math.max(Math.ceil(items.length / pageSize), 1)
  const safePage = Math.min(page, totalPages - 1)

  const pageItems = useMemo(() => {
    const start = safePage * pageSize
    return items.slice(start, start + pageSize)
  }, [items, safePage, pageSize])

  return {
    page: safePage,
    pageItems,
    pageSize,
    setPage,
    totalPages,
    totalItems: items.length,
  }
}
