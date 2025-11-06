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

    // ============================================
    // TYPE DEFINITIONS
    // ============================================
    '!src/**/*.d.ts',

    // ============================================
    // NEXT.JS FRAMEWORK FILES
    // ============================================
    '!src/app/layout.tsx',
    '!src/app/page.tsx',
    '!src/middleware.ts',

    // ============================================
    // API ROUTES
    // ============================================
    // Exclude only the tRPC wrapper (thin adapter)
    '!src/app/api/trpc/**/route.ts',
    // NOTE: Cron route is NOT excluded - it has auth + error handling logic

    // ============================================
    // PAGE COMPONENTS (E2E TESTED)
    // ============================================
    '!src/app/auth/callback/page.tsx',
    '!src/app/auth/reset-password/page.tsx',
    '!src/app/auth/signup/page.tsx',
    '!src/app/auth/login/page.tsx',
    '!src/app/dashboard/page.tsx',
    '!src/app/dashboard/company/page.tsx',
    '!src/app/notifications/page.tsx',
    '!src/app/projects/page.tsx',

    // ============================================
    // CONFIGURATION & SETUP FILES
    // ============================================
    '!src/app/lib/trpc.ts', // tRPC client config
    '!src/lib/supabase/middleware.ts', // Supabase auth middleware
    '!src/lib/supabase/server.ts', // Supabase server client
    '!src/lib/context/DashboardContext.tsx', // UI state context (E2E tested)
    '!src/app/components/TRPCProvider.tsx', // tRPC React provider

    // ============================================
    // UI COMPONENTS (E2E TESTED)
    // ============================================
    // Small utility components
    '!src/app/components/Toast.tsx',
    '!src/app/components/ToastContainer.tsx',
    '!src/app/components/UserSelectOption.tsx',
    '!src/app/auth/components/DepartmentSelect.tsx',

    // Task management components
    '!src/app/components/TaskCard.tsx',
    '!src/app/components/TaskCreateModal.tsx',
    '!src/app/components/TaskTable/TaskTable.tsx',
    '!src/app/components/TaskTable/TaskRow.tsx',
    '!src/app/components/ConnectedTasks.tsx',
    '!src/app/components/TaskFileUpload.tsx',
    '!src/app/components/TaskComments.tsx',

    // Dashboard components
    '!src/app/components/Navbar.tsx',
    '!src/app/components/CompanyDashboard.tsx',
    '!src/app/components/DepartmentDashboard.tsx',
    '!src/app/components/PersonalDashboard.tsx',
    '!src/app/components/UnifiedDashboard.tsx',
    '!src/app/components/ProjectDashboard.tsx',
    '!src/app/components/DashboardTabs.tsx',

    // Calendar components
    '!src/app/components/Calendar/views/AgendaView.tsx',
    '!src/app/components/Calendar/views/DayView.tsx',
    '!src/app/components/Calendar/TaskCalendar.tsx',

    // Exclude other UI components (E2E tested)
    '!src/app/components/LogItem.tsx',
    '!src/app/components/ProjectCreateModal.tsx',
    '!src/app/components/NotificationModal.tsx',
    '!src/app/components/ProjectReport/ProjectReportExportButton.tsx',

    // ============================================
    // tRPC ROUTERS (THIN SERVICE WRAPPERS)
    // ============================================
    '!src/app/server/routers/department.ts', // Pure delegation to DepartmentService
    '!src/app/server/routers/userProfile.ts', // Pure delegation to UserProfileService
    '!src/app/server/routers/_app.ts', // Router composition only

    // NOTE: task.ts, notification.ts, project.ts, taskFile.ts are NOT excluded

    // ============================================
    // BARREL EXPORTS & STYLE FILES
    // ============================================
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
