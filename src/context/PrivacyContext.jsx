import { createContext, useContext, useState, useCallback } from 'react'

const PrivacyContext = createContext({})

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

  return (
    <PrivacyContext.Provider value={{ hideNumbers, toggleHideNumbers }}>
      {children}
    </PrivacyContext.Provider>
  )
}
