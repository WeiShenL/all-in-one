import { createClient } from '@supabase/supabase-js'

// Determine which environment we're in
const isProduction = process.env.NODE_ENV === 'production'
const environment = process.env.NEXT_PUBLIC_ENV || 'development'

// Select the appropriate Supabase URL and keys based on environment
const supabaseUrl = environment === 'production'
  ? process.env.NEXT_PUBLIC_SUPABASE_URL_PRODUCTION!
  : process.env.NEXT_PUBLIC_SUPABASE_URL_STAGING!

const supabaseAnonKey = environment === 'production'
  ? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY_PRODUCTION!
  : process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY_STAGING!

// Create a single supabase client for interacting with your database
// This client can be used in browser/client-side code
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Export environment info for debugging
export const supabaseConfig = {
  url: supabaseUrl,
  environment,
  isProduction,
}