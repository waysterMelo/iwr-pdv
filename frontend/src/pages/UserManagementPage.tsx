import { useEffect, useState, type FormEvent } from 'react'
import {
  createUser,
  getUsers,
  updateUser,
  updateUserPassword,
} from '../services/authService'
import type { ManagedUser, UserRole } from '../types/auth'
import { getErrorMessage } from '../utils/errors'
import { formatDateTime } from '../utils/formatters'
import { useAppMessage } from '../hooks/useAppMessage'

type UserFormState = {
  username: string
  displayName: string
  password: string
  role: UserRole
  active: 'true' | 'false'
}

const initialFormState: UserFormState = {
  username: '',
  displayName: '',
  password: '',
  role: 'OPERATOR',
  active: 'true',
}

function getRoleLabel(role: UserRole) {
  return role === 'ADMIN' ? 'Admin' : 'Vendedor'
}

function toFormState(user: ManagedUser): UserFormState {
  return {
    username: user.username,
    displayName: user.displayName,
    password: '',
    role: user.role,
    active: String(user.active) as 'true' | 'false',
  }
}

function validateForm(form: UserFormState, editingUserId: number | null) {
  if (!form.username.trim()) {
    return 'Informe o usuario.'
  }

  if (!form.displayName.trim()) {
    return 'Informe o nome do usuario.'
  }

  if (editingUserId === null && form.password.length < 6) {
    return 'Informe uma senha com pelo menos 6 caracteres.'
  }

  if (editingUserId !== null && form.password.length > 0 && form.password.length < 6) {
    return 'A nova senha precisa ter pelo menos 6 caracteres.'
  }

  return null
}

