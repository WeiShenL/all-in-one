import { createBrowserClient } from '@supabase/ssr';
import type { Database } from './types';
import type { SupabaseClient } from '@supabase/supabase-js';

let realtimeClient: SupabaseClient<Database> | null = null;

export const createClient = () => {
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
      realtime: {
        params: {
          eventsPerSecond: 10,
        },
      },
    }
  );
};

export const getRealtimeClient = (): SupabaseClient<Database> => {
  if (!realtimeClient) {
    realtimeClient = createBrowserClient<Database>(
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
        realtime: {
          params: {
            eventsPerSecond: 10,
          },
        },
      }
    );
  }

  return realtimeClient;
};
