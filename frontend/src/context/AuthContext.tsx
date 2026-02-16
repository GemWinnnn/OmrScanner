import { createContext, useContext, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { useAuth, type User } from '../hooks/useAuth'

interface AuthContextType {
  user: User | null
  session: Session | null
  loading: boolean
  signInWithGoogle: () => Promise<void>
  signOut: () => Promise<void>
  isConfigured: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const auth = useAuth()

  return (
    <AuthContext.Provider
      value={{
        user: auth.user,
        session: auth.session,
        loading: auth.loading,
        signInWithGoogle: auth.signInWithGoogle,
        signOut: auth.signOut,
        isConfigured: auth.isConfigured,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuthContext() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuthContext must be used within an AuthProvider')
  }
  return context
}
