import { useState, useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'

export default function useScrollDirection(ref) {
  const [hidden, setHidden] = useState(false)
  const lastY = useRef(0)
  const location = useLocation()

  // Reset on route change
  useEffect(() => {
    setHidden(false)
    lastY.current = 0
  }, [location.pathname])

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const onScroll = () => {
      const y = el.scrollTop
      if (y > lastY.current && y > 50) {
        setHidden(true)
      } else if (y < lastY.current) {
        setHidden(false)
      }
      lastY.current = y
    }

    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [ref])

  return hidden
}
