import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  env: {
    // Environment switching happens at .env level - just expose the active variables
    NEXT_PUBLIC_API_EXTERNAL_URL: process.env.NEXT_PUBLIC_API_EXTERNAL_URL,
    NEXT_PUBLIC_ANON_KEY: process.env.NEXT_PUBLIC_ANON_KEY,
  },
  // Disable ESLint during builds in production (Vercel)
  eslint: {
    ignoreDuringBuilds: process.env.VERCEL === '1',
  },

  // Disable TypeScript errors during builds in production (Vercel) - use with caution
  typescript: {
    ignoreBuildErrors: process.env.VERCEL === '1',
  },
  /* config options here */
};

export default nextConfig;
