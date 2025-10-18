// import 'whatwg-fetch';

// Silence GoTrueClient multiple instances warning
const originalWarn = console.warn;
console.warn = (...args) => {
  if (args[0] && args[0].includes('Multiple GoTrueClient instances detected')) {
    return; // Suppress this specific warning
  }
  originalWarn.apply(console, args);
};

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

// Polyfill crypto.randomUUID for older Node versions
if (!global.crypto) {
  global.crypto = {};
}
if (!global.crypto.randomUUID) {
  global.crypto.randomUUID = () => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  };
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
