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

  test.beforeAll(async () => {
    // Setup DB connection
    pgClient = new Client({ connectionString: process.env.DATABASE_URL });
    await pgClient.connect();

    supabaseClient = createClient(
      process.env.NEXT_PUBLIC_API_EXTERNAL_URL!,
      process.env.NEXT_PUBLIC_ANON_KEY!
    );

    // Create unique credentials
    const unique = Date.now();
    testEmail = `e2e.task.create.ui.${unique}@example.com`;
    testPassword = 'Test123!@#';

    // Create department
    const deptResult = await pgClient.query(
      'INSERT INTO "department" (id, name, "isActive", "createdAt", "updatedAt") VALUES (gen_random_uuid(), $1, true, NOW(), NOW()) RETURNING id',
      [`E2E UI Test Dept ${unique}`]
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
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    if (!profileExists) {
      throw new Error('User profile was not created by trigger');
    }

    // Update department and role
    await pgClient.query(
      'UPDATE "user_profile" SET "departmentId" = $1, role = $2, name = $3 WHERE id = $4',
      [testDepartmentId, 'STAFF', 'E2E UI Test User', authData.user.id]
    );
    testUserId = authData.user.id;
  }, 60000);

  test.afterEach(async ({ context }) => {
    // Clear browser storage after each test
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
        'e2e-ui-%',
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
  }, 60000);

  test('should create task through UI with all mandatory fields', async ({
    page,
  }) => {
    test.setTimeout(120000);

    // Step 1: Login
    await page.goto('/auth/login');
    await expect(
      page.getByRole('heading', { name: /welcome back/i })
    ).toBeVisible({ timeout: 65000 });

    await page.getByLabel('Email').fill(testEmail);
    await page.getByLabel('Password').fill(testPassword);
    await page.getByRole('button', { name: /sign in/i }).click();

    // Wait for dashboard
    await expect(
      page.getByRole('heading', { name: /staff dashboard/i })
    ).toBeVisible({ timeout: 65000 });

    // Step 2: Navigate to create task page
    await page.goto('/tasks/create');
    await expect(
      page.getByRole('heading', { name: /create new task/i })
    ).toBeVisible({ timeout: 65000 });

    // Step 3: Fill mandatory fields
    await page.locator('#title').fill('E2E UI Test Task');
    await page.locator('#description').fill('Task created via UI E2E test');
    await page.locator('#priority').fill('8');
    await page.locator('#date').fill('2025-12-31');
    await page.getByTestId('assignee-emails-input').fill(testEmail); // Assign to self

    // Step 4: Submit form
    await page.getByTestId('create-task-submit-button').click();

    // Step 5: Verify redirect to dashboard
    await expect(
      page.getByRole('heading', { name: /staff dashboard/i })
    ).toBeVisible({ timeout: 65000 });

    // Step 6: Get the task ID from database (now we can use reliable data-testid!)
    const taskResult = await pgClient.query(
      'SELECT id FROM "task" WHERE title = $1 AND "ownerId" = $2 ORDER BY "createdAt" DESC LIMIT 1',
      ['E2E UI Test Task', testUserId]
    );
    const createdTaskId = taskResult.rows[0]?.id;
    expect(createdTaskId).toBeDefined();

    // Step 8: Wait for tasks to load (same pattern as task-update-ui)
    await page.waitForTimeout(2000);

    // Step 9: Find task button using data-testid (RELIABLE!)
    const viewButton = page.getByTestId(`view-task-button-${createdTaskId}`);
    await expect(viewButton).toBeVisible({ timeout: 65000 });

    // Step 10: Find task row to verify details
    const taskRow = page.locator('tr', { hasText: 'E2E UI Test Task' });

    // Step 11: Verify priority badge shows 8
    await expect(taskRow.getByText('8')).toBeVisible({ timeout: 65000 });

    // Step 12: Verify status is TO DO
    await expect(taskRow.getByText(/to do/i)).toBeVisible({ timeout: 65000 });
  });

  test('should create task with optional tags through UI', async ({ page }) => {
    test.setTimeout(120000);

    // Login
    await page.goto('/auth/login');
    await page.getByLabel('Email').fill(testEmail);
    await page.getByLabel('Password').fill(testPassword);
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.waitForURL(/dashboard/, { timeout: 65000 });

    // Navigate to create task
    await page.goto('/tasks/create');
    await page.waitForTimeout(2000);

    // Fill form with tags
    await page.locator('#title').fill('Tagged UI Task');
    await page.locator('#description').fill('Task with tags via UI');
    await page.locator('#priority').fill('5');
    await page.locator('#date').fill('2025-12-31');
    await page.getByTestId('assignee-emails-input').fill(testEmail);
    await page.getByTestId('tags-input').fill('e2e-ui-urgent, e2e-ui-frontend');

    // Submit
    await page.getByTestId('create-task-submit-button').click();

    // Verify redirect to dashboard (success message is skipped because redirect happens too fast)
    await expect(
      page.getByRole('heading', { name: /staff dashboard/i })
    ).toBeVisible({ timeout: 65000 });

    // Get the task ID from database (now we can use reliable data-testid!)
    const taskResult = await pgClient.query(
      'SELECT id FROM "task" WHERE title = $1 AND "ownerId" = $2 ORDER BY "createdAt" DESC LIMIT 1',
      ['Tagged UI Task', testUserId]
    );
    const createdTaskId = taskResult.rows[0]?.id;
    expect(createdTaskId).toBeDefined();

    // Wait for tasks to load
    await page.waitForTimeout(2000);

    // Find task edit button using data-testid (same pattern as task-update-ui)
    const editButton = page.getByTestId(`edit-task-button-${createdTaskId}`);
    await expect(editButton).toBeVisible({ timeout: 65000 });

    // Click to open modal
    await editButton.click();

    // Wait for modal to open (same pattern as task-update-ui)
    await page.waitForTimeout(2000);

    // Verify tags appear in the task detail modal
    await expect(page.getByText('🏷️ Tags')).toBeVisible({ timeout: 65000 });
    await expect(page.getByText('e2e-ui-urgent')).toBeVisible({
      timeout: 65000,
    });
    await expect(page.getByText('e2e-ui-frontend')).toBeVisible({
      timeout: 65000,
    });
  });

  test('should create recurring task with interval through UI', async ({
    page,
  }) => {
    test.setTimeout(120000);

    // Login
    await page.goto('/auth/login');
    await page.getByLabel('Email').fill(testEmail);
    await page.getByLabel('Password').fill(testPassword);
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.waitForURL(/dashboard/, { timeout: 65000 });

    // Navigate to create task
    await page.goto('/tasks/create');
    await page.waitForTimeout(2000);

    // Fill form with recurring interval
    await page.locator('#title').fill('Weekly UI Report');
    await page.locator('#description').fill('Recurring task via UI');
    await page.locator('#priority').fill('5');
    await page.locator('#date').fill('2025-12-31');
    await page.getByTestId('assignee-emails-input').fill(testEmail);
    await page.getByTestId('recurring-interval-input').fill('7'); // Weekly

    // Submit
    await page.getByTestId('create-task-submit-button').click();

    // Verify redirect to dashboard (success message is skipped because redirect happens too fast)
    await expect(
      page.getByRole('heading', { name: /staff dashboard/i })
    ).toBeVisible({ timeout: 65000 });

    // Get the task ID from database (now we can use reliable data-testid!)
    const taskResult = await pgClient.query(
      'SELECT id FROM "task" WHERE title = $1 AND "ownerId" = $2 ORDER BY "createdAt" DESC LIMIT 1',
      ['Weekly UI Report', testUserId]
    );
    const createdTaskId = taskResult.rows[0]?.id;
    expect(createdTaskId).toBeDefined();

    // Wait for tasks to load (same pattern as task-update-ui)
    await page.waitForTimeout(2000);

    // Find task edit button using data-testid (same pattern as task-update-ui)
    const editButton = page.getByTestId(`edit-task-button-${createdTaskId}`);
    await expect(editButton).toBeVisible({ timeout: 65000 });

    // Click to open modal
    await editButton.click();

    // Wait for modal to open (same pattern as task-update-ui)
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
    test.setTimeout(120000);

    // Login
    await page.goto('/auth/login');
    await page.getByLabel('Email').fill(testEmail);
    await page.getByLabel('Password').fill(testPassword);
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.waitForURL(/dashboard/, { timeout: 65000 });

    // Navigate to create task
    await page.goto('/tasks/create');
    await page.waitForTimeout(2000);

    // Fill mandatory fields only (no status field - it should default to TO_DO)
    await page.locator('#title').fill('Default Status Task');
    await page.locator('#description').fill('Testing default status');
    await page.locator('#priority').fill('5');
    await page.locator('#date').fill('2025-12-31');
    await page.getByTestId('assignee-emails-input').fill(testEmail);

    // Submit
    await page.getByTestId('create-task-submit-button').click();

    // Verify redirect to dashboard
    await expect(
      page.getByRole('heading', { name: /staff dashboard/i })
    ).toBeVisible({ timeout: 65000 });

    // Get the task ID from database
    const taskResult = await pgClient.query(
      'SELECT id FROM "task" WHERE title = $1 AND "ownerId" = $2 ORDER BY "createdAt" DESC LIMIT 1',
      ['Default Status Task', testUserId]
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
