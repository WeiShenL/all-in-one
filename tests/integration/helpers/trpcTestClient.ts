/**
 * tRPC Test Client Helper
 *
 * Creates a tRPC client for integration testing
 */

import { createTRPCProxyClient, httpBatchLink } from '@trpc/client';
import type { AppRouter } from '../../../src/app/server/routers/_app';
import fetch from 'node-fetch';

/**
 * Create tRPC client for testing
 * Connects to local dev server (must be running)
 */
export function createTestTRPCClient() {
  return createTRPCProxyClient<AppRouter>({
    links: [
      httpBatchLink({
        url: process.env.TRPC_URL || 'http://localhost:3000/api/trpc',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        fetch: fetch as any, // Polyfill for Node.js environment
      }),
    ],
  });
}