export function UserManagementPage() {
  const { notify } = useAppMessage()
  const [users, setUsers] = useState<ManagedUser[]>([])
  const [form, setForm] = useState<UserFormState>(initialFormState)
  const [editingUserId, setEditingUserId] = useState<number | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  useEffect(() => {
    void loadUsers()
  }, [])

  async function loadUsers() {
    setIsLoading(true)

    try {
      setUsers(await getUsers())
      setErrorMessage(null)
    } catch (error) {
      setErrorMessage(getErrorMessage(error, 'Nao foi possivel carregar usuarios.'))
    } finally {
      setIsLoading(false)
    }
  }

  function resetForm(clearMessages = true) {
    setForm(initialFormState)
    setEditingUserId(null)

    if (clearMessages) {
      setErrorMessage(null)
      setSuccessMessage(null)
    }
  }

  function handleEdit(user: ManagedUser) {
    setEditingUserId(user.id)
    setForm(toFormState(user))
    setErrorMessage(null)
    setSuccessMessage(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSuccessMessage(null)

    const validationMessage = validateForm(form, editingUserId)
    if (validationMessage) {
      setErrorMessage(validationMessage)
      notify({
        type: 'warning',
        title: 'Revise o usuario',
        message: validationMessage,
      })
      return
    }

    setIsSaving(true)
    setErrorMessage(null)

    try {
      if (editingUserId === null) {
        await createUser({
          username: form.username.trim(),
          displayName: form.displayName.trim(),
          password: form.password,
          role: form.role,
          active: form.active === 'true',
        })
        setSuccessMessage('Usuario cadastrado com sucesso.')
        notify({
          type: 'success',
          title: 'Usuario cadastrado',
          message: 'Usuario cadastrado com sucesso.',
        })
      } else {
        await updateUser(editingUserId, {
          username: form.username.trim(),
          displayName: form.displayName.trim(),
          role: form.role,
          active: form.active === 'true',
        })

        if (form.password) {
          await updateUserPassword(editingUserId, { password: form.password })
        }

        setSuccessMessage('Usuario atualizado com sucesso.')
        notify({
          type: 'success',
          title: 'Usuario atualizado',
          message: 'Usuario atualizado com sucesso.',
        })
      }

      resetForm(false)
      await loadUsers()
    } catch (error) {
      const message = getErrorMessage(error, 'Nao foi possivel salvar usuario.')
      setErrorMessage(message)
      notify({
        type: 'error',
        title: 'Erro ao salvar usuario',
        message,
      })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <main className="app-shell">
      <div className="app-container">
        <section className="hero-panel">
          <header className="hero-header">
            <div className="hero-copy">
              <span className="eyebrow">Acessos</span>
              <h1>Usuarios e permissoes</h1>
              <p>Cadastre vendedores e administradores para controlar o acesso aos menus do PDV.</p>
            </div>
            <div className="hero-highlight">
              <div className="metric-pill">
                <strong>{users.length}</strong>
                <span>usuarios</span>
              </div>
              <div className="metric-pill">
                <strong>{users.filter((user) => user.role === 'ADMIN').length}</strong>
                <span>admins</span>
              </div>
              <div className="metric-pill">
                <strong>{users.filter((user) => user.role === 'OPERATOR').length}</strong>
                <span>vendedores</span>
              </div>
            </div>
          </header>
        </section>

        <div className="content-grid">
          <section className="product-form-panel">
            <header className="section-header">
              <div>
                <h2>{editingUserId === null ? 'Novo usuario' : 'Editar usuario'}</h2>
                <p>Somente administradores podem cadastrar ou alterar usuarios.</p>
              </div>
            </header>

            <form className="product-form" onSubmit={handleSubmit}>
              <div className="form-grid">
                <div className="field-group">
                  <label htmlFor="userDisplayName">Nome</label>
                  <input
                    id="userDisplayName"
                    value={form.displayName}
                    onChange={(event) => setForm((current) => ({ ...current, displayName: event.target.value }))}
                    placeholder="Ex.: Maria Silva"
                  />
                </div>
                <div className="field-group">
                  <label htmlFor="username">Usuario</label>
                  <input
                    id="username"
                    value={form.username}
                    onChange={(event) => setForm((current) => ({ ...current, username: event.target.value }))}
                    placeholder="Ex.: maria"
                  />
                </div>
                <div className="field-group">
                  <label htmlFor="userRole">Nivel</label>
                  <select
                    id="userRole"
                    value={form.role}
                    onChange={(event) => setForm((current) => ({ ...current, role: event.target.value as UserRole }))}
                  >
                    <option value="OPERATOR">Vendedor</option>
                    <option value="ADMIN">Admin</option>
                  </select>
                </div>
                <div className="field-group">
                  <label htmlFor="userActive">Status</label>
                  <select
                    id="userActive"
                    value={form.active}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, active: event.target.value as 'true' | 'false' }))
                    }
                  >
                    <option value="true">Ativo</option>
                    <option value="false">Inativo</option>
                  </select>
                </div>
                <div className="field-group field-group--full">
                  <label htmlFor="userPassword">{editingUserId === null ? 'Senha' : 'Nova senha'}</label>
                  <input
                    id="userPassword"
                    type="password"
                    value={form.password}
                    onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
                    placeholder={editingUserId === null ? 'Minimo 6 caracteres' : 'Deixe vazio para manter'}
                  />
                </div>
              </div>

              {errorMessage ? <div className="feedback-message feedback-message--error">{errorMessage}</div> : null}
              {successMessage ? (
                <div className="feedback-message feedback-message--success">{successMessage}</div>
              ) : null}

              <div className="form-actions">
                <button className="action-button" type="submit" disabled={isSaving}>
                  {isSaving ? 'Salvando...' : editingUserId === null ? 'Cadastrar usuario' : 'Salvar usuario'}
                </button>
                <button className="secondary-button" type="button" onClick={() => resetForm()} disabled={isSaving}>
                  Limpar formulario
                </button>
              </div>
            </form>
          </section>

          <section className="product-list-panel">
            <header className="section-header">
              <div>
                <h2>Usuarios cadastrados</h2>
                <p>Vendedores acessam Vendas e Caixa. Admins acessam todos os menus.</p>
              </div>
            </header>

            {isLoading ? (
              <div className="product-empty">Carregando usuarios...</div>
            ) : users.length === 0 ? (
              <div className="product-empty">Nenhum usuario cadastrado.</div>
            ) : (
              <div className="product-list">
                {users.map((user) => (
                  <article className="product-card" key={user.id}>
                    <div className="product-card-header">
                      <div>
                        <h3>{user.displayName}</h3>
                        <span className="product-card-code">{user.username}</span>
                      </div>
                      <div className="product-card-badges">
                        <span className="status-badge status-badge--up">{getRoleLabel(user.role)}</span>
                        <span className={`status-badge ${user.active ? 'status-badge--up' : 'status-badge--down'}`}>
                          {user.active ? 'Ativo' : 'Inativo'}
                        </span>
                      </div>
                    </div>
                    <div className="product-card-grid">
                      <div>
                        <span>Nivel</span>
                        <strong>{getRoleLabel(user.role)}</strong>
                      </div>
                      <div>
                        <span>Criado</span>
                        <strong>{formatDateTime(user.createdAt)}</strong>
                      </div>
                      <div>
                        <span>Atualizado</span>
                        <strong>{formatDateTime(user.updatedAt)}</strong>
                      </div>
                    </div>
                    <div className="product-card-actions">
                      <button className="secondary-button" type="button" onClick={() => handleEdit(user)}>
                        Editar
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  )
}
