export function getErrorMessage(error: unknown, fallbackMessage = 'Nao foi possivel concluir a operacao.') {
  if (error instanceof Error) {
    return error.message
  }

  return fallbackMessage
}
