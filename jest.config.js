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
    '!src/**/*.d.ts',
    '!src/app/layout.tsx',
  ],
  coverageReporters: ['text', 'lcov', 'html'],
  coverageDirectory: 'coverage',

  // Test file patterns - including new tests structure
  testMatch: [
    '<rootDir>/tests/**/*.{test,spec}.{js,jsx,ts,tsx}',
    '<rootDir>/src/**/__tests__/**/*.{js,jsx,ts,tsx}',
    '<rootDir>/src/**/*.{test,spec}.{js,jsx,ts,tsx}',
  ],

  // Default environment (jsdom for React components)
  testEnvironment: 'jest-environment-jsdom',
};

export default createJestConfig(customJestConfig);
