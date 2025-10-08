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

// Setup TextEncoder/TextDecoder
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { TextEncoder, TextDecoder } = require('util');
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

// Simple fetch polyfill that uses node's built-in fetch or mocks it
if (typeof global.fetch === 'undefined') {
  // For Node 18+, just mock it to not throw
  global.fetch = jest.fn(() =>
    Promise.resolve({
      ok: true,
      json: async () => ({}),
      text: async () => '',
      headers: new Map(),
    })
  );
}

// Import testing-library/jest-dom for extended matchers
// eslint-disable-next-line @typescript-eslint/no-require-imports
require('@testing-library/jest-dom');

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
