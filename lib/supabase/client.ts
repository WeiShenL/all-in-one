import { createClient } from '@supabase/supabase-js';

export function getSupabaseClient(
  supabaseUrl: string,
  supabaseAnonKey: string
) {
  return createClient(supabaseUrl, supabaseAnonKey);
}

// Export environment info for debugging
export const supabaseConfig = {
  // These will be populated when getSupabaseClient is called
  url: '',
  environment: '',
  isProduction: false,
};
