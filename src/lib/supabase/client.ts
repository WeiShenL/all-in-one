import { createBrowserClient } from '@supabase/ssr';
import type { Database } from './types';

export const createClient = () =>
  createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_API_EXTERNAL_URL!,
    process.env.NEXT_PUBLIC_ANON_KEY!
  );
