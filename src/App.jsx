import React, { lazy, Suspense, useEffect, useRef } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'
import { PrivacyProvider } from './context/PrivacyContext'
import { MobileHeaderContext } from './context/MobileHeaderContext'
import Sidebar from './components/Sidebar'
import BottomNav from './components/BottomNav'
import MobileTopBar from './components/MobileTopBar'
import useIsMobile from './hooks/useIsMobile'
import useScrollDirection from './hooks/useScrollDirection'
import Login from './pages/Login'

function lazyRetry(importFn) {
  return lazy(() =>
    importFn().catch((error) => {
      const isChunkError = /loading chunk|failed to fetch dynamically imported module/i.test(error.message)
      const hasReloaded = sessionStorage.getItem('chunk_reload')
      if (isChunkError && !hasReloaded) {
        sessionStorage.setItem('chunk_reload', '1')
        window.location.reload()
        return new Promise(() => {})
      }
      sessionStorage.removeItem('chunk_reload')
      throw error
    })
  )
}

const Carga = lazyRetry(() => import('./pages/Carga'))
const Dashboard = lazyRetry(() => import('./pages/Dashboard'))
const Evolucion = lazyRetry(() => import('./pages/Evolucion'))
const Gastos = lazyRetry(() => import('./pages/Gastos'))
const Detallado = lazyRetry(() => import('./pages/Detallado'))
const Historial = lazyRetry(() => import('./pages/Historial'))
const Configuracion = lazyRetry(() => import('./pages/Configuracion'))
const AnalyticsHub = lazyRetry(() => import('./pages/AnalyticsHub'))
const HistorialHub = lazyRetry(() => import('./pages/HistorialHub'))
const Pendientes = lazyRetry(() => import('./pages/Pendientes'))

function PageLoader() {
  return (
    <div style={{
      height: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: 'var(--text-muted)',
    }}>
      Cargando...
    </div>
  )
}

class ChunkErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--text-primary)',
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ marginBottom: 12, color: 'var(--text-secondary)' }}>
              Error al cargar la página.
            </div>
            <button
              onClick={() => window.location.reload()}
              style={{
                padding: '8px 20px',
                borderRadius: 'var(--radius-md)',
                border: 'none',
                background: 'var(--color-accent)',
                color: '#fff',
                cursor: 'pointer',
                fontFamily: 'inherit',
                fontSize: 14,
              }}
            >
              Recargar
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

function AppLayout() {
  const isMobile = useIsMobile()
  const mainRef = useRef(null)
  const hidden = useScrollDirection(isMobile ? mainRef : { current: null })

  return (
    <MobileHeaderContext.Provider value={{ hidden }}>
      <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
        <Sidebar />
        <main ref={mainRef} style={{
          flex: 1,
          marginLeft: isMobile ? 0 : 'var(--sidebar-width)',
          height: '100vh',
          overflow: isMobile ? 'auto' : 'hidden',
          transition: 'margin-left 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
          background: 'var(--bg-primary)',
          paddingBottom: isMobile ? 64 : 0,
          boxSizing: 'border-box',
        }}>
          {isMobile && <MobileTopBar hidden={hidden} />}
          <ChunkErrorBoundary>
            <Suspense fallback={<PageLoader />}>
              <Routes>
                <Route path="/carga" element={<Carga />} />
                {/* Desktop routes (sidebar) */}
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/evolucion" element={<Evolucion />} />
                <Route path="/gastos" element={<Gastos />} />
                <Route path="/detallado" element={<Detallado />} />
                <Route path="/historial" element={<Historial />} />
                <Route path="/configuracion" element={<Configuracion />} />
                {/* Mobile hub routes (bottom nav) */}
                <Route path="/analytics" element={<AnalyticsHub />}>
                  <Route index element={<Navigate to="dashboard" replace />} />
                  <Route path="dashboard" element={<Dashboard />} />
                  <Route path="evolucion" element={<Evolucion />} />
                  <Route path="gastos" element={<Gastos />} />
                </Route>
                <Route path="/transacciones" element={<HistorialHub />}>
                  <Route index element={<Navigate to="historial" replace />} />
                  <Route path="historial" element={<Historial />} />
                  <Route path="detallado" element={<Detallado />} />
                </Route>
                <Route path="/pendientes" element={<Pendientes />} />
                <Route path="*" element={<Navigate to="/carga" replace />} />
              </Routes>
            </Suspense>
          </ChunkErrorBoundary>
        </main>
        {isMobile && <BottomNav />}
      </div>
    </MobileHeaderContext.Provider>
  )
}

function AuthGate() {
  const { user, loading, isRecovery, setIsRecovery } = useAuth()

  if (loading) {
    return (
      <div style={{
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg-primary)',
        color: 'var(--text-muted)',
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ marginBottom: 12 }}><img src="/icons/icon-192x192.png" alt="Finanzas" style={{ width: 48, height: 48 }} /></div>
          <div>Cargando...</div>
        </div>
      </div>
    )
  }

  if (!user) return <Login />

  // If password recovery, redirect to settings
  if (isRecovery) {
    setIsRecovery(false)
    return <Navigate to="/configuracion" replace />
  }

  return <AppLayout />
}

export default function App() {
  useEffect(() => {
    sessionStorage.removeItem('chunk_reload')
  }, [])

  return (
    <BrowserRouter>
      <ThemeProvider>
        <PrivacyProvider>
          <AuthProvider>
            <AuthGate />
          </AuthProvider>
        </PrivacyProvider>
      </ThemeProvider>
    </BrowserRouter>
  )
}
