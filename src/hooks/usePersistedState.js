import { useState, useEffect } from 'react'

export function usePersistedState(key, defaultValue) {
  const [state, setState] = useState(() => {
    try {
      const stored = localStorage.getItem(key)
      if (stored !== null) return JSON.parse(stored)
      return typeof defaultValue === 'function' ? defaultValue() : defaultValue
    } catch {
      return typeof defaultValue === 'function' ? defaultValue() : defaultValue
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
