import { test, expect } from '@playwright/test';
import { Client } from 'pg';
import { createClient } from '@supabase/supabase-js';

/**
 * E2E Tests for Basic Task Update Feature
 *
 * Isolated test for core task update functionality
 * - Independent namespace and cleanup
 * - No shared state with other test files
 * - Optimized for parallel execution
 */

test.describe('Basic Task Update - Isolated E2E Tests', () => {
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
    testNamespace = `update-task-w${workerId}_${timestamp}_${processId}_${randomSuffix}`;

    // Create unique credentials with worker-specific namespace
    testEmail = `e2e.update.task.${testNamespace}@example.com`;
    testPassword = 'Test123!@#';

    // Create department
    const deptResult = await pgClient.query(
      'INSERT INTO "department" (id, name, "isActive", "createdAt", "updatedAt") VALUES (gen_random_uuid(), $1, true, NOW(), NOW()) RETURNING id',
      [`Update Task Test Dept ${testNamespace}`]
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
        `Update Task Test User ${testNamespace}`,
        authData.user.id,
      ]
    );
    testUserId = authData.user.id;

    // Create a test task to update
    const taskResult = await pgClient.query(
      'INSERT INTO "task" (id, title, description, priority, "dueDate", status, "ownerId", "departmentId", "createdAt", "updatedAt") VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, NOW(), NOW()) RETURNING id',
      [
        `Original Task ${testNamespace}`,
        'Original description',
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
        [`update-task-%${testNamespace}%`]
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
        `❌ Error during update task cleanup for namespace ${testNamespace}:`,
        error
      );
    } finally {
      // 9. Close connections
      if (pgClient) {
        await pgClient.end();
      }
    }
  });

  test('should update task title and description', async ({ page }) => {
    test.setTimeout(180000);

    // Login
    await page.goto('/auth/login');
    await page.getByLabel('Email').fill(testEmail);
    await page.getByLabel('Password').fill(testPassword);
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.waitForURL(/dashboard/, { timeout: 65000 });

    // Find and click edit button for our test task
    const editButton = page.getByTestId(`edit-task-button-${testTaskId}`);
    await expect(editButton).toBeVisible({ timeout: 60000 });
    await editButton.click();

    // Wait for modal to open - look for task title instead of heading
    await expect(page.getByTestId('task-title-display')).toBeVisible({
      timeout: 60000,
    });

    // Update title - click on title to start editing
    await page.getByTestId('task-title-display').click();
    const titleInput = page.getByTestId('task-title-input');
    await titleInput.clear();
    await titleInput.fill(`Updated Task ${testNamespace}`);
    await page
      .getByRole('button', { name: /✓ Save/i })
      .first()
      .click();

    // Verify title update success message (optional - may not appear in CI)
    try {
      await expect(page.getByText(/title updated|✅/i)).toBeVisible({
        timeout: 60000,
      });
    } catch {
      // Success message not visible, but that's okay - verify the actual change instead
    }

    // Verify the title was actually updated
    await expect(page.getByTestId('task-title-display')).toHaveText(
      `Updated Task ${testNamespace}`
    );

    // Update description - click on description to start editing
    await page.getByTestId('task-description-display').click();

    // Wait for the textarea to appear and be visible
    const descInput = page.getByTestId('task-description-input');
    await expect(descInput).toBeVisible({ timeout: 60000 });
    await descInput.clear();
    await descInput.fill('Updated description via E2E test');
    await page
      .getByRole('button', { name: /✓ Save/i })
      .first()
      .click();

    // Verify description update success message
    await expect(page.getByText(/description updated|✅/i)).toBeVisible({
      timeout: 60000,
    });
  });

  test('should update task priority and due date', async ({ page }) => {
    test.setTimeout(180000);

    // Login
    await page.goto('/auth/login');
    await page.getByLabel('Email').fill(testEmail);
    await page.getByLabel('Password').fill(testPassword);
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.waitForURL(/dashboard/, { timeout: 65000 });

    // Find and click edit button for our test task
    const editButton = page.getByTestId(`edit-task-button-${testTaskId}`);
    await expect(editButton).toBeVisible({ timeout: 60000 });
    await editButton.click();

    // Wait for modal to open - look for task title instead of heading
    await expect(page.getByTestId('task-title-display')).toBeVisible({
      timeout: 60000,
    });

    // Update priority - click on priority to start editing
    await page.getByTestId('task-priority-display').click();
    const priorityInput = page.getByTestId('task-priority-input');
    await priorityInput.clear();
    await priorityInput.fill('8');
    await page
      .getByRole('button', { name: /✓ Save/i })
      .first()
      .click();

    // Verify priority update success message (optional - may not appear in CI)
    try {
      await expect(page.getByText(/priority updated|✅/i)).toBeVisible({
        timeout: 60000,
      });
    } catch {
      // Success message not visible, but that's okay - verify the actual change instead
    }

    // Verify the priority was actually updated
    await expect(page.getByTestId('task-priority-display')).toHaveText('8');

    // Update due date - click on deadline to start editing
    await page.getByTestId('task-deadline-display').click();

    // Wait for the input field to appear and be visible
    const dateInput = page.getByTestId('deadline-input');
    await expect(dateInput).toBeVisible({ timeout: 60000 });
    await dateInput.fill('2025-11-15');
    await page
      .getByRole('button', { name: /✓ Save/i })
      .first()
      .click();

    // Verify due date update success message
    await expect(page.getByText(/deadline updated|✅/i)).toBeVisible({
      timeout: 60000,
    });
  });

  test('should update task status', async ({ page }) => {
    test.setTimeout(180000);

    // Login
    await page.goto('/auth/login');
    await page.getByLabel('Email').fill(testEmail);
    await page.getByLabel('Password').fill(testPassword);
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.waitForURL(/dashboard/, { timeout: 65000 });

    // Find and click edit button for our test task
    const editButton = page.getByTestId(`edit-task-button-${testTaskId}`);
    await expect(editButton).toBeVisible({ timeout: 60000 });
    await editButton.click();

    // Wait for modal to open - look for task title instead of heading
    await expect(page.getByTestId('task-title-display')).toBeVisible({
      timeout: 60000,
    });

    // Update status - click on status to start editing
    await page.getByTestId('task-status-display').click();
    const statusSelect = page.getByTestId('task-status-select');
    await expect(statusSelect).toBeVisible({ timeout: 60000 });
    await statusSelect.selectOption('IN_PROGRESS');
    await page
      .getByRole('button', { name: /✓ Save/i })
      .first()
      .click();

    // Verify success message (optional - may not appear in CI)
    try {
      await expect(page.getByText(/status updated|✅/i)).toBeVisible({
        timeout: 60000,
      });
    } catch {
      // Success message not visible, but that's okay - verify the actual change instead
    }

    // Verify the status was actually updated
    await expect(page.getByTestId('task-status-display')).toHaveText(
      'IN PROGRESS'
    );
  });
});
