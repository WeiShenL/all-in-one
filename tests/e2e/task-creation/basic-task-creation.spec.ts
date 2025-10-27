import { test, expect } from '@playwright/test';
import { Client } from 'pg';
import { createClient } from '@supabase/supabase-js';

/**
 * E2E Tests for Basic Task Creation Feature
 *
 * Isolated test for core task creation functionality
 * - Independent namespace and cleanup
 * - No shared state with other test files
 * - Optimized for parallel execution
 */

test.describe('Basic Task Creation - Isolated E2E Tests', () => {
  let pgClient: Client;
  let supabaseClient: ReturnType<typeof createClient>;
  let testEmail: string;
  let testPassword: string;
  let testDepartmentId: string;
  let testUserId: string;
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
    testNamespace = `basic-task-w${workerId}_${timestamp}_${processId}_${randomSuffix}`;

    // Create unique credentials with worker-specific namespace
    testEmail = `e2e.basic.task.${testNamespace}@example.com`;
    testPassword = 'Test123!@#';

    // Create department
    const deptResult = await pgClient.query(
      'INSERT INTO "department" (id, name, "isActive", "createdAt", "updatedAt") VALUES (gen_random_uuid(), $1, true, NOW(), NOW()) RETURNING id',
      [`Basic Task Test Dept ${testNamespace}`]
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
        `Basic Task Test User ${testNamespace}`,
        authData.user.id,
      ]
    );
    testUserId = authData.user.id;
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
        // 2. Delete task assignments (task_assignment has taskId, userId, assignedById)
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
        [`basic-task-%${testNamespace}%`]
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
        `❌ Error during basic task cleanup for namespace ${testNamespace}:`,
        error
      );
    } finally {
      // 9. Close connections
      if (pgClient) {
        await pgClient.end();
      }
    }
  });

  test('should create task through UI with all mandatory fields', async ({
    page,
  }) => {
    test.setTimeout(220000);

    // Step 1: Login
    await page.goto('/auth/login');
    await expect(
      page.getByRole('heading', { name: /welcome back/i })
    ).toBeVisible({ timeout: 65000 });

    await page.getByLabel('Email').fill(testEmail);
    await page.getByLabel('Password').fill(testPassword);
    await page.getByRole('button', { name: /sign in/i }).click();

    // Wait for navigation to complete
    await page.waitForLoadState('networkidle');

    // Wait for dashboard with increased timeout
    await expect(
      page.getByRole('heading', { name: /personal dashboard/i })
    ).toBeVisible({ timeout: 60000 });

    // Step 2: Open create task modal
    const createTaskButton = page.getByRole('button', {
      name: /\+ Create Task/i,
    });
    await expect(createTaskButton).toBeVisible({ timeout: 60000 });
    await createTaskButton.click();

    // Wait for modal to open
    await expect(
      page.getByRole('heading', { name: /create new task/i })
    ).toBeVisible({ timeout: 60000 });

    // Step 3: Fill mandatory fields
    await page
      .getByPlaceholder(/implement login feature/i)
      .fill(`Basic Task ${testNamespace}`);
    await page
      .getByPlaceholder(/detailed description/i)
      .fill('Task created via basic E2E test');
    await page.locator('input[type="number"]').first().fill('8'); // Priority
    await page.locator('input[type="date"]').first().fill('2025-12-31'); // Deadline
    // User is auto-assigned, no need to add assignee

    // Step 4: Submit form
    await page.getByRole('button', { name: /✓ create task/i }).click();

    // Step 5: Verify modal closes and we're still on dashboard
    await expect(
      page.getByRole('heading', { name: /create new task/i })
    ).not.toBeVisible({ timeout: 60000 });

    // Step 6: Get the task ID from database (to use data-testid!)
    const taskResult = await pgClient.query(
      'SELECT id FROM "task" WHERE title = $1 AND "ownerId" = $2 ORDER BY "createdAt" DESC LIMIT 1',
      [`Basic Task ${testNamespace}`, testUserId]
    );
    const createdTaskId = taskResult.rows[0]?.id;
    expect(createdTaskId).toBeDefined();

    // Step 8: Wait for tasks to load ()
    await page.waitForTimeout(10000);

    // Step 9: Find task button using data-testid
    const viewButton = page.getByTestId(`view-task-button-${createdTaskId}`);
    await expect(viewButton).toBeVisible({ timeout: 65000 });

    // Step 10: Find task row to verify details using the view button
    const taskRow = page.locator('tr').filter({ has: viewButton });

    // Step 11: Verify priority badge shows 8 (use more specific selector)
    await expect(taskRow.locator('td').nth(2).getByText('8')).toBeVisible({
      timeout: 65000,
    });

    // Step 12: Verify status is TO DO (use more specific selector)
    await expect(taskRow.locator('td').nth(1).getByText(/to do/i)).toBeVisible({
      timeout: 65000,
    });
  });

  test('should set default status to TO_DO', async ({ page }) => {
    test.setTimeout(220000);

    // Login
    await page.goto('/auth/login');
    await page.getByLabel('Email').fill(testEmail);
    await page.getByLabel('Password').fill(testPassword);
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.waitForURL(/dashboard/, { timeout: 65000 });

    // Open create task modal
    const createTaskButton = page.getByRole('button', {
      name: /\+ Create Task/i,
    });
    await expect(createTaskButton).toBeVisible({ timeout: 60000 });
    await createTaskButton.click();

    // Wait for modal to open
    await page.waitForTimeout(2000);

    // Fill mandatory fields only (no status field - it should default to TO_DO)
    await page
      .getByPlaceholder(/implement login feature/i)
      .fill(`Default Status Task ${testNamespace}`);
    await page
      .getByPlaceholder(/detailed description/i)
      .fill('Testing default status');
    await page.locator('input[type="number"]').first().fill('5'); // Priority
    await page.locator('input[type="date"]').first().fill('2025-12-31'); // Deadline

    // Submit
    await page.getByRole('button', { name: /✓ create task/i }).click();

    // Verify modal closes
    await expect(
      page.getByRole('heading', { name: /create new task/i })
    ).not.toBeVisible({ timeout: 60000 });

    // Get the task ID from database
    const taskResult = await pgClient.query(
      'SELECT id FROM "task" WHERE title = $1 AND "ownerId" = $2 ORDER BY "createdAt" DESC LIMIT 1',
      [`Default Status Task ${testNamespace}`, testUserId]
    );
    const createdTaskId = taskResult.rows[0]?.id;
    expect(createdTaskId).toBeDefined();

    // Wait for tasks to load
    await page.waitForTimeout(2000);

    // Find task edit button using data-testid
    const editButton = page.getByTestId(`edit-task-button-${createdTaskId}`);
    await expect(editButton).toBeVisible({ timeout: 65000 });

    // Click to open modal
    await editButton.click();

    // Wait for modal to open
    await page.waitForTimeout(2000);

    // Verify status is TO_DO in the modal
    await expect(page.getByTestId('task-status-display')).toContainText(
      /to do/i,
      {
        timeout: 65000,
      }
    );
  });
});
