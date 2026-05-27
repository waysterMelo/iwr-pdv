import type { PaymentMethod } from '../types/sale'

export const paymentMethodLabels: Record<PaymentMethod, string> = {
  CASH: 'Dinheiro',
  PIX: 'Pix',
  DEBIT_CARD: 'Cartão débito',
  CREDIT_CARD: 'Cartão crédito',
  PROMISSORY_NOTE: 'Nota promissória',
}

export function formatPaymentMethod(paymentMethod: PaymentMethod | null | undefined) {
  return paymentMethod ? paymentMethodLabels[paymentMethod] : '-'
}
