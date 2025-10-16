import { test, expect } from '@playwright/test';
import { Client } from 'pg';
import { createClient } from '@supabase/supabase-js';

/**
 * E2E Tests for Overdue Task Highlighting Feature
 *
 * User Story: As a user (Staff or Manager), I want overdue tasks to be visually highlighted,
 * so that I can immediately identify items that require urgent follow-up.
 *
 * Acceptance Criteria:
 * - AC1: Task is overdue if due date is in the past and status is NOT 'COMPLETED'
 * - AC2: Overdue due dates are highlighted distinctly (red background + red text)
 * - AC3: Completed tasks are NEVER shown as overdue, even if past due date
 *
 * Tests:
 * - Test 1: Verify overdue task displays red highlighting in task modal
 * - Test 2: Complete overdue task and verify highlighting turns gray (within same modal)
 */

test.describe('Overdue Task Highlighting', () => {
  // Run tests in serial mode so they execute sequentially
  test.describe.configure({ mode: 'serial' });

  let pgClient: Client;
  let supabaseClient: ReturnType<typeof createClient>;
  let testDepartmentId: string;
  let testUserId: string;
  let overdueTaskId: string;
  let testEmail: string;
  let testPassword: string;

  // Helper function to login and navigate to task edit view
  async function loginAndNavigateToOverdueTask(page: any) {
    await page.goto('/auth/login');

    // Wait for page to load
    await expect(
      page.getByRole('heading', { name: /welcome back/i })
    ).toBeVisible({ timeout: 65000 });

    // Fill email
    await page.getByLabel('Email').fill(testEmail);

    // Fill password
    await page.getByLabel('Password').fill(testPassword);

    // Click sign in button
    const signInButton = page.getByRole('button', { name: /sign in/i });
    await expect(signInButton).toBeEnabled({ timeout: 65000 });
    await signInButton.click();

    // Wait for dashboard
    await expect(
      page.getByRole('heading', { name: /personal dashboard/i })
    ).toBeVisible({ timeout: 65000 });

    // Wait a bit for tasks to load
    await page.waitForTimeout(2000);

    // Click the Edit button for the overdue task using data-testid
    const editButton = page.getByTestId(`edit-task-button-${overdueTaskId}`);
    await expect(editButton).toBeVisible({ timeout: 65000 });
    await editButton.click();

    // Wait for the modal/task card to open
    await page.waitForTimeout(2000);

    // The task details should be visible now
    await expect(page.getByText(/E2E Overdue Task/i).first()).toBeVisible({
      timeout: 65000,
    });
  }

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
    testEmail = `e2e.overdue.test.${unique}@example.com`;
    testPassword = 'Test123!@#';

    // 1. Create department
    const deptResult = await pgClient.query(
      'INSERT INTO "department" (id, name, "isActive", "createdAt", "updatedAt") VALUES (gen_random_uuid(), $1, true, NOW(), NOW()) RETURNING id',
      [`E2E Overdue Test Dept ${unique}`]
    );
    testDepartmentId = deptResult.rows[0].id;

    // 2. Create user with Supabase auth
    const { data: authData, error } = await supabaseClient.auth.signUp({
      email: testEmail,
      password: testPassword,
    });

    if (error || !authData.user) {
      throw new Error(`Failed to create test user: ${error?.message}`);
    }

    // 3. Wait for user_profile to be created by trigger
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
      throw new Error(
        'User profile was not created by trigger after 20 seconds'
      );
    }

    // Update the department, role, and name
    await pgClient.query(
      'UPDATE "user_profile" SET "departmentId" = $1, role = $2, name = $3 WHERE id = $4',
      [testDepartmentId, 'STAFF', 'E2E Overdue Test User', authData.user.id]
    );
    testUserId = authData.user.id;

    // 4. Create an OVERDUE task (due date in the past, status = TO_DO)
    const pastDate = new Date('2020-01-01'); // Way in the past (clearly overdue)
    const taskResult = await pgClient.query(
      'INSERT INTO "task" (id, title, description, priority, "dueDate", "ownerId", "departmentId", status, "createdAt", "updatedAt") VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, NOW(), NOW()) RETURNING id',
      [
        'E2E Overdue Task',
        'This task is overdue for testing highlighting',
        5,
        pastDate,
        testUserId,
        testDepartmentId,
        'TO_DO', // NOT completed, so should show as overdue
      ]
    );
    overdueTaskId = taskResult.rows[0].id;

    // 5. Create task assignment
    await pgClient.query(
      'INSERT INTO "task_assignment" ("taskId", "userId", "assignedById", "assignedAt") VALUES ($1, $2, $3, NOW())',
      [overdueTaskId, testUserId, testUserId]
    );
  });

  test.afterAll(async () => {
    // Cleanup - order matters due to foreign keys

    // 1. Delete task assignments
    await pgClient.query('DELETE FROM "task_assignment" WHERE "taskId" = $1', [
      overdueTaskId,
    ]);

    // 2. Delete task
    await pgClient.query('DELETE FROM "task" WHERE id = $1', [overdueTaskId]);

    // 3. Delete user profiles
    await pgClient.query(
      'DELETE FROM "user_profile" WHERE "departmentId" = $1',
      [testDepartmentId]
    );

    // 4. Delete auth users
    await supabaseClient.auth.signOut();
    const unique = testEmail.split('.')[3].split('@')[0];
    await pgClient.query('DELETE FROM auth.users WHERE email LIKE $1', [
      `e2e.overdue.test.${unique}%`,
    ]);

    // 5. Delete department
    await pgClient.query('DELETE FROM "department" WHERE id = $1', [
      testDepartmentId,
    ]);

    // 6. Close connections
    await pgClient.end();
  });

  test('AC2: should display red highlighting for overdue task in task modal', async ({
    page,
  }) => {
    test.setTimeout(120000); // 2 minute timeout for CI/CD

    // Login and open the overdue task modal
    await loginAndNavigateToOverdueTask(page);

    // Find the TaskDatePill INSIDE the task modal (scope to deadline display to avoid table row pill)
    const datePill = page
      .getByTestId('task-deadline-display')
      .getByTestId('task-date-pill');
    await expect(datePill).toBeVisible({ timeout: 65000 });

    // Verify the date pill has RED styling (overdue)
    // Background color: rgb(254, 226, 226) = #fee2e2
    // Text color: rgb(220, 38, 38) = #dc2626
    await expect(datePill).toHaveCSS('background-color', 'rgb(254, 226, 226)', {
      timeout: 65000,
    });
    await expect(datePill).toHaveCSS('color', 'rgb(220, 38, 38)', {
      timeout: 65000,
    });

    // Verify the date is displayed (1/1/2020 or locale-specific format)
    await expect(datePill).toHaveText(/1\/1\/2020|2020/i, {
      timeout: 65000,
    });
  });

  test('AC3: should turn gray when overdue task is marked as COMPLETED (in same modal)', async ({
    page,
  }) => {
    test.setTimeout(120000); // 2 minute timeout for CI/CD

    // Login and open the same overdue task modal
    await loginAndNavigateToOverdueTask(page);

    // Find the TaskDatePill INSIDE the task modal (scope to deadline display to avoid table row pill)
    const datePill = page
      .getByTestId('task-deadline-display')
      .getByTestId('task-date-pill');
    await expect(datePill).toBeVisible({ timeout: 65000 });

    // Now change the task status to COMPLETED (without leaving the modal)
    // Click on the status display to trigger edit mode
    await page.getByTestId('task-status-display').click();

    // Wait for the select element to appear and be visible
    const statusSelect = page.getByTestId('task-status-select');
    await expect(statusSelect).toBeVisible({ timeout: 65000 });

    // Wait a bit for the field to be ready
    await page.waitForTimeout(2000);

    // Select COMPLETED status
    await statusSelect.selectOption('COMPLETED');

    // Wait a bit to ensure the selection is registered
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

    // Wait for UI to update after status change
    await page.waitForTimeout(2000);

    // Verify status badge shows COMPLETED
    await expect(
      page.getByTestId('task-status-display').getByText(/COMPLETED/i)
    ).toBeVisible({
      timeout: 65000,
    });

    // CRITICAL ASSERTION: Verify the date pill is now GRAY (not red)
    // Even though the task is still overdue (past due date), it should NOT show red
    // because status is COMPLETED
    // Background color: rgb(243, 244, 246) = #f3f4f6
    // Text color: rgb(107, 114, 128) = #6b7280
    await expect(datePill).toHaveCSS('background-color', 'rgb(243, 244, 246)', {
      timeout: 65000,
    });
    await expect(datePill).toHaveCSS('color', 'rgb(107, 114, 128)', {
      timeout: 65000,
    });

    // Date should still be displayed
    await expect(datePill).toHaveText(/1\/1\/2020|2020/i, {
      timeout: 65000,
    });
  });
});
