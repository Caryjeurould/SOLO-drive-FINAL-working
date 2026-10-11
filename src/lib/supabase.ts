import { createClient } from '@supabase/supabase-js'
import { isVisitor } from './site-role'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Visitor (demo) mode: the database connection refuses every request — reads,
// writes, sign-in, sign-up and file uploads — before anything leaves the
// device, and no sign-in is stored or refreshed. The demo runs on sample data
// in memory (lib/demo).
const demoFetch: typeof fetch = () => Promise.reject(new Error('Demo mode: the database is switched off.'))

export const supabase = createClient(supabaseUrl, supabaseAnonKey, isVisitor()
  ? {
      global: { fetch: demoFetch },
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    }
  : undefined)
