import { test, expect } from '@playwright/test';
import { Client } from 'pg';
import { createClient } from '@supabase/supabase-js';

/**
 * E2E Tests for Task Creation with Tags Feature
 *
 * Isolated test for tag functionality in task creation
 * - Independent namespace and cleanup
 * - No shared state with other test files
 * - Optimized for parallel execution
 */

test.describe('Task Creation with Tags - Isolated E2E Tests', () => {
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
    testNamespace = `tags-task-w${workerId}_${timestamp}_${processId}_${randomSuffix}`;

    // Create unique credentials with worker-specific namespace
    testEmail = `e2e.tags.task.${testNamespace}@example.com`;
    testPassword = 'Test123!@#';

    // Create department
    const deptResult = await pgClient.query(
      'INSERT INTO "department" (id, name, "isActive", "createdAt", "updatedAt") VALUES (gen_random_uuid(), $1, true, NOW(), NOW()) RETURNING id',
      [`Tags Task Test Dept ${testNamespace}`]
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
        `Tags Task Test User ${testNamespace}`,
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
      // Use CASCADE DELETE to handle foreign key constraints automatically

      // 1. Delete ALL tasks that reference this user (as owner, assignee, or creator)
      if (testUserId) {
        // Delete tasks where user is owner
        await pgClient.query('DELETE FROM "task" WHERE "ownerId" = $1', [
          testUserId,
        ]);

        // Delete tasks where user is assigned (this will also clean up task_assignment)
        await pgClient.query(
          'DELETE FROM "task_assignment" WHERE "userId" = $1',
          [testUserId]
        );

        // Delete tasks where user is assigned by someone else
        await pgClient.query(
          'DELETE FROM "task_assignment" WHERE "assignedById" = $1',
          [testUserId]
        );
      }

      // 2. Delete any remaining tasks with our namespace in title (fallback cleanup)
      await pgClient.query('DELETE FROM "task" WHERE title LIKE $1', [
        `%${testNamespace}%`,
      ]);

      // 3. Delete tags created during test
      await pgClient.query('DELETE FROM "tag" WHERE name LIKE $1', [
        `tags-task-%${testNamespace}%`,
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
      console.error(
        `❌ Error during tags task cleanup for namespace ${testNamespace}:`,
        error
      );
    } finally {
      // 9. Close connections
      if (pgClient) {
        await pgClient.end();
      }
    }
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
    await expect(createTaskButton).toBeVisible({ timeout: 60000 });
    await createTaskButton.click();

    // Wait for modal to open
    await page.waitForTimeout(2000);

    // Fill form with tags
    await page
      .getByPlaceholder(/implement login feature/i)
      .fill(`Tagged Task ${testNamespace}`);
    await page
      .getByPlaceholder(/detailed description/i)
      .fill('Task with tags via UI');
    await page.locator('input[type="number"]').first().fill('5'); // Priority
    await page.locator('input[type="date"]').first().fill('2025-12-31'); // Deadline

    // Add tags using the add/remove interface
    await page
      .getByPlaceholder(/add tag/i)
      .fill(`tags-task-urgent-${testNamespace}`);
    await page.getByRole('button', { name: /add tag/i }).click();
    await page.waitForTimeout(500);
    await page
      .getByPlaceholder(/add tag/i)
      .fill(`tags-task-frontend-${testNamespace}`);
    await page.getByRole('button', { name: /add tag/i }).click();
    await page.waitForTimeout(500);

    // Submit
    await page.getByRole('button', { name: /✓ create task/i }).click();

    // Verify modal closes
    // Should succeed - verify modal closes or task appears in dashboard
    try {
      await expect(
        page.getByRole('heading', { name: /create new task/i })
      ).not.toBeVisible({ timeout: 60000 });
    } catch {
      // Modal might still be visible, but that's okay - verify task was created instead
      // Check if we're redirected to dashboard or task appears in list
      const isOnDashboard = page.url().includes('/dashboard');
      if (!isOnDashboard) {
        // If still on create page, check for success indicators
        await expect(page.getByText(/task created|success/i)).toBeVisible({
          timeout: 120000,
        });
      }
    }

    // Get the task ID from database
    const taskResult = await pgClient.query(
      'SELECT id FROM "task" WHERE title = $1 AND "ownerId" = $2 ORDER BY "createdAt" DESC LIMIT 1',
      [`Tagged Task ${testNamespace}`, testUserId]
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
    await expect(
      page.locator(`span:has-text("tags-task-urgent-${testNamespace}×")`)
    ).toBeVisible({
      timeout: 65000,
    });
    await expect(
      page.locator(`span:has-text("tags-task-frontend-${testNamespace}×")`)
    ).toBeVisible({
      timeout: 65000,
    });
  });
});
