import { createClient } from './supabase/client';

export async function testSupabaseConnection() {
  try {
    const supabase = createClient();

    // Test basic connection by getting the current user
    const { error: userError } = await supabase.auth.getUser();

    if (userError && userError.message !== 'Auth session missing!') {
      console.error('Supabase auth error:', userError);
      return false;
    }

    // Test database connection by querying user_profiles table
    const { error: dbError } = await supabase
      .from('user_profiles')
      .select('count')
      .limit(1);

    if (dbError) {
      console.error('Supabase database error:', dbError);
      return false;
    }

    console.warn('✅ Supabase connection successful!');
    return true;
  } catch (error) {
    console.error('❌ Failed to connect to Supabase:', error);
    return false;
  }
}
