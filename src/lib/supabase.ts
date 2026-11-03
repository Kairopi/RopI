import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

console.log('=== Supabase Config ===')
console.log('URL:', supabaseUrl)
console.log('Key prefix:', supabaseAnonKey.substring(0, 20) + '...')
console.log('Key type:', supabaseAnonKey.startsWith('sb_publishable_') ? 'PUBLISHABLE' : 'LEGACY')

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Missing Supabase environment variables!')
} else {
  console.log('✅ Supabase client initializing...')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  }
})

console.log('✅ Supabase client created')
