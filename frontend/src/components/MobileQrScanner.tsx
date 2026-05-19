import { useEffect, useRef, useState } from 'react'
import { BarcodeFormat, BrowserMultiFormatReader, type IScannerControls } from '@zxing/browser'
import { DecodeHintType } from '@zxing/library'

type MobileQrScannerProps = {
  active: boolean
  onClose: () => void
  onRead: (code: string) => Promise<boolean> | boolean
}

const duplicateReadWindowMs = 1800
const barcodeHints = new Map<DecodeHintType, unknown>([
  [DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.CODE_128]],
  [DecodeHintType.TRY_HARDER, true],
])

export function MobileQrScanner({ active, onClose, onRead }: MobileQrScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const controlsRef = useRef<IScannerControls | null>(null)
  const inFlightRef = useRef(false)
  const lastReadRef = useRef({ code: '', time: 0 })
  const onCloseRef = useRef(onClose)
  const onReadRef = useRef(onRead)
  const [scannerStatus, setScannerStatus] = useState('Aguardando permissao da camera...')
  const [scannerError, setScannerError] = useState<string | null>(null)
  const [hasSuccessfulRead, setHasSuccessfulRead] = useState(false)

  useEffect(() => {
    onReadRef.current = onRead
  }, [onRead])

  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

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

    BrowserMultiFormatReader.releaseAllStreams()
  }

  useEffect(() => {
    if (!active) {
      stopScanner()
      return
    }

    let isDisposed = false
    const codeReader = new BrowserMultiFormatReader(barcodeHints)

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
        setHasSuccessfulRead(false)
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
            setScannerStatus('Codigo de barras lido. Atualizando carrinho...')

            try {
              const added = await onReadRef.current(code)

              if (added) {
                setHasSuccessfulRead(true)
                stopScanner()
                window.setTimeout(() => onCloseRef.current(), 450)
              } else {
                setScannerStatus('Produto nao adicionado. Tente novamente.')
              }
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

      <div className={`mobile-camera-frame ${hasSuccessfulRead ? 'mobile-camera-frame--success' : ''}`}>
        <video ref={videoRef} muted playsInline aria-label="Camera para leitura de codigo de barras" />
        <span className="mobile-scan-target" aria-hidden="true" />
        {hasSuccessfulRead ? <span className="mobile-scan-success" aria-hidden="true">OK</span> : null}
      </div>

      {scannerError ? (
        <div className="feedback-message feedback-message--error">{scannerError}</div>
      ) : (
        <div className="feedback-message feedback-message--success">{scannerStatus}</div>
      )}
    </div>
  )
}
