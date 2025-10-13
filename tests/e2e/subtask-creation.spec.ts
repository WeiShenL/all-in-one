import { test, expect } from '@playwright/test';
import { Client } from 'pg';
import { createClient } from '@supabase/supabase-js';

/**
 * E2E Test for Subtask Creation - SCRUM-65 (Happy Path)
 *
 * This is a TRUE Playwright E2E test that:
 * 1. Creates test user with Supabase auth
 * 2. Creates parent task
 * 3. Logs in through the UI
 * 4. Navigates to task creation page
 * 5. Fills form and selects parent task (making it a subtask)
 * 6. Submits and verifies subtask appears
 * 7. Verifies subtask data in database
 */

test.describe('Subtask Creation E2E - SCRUM-65', () => {
  let pgClient: Client;
  let supabaseClient: ReturnType<typeof createClient>;
  let testDepartmentId: string;
  let testUserId: string;
  let testProjectId: string;
  let testParentTaskId: string;
  let testEmail: string;
  let testPassword: string;
  const createdSubtaskIds: string[] = [];

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
    testEmail = `e2e.subtask.${unique}@example.com`;
    testPassword = 'Test123!@#';

    // 1. Create department
    const deptResult = await pgClient.query(
      'INSERT INTO "department" (id, name, "isActive", "createdAt", "updatedAt") VALUES (gen_random_uuid(), $1, true, NOW(), NOW()) RETURNING id',
      [`E2E Subtask Dept ${unique}`]
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

    // 3. Wait for Supabase trigger to create user_profile
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
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    if (!profileExists) {
      throw new Error(
        'User profile was not created by trigger after 5 seconds'
      );
    }

    // Update the department, role, and name
    await pgClient.query(
      'UPDATE "user_profile" SET "departmentId" = $1, role = $2, name = $3 WHERE id = $4',
      [testDepartmentId, 'STAFF', 'E2E Subtask User', authData.user.id]
    );
    testUserId = authData.user.id;

    // 4. Create test project
    const projectResult = await pgClient.query(
      'INSERT INTO "project" (id, name, description, priority, status, "departmentId", "creatorId", "isArchived", "createdAt", "updatedAt") VALUES (gen_random_uuid(), $1, $2, 5, $3, $4, $5, false, NOW(), NOW()) RETURNING id',
      [
        'E2E Subtask Project',
        'Project for subtask E2E testing',
        'ACTIVE',
        testDepartmentId,
        testUserId,
      ]
    );
    testProjectId = projectResult.rows[0].id;

    // 5. Create parent task that user is assigned to
    const parentResult = await pgClient.query(
      'INSERT INTO "task" (id, title, description, priority, "dueDate", status, "ownerId", "departmentId", "projectId", "parentTaskId", "recurringInterval", "isArchived", "createdAt", "updatedAt") VALUES (gen_random_uuid(), $1, $2, 5, $3, $4, $5, $6, $7, NULL, NULL, false, NOW(), NOW()) RETURNING id',
      [
        'E2E Parent Task for Subtask',
        'Parent task to create subtasks under',
        new Date('2025-12-31'),
        'TO_DO',
        testUserId,
        testDepartmentId,
        testProjectId,
      ]
    );
    testParentTaskId = parentResult.rows[0].id;

    // 6. Assign user to parent task (required for creating subtasks)
    await pgClient.query(
      'INSERT INTO "task_assignment" ("taskId", "userId", "assignedById", "assignedAt") VALUES ($1, $2, $3, NOW())',
      [testParentTaskId, testUserId, testUserId]
    );
  });

  test.afterAll(async () => {
    // Cleanup in reverse order of dependencies

    // 1. Delete task-related records for subtasks
    for (const subtaskId of createdSubtaskIds) {
      await pgClient.query(
        'DELETE FROM "task_assignment" WHERE "taskId" = $1',
        [subtaskId]
      );
      await pgClient.query('DELETE FROM "task_log" WHERE "taskId" = $1', [
        subtaskId,
      ]);
      await pgClient.query('DELETE FROM "task_tag" WHERE "taskId" = $1', [
        subtaskId,
      ]);
      await pgClient.query('DELETE FROM "task" WHERE id = $1', [subtaskId]);
    }

    // 2. Delete task-related records for parent task
    if (testParentTaskId) {
      await pgClient.query(
        'DELETE FROM "task_assignment" WHERE "taskId" = $1',
        [testParentTaskId]
      );
      await pgClient.query('DELETE FROM "task_log" WHERE "taskId" = $1', [
        testParentTaskId,
      ]);
      await pgClient.query('DELETE FROM "task_tag" WHERE "taskId" = $1', [
        testParentTaskId,
      ]);
      await pgClient.query('DELETE FROM "task" WHERE id = $1', [
        testParentTaskId,
      ]);
    }

    // 3. Delete project
    if (testProjectId) {
      await pgClient.query('DELETE FROM "project" WHERE id = $1', [
        testProjectId,
      ]);
    }

    // 4. Delete user profile
    if (testUserId) {
      await pgClient.query('DELETE FROM "user_profile" WHERE id = $1', [
        testUserId,
      ]);
    }

    // 5. Delete auth user
    await supabaseClient.auth.signOut();
    const unique = testEmail.split('.')[2].split('@')[0];
    await pgClient.query('DELETE FROM auth.users WHERE email LIKE $1', [
      `e2e.subtask.${unique}%`,
    ]);

    // 6. Delete department
    if (testDepartmentId) {
      await pgClient.query('DELETE FROM "department" WHERE id = $1', [
        testDepartmentId,
      ]);
    }

    // 7. Close connections
    await pgClient.end();
  });

  test('should successfully create a subtask through the UI', async ({
    page,
  }) => {
    test.setTimeout(300000);
    /**
     * STEP 1: Login through UI
     */
    await page.goto('/auth/login');

    // Wait for login page to load
    await expect(
      page.getByRole('heading', { name: /welcome back/i })
    ).toBeVisible({ timeout: 10000 });

    // Fill email
    await page.getByLabel('Email').fill(testEmail);

    // Fill password
    await page.getByLabel('Password').fill(testPassword);

    // Click sign in button
    const signInButton = page.getByRole('button', { name: /sign in/i });
    await expect(signInButton).toBeEnabled({ timeout: 10000 });
    await signInButton.click();

    /**
     * STEP 2: Wait for dashboard to load
     */
    await expect(
      page.getByRole('heading', { name: /staff dashboard/i })
    ).toBeVisible({ timeout: 15000 });

    // Verify parent task appears in dashboard
    await expect(page.getByText('E2E Parent Task for Subtask')).toBeVisible({
      timeout: 10000,
    });

    /**
     * STEP 3: Navigate to Create Task page
     */
    const createTaskButton = page.getByRole('button', {
      name: /\+ Create Task/i,
    });
    await expect(createTaskButton).toBeVisible({ timeout: 10000 });
    await createTaskButton.click();

    // Wait for task creation form
    await expect(page).toHaveURL(/\/tasks\/create/, { timeout: 10000 });

    /**
     * STEP 4: Fill out subtask form
     */
    // Fill title
    await page.getByLabel(/title/i).fill('E2E Test Subtask');

    // Fill description
    await page
      .getByLabel(/description/i)
      .fill('This is a subtask created via Playwright E2E test');

    // Fill priority
    await page.getByLabel(/priority/i).fill('7');

    // Fill due date (using id selector)
    await page.locator('#date').fill('2025-12-30');

    // SELECT PARENT TASK - This makes it a subtask!
    const parentTaskSelect = page.locator('select[name="parentTaskId"]');
    await expect(parentTaskSelect).toBeVisible({ timeout: 5000 });
    await parentTaskSelect.selectOption(testParentTaskId);

    // Fill assignee emails (comma-separated in single input)
    await page
      .getByPlaceholder('user1@example.com, user2@example.com')
      .fill(testEmail);

    /**
     * STEP 5: Submit the form
     */
    const createButton = page.getByRole('button', {
      name: /create task/i,
      exact: false,
    });
    await expect(createButton).toBeEnabled({ timeout: 5000 });
    await createButton.click();

    /**
     * STEP 6: Verify redirect to dashboard
     */
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15000 });

    /**
     * STEP 7: Verify subtask appears in UI
     */
    // First verify parent task is still visible
    await expect(page.getByText('E2E Parent Task for Subtask')).toBeVisible({
      timeout: 20000,
    });

    // Click the dropdown arrow to expand the parent task and reveal subtasks
    // The dropdown button is next to parent tasks that have subtasks
    const dropdownButton = page
      .locator('tr')
      .filter({ hasText: 'E2E Parent Task for Subtask' })
      .locator('button')
      .first();
    await expect(dropdownButton).toBeVisible({ timeout: 20000 });
    await dropdownButton.click();

    // Now the subtask should be visible (indented under parent)
    await expect(page.getByText('E2E Test Subtask')).toBeVisible({
      timeout: 20000,
    });

    /**
     * STEP 8: Verify subtask data in database
     */
    const subtaskResult = await pgClient.query(
      'SELECT * FROM "task" WHERE "parentTaskId" = $1 AND title = $2',
      [testParentTaskId, 'E2E Test Subtask']
    );

    expect(subtaskResult.rows.length).toBe(1);
    const subtask = subtaskResult.rows[0];

    // Store for cleanup
    createdSubtaskIds.push(subtask.id);

    // Verify all subtask properties
    expect(subtask.title).toBe('E2E Test Subtask');
    expect(subtask.description).toBe(
      'This is a subtask created via Playwright E2E test'
    );
    expect(subtask.priority).toBe(7);
    expect(subtask.status).toBe('TO_DO');
    expect(subtask.parentTaskId).toBe(testParentTaskId);

    // Verify inheritance from parent (enforced by SubtaskService)
    expect(subtask.departmentId).toBe(testDepartmentId);
    expect(subtask.projectId).toBe(testProjectId);

    // Verify subtask constraints (enforced by SubtaskService)
    expect(subtask.recurringInterval).toBeNull();
    expect(subtask.isArchived).toBe(false);

    // Verify deadline is before or equal to parent deadline
    const parentDeadline = new Date('2025-12-31');
    const subtaskDeadline = new Date(subtask.dueDate);
    expect(subtaskDeadline.getTime()).toBeLessThanOrEqual(
      parentDeadline.getTime()
    );

    // Verify assignment was created
    const assignmentResult = await pgClient.query(
      'SELECT * FROM "task_assignment" WHERE "taskId" = $1',
      [subtask.id]
    );
    expect(assignmentResult.rows.length).toBeGreaterThan(0);
    expect(assignmentResult.rows[0].userId).toBe(testUserId);

    // Verify action log was created
    const logResult = await pgClient.query(
      'SELECT * FROM "task_log" WHERE "taskId" = $1 AND action = $2',
      [subtask.id, 'CREATED']
    );
    expect(logResult.rows.length).toBe(1);
    expect(logResult.rows[0].userId).toBe(testUserId);
    expect(logResult.rows[0].metadata.parentTaskId).toBe(testParentTaskId);
  });
});
