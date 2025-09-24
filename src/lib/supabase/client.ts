import { createBrowserClient } from '@supabase/ssr';
import type { Database } from './types';

export const createClient = () => {
  const environment = process.env.NEXT_PUBLIC_ENV || 'development';

  const supabaseUrl =
    environment === 'production'
      ? process.env.NEXT_PUBLIC_SUPABASE_URL_PRODUCTION!
      : process.env.NEXT_PUBLIC_SUPABASE_URL_STAGING!;

  const supabaseAnonKey =
    environment === 'production'
      ? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY_PRODUCTION!
      : process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY_STAGING!;

  return createBrowserClient<Database>(supabaseUrl, supabaseAnonKey);
};
