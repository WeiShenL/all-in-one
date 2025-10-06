// Mock Supabase with a pass-through that works for both unit and integration tests
jest.mock('@supabase/supabase-js', () => {
  const actual = jest.requireActual('@supabase/supabase-js');
  return {
    ...actual,
    createClient: jest.fn((...args) => {
      // For integration tests, use real client
      // For unit tests, return mock (unit tests will override with jest.mock anyway)
      return actual.createClient(...args);
    }),
  };
});

// eslint-disable-next-line @typescript-eslint/no-require-imports
require('dotenv').config({ path: './.env' });

import '@testing-library/jest-dom';
import { TextEncoder, TextDecoder } from 'util';
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

// Polyfill setImmediate for Prisma in jsdom environment
if (typeof setImmediate === 'undefined') {
  global.setImmediate = (callback, ...args) => setTimeout(callback, 0, ...args);
  global.clearImmediate = id => clearTimeout(id);
}

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter() {
    return {
      push: jest.fn(),
      replace: jest.fn(),
      prefetch: jest.fn(),
    };
  },
  useSearchParams() {
    return new URLSearchParams();
  },
  usePathname() {
    return '';
  },
}));
