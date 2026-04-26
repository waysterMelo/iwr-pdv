import { useSyncExternalStore } from 'react'

export function useMediaQuery(query: string) {
  return useSyncExternalStore(
    (notify) => {
      const mediaQuery = window.matchMedia(query)
      mediaQuery.addEventListener('change', notify)

      return () => mediaQuery.removeEventListener('change', notify)
    },
    () => window.matchMedia(query).matches,
    () => false,
  )
}
