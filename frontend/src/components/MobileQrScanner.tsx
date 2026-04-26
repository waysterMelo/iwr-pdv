import { useEffect, useRef, useState } from 'react'
import { BrowserQRCodeReader, type IScannerControls } from '@zxing/browser'

type MobileQrScannerProps = {
  active: boolean
  onClose: () => void
  onRead: (code: string) => Promise<void> | void
}

const duplicateReadWindowMs = 1800

export function MobileQrScanner({ active, onClose, onRead }: MobileQrScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const controlsRef = useRef<IScannerControls | null>(null)
  const inFlightRef = useRef(false)
  const lastReadRef = useRef({ code: '', time: 0 })
  const onReadRef = useRef(onRead)
  const [scannerStatus, setScannerStatus] = useState('Aguardando permissao da camera...')
  const [scannerError, setScannerError] = useState<string | null>(null)

  useEffect(() => {
    onReadRef.current = onRead
  }, [onRead])

  function stopScanner() {
    controlsRef.current?.stop()
    controlsRef.current = null

    const videoElement = videoRef.current
    const stream = videoElement?.srcObject

    if (stream instanceof MediaStream) {
      stream.getTracks().forEach((track) => track.stop())
    }

    if (videoElement) {
      videoElement.srcObject = null
    }

    BrowserQRCodeReader.releaseAllStreams()
  }

  useEffect(() => {
    if (!active) {
      stopScanner()
      return
    }

    let isDisposed = false
    const codeReader = new BrowserQRCodeReader()

    async function startScanner() {
      if (!videoRef.current) {
        return
      }

      if (!window.isSecureContext) {
        setScannerError('Camera indisponivel fora de HTTPS ou localhost.')
        return
      }

      try {
        setScannerError(null)
        setScannerStatus('Camera ativa')

        controlsRef.current = await codeReader.decodeFromConstraints(
          {
            audio: false,
            video: {
              facingMode: { ideal: 'environment' },
            },
          },
          videoRef.current,
          async (result) => {
            if (!result || isDisposed || inFlightRef.current) {
              return
            }

            const code = result.getText().trim()
            const now = Date.now()
            const isDuplicate =
              lastReadRef.current.code === code && now - lastReadRef.current.time < duplicateReadWindowMs

            if (!code || isDuplicate) {
              return
            }

            inFlightRef.current = true
            lastReadRef.current = { code, time: now }
            setScannerStatus(`Codigo lido: ${code}`)

            try {
              await onReadRef.current(code)
            } finally {
              window.setTimeout(() => {
                inFlightRef.current = false
              }, 650)
            }
          },
        )
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Nao foi possivel abrir a camera.'
        setScannerError(message)
        stopScanner()
      }
    }

    void startScanner()

    return () => {
      isDisposed = true
      stopScanner()
    }
  }, [active])

  return (
    <div className="mobile-scanner-sheet" role="dialog" aria-modal="true" aria-labelledby="mobile-scanner-title">
      <header className="mobile-scanner-header">
        <div>
          <span className="eyebrow">Camera</span>
          <h2 id="mobile-scanner-title">Escanear produto</h2>
        </div>
        <button className="mobile-icon-button" type="button" onClick={onClose} aria-label="Fechar camera">
          X
        </button>
      </header>

      <div className="mobile-camera-frame">
        <video ref={videoRef} muted playsInline aria-label="Camera para leitura de QR Code" />
        <span className="mobile-scan-target" aria-hidden="true" />
      </div>

      {scannerError ? (
        <div className="feedback-message feedback-message--error">{scannerError}</div>
      ) : (
        <div className="feedback-message feedback-message--success">{scannerStatus}</div>
      )}
    </div>
  )
}
