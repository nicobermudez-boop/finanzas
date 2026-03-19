import { createContext, useContext, useState, useCallback, useMemo } from 'react'

const PrivacyContext = createContext({})

// eslint-disable-next-line react-refresh/only-export-components
export const usePrivacy = () => useContext(PrivacyContext)

export function PrivacyProvider({ children }) {
  const [hideNumbers, setHideNumbers] = useState(() => {
    if (typeof window === 'undefined') return false
    return localStorage.getItem('hide-numbers') === 'true'
  })

  const toggleHideNumbers = useCallback(() => {
    setHideNumbers(prev => {
      const next = !prev
      localStorage.setItem('hide-numbers', String(next))
      return next
    })
  }, [])

  const value = useMemo(
    () => ({ hideNumbers, toggleHideNumbers }),
    [hideNumbers, toggleHideNumbers]
  )

  return (
    <PrivacyContext.Provider value={value}>
      {children}
    </PrivacyContext.Provider>
  )
}
