import { createBrowserClient } from '@supabase/ssr';
import type { Database } from './types';

export const createClient = () => {
  // Environment switching happens at .env level - just use whatever is uncommented
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_API_EXTERNAL_URL!,
    process.env.NEXT_PUBLIC_ANON_KEY!,
    {
      db: {
        schema: 'public',
      },
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    }
  );
};
