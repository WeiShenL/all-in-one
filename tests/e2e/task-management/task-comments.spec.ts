import { test, expect } from '@playwright/test';
import { Client } from 'pg';
import { createClient } from '@supabase/supabase-js';

/**
 * E2E Tests for Task Comments Feature
 *
 * Isolated test for task comment functionality
 * - Independent namespace and cleanup
 * - No shared state with other test files
 * - Optimized for parallel execution
 */

test.describe('Task Comments - Isolated E2E Tests', () => {
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
    testNamespace = `comments-task-w${workerId}_${timestamp}_${processId}_${randomSuffix}`;

    // Create unique credentials with worker-specific namespace
    testEmail = `e2e.comments.task.${testNamespace}@example.com`;
    testPassword = 'Test123!@#';

    // Create department
    const deptResult = await pgClient.query(
      'INSERT INTO "department" (id, name, "isActive", "createdAt", "updatedAt") VALUES (gen_random_uuid(), $1, true, NOW(), NOW()) RETURNING id',
      [`Comments Task Test Dept ${testNamespace}`]
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
        `Comments Task Test User ${testNamespace}`,
        authData.user.id,
      ]
    );
    testUserId = authData.user.id;

    // Create a test task for comments
    const taskResult = await pgClient.query(
      'INSERT INTO "task" (id, title, description, priority, "dueDate", status, "ownerId", "departmentId", "createdAt", "updatedAt") VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, NOW(), NOW()) RETURNING id',
      [
        `Comments Task ${testNamespace}`,
        'Task for testing comments',
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
        // 2. Delete comments first
        await pgClient.query('DELETE FROM "comment" WHERE "taskId" = ANY($1)', [
          taskIds,
        ]);

        // 3. Delete task assignments
        await pgClient.query(
          'DELETE FROM "task_assignment" WHERE "taskId" = ANY($1)',
          [taskIds]
        );

        // 4. Delete task tags
        await pgClient.query(
          'DELETE FROM "task_tag" WHERE "taskId" = ANY($1)',
          [taskIds]
        );

        // 5. Delete tasks
        await pgClient.query('DELETE FROM "task" WHERE id = ANY($1)', [
          taskIds,
        ]);
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
        `❌ Error during comments task cleanup for namespace ${testNamespace}:`,
        error
      );
    } finally {
      // 9. Close connections
      if (pgClient) {
        await pgClient.end();
      }
    }
  });

  test('should add comment to task', async ({ page }) => {
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

    // Navigate to comments section - use more specific selector
    await expect(
      page.getByRole('heading', { name: /💬 Comments/i })
    ).toBeVisible({ timeout: 30000 });

    // Add a comment
    const commentText = `Test comment ${testNamespace}`;

    // Wait for comment input to be visible
    const commentInput = page.getByTestId('comment-input');
    await expect(commentInput).toBeVisible({ timeout: 30000 });

    // Wait a bit for the field to be ready
    await page.waitForTimeout(2000);

    await commentInput.clear();
    await commentInput.fill(commentText);

    // Wait and click add button
    await page.waitForTimeout(500);
    await page.getByTestId('add-comment-button').click();

    // Verify comment appears
    await expect(page.getByText(commentText)).toBeVisible({ timeout: 30000 });
  });

  test('should edit own comment only', async ({ page }) => {
    test.setTimeout(180000);

    // First, add a comment via database
    const commentText = `Editable comment ${testNamespace}`;
    const commentResult = await pgClient.query(
      'INSERT INTO "comment" (id, content, "taskId", "userId", "createdAt", "updatedAt") VALUES (gen_random_uuid(), $1, $2, $3, NOW(), NOW()) RETURNING id',
      [commentText, testTaskId, testUserId]
    );
    const testCommentId = commentResult.rows[0].id;

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

    // Wait for modal to open - wait for task title display to be visible
    await expect(page.getByTestId('task-title-display')).toBeVisible({
      timeout: 30000,
    });

    // Navigate to comments section - use more specific selector
    await expect(
      page.getByRole('heading', { name: /💬 Comments/i })
    ).toBeVisible({ timeout: 30000 });

    // Find the comment and click edit
    const commentElement = page.getByText(commentText);
    await expect(commentElement).toBeVisible({ timeout: 30000 });

    // Look for edit button using test ID
    const editCommentButton = page.getByTestId(
      `comment-edit-button-${testCommentId}`
    );
    await expect(editCommentButton).toBeVisible({ timeout: 30000 });
    await editCommentButton.click();

    // Edit the comment
    const updatedText = `Updated comment ${testNamespace}`;

    // Wait for the textarea to appear after clicking edit
    const textarea = page.locator('textarea').first();
    await expect(textarea).toBeVisible({ timeout: 30000 });
    await textarea.clear();
    await textarea.fill(updatedText);

    // Wait a bit to ensure the text is registered
    await page.waitForTimeout(1000);

    // Save the edit
    await page.getByTestId(`comment-save-button-${testCommentId}`).click();

    // Verify updated comment appears
    await expect(page.getByText(updatedText)).toBeVisible({ timeout: 30000 });
  });
});
