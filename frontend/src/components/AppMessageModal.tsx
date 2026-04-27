import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react'
import { AppMessageContext, type AppMessageOptions, type AppMessageType } from '../hooks/useAppMessage'

type AppMessageState = AppMessageOptions & {
  mode: 'message' | 'confirm'
}

const typeConfig: Record<AppMessageType, { eyebrow: string; defaultTitle: string; symbol: string }> = {
  success: {
    eyebrow: 'Sucesso',
    defaultTitle: 'Operacao concluida',
    symbol: 'OK',
  },
  error: {
    eyebrow: 'Erro',
    defaultTitle: 'Algo precisa de atencao',
    symbol: '!',
  },
  warning: {
    eyebrow: 'Alerta',
    defaultTitle: 'Confirme antes de continuar',
    symbol: 'AT',
  },
  info: {
    eyebrow: 'Aviso',
    defaultTitle: 'Informacao',
    symbol: 'IN',
  },
}

export function AppMessageProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState<AppMessageState | null>(null)
  const pendingResolver = useRef<((confirmed: boolean) => void) | null>(null)

  const resolvePending = useCallback((confirmed: boolean) => {
    pendingResolver.current?.(confirmed)
    pendingResolver.current = null
  }, [])

  const close = useCallback(() => {
    resolvePending(false)
    setMessage(null)
  }, [resolvePending])

  const notify = useCallback((options: AppMessageOptions) => {
    resolvePending(false)
    setMessage({ ...options, mode: 'message' })
  }, [resolvePending])

  const confirm = useCallback((options: AppMessageOptions) => {
    resolvePending(false)
    setMessage({ ...options, mode: 'confirm' })

    return new Promise<boolean>((resolve) => {
      pendingResolver.current = resolve
    })
  }, [resolvePending])

  function handleConfirm() {
    resolvePending(true)
    setMessage(null)
  }

  const value = useMemo(() => ({ notify, confirm, close }), [close, confirm, notify])
  const config = message ? typeConfig[message.type] : null

  return (
    <AppMessageContext.Provider value={value}>
      {children}
      {message && config ? (
        <div className="app-message-backdrop" role="presentation" onClick={close}>
          <section
            className={`app-message-modal app-message-modal--${message.type}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="app-message-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="app-message-symbol" aria-hidden="true">
              {config.symbol}
            </div>
            <div className="app-message-content">
              <span className="app-message-eyebrow">{config.eyebrow}</span>
              <h2 id="app-message-title">{message.title ?? config.defaultTitle}</h2>
              <p>{message.message}</p>
            </div>
            <div className="app-message-actions">
              {message.mode === 'confirm' ? (
                <button className="secondary-button" type="button" onClick={close}>
                  {message.cancelLabel ?? 'Cancelar'}
                </button>
              ) : null}
              <button className="action-button" type="button" onClick={message.mode === 'confirm' ? handleConfirm : close}>
                {message.confirmLabel ?? (message.mode === 'confirm' ? 'Confirmar' : 'Entendi')}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </AppMessageContext.Provider>
  )
}
