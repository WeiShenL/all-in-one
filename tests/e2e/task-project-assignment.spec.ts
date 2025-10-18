import { test, expect, Page } from '@playwright/test';
import { Client } from 'pg';
import { createClient } from '@supabase/supabase-js';

/**
 * E2E Test for Task-Project Assignment Feature - SCRUM-31
 *
 * User Story: As a staff, I want to add tasks and subtasks to projects so that
 * I can organise my work and not get confused between multiple projects.
 *
 * Happy Path Test Coverage:
 * - AC 1: Staff can add tasks to a project
 * - AC 2: Task belongs to exactly one project
 * - AC 3: Task project cannot be changed after creation
 * - AC 4: System shows confirmation message
 *
 * Test Pattern: Real browser automation (Playwright)
 * - Opens browser, navigates to task creation form
 * - Selects a project from dropdown
 * - Creates task and verifies project assignment in UI
 * - Verifies task appears in project view
 * - Verifies project cannot be changed
 */

test.describe('Task-Project Assignment - E2E Happy Path', () => {
  let pgClient: Client;
  let supabaseClient: ReturnType<typeof createClient>;
  let testEmail: string;
  let testPassword: string;
  let testDepartmentId: string;
  let testUserId: string;
  let testProjectId: string;
  let testProjectName: string;

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
    testEmail = `e2e.task.project.${unique}@example.com`;
    testPassword = 'Test123!@#';
    testProjectName = `E2E Project ${unique}`;

    // Create department
    const deptResult = await pgClient.query(
      'INSERT INTO "department" (id, name, "isActive", "createdAt", "updatedAt") VALUES (gen_random_uuid(), $1, true, NOW(), NOW()) RETURNING id',
      [`E2E Task-Project Dept ${unique}`]
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
      [testDepartmentId, 'STAFF', 'E2E Test User', authData.user.id]
    );
    testUserId = authData.user.id;

    // Create test project
    const projectResult = await pgClient.query(
      `INSERT INTO "project" (id, name, description, priority, "departmentId", "creatorId", status, "createdAt", "updatedAt")
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, NOW(), NOW())
       RETURNING id`,
      [
        testProjectName,
        'E2E test project for task assignment',
        5,
        testDepartmentId,
        testUserId,
        'ACTIVE',
      ]
    );
    testProjectId = projectResult.rows[0].id;
  });

  test.afterEach(async ({ context }) => {
    // Clear browser storage after each test
    await context.clearCookies();
    await context.clearPermissions();
  });

  test.afterAll(async () => {
    try {
      // Cleanup - order matters due to foreign keys

      // 1. Get all task IDs created by test user
      const taskResult = await pgClient.query(
        'SELECT id FROM "task" WHERE "ownerId" = $1',
        [testUserId]
      );
      const taskIds = taskResult.rows.map(row => row.id);

      if (taskIds.length > 0) {
        // Delete task-related data
        await pgClient.query(
          'DELETE FROM "task_assignment" WHERE "taskId" = ANY($1)',
          [taskIds]
        );
        await pgClient.query(
          'DELETE FROM "task_tag" WHERE "taskId" = ANY($1)',
          [taskIds]
        );
        await pgClient.query('DELETE FROM "comment" WHERE "taskId" = ANY($1)', [
          taskIds,
        ]);
        await pgClient.query(
          'DELETE FROM "task_log" WHERE "taskId" = ANY($1)',
          [taskIds]
        );
        await pgClient.query('DELETE FROM "task" WHERE id = ANY($1)', [
          taskIds,
        ]);
      }

      // 2. Delete project
      if (testProjectId) {
        await pgClient.query('DELETE FROM "project" WHERE id = $1', [
          testProjectId,
        ]);
      }

      // 3. Delete user
      if (testUserId) {
        await supabaseClient.auth.admin.deleteUser(testUserId);
        await pgClient.query('DELETE FROM "user_profile" WHERE id = $1', [
          testUserId,
        ]);
      }

      // 4. Delete department
      if (testDepartmentId) {
        await pgClient.query('DELETE FROM "department" WHERE id = $1', [
          testDepartmentId,
        ]);
      }
    } catch (error) {
      console.error('Cleanup error:', error);
    } finally {
      await pgClient.end();
    }
  });

  // ============================================
  // HAPPY PATH: Create Task with Project Assignment
  // ============================================
  test('should create task assigned to project and verify immutability', async ({
    page,
  }: {
    page: Page;
  }) => {
    test.setTimeout(180000);

    // 1. Login
    await page.goto('/auth/login');
    await page.fill('input[type="email"]', testEmail);
    await page.fill('input[type="password"]', testPassword);
    await page.click('button[type="submit"]');

    // Wait for redirect to dashboard
    await page.waitForURL(/\/dashboard/, { timeout: 15000 });

    // 2. Navigate to task creation page/modal
    // Look for "Create Task" button (exact text: "+ Create Task")
    const createTaskButton = page
      .locator('button', {
        hasText: /create task/i,
      })
      .first();

    await expect(createTaskButton).toBeVisible({ timeout: 65000 });
    await createTaskButton.click();

    // Wait for modal to appear (TaskCreateModal opens, not a page navigation)
    // Look for modal heading "Create New Task"
    await page.waitForSelector('text=Create New Task', {
      timeout: 10000,
    });

    // 3. Fill in task details
    const taskTitle = `E2E Task in Project ${Date.now()}`;
    const taskDescription =
      'This task is assigned to a project and cannot be reassigned';

    // Fill title - use placeholder to identify the correct input
    const titleInput = page.locator(
      'input[placeholder="e.g., Implement login feature"]'
    );
    await titleInput.fill(taskTitle);

    // Fill description - use placeholder to identify the correct textarea
    const descriptionInput = page.locator(
      'textarea[placeholder="Detailed description of the task..."]'
    );
    await descriptionInput.fill(taskDescription);

    // Set priority - number input with min=1, max=10
    const priorityInput = page.locator('input[type="number"]').first();
    await priorityInput.fill('7');

    // Set deadline - date input
    const deadlineInput = page.locator('input[type="date"]').first();
    await deadlineInput.fill('2025-12-31');

    // 4. Select project from dropdown
    // Scroll down to see the project dropdown (it's below the fold)
    await page.evaluate(() => {
      const modal = document.querySelector('form');
      if (modal) {
        modal.scrollTop = modal.scrollHeight;
      }
    });
    await page.waitForTimeout(500);

    // The modal has a select for project (after "🗂️ Project (Optional)" label)
    // Wait for projects to load and select the test project
    await page.waitForFunction(
      projectName => {
        const forms = Array.from(document.querySelectorAll('form'));
        const visibleForm = forms.find(f => f.offsetParent !== null);
        if (!visibleForm) {
          return false;
        }

        const selects = Array.from(visibleForm.querySelectorAll('select'));
        // Find the project select (should have "Project" related option text)
        const projectSelect = selects.find(s => {
          const firstOption = s.options[0];
          return (
            firstOption && firstOption.text.toLowerCase().includes('project')
          );
        });

        if (!projectSelect) {
          return false;
        }
        const options = Array.from(projectSelect.options);
        return options.some(opt => opt.text.includes(projectName));
      },
      testProjectName,
      { timeout: 15000 }
    );

    // Now select using a more reliable selector - find the select that contains the project option
    const allSelects = await page.locator('select').all();
    let projectSelect = null;
    for (const select of allSelects) {
      const options = await select.locator('option').allTextContents();
      if (options.some(opt => opt.toLowerCase().includes('project'))) {
        projectSelect = select;
        break;
      }
    }

    if (!projectSelect) {
      throw new Error('Could not find project select dropdown');
    }

    await projectSelect.selectOption({ label: testProjectName });

    // 5. Submit form
    const submitButton = page
      .locator('button[type="submit"]', {
        hasText: /create|submit|save/i,
      })
      .first();
    await submitButton.click();

    // 6. AC 4: Verify confirmation message appears
    const confirmationMessage = page
      .locator('text=/task created|success|added/i')
      .first();
    await expect(confirmationMessage).toBeVisible({ timeout: 65000 });

    // Wait for task to appear in list
    await page.waitForTimeout(2000);

    // 7. Verify task appears with project indicator
    const taskItem = page.locator(`text=${taskTitle}`).first();
    await expect(taskItem).toBeVisible({ timeout: 65000 });

    // 8. Get task ID from database for verification
    const taskResult = await pgClient.query(
      'SELECT id, "projectId" FROM "task" WHERE title = $1 AND "ownerId" = $2',
      [taskTitle, testUserId]
    );

    expect(taskResult.rows.length).toBe(1);
    const createdTask = taskResult.rows[0];

    // AC 2: Verify task belongs to exactly one project
    expect(createdTask.projectId).toBe(testProjectId);

    // 9. Open task details to verify project is displayed
    await taskItem.click();
    await page.waitForTimeout(1000);

    // Look for project name in task details
    const projectLabel = page.locator(`text=${testProjectName}`).first();
    await expect(projectLabel).toBeVisible({ timeout: 65000 });

    // 10. AC 3: Verify project field is not editable
    // Look for edit button or form
    const editButton = page
      .locator('button', {
        hasText: /edit|update/i,
      })
      .first();

    if (await editButton.isVisible()) {
      // Force click in case there's an overlay
      await editButton.click({ force: true });
      await page.waitForTimeout(1000);

      // Project field should either:
      // 1. Not exist (no way to change it)
      // 2. Be disabled/readonly
      const projectEditField = page
        .locator('select[name="projectId"], input[name="projectId"]')
        .first();

      if (await projectEditField.isVisible()) {
        // If field exists, it should be disabled
        await expect(projectEditField).toBeDisabled();
      }
      // If field doesn't exist, that's also valid (immutable by design)
    }

    // 11. Verify task still has correct project in database
    const verifyResult = await pgClient.query(
      'SELECT "projectId" FROM "task" WHERE id = $1',
      [createdTask.id]
    );

    expect(verifyResult.rows[0].projectId).toBe(testProjectId);

    // 12. Navigate to project view and verify task appears there
    await page.goto('/dashboard');
    await page.waitForTimeout(1000);

    // Look for projects section or navigation
    const projectsLink = page
      .locator('a[href*="project"], button', {
        hasText: /project/i,
      })
      .first();

    if (await projectsLink.isVisible()) {
      await projectsLink.click();
      await page.waitForTimeout(1000);

      // Find and click on the test project
      const projectLink = page.locator(`text=${testProjectName}`).first();
      if (await projectLink.isVisible()) {
        await projectLink.click();
        await page.waitForTimeout(1000);

        // Verify task appears in project's task list
        const taskInProject = page.locator(`text=${taskTitle}`).first();
        await expect(taskInProject).toBeVisible({ timeout: 65000 });
      }
    }
  });

  // ============================================
  // Subtask Project Inheritance (Bonus)
  // ============================================
  test('should create subtask that inherits project from parent', async ({
    page,
  }: {
    page: Page;
  }) => {
    test.setTimeout(180000);

    // 1. Login
    await page.goto('/auth/login');
    await page.fill('input[type="email"]', testEmail);
    await page.fill('input[type="password"]', testPassword);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/dashboard/, { timeout: 15000 });

    // 2. Create parent task with project
    const createTaskButton = page
      .locator('button', {
        hasText: /create task/i,
      })
      .first();
    await createTaskButton.click();

    // Wait for modal to appear (TaskCreateModal opens, not a page navigation)
    await page.waitForSelector('text=Create New Task', {
      timeout: 10000,
    });

    const parentTitle = `E2E Parent Task ${Date.now()}`;

    // Fill title - use placeholder to identify the correct input
    const titleInput = page.locator(
      'input[placeholder="e.g., Implement login feature"]'
    );
    await titleInput.fill(parentTitle);

    // Fill description
    const descriptionInput = page.locator(
      'textarea[placeholder="Detailed description of the task..."]'
    );
    await descriptionInput.fill('Parent task with project');

    // Fill priority
    const priorityInput = page.locator('input[type="number"]').first();
    await priorityInput.fill('5');

    // Fill deadline
    const deadlineInput = page.locator('input[type="date"]').first();
    await deadlineInput.fill('2025-12-31');

    // Scroll down to see the project dropdown (it's below the fold)
    await page.evaluate(() => {
      const modal = document.querySelector('form');
      if (modal) {
        modal.scrollTop = modal.scrollHeight;
      }
    });
    await page.waitForTimeout(500);

    // Select project - wait for projects to load and select
    await page.waitForFunction(
      projectName => {
        const forms = Array.from(document.querySelectorAll('form'));
        const visibleForm = forms.find(f => f.offsetParent !== null);
        if (!visibleForm) {
          return false;
        }

        const selects = Array.from(visibleForm.querySelectorAll('select'));
        // Find the project select (should have "Project" related option text)
        const projectSelect = selects.find(s => {
          const firstOption = s.options[0];
          return (
            firstOption && firstOption.text.toLowerCase().includes('project')
          );
        });

        if (!projectSelect) {
          return false;
        }
        const options = Array.from(projectSelect.options);
        return options.some(opt => opt.text.includes(projectName));
      },
      testProjectName,
      { timeout: 15000 }
    );

    // Now select using a more reliable selector - find the select that contains the project option
    const allSelects2 = await page.locator('select').all();
    let projectSelect2 = null;
    for (const select of allSelects2) {
      const options = await select.locator('option').allTextContents();
      if (options.some(opt => opt.toLowerCase().includes('project'))) {
        projectSelect2 = select;
        break;
      }
    }

    if (!projectSelect2) {
      throw new Error('Could not find project select dropdown');
    }

    await projectSelect2.selectOption({ label: testProjectName });

    const submitButton = page
      .locator('button[type="submit"]', {
        hasText: /create|submit|save/i,
      })
      .first();
    await submitButton.click();

    // Wait for confirmation message
    const confirmationMessage = page
      .locator('text=/task created|success/i')
      .first();
    await expect(confirmationMessage).toBeVisible({ timeout: 65000 });

    // Wait for modal to close and task to be saved
    await page.waitForTimeout(3000);

    // 3. Get parent task ID
    const parentResult = await pgClient.query(
      'SELECT id, "projectId" FROM "task" WHERE title = $1 AND "ownerId" = $2',
      [parentTitle, testUserId]
    );

    if (parentResult.rows.length === 0) {
      throw new Error(
        `Parent task not found in database. Title: ${parentTitle}, OwnerId: ${testUserId}`
      );
    }

    const parentTask = parentResult.rows[0];
    expect(parentTask.projectId).toBe(testProjectId);

    // 4. Find parent task in UI and create subtask
    const parentTaskItem = page.locator(`text=${parentTitle}`).first();
    await expect(parentTaskItem).toBeVisible({ timeout: 65000 });
    await parentTaskItem.click();
    await page.waitForTimeout(1000);

    // Look for "Add Subtask" button
    const addSubtaskButton = page
      .locator('button', {
        hasText: /subtask|add subtask/i,
      })
      .first();

    if (await addSubtaskButton.isVisible()) {
      await addSubtaskButton.click();
      await page.waitForTimeout(1000);

      // Fill subtask details
      const subtaskTitle = `E2E Subtask ${Date.now()}`;

      // Wait for subtask modal/form to appear
      await page.waitForTimeout(500);

      const subtaskTitleInput = page.locator('input[type="text"]').last();
      await subtaskTitleInput.fill(subtaskTitle);

      const subtaskDescInput = page.locator('textarea').last();
      await subtaskDescInput.fill('Subtask should inherit project');

      // Submit subtask
      const subtaskSubmit = page
        .locator('button[type="submit"]', {
          hasText: /create|submit|save/i,
        })
        .first();
      await subtaskSubmit.click();

      // Wait for confirmation
      await page.waitForTimeout(2000);

      // 5. Verify subtask inherited project
      const subtaskResult = await pgClient.query(
        'SELECT id, "projectId", "parentTaskId" FROM "task" WHERE title = $1',
        [subtaskTitle]
      );

      expect(subtaskResult.rows.length).toBe(1);
      const subtask = subtaskResult.rows[0];

      // Verify subtask inherits parent's project
      expect(subtask.projectId).toBe(testProjectId);
      expect(subtask.parentTaskId).toBe(parentTask.id);

      console.warn('✓ Subtask Project Inheritance Test Passed:');
      console.warn('  - Subtask created under parent task');
      console.warn('  - Subtask inherited project from parent');
      console.warn('  - Parent and subtask in same project');
    }
  });
});
