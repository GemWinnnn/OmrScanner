import { useEffect, useState, useCallback, useRef } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

export interface User {
  id: string
  email: string
  full_name?: string
  avatar_url?: string
}

/**
 * Check if the current URL contains Supabase auth callback params.
 * - PKCE flow (v2 default): redirects with ?code=...
 * - Implicit flow: redirects with #access_token=...
 */
function isOAuthCallback(): boolean {
  const hash = window.location.hash
  const search = window.location.search
  return (
    hash.includes('access_token') ||
    hash.includes('refresh_token') ||
    hash.includes('error_description') ||
    search.includes('code=') ||
    search.includes('error=')
  )
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const loadingResolved = useRef(false)

  const updateUserFromSession = useCallback((s: Session | null) => {
    setSession(s)
    if (s?.user) {
      setUser({
        id: s.user.id,
        email: s.user.email || '',
        full_name: s.user.user_metadata?.full_name || s.user.user_metadata?.name || '',
        avatar_url: s.user.user_metadata?.avatar_url || s.user.user_metadata?.picture || '',
      })
    } else {
      setUser(null)
    }
  }, [])

  useEffect(() => {
    if (!supabase) {
      queueMicrotask(() => setLoading(false))
      return
    }

    const oauthInProgress = isOAuthCallback()

    // Listen for auth state changes -- this fires when:
    // - OAuth callback is processed (SIGNED_IN)
    // - Token is refreshed
    // - User signs out
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      updateUserFromSession(s)
      if (!loadingResolved.current) {
        loadingResolved.current = true
        setLoading(false)
      }
    })

    if (oauthInProgress) {
      // OAuth callback in progress.
      // The Supabase client will automatically exchange the code/hash for a session,
      // which triggers onAuthStateChange above.
      // Add a safety timeout in case something goes wrong.
      const timeout = setTimeout(() => {
        if (!loadingResolved.current) {
          // Fallback: try getSession one more time
          supabase!.auth.getSession().then(({ data: { session: s } }) => {
            updateUserFromSession(s)
            if (!loadingResolved.current) {
              loadingResolved.current = true
              setLoading(false)
            }
          })
        }
      }, 3000)
      return () => {
        clearTimeout(timeout)
        subscription.unsubscribe()
      }
    } else {
      // Normal page load -- check for existing stored session
      supabase.auth.getSession().then(({ data: { session: s } }) => {
        updateUserFromSession(s)
        if (!loadingResolved.current) {
          loadingResolved.current = true
          setLoading(false)
        }
      })
    }

    return () => subscription.unsubscribe()
  }, [updateUserFromSession])

  const signInWithGoogle = async () => {
    if (!supabase) throw new Error('Supabase not configured')
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
      },
    })
    if (error) throw error
  }

  const signIn = async (email: string, password: string) => {
    if (!supabase) throw new Error('Supabase not configured')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
  }

  const signUp = async (email: string, password: string) => {
    if (!supabase) throw new Error('Supabase not configured')
    const { error } = await supabase.auth.signUp({ email, password })
    if (error) throw error
  }

  const signOut = async () => {
    if (!supabase) return
    await supabase.auth.signOut()
    setUser(null)
    setSession(null)
  }

  return { user, session, loading, signIn, signUp, signInWithGoogle, signOut, isConfigured: !!supabase }
}
