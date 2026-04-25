const brlFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})

const dateTimeFormatter = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'short',
  timeStyle: 'short',
})

export function formatCurrency(value: number | null | undefined) {
  return brlFormatter.format(value ?? 0)
}

export function formatDateTime(value: string) {
  return dateTimeFormatter.format(new Date(value))
}

export function formatNullableDateTime(value: string | null | undefined, fallback = '-') {
  return value ? formatDateTime(value) : fallback
}
