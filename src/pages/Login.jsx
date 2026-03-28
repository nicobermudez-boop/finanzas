import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'

export default function Login() {
  const { signIn, signUp } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [isForgot, setIsForgot] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    setLoading(true)

    if (isForgot) {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin,
      })
      if (error) setError(error.message)
      else setSuccess('Te enviamos un email con el link para restablecer tu contraseña. Revisá tu bandeja de entrada (y spam).')
      setLoading(false)
      return
    }

    const { error } = isSignUp
      ? await signUp(email, password)
      : await signIn(email, password)
    if (error) setError(error.message)
    setLoading(false)
  }

  const inputStyle = {
    width: '100%',
    padding: '11px 14px',
    background: 'var(--bg-secondary)',
    border: '1px solid var(--border-default)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--text-primary)',
    fontSize: 14,
    outline: 'none',
    transition: 'border-color 0.2s',
    fontFamily: 'inherit'
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg-primary)', padding: '20px'
    }}>
      <div style={{
        width: '100%', maxWidth: 380, background: 'var(--bg-card)',
        border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-xl)', padding: '40px 32px',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.03em', marginBottom: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <img src="/icons/icon-192x192.png" alt="Finanzas" style={{ width: 32, height: 32, borderRadius: 6 }} /> Finanzas
          </div>
          <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>
            {isForgot ? 'Restablecer contraseña' : isSignUp ? 'Crear cuenta' : 'Iniciar sesión'}
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 14 }}>
            <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required style={inputStyle} />
          </div>
          {!isForgot && (
            <div style={{ marginBottom: 20 }}>
              <input type="password" placeholder="Contraseña" value={password} onChange={e => setPassword(e.target.value)} required style={inputStyle} />
            </div>
          )}

          {error && (
            <div style={{ padding: '10px 14px', background: 'var(--color-expense-bg)', border: '1px solid var(--color-expense-border)', borderRadius: 'var(--radius-sm)', color: 'var(--color-expense-light)', fontSize: 13, marginBottom: 16 }}>
              {error}
            </div>
          )}

          {success && (
            <div style={{ padding: '10px 14px', background: 'var(--color-income-bg)', border: '1px solid var(--color-income-border)', borderRadius: 'var(--radius-sm)', color: 'var(--color-income)', fontSize: 13, marginBottom: 16 }}>
              {success}
            </div>
          )}

          <button type="submit" disabled={loading} style={{
            width: '100%', padding: '11px', background: 'var(--color-accent)', border: 'none',
            borderRadius: 'var(--radius-md)', color: 'white', fontSize: 14, fontWeight: 600,
            cursor: loading ? 'wait' : 'pointer', opacity: loading ? 0.7 : 1,
            transition: 'opacity 0.2s', fontFamily: 'inherit'
          }}>
            {loading ? '...' : isForgot ? 'Enviar link de reset' : isSignUp ? 'Crear cuenta' : 'Ingresar'}
          </button>
        </form>

        {!isForgot && (
          <div style={{ textAlign: 'center', marginTop: 12, fontSize: 12 }}>
            <span onClick={() => { setIsForgot(true); setError(null); setSuccess(null) }}
              style={{ color: 'var(--text-dim)', cursor: 'pointer', textDecoration: 'underline' }}>
              ¿Olvidaste tu contraseña?
            </span>
          </div>
        )}

        <div style={{ textAlign: 'center', marginTop: 16, fontSize: 13, color: 'var(--text-muted)' }}>
          {isForgot ? (
            <span onClick={() => { setIsForgot(false); setError(null); setSuccess(null) }}
              style={{ color: 'var(--color-accent)', cursor: 'pointer' }}>
              Volver a iniciar sesión
            </span>
          ) : (
            <>
              {isSignUp ? '¿Ya tenés cuenta?' : '¿No tenés cuenta?'}{' '}
              <span onClick={() => { setIsSignUp(!isSignUp); setError(null) }}
                style={{ color: 'var(--color-accent)', cursor: 'pointer' }}>
                {isSignUp ? 'Iniciar sesión' : 'Registrate'}
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
