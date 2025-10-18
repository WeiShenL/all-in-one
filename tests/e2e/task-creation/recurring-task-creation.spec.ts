import { test, expect } from '@playwright/test';
import { Client } from 'pg';
import { createClient } from '@supabase/supabase-js';

/**
 * E2E Tests for Recurring Task Creation Feature
 *
 * Isolated test for recurring task functionality
 * - Independent namespace and cleanup
 * - No shared state with other test files
 * - Optimized for parallel execution
 */

test.describe('Recurring Task Creation - Isolated E2E Tests', () => {
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
    testNamespace = `recurring-task-w${workerId}_${timestamp}_${processId}_${randomSuffix}`;

    // Create unique credentials with worker-specific namespace
    testEmail = `e2e.recurring.task.${testNamespace}@example.com`;
    testPassword = 'Test123!@#';

    // Create department
    const deptResult = await pgClient.query(
      'INSERT INTO "department" (id, name, "isActive", "createdAt", "updatedAt") VALUES (gen_random_uuid(), $1, true, NOW(), NOW()) RETURNING id',
      [`Recurring Task Test Dept ${testNamespace}`]
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
        `Recurring Task Test User ${testNamespace}`,
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
        [`recurring-task-%${testNamespace}%`]
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
        `❌ Error during recurring task cleanup for namespace ${testNamespace}:`,
        error
      );
    } finally {
      // 9. Close connections
      if (pgClient) {
        await pgClient.end();
      }
    }
  });

  test('should create recurring task with interval through UI', async ({
    page,
  }) => {
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
    await expect(createTaskButton).toBeVisible({ timeout: 15000 });
    await createTaskButton.click();

    // Wait for modal to open
    await page.waitForTimeout(2000);

    // Fill form and enable recurring settings
    await page
      .getByPlaceholder(/implement login feature/i)
      .fill(`Weekly Report ${testNamespace}`);
    await page
      .getByPlaceholder(/detailed description/i)
      .fill('Recurring task via UI');
    await page.locator('input[type="number"]').first().fill('5'); // Priority
    await page.locator('input[type="date"]').first().fill('2025-12-31'); // Deadline

    // Enable recurring settings by clicking the checkbox
    await page.getByText(/enable recurring task/i).click();
    await page.waitForTimeout(500);

    // Fill recurring interval
    await page.getByPlaceholder(/e\.g\., 7/i).fill('7');

    // Submit
    await page.getByRole('button', { name: /✓ create task/i }).click();

    // Verify modal closes
    await expect(
      page.getByRole('heading', { name: /create new task/i })
    ).not.toBeVisible({ timeout: 15000 });

    // Get the task ID from database (now we can use reliable data-testid!)
    const taskResult = await pgClient.query(
      'SELECT id FROM "task" WHERE title = $1 AND "ownerId" = $2 ORDER BY "createdAt" DESC LIMIT 1',
      [`Weekly Report ${testNamespace}`, testUserId]
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

    // Verify recurring settings appear in the task detail modal
    await expect(page.getByText('🔄 Recurring Settings')).toBeVisible({
      timeout: 65000,
    });
    await expect(page.getByText(/✅ Enabled \(every 7 days\)/i)).toBeVisible({
      timeout: 65000,
    });
  });

  test('should NOT generate next instance for non-recurring completed tasks', async ({
    page,
  }) => {
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
    await expect(createTaskButton).toBeVisible({ timeout: 15000 });
    await createTaskButton.click();

    // Wait for modal to open
    await page.waitForTimeout(2000);

    // Create a NON-recurring task
    await page
      .getByPlaceholder(/implement login feature/i)
      .fill(`Non-Recurring Task ${testNamespace}`);
    await page
      .getByPlaceholder(/detailed description/i)
      .fill('This should not create new instance');
    await page.locator('input[type="number"]').first().fill('5'); // Priority
    await page.locator('input[type="date"]').first().fill('2025-12-31'); // Deadline
    // Do NOT enable recurring settings - leave checkbox unchecked

    // Submit
    await page.getByRole('button', { name: /✓ create task/i }).click();

    // Verify modal closes
    await expect(
      page.getByRole('heading', { name: /create new task/i })
    ).not.toBeVisible({ timeout: 15000 });

    // Get the task ID from database
    const taskResult = await pgClient.query(
      'SELECT id FROM "task" WHERE title = $1 AND "ownerId" = $2 ORDER BY "createdAt" DESC LIMIT 1',
      [`Non-Recurring Task ${testNamespace}`, testUserId]
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

    // Change status to COMPLETED
    await page.getByTestId('task-status-display').click();
    const statusSelect = page.getByTestId('task-status-select');
    await expect(statusSelect).toBeVisible({ timeout: 65000 });
    await page.waitForTimeout(2000);
    await statusSelect.selectOption('COMPLETED');
    await page.waitForTimeout(2000);

    // Click Save button
    const saveButton = page.getByRole('button', { name: /save|✓/i }).first();
    await expect(saveButton).toBeVisible({ timeout: 65000 });
    await expect(saveButton).toBeEnabled({ timeout: 65000 });
    await saveButton.click();

    // Verify success message
    await expect(page.getByText(/status updated|✅/i)).toBeVisible({
      timeout: 65000,
    });

    // Wait for update to complete
    await page.waitForTimeout(2000);

    // Query database to verify NO new task instance was created
    const taskCount = await pgClient.query(
      'SELECT COUNT(*) as count FROM "task" WHERE title = $1 AND "ownerId" = $2',
      [`Non-Recurring Task ${testNamespace}`, testUserId]
    );

    // Should still be exactly 1 task (no new instance created)
    expect(parseInt(taskCount.rows[0].count)).toBe(1);

    // Verify the original task is marked as completed
    const taskStatus = await pgClient.query(
      'SELECT status FROM "task" WHERE id = $1',
      [createdTaskId]
    );
    expect(taskStatus.rows[0].status).toBe('COMPLETED');
  });

  test('should automatically generate next instance when recurring task is completed', async ({
    page,
  }) => {
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
    await expect(createTaskButton).toBeVisible({ timeout: 15000 });
    await createTaskButton.click();

    // Wait for modal to open
    await page.waitForTimeout(2000);

    // Create a RECURRING task with interval
    await page
      .getByPlaceholder(/implement login feature/i)
      .fill(`Recurring Instance ${testNamespace}`);
    await page
      .getByPlaceholder(/detailed description/i)
      .fill('This should create new instance when completed');
    await page.locator('input[type="number"]').first().fill('5'); // Priority
    await page.locator('input[type="date"]').first().fill('2025-12-31'); // Deadline

    // Enable recurring settings
    await page.getByText(/enable recurring task/i).click();
    await page.waitForTimeout(500);
    await page.getByPlaceholder(/e\.g\., 7/i).fill('7'); // Weekly

    // Submit
    await page.getByRole('button', { name: /✓ create task/i }).click();

    // Verify modal closes
    await expect(
      page.getByRole('heading', { name: /create new task/i })
    ).not.toBeVisible({ timeout: 15000 });

    // Get the task ID from database
    const taskResult = await pgClient.query(
      'SELECT id FROM "task" WHERE title = $1 AND "ownerId" = $2 ORDER BY "createdAt" DESC LIMIT 1',
      [`Recurring Instance ${testNamespace}`, testUserId]
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

    // Change status to COMPLETED
    await page.getByTestId('task-status-display').click();
    const statusSelect = page.getByTestId('task-status-select');
    await expect(statusSelect).toBeVisible({ timeout: 65000 });
    await page.waitForTimeout(2000);
    await statusSelect.selectOption('COMPLETED');
    await page.waitForTimeout(2000);

    // Click Save button
    const saveButton = page.getByRole('button', { name: /save|✓/i }).first();
    await expect(saveButton).toBeVisible({ timeout: 65000 });
    await expect(saveButton).toBeEnabled({ timeout: 65000 });
    await saveButton.click();

    // Verify success message
    await expect(page.getByText(/status updated|✅/i)).toBeVisible({
      timeout: 65000,
    });

    // Wait for update to complete and new task to be generated
    await page.waitForTimeout(15000);

    // Close modal by pressing Escape or clicking outside
    await page.keyboard.press('Escape');
    await page.waitForTimeout(2000);

    // Reload the page to see the new auto-generated task
    await page.reload();
    await expect(
      page.getByRole('heading', { name: /personal dashboard/i })
    ).toBeVisible({ timeout: 65000 });
    await page.waitForTimeout(8000);

    // Query database to verify a NEW task instance WAS created
    const taskCount = await pgClient.query(
      'SELECT COUNT(*) as count FROM "task" WHERE title = $1 AND "ownerId" = $2',
      [`Recurring Instance ${testNamespace}`, testUserId]
    );

    // Should be exactly 2 tasks now (original completed + new instance)
    expect(parseInt(taskCount.rows[0].count)).toBe(2);

    // Get the NEW task (TO_DO status) ID
    const newTask = await pgClient.query(
      'SELECT id, status, "recurringInterval" FROM "task" WHERE title = $1 AND "ownerId" = $2 AND status = $3 ORDER BY "createdAt" DESC LIMIT 1',
      [`Recurring Instance ${testNamespace}`, testUserId, 'TO_DO']
    );

    expect(newTask.rows.length).toBe(1);
    const newTaskId = newTask.rows[0].id;
    expect(newTaskId).toBeDefined();
    expect(newTask.rows[0].recurringInterval).toBe(7); // New task has same recurring settings

    // Verify the new task appears in the UI using its data-testid
    const newTaskEditButton = page.getByTestId(`edit-task-button-${newTaskId}`);
    await expect(newTaskEditButton).toBeVisible({ timeout: 65000 });

    // Verify the new task row shows TO_DO status
    const newTaskRow = page.locator('tr').filter({ has: newTaskEditButton });
    await expect(newTaskRow.getByText(/to do/i)).toBeVisible({
      timeout: 65000,
    });

    // Verify the original completed task still exists
    const originalTaskEditButton = page.getByTestId(
      `edit-task-button-${createdTaskId}`
    );
    await expect(originalTaskEditButton).toBeVisible({ timeout: 65000 });

    // Verify the original task row shows COMPLETED status
    const originalTaskRow = page
      .locator('tr')
      .filter({ has: originalTaskEditButton });
    await expect(originalTaskRow.getByText(/completed/i)).toBeVisible({
      timeout: 65000,
    });
  });
});
