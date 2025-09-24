import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_SUPABASE_URL_STAGING:
      process.env.NEXT_PUBLIC_SUPABASE_URL_STAGING,
    NEXT_PUBLIC_SUPABASE_ANON_KEY_STAGING:
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY_STAGING,
    NEXT_PUBLIC_SUPABASE_URL_PRODUCTION:
      process.env.NEXT_PUBLIC_SUPABASE_URL_PRODUCTION,
    NEXT_PUBLIC_SUPABASE_ANON_KEY_PRODUCTION:
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY_PRODUCTION,
    NEXT_PUBLIC_ENV: process.env.NEXT_PUBLIC_ENV,
  },
  /* config options here */
};

export default nextConfig;
