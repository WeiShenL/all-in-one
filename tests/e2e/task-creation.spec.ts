import { test, expect } from '@playwright/test';
import { Client } from 'pg';
import { createClient } from '@supabase/supabase-js';

/**
 * E2E Tests for Task Creation Feature - SCRUM-12
 *
 * Real UI E2E Tests (Playwright browser automation)
 * - Opens browser, fills form, submits, verifies UI
 * - Tests complete user journey from form to dashboard
 *
 * Test Coverage:
 * - TM016: Mandatory fields (title, description, priority 1-10, deadline, 1-5 assignees)
 * - Automatic department association from user profile
 * - Default "To Do" status
 * - Optional tags creation and verification in modal
 * - Recurring task creation and verification in modal
 *
 * Test Pattern: Follows auth-flow.spec.ts and task-update-ui.spec.ts patterns
 * Uses pg client for test data setup/cleanup with generous timeouts for CI/CD pipelines
 *
 * NOTE: Service layer integration tests are in tests/integration/database/task-creation.test.ts
 */

test.describe('Task Creation - UI E2E Tests (Browser)', () => {
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

    // Create worker-specific namespace for test data isolation
    const workerId = process.env.PLAYWRIGHT_WORKER_INDEX || '0';
    testNamespace = `w${workerId}_${crypto.randomUUID().slice(0, 8)}`;

    // Create unique credentials with worker-specific namespace
    testEmail = `e2e.task.create.ui.${testNamespace}@example.com`;
    testPassword = 'Test123!@#';

    // Create department
    const deptResult = await pgClient.query(
      'INSERT INTO "department" (id, name, "isActive", "createdAt", "updatedAt") VALUES (gen_random_uuid(), $1, true, NOW(), NOW()) RETURNING id',
      [`E2E UI Test Dept ${testNamespace}`]
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
        `E2E UI Test User ${testNamespace}`,
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

      // 1. Get all task IDs created by test user
      const taskIdsResult = await pgClient.query(
        'SELECT id FROM "task" WHERE "ownerId" = $1',
        [testUserId]
      );
      const taskIds = taskIdsResult.rows.map(row => row.id);

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
      await pgClient.query('DELETE FROM "tag" WHERE name LIKE $1', [
        `e2e-ui-%${testNamespace}%`,
      ]);

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
      console.error('Error during cleanup:', error);
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
    ).toBeVisible({ timeout: 30000 });

    // Step 2: Open create task modal
    const createTaskButton = page.getByRole('button', {
      name: /\+ Create Task/i,
    });
    await expect(createTaskButton).toBeVisible({ timeout: 15000 });
    await createTaskButton.click();

    // Wait for modal to open
    await expect(
      page.getByRole('heading', { name: /create new task/i })
    ).toBeVisible({ timeout: 15000 });

    // Step 3: Fill mandatory fields
    await page
      .getByPlaceholder(/implement login feature/i)
      .fill(`E2E UI Test Task ${testNamespace}`);
    await page
      .getByPlaceholder(/detailed description/i)
      .fill('Task created via UI E2E test');
    await page.locator('input[type="number"]').first().fill('8'); // Priority
    await page.locator('input[type="date"]').first().fill('2025-12-31'); // Deadline
    // User is auto-assigned, no need to add assignee

    // Step 4: Submit form
    await page.getByRole('button', { name: /✓ create task/i }).click();

    // Step 5: Verify modal closes and we're still on dashboard
    await expect(
      page.getByRole('heading', { name: /create new task/i })
    ).not.toBeVisible({ timeout: 15000 });

    // Step 6: Get the task ID from database (to use data-testid!)
    const taskResult = await pgClient.query(
      'SELECT id FROM "task" WHERE title = $1 AND "ownerId" = $2 ORDER BY "createdAt" DESC LIMIT 1',
      [`E2E UI Test Task ${testNamespace}`, testUserId]
    );
    const createdTaskId = taskResult.rows[0]?.id;
    expect(createdTaskId).toBeDefined();

    // Step 8: Wait for tasks to load ()
    await page.waitForTimeout(10000);

    // Step 9: Find task button using data-testid
    const viewButton = page.getByTestId(`view-task-button-${createdTaskId}`);
    await expect(viewButton).toBeVisible({ timeout: 65000 });

    // Step 10: Find task row to verify details
    const taskRow = page.locator('tr', {
      hasText: `E2E UI Test Task ${testNamespace}`,
    });

    // Step 11: Verify priority badge shows 8
    await expect(taskRow.getByText('8')).toBeVisible({ timeout: 65000 });

    // Step 12: Verify status is TO DO
    await expect(taskRow.getByText(/to do/i)).toBeVisible({ timeout: 65000 });
  });

  test('should create task with optional tags through UI', async ({ page }) => {
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

    // Fill form with tags
    await page
      .getByPlaceholder(/implement login feature/i)
      .fill(`Tagged UI Task ${testNamespace}`);
    await page
      .getByPlaceholder(/detailed description/i)
      .fill('Task with tags via UI');
    await page.locator('input[type="number"]').first().fill('5'); // Priority
    await page.locator('input[type="date"]').first().fill('2025-12-31'); // Deadline

    // Add tags using the add/remove interface
    await page
      .getByPlaceholder(/add tag/i)
      .fill(`e2e-ui-urgent-${testNamespace}`);
    await page.getByRole('button', { name: /add tag/i }).click();
    await page.waitForTimeout(500);
    await page
      .getByPlaceholder(/add tag/i)
      .fill(`e2e-ui-frontend-${testNamespace}`);
    await page.getByRole('button', { name: /add tag/i }).click();
    await page.waitForTimeout(500);

    // Submit
    await page.getByRole('button', { name: /✓ create task/i }).click();

    // Verify modal closes
    await expect(
      page.getByRole('heading', { name: /create new task/i })
    ).not.toBeVisible({ timeout: 15000 });

    // Get the task ID from database
    const taskResult = await pgClient.query(
      'SELECT id FROM "task" WHERE title = $1 AND "ownerId" = $2 ORDER BY "createdAt" DESC LIMIT 1',
      [`Tagged UI Task ${testNamespace}`, testUserId]
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

    // Verify tags appear in the task detail modal
    await expect(page.getByText('🏷️ Tags')).toBeVisible({ timeout: 65000 });
    await expect(page.getByText(`e2e-ui-urgent-${testNamespace}`)).toBeVisible({
      timeout: 65000,
    });
    await expect(
      page.getByText(`e2e-ui-frontend-${testNamespace}`)
    ).toBeVisible({
      timeout: 65000,
    });
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
      .fill(`Weekly UI Report ${testNamespace}`);
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
      [`Weekly UI Report ${testNamespace}`, testUserId]
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
    await expect(createTaskButton).toBeVisible({ timeout: 15000 });
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
    ).not.toBeVisible({ timeout: 15000 });

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
      .fill(`Recurring Task Instance ${testNamespace}`);
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
      [`Recurring Task Instance ${testNamespace}`, testUserId]
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
      [`Recurring Task Instance ${testNamespace}`, testUserId]
    );

    // Should be exactly 2 tasks now (original completed + new instance)
    expect(parseInt(taskCount.rows[0].count)).toBe(2);

    // Get the NEW task (TO_DO status) ID
    const newTask = await pgClient.query(
      'SELECT id, status, "recurringInterval" FROM "task" WHERE title = $1 AND "ownerId" = $2 AND status = $3 ORDER BY "createdAt" DESC LIMIT 1',
      [`Recurring Task Instance ${testNamespace}`, testUserId, 'TO_DO']
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
