import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    '[Supabase] Missing env vars. VITE_SUPABASE_URL:',
    supabaseUrl ? 'SET' : 'EMPTY',
    'VITE_SUPABASE_ANON_KEY:',
    supabaseAnonKey ? 'SET' : 'EMPTY',
  )
}

export const supabase = (supabaseUrl && supabaseAnonKey)
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null
