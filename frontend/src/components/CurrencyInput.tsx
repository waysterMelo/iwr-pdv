import { type ChangeEvent, useEffect, useState, type InputHTMLAttributes } from 'react'
import { formatCurrencyInput, parseCurrencyInput } from '../utils/formatters'

type CurrencyInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> & {
  value: string
  onChange: (value: string) => void
}

export function CurrencyInput({ value, onChange, ...props }: CurrencyInputProps) {
  const [displayValue, setDisplayValue] = useState(() => formatCurrencyInput(value || '0.00'))

  useEffect(() => {
    // If the external value resets (e.g., cleared after submit), we sync display.
    // Also happens on initial mount or when programmatically changed.
    setDisplayValue(formatCurrencyInput(value || '0.00'))
  }, [value])

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const rawInput = event.target.value
    const nextDisplay = formatCurrencyInput(rawInput)
    const nextValue = parseCurrencyInput(rawInput)
    
    setDisplayValue(nextDisplay)
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
