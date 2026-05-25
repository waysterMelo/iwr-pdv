import type { PaymentMethod } from './sale'
import type { PromissoryNoteStatus } from './promissoryNote'

export type AdminDashboardTopProduct = {
  productName: string
  productCode: string
  quantity: number
  totalRevenue: number
}

export type AdminDashboardSummary = {
  startDate: string
  endDate: string
  totalSold: number
  totalReceived: number
  totalCashSales: number
  totalPixSales: number
  totalDebitSales: number
  totalCreditSales: number
  totalPromissorySales: number
  saleCount: number
  averageTicket: number
  totalDiscounts: number
  openReceivables: number
  overdueReceivables: number
  dueTodayReceivables: number
  dueNext7DaysReceivables: number
  dueNext30DaysReceivables: number
  globalStockItems: number
  globalCostValue: number
  globalSaleValue: number
  totalCMV: number
  totalProfit: number
  topProducts: AdminDashboardTopProduct[]
}

export type AdminDashboardPaymentMethod = {
  paymentMethod: PaymentMethod
  soldAmount: number
  receivedAmount: number
  saleCount: number
  receiptCount: number
}

export type AdminDashboardReceivable = {
  noteId: number
  saleId: number
  customerName: string
  installmentNumber: number
  totalInstallments: number
  amount: number
  dueDate: string
  status: PromissoryNoteStatus
  paymentMethod: PaymentMethod | null
  paidAt: string | null
}

export type AdminDashboardTopCustomer = {
  customerId: number
  customerName: string
  openAmount: number
  openInstallments: number
}

export type AdminDashboardReceivableDay = {
  date: string
  amount: number
  count: number
}

export type AdminDashboardReceivables = {
  openAmount: number
  overdueAmount: number
  dueTodayAmount: number
  dueNext7DaysAmount: number
  dueNext30DaysAmount: number
  topCustomers: AdminDashboardTopCustomer[]
  calendarDays: AdminDashboardReceivableDay[]
  items: AdminDashboardReceivable[]
}

export type AdminDashboardFilters = {
  startDate: string
  endDate: string
}
