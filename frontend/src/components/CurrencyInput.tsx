import { type ChangeEvent, type InputHTMLAttributes } from 'react'
import { formatCurrencyInput, parseCurrencyInput } from '../utils/formatters'

type CurrencyInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> & {
  value: string
  onChange: (value: string) => void
}

export function CurrencyInput({ value, onChange, ...props }: CurrencyInputProps) {
  const displayValue = formatCurrencyInput(value || '0.00')

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const rawInput = event.target.value
    const nextValue = parseCurrencyInput(rawInput)

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
