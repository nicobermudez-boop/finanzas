import React, { lazy, Suspense, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'
import { PrivacyProvider } from './context/PrivacyContext'
import Sidebar from './components/Sidebar'
import useIsMobile from './hooks/useIsMobile'
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

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <Sidebar />
      <main style={{
        flex: 1,
        marginLeft: isMobile ? 0 : 'var(--sidebar-width)',
        height: '100vh',
        overflow: 'hidden',
        transition: 'margin-left 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
        background: 'var(--bg-primary)',
      }}>
        <ChunkErrorBoundary>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/carga" element={<Carga />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/evolucion" element={<Evolucion />} />
              <Route path="/gastos" element={<Gastos />} />
              <Route path="/detallado" element={<Detallado />} />
              <Route path="/historial" element={<Historial />} />
              <Route path="/configuracion" element={<Configuracion />} />
              <Route path="*" element={<Navigate to="/carga" replace />} />
            </Routes>
          </Suspense>
        </ChunkErrorBoundary>
      </main>
    </div>
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
          <div style={{ fontSize: 32, marginBottom: 12 }}>💰</div>
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
