import { useState, type FormEvent } from 'react'
import { useAppMessage } from '../hooks/useAppMessage'
import { login } from '../services/authService'
import type { AuthUser } from '../types/auth'
import { getErrorMessage } from '../utils/errors'

type LoginPageProps = {
  onAuthenticated: (user: AuthUser) => void
}

export function LoginPage({ onAuthenticated }: LoginPageProps) {
  const { notify } = useAppMessage()
  const [username, setUsername] = useState('admin')
  const [password, setPassword] = useState('')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!username.trim() || !password) {
      const message = 'Informe usuario e senha para entrar.'
      setErrorMessage(message)
      notify({
        type: 'warning',
        title: 'Dados obrigatorios',
        message,
      })
      return
    }

    setIsSubmitting(true)
    setErrorMessage(null)

    try {
      const response = await login(username.trim(), password)
      onAuthenticated(response.user)
    } catch (error) {
      const message = getErrorMessage(error, 'Nao foi possivel entrar no sistema.')
      setErrorMessage(message)
      notify({
        type: 'error',
        title: 'Erro ao entrar',
        message,
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="login-shell">
      <section className="login-card" aria-labelledby="login-title">
        <div className="login-brand">
          <span className="brand-mark">IWR.</span>
          <span className="brand-caption">Atelier PDV</span>
        </div>

        <div className="login-copy">
          <span className="eyebrow">Acesso restrito</span>
          <h1 id="login-title">Entre para operar o caixa</h1>
          <p>
            Produtos, vendas e historico ficam protegidos por sessao. Use o usuario
            inicial e altere a senha padrao antes da entrega final ao cliente.
          </p>
        </div>

        <form className="login-form" onSubmit={handleSubmit}>
          <div className="field-group">
            <label htmlFor="loginUsername">Usuario</label>
            <input
              id="loginUsername"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              autoComplete="username"
              placeholder="admin"
            />
          </div>

          <div className="field-group">
            <label htmlFor="loginPassword">Senha</label>
            <input
              id="loginPassword"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              placeholder="Digite sua senha"
            />
            <small className="field-hint">Padrao local: admin / admin123.</small>
          </div>

          {errorMessage ? (
            <div className="feedback-message feedback-message--error">{errorMessage}</div>
          ) : null}

          <button className="action-button" type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Entrando...' : 'Entrar no sistema'}
          </button>
        </form>
      </section>
    </main>
  )
}
