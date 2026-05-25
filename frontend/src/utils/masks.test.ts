import { describe, it, expect } from 'vitest'
import { onlyDigits, maskCpf, maskPhone } from './masks'

describe('Masks Utilities', () => {
  describe('onlyDigits', () => {
    it('should remove all non-digit characters', () => {
      expect(onlyDigits('123-456.789-00')).toBe('12345678900')
      expect(onlyDigits('(11) 99999-9999')).toBe('11999999999')
      expect(onlyDigits('abc123def456')).toBe('123456')
    })

    it('should return empty string if no digits are present', () => {
      expect(onlyDigits('abc-def')).toBe('')
    })
  })

  describe('maskCpf', () => {
    it('should format a complete CPF correctly', () => {
      expect(maskCpf('12345678900')).toBe('123.456.789-00')
      expect(maskCpf('123.456.789-00')).toBe('123.456.789-00')
    })

    it('should format partial CPF correctly', () => {
      expect(maskCpf('123')).toBe('123')
      expect(maskCpf('1234')).toBe('123.4')
      expect(maskCpf('1234567')).toBe('123.456.7')
      expect(maskCpf('1234567890')).toBe('123.456.789-0')
    })
  })

  describe('maskPhone', () => {
    it('should format landline / standard phone numbers', () => {
      expect(maskPhone('1133334444')).toBe('11 3333-4444')
    })

    it('should format mobile phone numbers with 9 digits', () => {
      expect(maskPhone('11999998888')).toBe('11 99999-8888')
    })

    it('should handle partial phone numbers gracefully', () => {
      expect(maskPhone('1')).toBe('1')
      expect(maskPhone('11')).toBe('11')
      expect(maskPhone('119')).toBe('11 9')
      expect(maskPhone('1199999')).toBe('11 9999-9')
    })
  })
})
