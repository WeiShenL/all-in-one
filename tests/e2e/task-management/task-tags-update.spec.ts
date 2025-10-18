import { test, expect } from '@playwright/test';
import { Client } from 'pg';
import { createClient } from '@supabase/supabase-js';

/**
 * E2E Tests for Task Tags Update Feature
 *
 * Isolated test for task tag update functionality
 * - Independent namespace and cleanup
 * - No shared state with other test files
 * - Optimized for parallel execution
 */

test.describe('Task Tags Update - Isolated E2E Tests', () => {
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
    testNamespace = `tags-update-w${workerId}_${timestamp}_${processId}_${randomSuffix}`;

    // Create unique credentials with worker-specific namespace
    testEmail = `e2e.tags.update.${testNamespace}@example.com`;
    testPassword = 'Test123!@#';

    // Create department
    const deptResult = await pgClient.query(
      'INSERT INTO "department" (id, name, "isActive", "createdAt", "updatedAt") VALUES (gen_random_uuid(), $1, true, NOW(), NOW()) RETURNING id',
      [`Tags Update Test Dept ${testNamespace}`]
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
        `Tags Update Test User ${testNamespace}`,
        authData.user.id,
      ]
    );
    testUserId = authData.user.id;

    // Create a test task for tag updates
    const taskResult = await pgClient.query(
      'INSERT INTO "task" (id, title, description, priority, "dueDate", status, "ownerId", "departmentId", "createdAt", "updatedAt") VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, NOW(), NOW()) RETURNING id',
      [
        `Tags Update Task ${testNamespace}`,
        'Task for testing tag updates',
        5,
        new Date('2025-12-31'),
        'TO_DO',
        testUserId,
        testDepartmentId,
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

      // 5. Delete tags created during test
      const tagResult = await pgClient.query(
        'DELETE FROM "tag" WHERE name LIKE $1 RETURNING name',
        [`tags-update-%${testNamespace}%`]
      );
      if (tagResult.rows.length > 0) {
      }

      // 6. Delete user profile
      if (testUserId) {
        await pgClient.query('DELETE FROM "user_profile" WHERE id = $1', [
          testUserId,
        ]);
      }

      // 7. Delete auth user
      await supabaseClient.auth.signOut();
      if (testUserId) {
        await pgClient.query('DELETE FROM auth.users WHERE id = $1', [
          testUserId,
        ]);
      }

      // 8. Delete department
      if (testDepartmentId) {
        await pgClient.query('DELETE FROM "department" WHERE id = $1', [
          testDepartmentId,
        ]);
      }
    } catch (error) {
      console.error(
        `❌ Error during tags update cleanup for namespace ${testNamespace}:`,
        error
      );
    } finally {
      // 9. Close connections
      if (pgClient) {
        await pgClient.end();
      }
    }
  });

  test('should add and remove tags', async ({ page }) => {
    test.setTimeout(120000);

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
      timeout: 15000,
    });

    // Navigate to tags section - scroll to section first
    await page.getByText(/🏷️ Tags/).scrollIntoViewIfNeeded();

    // Wait for the tag input field to be visible
    const tagInput = page.getByTestId('tag-input');
    await expect(tagInput).toBeVisible({ timeout: 15000 });

    // Wait a bit for the field to be ready
    await page.waitForTimeout(2000);

    // Add first tag
    await tagInput.clear();
    await tagInput.fill('e2e-test-tag-urgent');

    // Wait and click add button
    await page.waitForTimeout(500);
    const addTagButton = page.getByTestId('add-tag-button');
    await expect(addTagButton).toBeEnabled({ timeout: 65000 });
    await addTagButton.click();

    // Verify success message - increased timeout as video shows 15s delay
    await expect(page.getByText(/tag added/i)).toBeVisible({
      timeout: 65000,
    });

    // Verify tag appears (longer timeout for CI/CD)
    await expect(page.getByText('e2e-test-tag-urgent')).toBeVisible({
      timeout: 65000,
    });

    // Add second tag - wait for input to be ready again
    await page.waitForTimeout(2000);
    await tagInput.clear();
    await tagInput.fill('e2e-test-tag-frontend');
    await page.waitForTimeout(2000);
    await addTagButton.click();

    await expect(page.getByText(/tag added/i)).toBeVisible({
      timeout: 65000,
    });
    await expect(page.getByText('e2e-test-tag-frontend')).toBeVisible({
      timeout: 65000,
    });

    // Remove first tag using data-testid
    await page.getByTestId('remove-tag-e2e-test-tag-urgent').click();

    // Wait for tag removal to complete and verify tag is gone
    await page.waitForTimeout(2000); // Give time for removal to process
    await expect(page.getByText('e2e-test-tag-urgent')).not.toBeVisible({
      timeout: 65000,
    });
  });
});
