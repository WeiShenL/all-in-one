import { test, expect } from '@playwright/test';
import { Client } from 'pg';
import { createClient } from '@supabase/supabase-js';

/**
 * E2E Tests for Task Recurring Settings Update Feature
 *
 * Isolated test for task recurring settings update functionality
 * - Independent namespace and cleanup
 * - No shared state with other test files
 * - Optimized for parallel execution
 */

test.describe('Task Recurring Settings Update - Isolated E2E Tests', () => {
  let pgClient: Client;
  let supabaseClient: ReturnType<typeof createClient>;
  let testEmail: string;
  let testPassword: string;
  let testDepartmentId: string;
  let testUserId: string;
  let testTaskId: string;
  let testNamespace: string;

  test.beforeAll(async () => {
    // Setup DB connection
    pgClient = new Client({ connectionString: process.env.DATABASE_URL });
    await pgClient.connect();

    supabaseClient = createClient(
      process.env.NEXT_PUBLIC_API_EXTERNAL_URL!,
      process.env.NEXT_PUBLIC_ANON_KEY!
    );

    // Create robust worker-specific namespace for test data isolation
    const workerId = process.env.PLAYWRIGHT_WORKER_INDEX || '0';
    const timestamp = Date.now();
    const processId = process.pid;
    const randomSuffix = crypto.randomUUID().slice(0, 8);
    testNamespace = `recurring-update-w${workerId}_${timestamp}_${processId}_${randomSuffix}`;

    // Create unique credentials with worker-specific namespace
    testEmail = `e2e.recurring.update.${testNamespace}@example.com`;
    testPassword = 'Test123!@#';

    // Create department
    const deptResult = await pgClient.query(
      'INSERT INTO "department" (id, name, "isActive", "createdAt", "updatedAt") VALUES (gen_random_uuid(), $1, true, NOW(), NOW()) RETURNING id',
      [`Recurring Update Test Dept ${testNamespace}`]
    );
    testDepartmentId = deptResult.rows[0].id;

    // Create user with Supabase auth
    const { data: authData, error } = await supabaseClient.auth.signUp({
      email: testEmail,
      password: testPassword,
    });

    if (error || !authData.user) {
      throw new Error(`Failed to create test user: ${error?.message}`);
    }

    // Wait for user_profile trigger to complete
    let profileExists = false;
    for (let i = 0; i < 10; i++) {
      const checkResult = await pgClient.query(
        'SELECT id FROM "user_profile" WHERE id = $1',
        [authData.user.id]
      );
      if (checkResult.rows.length > 0) {
        profileExists = true;
        break;
      }
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    if (!profileExists) {
      throw new Error('User profile was not created by trigger');
    }

    // Update department and role
    await pgClient.query(
      'UPDATE "user_profile" SET "departmentId" = $1, role = $2, name = $3 WHERE id = $4',
      [
        testDepartmentId,
        'STAFF',
        `Recurring Update Test User ${testNamespace}`,
        authData.user.id,
      ]
    );
    testUserId = authData.user.id;

    // Create a test task for recurring settings updates
    const taskResult = await pgClient.query(
      'INSERT INTO "task" (id, title, description, priority, "dueDate", status, "ownerId", "departmentId", "recurringInterval", "createdAt", "updatedAt") VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW()) RETURNING id',
      [
        `Recurring Update Task ${testNamespace}`,
        'Task for testing recurring settings updates',
        5,
        new Date('2025-12-31'),
        'TO_DO',
        testUserId,
        testDepartmentId,
        7, // Weekly recurring
      ]
    );
    testTaskId = taskResult.rows[0].id;

    // Create task assignment
    await pgClient.query(
      'INSERT INTO "task_assignment" ("taskId", "userId", "assignedById", "assignedAt") VALUES ($1, $2, $3, NOW())',
      [testTaskId, testUserId, testUserId]
    );
  });

  test.afterEach(async ({ context }) => {
    // Only clear browser storage - no database cleanup to avoid race conditions
    await context.clearCookies();
    await context.clearPermissions();
  });

  test.afterAll(async () => {
    try {
      // Cleanup - order matters due to foreign keys
      let taskIds: string[] = [];

      // 1. Get all task IDs created by test user
      if (testUserId) {
        const taskIdsResult = await pgClient.query(
          'SELECT id FROM "task" WHERE "ownerId" = $1',
          [testUserId]
        );
        taskIds = taskIdsResult.rows.map(row => row.id);
      }

      // Also clean up any tasks with our namespace in title (fallback cleanup)
      const namespaceTaskResult = await pgClient.query(
        'SELECT id FROM "task" WHERE title LIKE $1',
        [`%${testNamespace}%`]
      );
      const namespaceTaskIds = namespaceTaskResult.rows.map(row => row.id);
      taskIds = [...new Set([...taskIds, ...namespaceTaskIds])]; // Remove duplicates

      if (taskIds.length > 0) {
        // 2. Delete task assignments
        await pgClient.query(
          'DELETE FROM "task_assignment" WHERE "taskId" = ANY($1)',
          [taskIds]
        );

        // 3. Delete task tags
        await pgClient.query(
          'DELETE FROM "task_tag" WHERE "taskId" = ANY($1)',
          [taskIds]
        );

        // 4. Delete tasks
        await pgClient.query('DELETE FROM "task" WHERE id = ANY($1)', [
          taskIds,
        ]);
      }

      // 5. Delete user profile
      if (testUserId) {
        await pgClient.query('DELETE FROM "user_profile" WHERE id = $1', [
          testUserId,
        ]);
      }

      // 6. Delete auth user
      await supabaseClient.auth.signOut();
      if (testUserId) {
        await pgClient.query('DELETE FROM auth.users WHERE id = $1', [
          testUserId,
        ]);
      }

      // 7. Delete department
      if (testDepartmentId) {
        await pgClient.query('DELETE FROM "department" WHERE id = $1', [
          testDepartmentId,
        ]);
      }
    } catch {
      // Error during cleanup
    } finally {
      // 8. Close connections
      if (pgClient) {
        await pgClient.end();
      }
    }
  });

  test('should update recurring settings', async ({ page }) => {
    test.setTimeout(180000);

    // Login
    await page.goto('/auth/login');
    await page.getByLabel('Email').fill(testEmail);
    await page.getByLabel('Password').fill(testPassword);
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.waitForURL(/dashboard/, { timeout: 65000 });

    // Find and click edit button for our test task
    const editButton = page.getByTestId(`edit-task-button-${testTaskId}`);
    await expect(editButton).toBeVisible({ timeout: 30000 });
    await editButton.click();

    // Wait for modal to open - look for task title instead of heading
    await expect(page.getByTestId('task-title-display')).toBeVisible({
      timeout: 30000,
    });

    // Navigate to recurring settings section - scroll to section first
    await page.getByText(/🔄 Recurring Settings/).scrollIntoViewIfNeeded();

    // Click on recurring display to start editing
    await page.getByTestId('task-recurring-display').click();

    // Wait for the checkbox to appear and be visible
    const recurringCheckbox = page.getByTestId('recurring-checkbox');
    await expect(recurringCheckbox).toBeVisible({ timeout: 30000 });

    // Wait a bit for the elements to be ready
    await page.waitForTimeout(2000);

    // Update recurring interval
    const intervalInput = page.getByTestId('recurring-interval-input');
    await expect(intervalInput).toBeVisible({ timeout: 65000 });
    await intervalInput.clear();
    await intervalInput.type('14', { delay: 50 }); // Change to bi-weekly

    // Wait a bit to ensure the value is registered
    await page.waitForTimeout(2000);

    // Save changes
    const saveButton = page.getByRole('button', { name: /save|✓/i }).first();
    await expect(saveButton).toBeVisible({ timeout: 65000 });
    await expect(saveButton).toBeEnabled({ timeout: 65000 });
    await saveButton.click();

    // Verify success message - target only the specific success text
    await expect(page.getByText(/recurring settings updated/i)).toBeVisible({
      timeout: 65000,
    });

    // Wait for success message to disappear (component re-renders after fetchTask)
    await expect(page.getByText(/recurring settings updated/i)).not.toBeVisible(
      {
        timeout: 65000,
      }
    );

    // Verify updated settings display
    await expect(page.getByText(/✅ Enabled \(every 14 days\)/i)).toBeVisible({
      timeout: 65000,
    });
  });

  test('should disable recurring settings', async ({ page }) => {
    test.setTimeout(180000);

    // Login
    await page.goto('/auth/login');
    await page.getByLabel('Email').fill(testEmail);
    await page.getByLabel('Password').fill(testPassword);
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.waitForURL(/dashboard/, { timeout: 65000 });

    // Find and click edit button for our test task
    const editButton = page.getByTestId(`edit-task-button-${testTaskId}`);
    await expect(editButton).toBeVisible({ timeout: 30000 });
    await editButton.click();

    // Wait for modal to open - look for task title instead of heading
    await expect(page.getByTestId('task-title-display')).toBeVisible({
      timeout: 30000,
    });

    // Navigate to recurring settings section - scroll to section first
    await page.getByText(/🔄 Recurring Settings/).scrollIntoViewIfNeeded();

    // Click on recurring display to start editing
    await page.getByTestId('task-recurring-display').click();

    // Wait for the checkbox to appear and be visible
    const recurringCheckbox = page.getByTestId('recurring-checkbox');
    await expect(recurringCheckbox).toBeVisible({ timeout: 30000 });

    // Wait a bit for the elements to be ready
    await page.waitForTimeout(2000);

    // Disable recurring settings
    await recurringCheckbox.uncheck();

    // Wait a bit to ensure the change is registered
    await page.waitForTimeout(2000);

    // Save changes
    const saveButton = page.getByRole('button', { name: /save|✓/i }).first();
    await expect(saveButton).toBeVisible({ timeout: 65000 });
    await expect(saveButton).toBeEnabled({ timeout: 65000 });
    await saveButton.click();

    // Verify success message - target only the specific success text
    await expect(page.getByText(/recurring settings updated/i)).toBeVisible({
      timeout: 65000,
    });

    // Wait for success message to disappear (component re-renders after fetchTask)
    await expect(page.getByText(/recurring settings updated/i)).not.toBeVisible(
      {
        timeout: 65000,
      }
    );

    // Verify disabled settings display
    await expect(page.getByText(/❌ Not recurring/i)).toBeVisible({
      timeout: 65000,
    });
  });
});
