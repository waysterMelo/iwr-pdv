import { createContext, useContext } from 'react'

export type AppMessageType = 'success' | 'error' | 'warning' | 'info'

export type AppMessageOptions = {
  type: AppMessageType
  title?: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
}

export type AppMessageContextValue = {
  notify: (options: AppMessageOptions) => void
  confirm: (options: AppMessageOptions) => Promise<boolean>
  close: () => void
}

export const AppMessageContext = createContext<AppMessageContextValue | null>(null)

export function useAppMessage() {
  const context = useContext(AppMessageContext)

  if (!context) {
    throw new Error('useAppMessage must be used inside AppMessageProvider.')
  }

  return context
}
