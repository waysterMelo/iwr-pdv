import { useEffect, useState } from 'react'
import { HealthStatusCard } from '../components/HealthStatusCard'
import { getHealthStatus, HttpRequestError } from '../services/healthService'
import type { HealthStatus } from '../types/health'

const stackItems = [
  {
    label: 'Frontend',
    title: 'React + TypeScript + Vite',
    description:
      'Base com tipagem forte, servicos centralizados e uma pagina inicial preparada para crescer sem acumular logica na interface.',
  },
  {
    label: 'Backend',
    title: 'Spring Boot + Java 21',
    description:
      'Estrutura organizada por camadas, healthcheck proprio, Flyway e tratamento global de erros para manter o codigo previsivel.',
  },
  {
    label: 'Banco',
    title: 'PostgreSQL + Flyway',
    description:
      'Conexao configurada por ambiente, migration inicial aplicada e caminho preparado para evolucao segura do schema.',
  },
]

const acceptanceItems = [
  'Frontend e backend iniciam com configuracao clara.',
  'Banco PostgreSQL sobe via Docker Compose.',
  'Migration inicial valida o fluxo de banco.',
  'Tela inicial consome o endpoint /health.',
  'Documentacao minima acompanha a fundacao tecnica.',
]

function getErrorMessage(error: unknown) {
  if (error instanceof HttpRequestError) {
    return error.message
  }

  if (error instanceof Error) {
    return error.message
  }

  return 'Nao foi possivel consultar o backend agora.'
}

export function SystemOverviewPage() {
  const [health, setHealth] = useState<HealthStatus | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  async function loadHealth(signal?: AbortSignal) {
    setIsLoading(true)

    try {
      const response = await getHealthStatus(signal)
      setHealth(response)
      setErrorMessage(null)
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return
      }

      setErrorMessage(getErrorMessage(error))
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    const controller = new AbortController()
    const timeoutId = window.setTimeout(() => {
      void loadHealth(controller.signal)
    }, 0)

    return () => {
      window.clearTimeout(timeoutId)
      controller.abort()
    }
  }, [])

  return (
    <main className="app-shell">
      <div className="app-container">
        <section className="hero-panel">
          <header className="hero-header">
            <div className="hero-copy">
              <span className="eyebrow">Sistema</span>
              <h1>Base tecnica do IWR PDV</h1>
              <p>
                Esta base mantem arquitetura organizada, migracoes, integracao frontend/backend
                e foco em codigo simples, legivel e pronto para operacao.
              </p>
            </div>

            <div className="hero-highlight">
              <div className="metric-pill">
                <strong>3 camadas</strong>
                <span>Controller, service e repository no backend</span>
              </div>
              <div className="metric-pill">
                <strong>1 contrato</strong>
                <span>Healthcheck consumido pelo frontend</span>
              </div>
            </div>
          </header>

          <div className="hero-grid">
            {stackItems.map((item) => (
              <article className="stack-card" key={item.title}>
                <span className="stack-label">{item.label}</span>
                <h2>{item.title}</h2>
                <p>{item.description}</p>
              </article>
            ))}
          </div>
        </section>

        <HealthStatusCard
          health={health}
          errorMessage={errorMessage}
          isLoading={isLoading}
          onRefresh={() => void loadHealth()}
        />

        <section className="acceptance-card">
          <h2>Checklist tecnico</h2>
          <p>
            A fundacao fica pronta quando ambiente, banco e integracao basica estiverem
            funcionando juntos.
          </p>
          <ul className="acceptance-list">
            {acceptanceItems.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  )
}
