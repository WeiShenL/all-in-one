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
            // Cache configuration for optimal performance
            staleTime: 5 * 60_000, // Data is fresh for 5 minutes
            gcTime: 10 * 60_000, // Keep unused data in cache for 10 minutes (formerly cacheTime)
            refetchOnWindowFocus: false, // Disable aggressive refetching
            refetchOnReconnect: true, // Refetch when internet reconnects
            retry: 1, // Retry failed requests once
            retryDelay: 1000, // Wait 1s before retry
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
