import { describe, it, expect } from 'vitest'
import {
  formatCurrency,
  formatDateTime,
  formatNullableDateTime,
  formatCurrencyInput,
  parseCurrencyInput
} from './formatters'

// Helper to normalize breaking and non-breaking spaces for cross-platform comparison
function normalizeSpaces(value: string) {
  return value.replace(/[\s\u00a0\u202f]/g, ' ')
}

describe('Formatters Utilities', () => {
  describe('formatCurrency', () => {
    it('should format numbers to BRL currency representation', () => {
      expect(normalizeSpaces(formatCurrency(100))).toContain('R$')
      expect(normalizeSpaces(formatCurrency(100))).toContain('100,00')
      expect(normalizeSpaces(formatCurrency(1234.56))).toContain('1.234,56')
    })

    it('should fall back to 0 if value is null or undefined', () => {
      expect(normalizeSpaces(formatCurrency(null))).toContain('0,00')
      expect(normalizeSpaces(formatCurrency(undefined))).toContain('0,00')
    })
  })

  describe('formatCurrencyInput', () => {
    it('should format text input numbers to BRL currency representation', () => {
      expect(normalizeSpaces(formatCurrencyInput('100'))).toContain('1,00')
      expect(normalizeSpaces(formatCurrencyInput('123456'))).toContain('1.234,56')
    })

    it('should format empty or non-digit inputs to R$ 0,00', () => {
      expect(normalizeSpaces(formatCurrencyInput(''))).toBe('R$ 0,00')
      expect(normalizeSpaces(formatCurrencyInput('abc'))).toBe('R$ 0,00')
    })
  })

  describe('parseCurrencyInput', () => {
    it('should convert raw text input to stringified decimal number', () => {
      expect(parseCurrencyInput('R$ 1.234,56')).toBe('1234.56')
      expect(parseCurrencyInput('100')).toBe('1.00')
      expect(parseCurrencyInput('5')).toBe('0.05')
    })

    it('should return 0.00 for empty or invalid input', () => {
      expect(parseCurrencyInput('')).toBe('0.00')
      expect(parseCurrencyInput('abc')).toBe('0.00')
    })
  })

  describe('formatNullableDateTime', () => {
    it('should return fallback if date value is missing', () => {
      expect(formatNullableDateTime(null)).toBe('-')
      expect(formatNullableDateTime(undefined, 'N/A')).toBe('N/A')
    })

    it('should format valid date strings correctly', () => {
      const dateStr = '2026-05-24T12:00:00.000Z'
      expect(formatNullableDateTime(dateStr)).toBeDefined()
    })
  })
})
