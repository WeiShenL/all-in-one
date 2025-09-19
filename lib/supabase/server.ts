import { createClient } from '@supabase/supabase-js'

// Server-side Supabase client with service role key
// WARNING: This should ONLY be used in server-side code (API routes, server components, etc.)
// Never expose the service role key to the client

const environment = process.env.NEXT_PUBLIC_ENV || 'development'

const supabaseUrl = environment === 'production'
  ? process.env.NEXT_PUBLIC_SUPABASE_URL_PRODUCTION!
  : process.env.NEXT_PUBLIC_SUPABASE_URL_STAGING!

const supabaseServiceRoleKey = environment === 'production'
  ? process.env.SUPABASE_SERVICE_ROLE_KEY_PRODUCTION!
  : process.env.SUPABASE_SERVICE_ROLE_KEY_STAGING!

// Database URLs for direct connections (migrations, etc.)
export const databaseUrl = environment === 'production'
  ? process.env.PRODUCTION_DATABASE_URL!
  : process.env.STAGING_DATABASE_URL!

// Create admin client with service role key - bypasses RLS
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

// Helper function to get database connection string
export function getDatabaseUrl(): string {
  return databaseUrl
}

// Helper to check if all required environment variables are set
export function validateEnvVars(): { isValid: boolean; missing: string[] } {
  const required = environment === 'production' 
    ? [
        'NEXT_PUBLIC_SUPABASE_URL_PRODUCTION',
        'NEXT_PUBLIC_SUPABASE_ANON_KEY_PRODUCTION',
        'SUPABASE_SERVICE_ROLE_KEY_PRODUCTION',
        'PRODUCTION_DATABASE_URL',
      ]
    : [
        'NEXT_PUBLIC_SUPABASE_URL_STAGING',
        'NEXT_PUBLIC_SUPABASE_ANON_KEY_STAGING',
        'SUPABASE_SERVICE_ROLE_KEY_STAGING',
        'STAGING_DATABASE_URL',
      ]

  const missing = required.filter(key => !process.env[key])
  
  return {
    isValid: missing.length === 0,
    missing,
  }
}