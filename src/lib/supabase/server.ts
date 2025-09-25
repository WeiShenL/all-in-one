import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Database } from './types';
import { createClient as createAdminClient } from '@supabase/supabase-js';

const environment = process.env.NEXT_PUBLIC_ENV || 'development';

const supabaseUrl =
  environment === 'production'
    ? process.env.NEXT_PUBLIC_SUPABASE_URL_PRODUCTION!
    : process.env.NEXT_PUBLIC_SUPABASE_URL_STAGING!;

const supabaseAnonKey =
  environment === 'production'
    ? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY_PRODUCTION!
    : process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY_STAGING!;

const supabaseServiceRoleKey =
  environment === 'production'
    ? process.env.SUPABASE_SERVICE_ROLE_KEY_PRODUCTION!
    : process.env.SUPABASE_SERVICE_ROLE_KEY_STAGING!;

export const databaseUrl =
  environment === 'production'
    ? process.env.PRODUCTION_DATABASE_URL!
    : process.env.STAGING_DATABASE_URL!;

export const createClient = async () => {
  const cookieStore = await cookies();

  return createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // The `setAll` method was called from a Server Component.
          // This can be ignored if you have middleware refreshing
          // user sessions.
        }
      },
    },
  });
};

export const supabaseAdmin = createAdminClient(
  supabaseUrl,
  supabaseServiceRoleKey,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

export function getDatabaseUrl(): string {
  return databaseUrl;
}

export function validateEnvVars(): { isValid: boolean; missing: string[] } {
  const required =
    environment === 'production'
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
        ];

  const missing = required.filter(key => !process.env[key]);

  return {
    isValid: missing.length === 0,
    missing,
  };
}
