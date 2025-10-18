# Test Manual: Parallel Testing Practices

## Overview

This document outlines the practices and patterns used to ensure integration tests and e2e tests can run in parallel without race conditions or data conflicts. The refactoring from sequential-only tests to parallel-capable tests involves several key strategies.

## Table of Contents

1. [Core Principles](#core-principles)
2. [Integration Tests](#integration-tests)
3. [E2E Tests](#e2e-tests)
4. [Data Isolation Strategies](#data-isolation-strategies)
5. [Worker-Specific Namespacing](#worker-specific-namespacing)
6. [Database Management](#database-management)
7. [Test Organization](#test-organization)
8. [Configuration Changes](#configuration-changes)
9. [Best Practices](#best-practices)
10. [Common Pitfalls](#common-pitfalls)

## Core Principles

### 1. Test Isolation

- Each test worker operates independently
- No shared state between test workers
- Each worker has its own test data namespace
- Cleanup is worker-specific

### 2. Deterministic Behavior

- Tests produce consistent results regardless of execution order
- No dependencies on external state
- Predictable test data generation

### 3. Resource Management

- Proper connection pooling
- Efficient cleanup strategies
- Memory and database connection limits

## Integration Tests

### Jest Configuration for Parallel Execution

```javascript
// jest.config.js
const customJestConfig = {
  // Run integration tests in parallel
  maxWorkers: 4,

  // Exclude e2e tests from Jest (run with Playwright instead)
  testPathIgnorePatterns: ['/node_modules/', '/.next/', '/tests/e2e/'],
};
```

### Package.json Scripts

```json
{
  "scripts": {
    "test:integration": "jest tests/integration --maxWorkers=4",
    "test:integration:backup": "npm run test:integration:parallel && npm run test:integration:serial",
    "test:integration:parallel": "jest tests/integration --testPathIgnorePatterns=hr-company-dashboard.test.ts --maxWorkers=4", // use this and below one to test if integration tests created is working in series first. then, try to make it workable in parallel
    "test:integration:serial": "jest tests/integration/hr-company-dashboard.test.ts --maxWorkers=1" // use this and above one to test if integration tests created is working in series first. then, try to make it workable in parallel
  }
}
```

### Integration Test Structure

```typescript
/**
 * @jest-environment node
 * Integration Tests for Task Creation
 */
import { Client } from 'pg';

describe('Integration Tests - Task Creation', () => {
  let pgClient: Client;

  // Test data IDs
  let testDepartmentId: string;
  let testUserId: string;
  let testProjectId: string;

  // Track created resources for cleanup
  const createdTaskIds: string[] = [];
  const createdTagIds: string[] = [];

  // Generate unique test run ID to avoid conflicts
  const testRunId = Date.now();

  beforeAll(async () => {
    pgClient = new Client({ connectionString: process.env.DATABASE_URL });
    await pgClient.connect();

    // Setup test data with unique identifiers
    await setupTestData();
  });

  afterAll(async () => {
    // Cleanup all created resources
    await cleanupTestData();
    await pgClient.end();
  });

  beforeEach(async () => {
    // Reset state between tests
    await resetTestState();
  });

  test('should create task successfully', async () => {
    // Test implementation
  });
});
```

### Database Setup Patterns

```typescript
// tests/integration/helpers/dbSetup.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Clear all tables in correct order (respecting FK constraints)
 */
export async function clearDatabase() {
  await prisma.$transaction([
    // Order matters due to foreign key constraints
    prisma.taskLog.deleteMany({}),
    prisma.taskFile.deleteMany({}),
    prisma.comment.deleteMany({}),
    prisma.taskTag.deleteMany({}),
    prisma.tag.deleteMany({}),
    prisma.taskAssignment.deleteMany({}),
    prisma.task.deleteMany({}),
    prisma.project.deleteMany({}),
    prisma.teamMember.deleteMany({}),
    prisma.team.deleteMany({}),
    prisma.userProfile.deleteMany({}),
    prisma.department.deleteMany({}),
  ]);
}

/**
 * Seed ONLY base infrastructure data (departments, users, projects)
 * Tests will create their own task-specific data
 */
export async function seedBaseData() {
  // Create base infrastructure that tests can reference
  // This is READ-ONLY shared data
}
```

### Unique ID Generation for Integration Tests

```typescript
// Generate unique test IDs based on namespace to avoid conflicts
function generateTestIds(testNamespace: string) {
  const hash = testNamespace.split('').reduce((a, b) => {
    a = (a << 5) - a + b.charCodeAt(0);
    return a & a;
  }, 0);

  const baseId = Math.abs(hash).toString(16).padStart(8, '0');

  // Create valid UUID v4 segments
  const createUuid = (prefix: string, suffix: string) => {
    const segment1 = prefix.padStart(8, '0');
    const segment2 = baseId.substring(0, 4);
    const segment3 = '4' + baseId.substring(4, 7); // 4xxx (version 4)
    const segment4 = '8' + suffix.substring(0, 3); // 8xxx (variant)
    const segment5 = (
      suffix.substring(3, 7) +
      baseId.substring(7, 8) +
      '0000'
    ).padStart(12, '0');
    return `${segment1}-${segment2}-${segment3}-${segment4}-${segment5}`;
  };

  return {
    departmentId: createUuid('dept', '0001'),
    userId: createUuid('user', '0001'),
    projectId: createUuid('proj', '0001'),
  };
}
```

### TRPC Integration Testing

```typescript
// tests/integration/helpers/trpcTestClient.ts
import { appRouter } from '../../src/app/server/routers/_app';
import { createInnerTRPCContext } from '../../src/app/server/trpc';

export function createTestTRPCClient(userContext: UserContext) {
  const ctx = createInnerTRPCContext({
    user: userContext,
  });

  return appRouter.createCaller(ctx);
}

// Usage in tests
const trpcClient = createTestTRPCClient(testUser);
const result = await trpcClient.task.create({
  title: 'Test Task',
  description: 'Test Description',
  // ... other fields
});
```

### Integration Test Cleanup Patterns

```typescript
// Comprehensive cleanup strategy
async function cleanupTestData() {
  try {
    // Cleanup in reverse dependency order
    await pgClient.query('DELETE FROM task_log WHERE task_id = ANY($1)', [
      createdTaskIds,
    ]);
    await pgClient.query('DELETE FROM task_file WHERE task_id = ANY($1)', [
      createdTaskIds,
    ]);
    await pgClient.query('DELETE FROM comment WHERE task_id = ANY($1)', [
      createdTaskIds,
    ]);
    await pgClient.query('DELETE FROM task_tag WHERE task_id = ANY($1)', [
      createdTaskIds,
    ]);
    await pgClient.query(
      'DELETE FROM task_assignment WHERE task_id = ANY($1)',
      [createdTaskIds]
    );
    await pgClient.query('DELETE FROM task WHERE id = ANY($1)', [
      createdTaskIds,
    ]);
    await pgClient.query('DELETE FROM tag WHERE id = ANY($1)', [createdTagIds]);
    await pgClient.query('DELETE FROM project WHERE id = $1', [testProjectId]);
    await pgClient.query('DELETE FROM user_profile WHERE id = $1', [
      testUserId,
    ]);
    await pgClient.query('DELETE FROM department WHERE id = $1', [
      testDepartmentId,
    ]);
  } catch (error) {
    console.error('Cleanup failed:', error);
  }
}
```

## E2E Tests

### Playwright Configuration for Parallel Execution

```typescript
// playwright.config.ts
export default defineConfig({
  // Enable parallel execution
  fullyParallel: true,
  workers: process.env.CI ? 3 : 3, // Optimized worker count

  // Test-specific settings
  timeout: 30_000,
  expect: {
    timeout: process.env.CI ? 15_000 : 5_000,
  },

  // Use the dev server's URL for tests
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
});
```

### E2E Test Structure

```typescript
import { test, expect, Page } from '@playwright/test';
import { Client } from 'pg';

test.describe('Feature Group - Specific Test', () => {
  let pgClient: Client;
  let testNamespace: string;
  let testData: TestData;

  test.beforeAll(async () => {
    pgClient = new Client({ connectionString: process.env.DATABASE_URL });
    await pgClient.connect();

    // Worker-specific setup
    const workerId = process.env.PLAYWRIGHT_WORKER_INDEX || '0';
    testNamespace = `w${workerId}_${crypto.randomUUID().slice(0, 8)}`;

    // Initialize test data with namespace
    testData = await createTestData(testNamespace);
  });

  test.afterAll(async () => {
    // Cleanup worker-specific data
    await cleanupTestData(testNamespace);
    await pgClient.end();
  });

  test('Specific test case', async ({ page }) => {
    // Test implementation using namespaced data
  });
});
```

### Package.json Scripts for E2E

```json
{
  "scripts": {
    "test:e2e": "playwright test",
    "test:e2e:headed": "playwright test --headed",
    "test:e2e:ui": "playwright test --ui",
    "test:e2e:debug": "playwright test --debug"
  }
}
```

## Data Isolation Strategies

### Worker-Specific Namespacing

```typescript
// Create worker-specific namespace for test data isolation
const workerId = process.env.PLAYWRIGHT_WORKER_INDEX || '0';
const testNamespace = `w${workerId}_${crypto.randomUUID().slice(0, 8)}`;

// Generate unique test email with worker-specific namespace
const testEmail = `user.${testNamespace}@test.com`;
```

**Benefits:**

- Prevents data conflicts between workers
- Enables parallel execution
- Easy cleanup identification
- Debugging support (worker-specific data)

### Unique Test Data Generation

```typescript
// Example from hr-company-dashboard.spec.ts
const hrAdminEmail = `hradmin.${testNamespace}@test.com`;
const testUserName = `HR Admin User ${testNamespace}`;
```

**Pattern:**

- Use worker ID + UUID for uniqueness
- Include namespace in all test data
- Consistent naming convention across tests

## Database Management

### Connection Strategy

```typescript
test.beforeAll(async () => {
  pgClient = new Client({ connectionString: process.env.DATABASE_URL });
  await pgClient.connect();

  // Worker-specific setup
  const workerId = process.env.PLAYWRIGHT_WORKER_INDEX || '0';
  testNamespace = `w${workerId}_${crypto.randomUUID().slice(0, 8)}`;
});
```

### Cleanup Strategy

```typescript
test.afterAll(async () => {
  // Cleanup test user
  try {
    await pgClient.query('DELETE FROM public."user_profile" WHERE email = $1', [
      hrAdminEmail,
    ]);
    await pgClient.query('DELETE FROM auth.users WHERE email = $1', [
      hrAdminEmail,
    ]);
  } catch (error) {
    console.error(`Failed to cleanup user ${hrAdminEmail}:`, error);
  }

  await pgClient.end();
});
```

**Key Points:**

- Each worker manages its own database connection
- Cleanup is specific to worker's namespace
- Error handling prevents cleanup failures from affecting other workers
- Connections are properly closed

## Test Organization

### File Structure Changes

**Before (Sequential):**

```
tests/e2e/
├── task-creation.spec.ts
├── task-update-ui.spec.ts
├── manager-remove-assignee.spec.ts
└── overdue-task-highlighting.spec.ts
```

**After (Parallel-Ready):**

```
tests/e2e/
├── task-creation/
│   ├── basic-task-creation.spec.ts
│   ├── recurring-task-creation.spec.ts
│   ├── task-validation.spec.ts
│   └── task-with-tags.spec.ts
├── task-management/
│   ├── basic-task-update.spec.ts
│   ├── manager-remove-assignee.spec.ts
│   ├── overdue-task-highlighting.spec.ts
│   ├── subtask-creation.spec.ts
│   ├── task-comments.spec.ts
│   ├── task-file-attachments.spec.ts
│   ├── task-recurring-settings.spec.ts
│   └── task-tags-update.spec.ts
└── hr-company-dashboard.spec.ts
```

**Benefits:**

- Logical grouping of related tests
- Easier parallel execution
- Better test organization
- Reduced test file size

### Test Structure Pattern

```typescript
test.describe('Feature Group - Specific Test', () => {
  let pgClient: Client;
  let testNamespace: string;
  let testData: TestData;

  test.beforeAll(async () => {
    // Worker-specific setup
    pgClient = new Client({ connectionString: process.env.DATABASE_URL });
    await pgClient.connect();

    const workerId = process.env.PLAYWRIGHT_WORKER_INDEX || '0';
    testNamespace = `w${workerId}_${crypto.randomUUID().slice(0, 8)}`;

    // Initialize test data with namespace
    testData = await createTestData(testNamespace);
  });

  test.afterAll(async () => {
    // Cleanup worker-specific data
    await cleanupTestData(testNamespace);
    await pgClient.end();
  });

  test('Specific test case', async ({ page }) => {
    // Test implementation using namespaced data
  });
});
```

## Configuration Changes

### Playwright Configuration

```typescript
// playwright.config.ts
export default defineConfig({
  // Enable parallel execution
  fullyParallel: true,
  workers: process.env.CI ? 3 : 3, // Optimized worker count

  // Test-specific settings
  timeout: 30_000,
  expect: {
    timeout: process.env.CI ? 15_000 : 5_000,
  },
});
```

### Package.json Scripts

```json
{
  "scripts": {
    "test:e2e": "playwright test",
    "test:e2e:headed": "playwright test --headed",
    "test:e2e:ui": "playwright test --ui",
    "test:e2e:debug": "playwright test --debug"
  }
}
```

## Best Practices

### 1. Test Data Management

```typescript
// ✅ Good: Worker-specific data
const testEmail = `user.${testNamespace}@test.com`;

// ❌ Bad: Shared data
const testEmail = 'user@test.com';
```

### 2. Error Handling

```typescript
// ✅ Good: Graceful error handling
try {
  await pgClient.query('DELETE FROM users WHERE email = $1', [email]);
} catch (error) {
  console.error(`Failed to cleanup user ${email}:`, error);
}

// ❌ Bad: Throwing errors in cleanup
await pgClient.query('DELETE FROM users WHERE email = $1', [email]);
```

### 3. Resource Cleanup

```typescript
// ✅ Good: Comprehensive cleanup
test.afterAll(async () => {
  try {
    await cleanupUser(testEmail);
    await cleanupTasks(testNamespace);
    await cleanupFiles(testNamespace);
  } catch (error) {
    console.error('Cleanup failed:', error);
  } finally {
    await pgClient.end();
  }
});
```

### 4. Test Independence

```typescript
// ✅ Good: Self-contained test
test('User can create task', async ({ page }) => {
  await createTestUser(testNamespace);
  await loginAsUser(page, testEmail);
  await createTask(page, 'Test Task');
  await expect(page.getByText('Test Task')).toBeVisible();
});

// ❌ Bad: Dependent on other tests
test('User can edit task', async ({ page }) => {
  // Assumes task from previous test exists
  await editTask(page, 'Existing Task');
});
```

## Integration vs E2E Test Differences

### Key Differences in Parallel Testing Approaches

| Aspect                   | Integration Tests (Jest)           | E2E Tests (Playwright)                    |
| ------------------------ | ---------------------------------- | ----------------------------------------- |
| **Worker Management**    | Jest manages workers internally    | Playwright uses `PLAYWRIGHT_WORKER_INDEX` |
| **Data Isolation**       | `testRunId = Date.now()`           | `workerId + crypto.randomUUID()`          |
| **Database Connections** | One connection per test file       | One connection per worker                 |
| **Cleanup Strategy**     | `afterAll` with tracked arrays     | Worker-specific namespace cleanup         |
| **Test Environment**     | Node.js (`@jest-environment node`) | Browser automation                        |
| **Parallel Execution**   | `maxWorkers: 4`                    | `workers: 3`                              |
| **Resource Management**  | Shared Prisma client               | Individual pg clients                     |

### Integration Test Specific Patterns

```typescript
// Integration tests use timestamp-based isolation
const testRunId = Date.now();
const testEmail = `user.${testRunId}@test.com`;

// Track resources for cleanup
const createdTaskIds: string[] = [];
const createdTagIds: string[] = [];

// Cleanup in afterAll
afterAll(async () => {
  await pgClient.query('DELETE FROM task WHERE id = ANY($1)', [createdTaskIds]);
  await pgClient.query('DELETE FROM tag WHERE id = ANY($1)', [createdTagIds]);
});
```

### E2E Test Specific Patterns

```typescript
// E2E tests use worker-based isolation
const workerId = process.env.PLAYWRIGHT_WORKER_INDEX || '0';
const testNamespace = `w${workerId}_${crypto.randomUUID().slice(0, 8)}`;
const testEmail = `user.${testNamespace}@test.com`;

// Cleanup by namespace
test.afterAll(async () => {
  await pgClient.query('DELETE FROM user_profile WHERE email LIKE $1', [
    `%.${testNamespace}@%`,
  ]);
});
```

## Common Pitfalls

### 1. Shared Test Data

**Problem:** Multiple workers using same test data

```typescript
// ❌ Problematic
const testEmail = 'test@example.com';
```

**Solution:** Worker-specific namespacing

```typescript
// ✅ Fixed
const testEmail = `test.${testNamespace}@example.com`;
```

### 2. Incomplete Cleanup

**Problem:** Test data persists between runs

```typescript
// ❌ Problematic
test.afterAll(async () => {
  // No cleanup
});
```

**Solution:** Comprehensive cleanup

```typescript
// ✅ Fixed
test.afterAll(async () => {
  await cleanupAllTestData(testNamespace);
});
```

### 3. Database Connection Issues

**Problem:** Shared database connections

```typescript
// ❌ Problematic
const sharedClient = new Client(); // Shared across workers
```

**Solution:** Worker-specific connections

```typescript
// ✅ Fixed
let pgClient: Client; // Each worker gets its own
```

### 4. Race Conditions in UI Tests

**Problem:** Tests interfering with each other

```typescript
// ❌ Problematic
await page.click('[data-testid="shared-button"]');
```

**Solution:** Unique test identifiers

```typescript
// ✅ Fixed
await page.click(`[data-testid="button-${testNamespace}"]`);
```

## Performance Considerations

### Worker Count Optimization

- **Local Development:** 3 workers (sweet spot for most systems)
- **CI/CD:** 3 workers (balanced with resource constraints)
- **High-performance systems:** Can increase to 4-5 workers

### Database Connection Limits

- Monitor database connection pool usage
- Each worker uses 1-2 connections
- Total connections = workers × 2 + buffer

### Memory Management

- Each worker runs in separate process
- Memory usage scales with worker count
- Monitor for memory leaks in long-running tests

## Migration Checklist

When refactoring tests for parallel execution:

- [ ] Add worker-specific namespacing
- [ ] Implement comprehensive cleanup
- [ ] Remove shared test data dependencies
- [ ] Update test organization structure
- [ ] Configure parallel execution settings
- [ ] Test with multiple workers
- [ ] Monitor for race conditions
- [ ] Document test data patterns
- [ ] Verify cleanup effectiveness

## Conclusion

The refactoring from sequential to parallel testing requires careful attention to data isolation, resource management, and test organization. By following these practices, tests can run efficiently in parallel while maintaining reliability and preventing race conditions.

The key is ensuring each test worker operates independently with its own namespace, proper cleanup, and no shared dependencies. This approach significantly improves test execution speed while maintaining test reliability.
