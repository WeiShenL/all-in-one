'use client';

// this is our client provider

import { useState } from 'react';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { trpc } from '../lib/trpc';
import { httpBatchLink } from '@trpc/client';

function getBaseUrl() {
  if (typeof window !== 'undefined') {
    return '';
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  return `http://localhost:${process.env.PORT ?? 3000}`;
}

export function TRPCProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // OPTIMIZED: Cache configuration for better performance
            // Short staleTime ensures data is refetched on mount/reload
            staleTime: 0, // Always consider data stale to ensure fresh data on reload
            gcTime: 5 * 60 * 1000, // Keep unused data in cache for 5 minutes
            refetchOnWindowFocus: false, // Disable aggressive refetching
            refetchOnReconnect: true, // Refetch when internet reconnects
            refetchOnMount: 'always', // Force refetch on every mount, even if loading
            retry: 2, // Retry failed requests twice
            retryDelay: attemptIndex =>
              Math.min(1000 * 2 ** attemptIndex, 3000), // Exponential backoff
          },
          mutations: {
            retry: 1,
            retryDelay: 1000,
          },
        },
      })
  );
  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [
        httpBatchLink({
          url: `${getBaseUrl()}/api/trpc`,
          // Batch requests within 10ms window for better performance
          maxURLLength: 2083,
          headers() {
            return {
              'cache-control': 'no-cache, no-store, must-revalidate',
              pragma: 'no-cache',
              expires: '0',
            };
          },
        }),
      ],
    })
  );

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </trpc.Provider>
  );
}
