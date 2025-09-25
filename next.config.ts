import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  env: {
    // Environment switching happens at .env level - just expose the active variables
    NEXT_PUBLIC_API_EXTERNAL_URL: process.env.NEXT_PUBLIC_API_EXTERNAL_URL,
    NEXT_PUBLIC_ANON_KEY: process.env.NEXT_PUBLIC_ANON_KEY,
  },
  /* config options here */
};

export default nextConfig;
