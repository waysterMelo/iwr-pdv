import { type ChangeEvent, type InputHTMLAttributes } from 'react'

type PercentInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> & {
  value: string
  onChange: (value: string) => void
}

function formatPercent(value: string) {
  const digits = value.replace(/\D/g, '')
  if (!digits) return '0,00 %'
  const numberValue = Number(digits) / 100
  return new Intl.NumberFormat('pt-BR', {
    style: 'decimal',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(numberValue) + ' %'
}

function parsePercent(value: string) {
  const digits = value.replace(/\D/g, '')
  if (!digits) return '0.00'
  const numberValue = Number(digits) / 100
  return numberValue.toFixed(2)
}

export function PercentInput({ value, onChange, ...props }: PercentInputProps) {
  const displayValue = formatPercent(value || '0.00')

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const rawInput = event.target.value
    const nextValue = parsePercent(rawInput)

    onChange(nextValue)
  }

  return (
    <input
      {...props}
      type="text"
      inputMode="numeric"
      value={displayValue}
      onChange={handleChange}
    />
  )
}
