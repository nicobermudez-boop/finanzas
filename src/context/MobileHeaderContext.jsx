import { createContext, useContext } from 'react'

export const MobileHeaderContext = createContext({ hidden: false })

export function useMobileHeader() {
  return useContext(MobileHeaderContext)
}
