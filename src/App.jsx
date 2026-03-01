import { useState, useEffect } from 'react'
import { supabase } from './lib/supabase'
import Auth from './components/Auth'
import TransactionForm from './components/TransactionForm'

export default function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
  }

  if (loading) {
    return (
      <div className="app">
        <div className="loading-screen">
          <div className="logo"><span>$</span> finanzas</div>
        </div>
      </div>
    )
  }

  if (!session) {
    return <Auth />
  }

  return <TransactionForm user={session.user} onSignOut={handleSignOut} />
}
