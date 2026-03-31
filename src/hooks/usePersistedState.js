import { useState, useEffect } from 'react'

export function usePersistedState(key, defaultValue) {
  const [state, setState] = useState(() => {
    try {
      const stored = localStorage.getItem(key)
      return stored !== null ? JSON.parse(stored) : defaultValue
    } catch {
      return defaultValue
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(state))
    } catch {
      // ignore storage errors (private mode, quota exceeded)
    }
  }, [key, state])

  return [state, setState]
}
