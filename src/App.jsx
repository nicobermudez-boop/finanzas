import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'
import { PrivacyProvider } from './context/PrivacyContext'
import Sidebar from './components/Sidebar'
import Login from './pages/Login'
import Detallado from './pages/Detallado'
import Evolucion from './pages/Evolucion'
import Dashboard from './pages/Dashboard'
import Gastos from './pages/Gastos'
import Historial from './pages/Historial'
import Configuracion from './pages/Configuracion'
import Carga from './pages/Carga'

function AppLayout() {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

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
