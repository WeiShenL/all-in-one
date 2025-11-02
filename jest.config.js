// integrate jest with next.js

import nextJest from 'next/jest.js';
const createJestConfig = nextJest({
  dir: './',
});

const customJestConfig = {
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],

  // Default test environment for React components
  testEnvironment: 'jest-environment-jsdom',

  // path mapping to match tsconfig.json paths
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@tests/(.*)$': '<rootDir>/tests/$1',
  },

  // Coverage configuration
  collectCoverageFrom: [
    'src/**/*.{js,jsx,ts,tsx}',
    // Exclude type definition files
    '!src/**/*.d.ts',

    // Exclude Next.js framework files
    '!src/app/layout.tsx',
    '!src/app/page.tsx',
    '!src/middleware.ts',

    // Exclude API route handlers (thin wrappers)
    '!src/app/api/**/route.ts',

    // Exclude UI/Presentation pages (tested via E2E)
    '!src/app/auth/callback/page.tsx',
    '!src/app/auth/reset-password/page.tsx',
    '!src/app/auth/signup/page.tsx',
    '!src/app/dashboard/page.tsx',
    '!src/app/dashboard/company/page.tsx',
    '!src/app/notifications/page.tsx',
    '!src/app/projects/page.tsx',

    // Exclude configuration/setup files
    '!src/app/lib/trpc.ts',
    '!src/lib/supabase/middleware.ts',
    '!src/lib/supabase/server.ts',
    '!src/lib/supabase/auth-context.tsx',
    '!src/app/components/TRPCProvider.tsx',

    // Exclude simple presentational components (low testing value)
    '!src/app/components/Toast.tsx',
    '!src/app/components/ToastContainer.tsx',
    '!src/app/components/UserSelectOption.tsx',

    // Exclude simple barrel exports
    '!src/**/index.ts',
    '!src/**/styles.ts',
  ],
  coverageReporters: ['text', 'lcov', 'html'],
  coverageDirectory: 'coverage',

  // Test file patterns - including new tests structure
  testMatch: [
    '<rootDir>/tests/**/*.{test,spec}.{js,jsx,ts,tsx}',
    '<rootDir>/src/**/__tests__/**/*.{js,jsx,ts,tsx}',
    '<rootDir>/src/**/*.{test,spec}.{js,jsx,ts,tsx}',
  ],

  // run integration tests in parallel (except task-permissions which has race conditions)
  maxWorkers: 4,

  // Exclude e2e tests from Jest (run with Playwright instead)
  testPathIgnorePatterns: ['/node_modules/', '/.next/', '/tests/e2e/'],
};

export default createJestConfig(customJestConfig);
