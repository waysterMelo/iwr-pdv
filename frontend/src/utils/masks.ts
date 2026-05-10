export function onlyDigits(value: string) {
  return value.replace(/\D/g, '')
}

export function maskCpf(value: string) {
  const digits = onlyDigits(value).slice(0, 11)
  return digits
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1-$2')
}

export function maskPhone(value: string) {
  const digits = onlyDigits(value).slice(0, 11)

  if (digits.length <= 2) {
    return digits
  }

  if (digits.length <= 6) {
    return digits.replace(/^(\d{2})(\d+)/, '$1 $2')
  }

  if (digits.length <= 10) {
    return digits.replace(/^(\d{2})(\d{4})(\d+)/, '$1 $2-$3')
  }

  return digits.replace(/^(\d{2})(\d{5})(\d+)/, '$1 $2-$3')
}
