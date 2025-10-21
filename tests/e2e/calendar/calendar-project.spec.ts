import { test, expect } from '@playwright/test';
import { Client } from 'pg';
import { createClient } from '@supabase/supabase-js';

/**
 * E2E Tests for Project Calendar - SCRUM-70
 *
 * Tests project calendar acceptance criteria:
 * - GIVEN I am on a "Project Calendar" view
 * - THEN the calendar displays all tasks for that specific project that I am permitted to see
 *   based on my departmental visibility rules (DST017, DST020)
 *
 * Test Coverage:
 * - Shows tasks from selected project within department hierarchy
 * - Filters out tasks from other projects
 * - Filters out tasks from peer departments (outside hierarchy)
 * - Filters out standalone tasks (no project assigned)
 * - Manager can optionally filter by department
 */

test.describe('Project Calendar - Manager Flow', () => {
  let pgClient: Client;
  let supabaseClient: ReturnType<typeof createClient>;
  let parentDeptId: string;
  let childDeptId: string;
  let peerDeptId: string;
  let managerId: string;
  let staffParentId: string;
  let staffChildId: string;
  let peerUserId: string;
  let managerEmail: string;
  let testPassword: string;
  let testNamespace: string;
  let projectAId: string;
  let projectBId: string;
  const createdTaskIds: string[] = [];
  const createdUserIds: string[] = [];
  const createdProjectIds: string[] = [];

  // Helper function to login as manager and navigate to project calendar
  async function loginManagerAndNavigateToProjectCalendar(page: any) {
    await page.goto('/auth/login');

    // Wait for page to load
    await expect(
      page.getByRole('heading', { name: /welcome back/i })
    ).toBeVisible({ timeout: 65000 });

    // Fill email
    await page.getByLabel('Email').fill(managerEmail);

    // Fill password
    await page.getByLabel('Password').fill(testPassword);

    // Click sign in button
    const signInButton = page.getByRole('button', { name: /sign in/i });
    await expect(signInButton).toBeEnabled({ timeout: 65000 });
    await signInButton.click();

    // Wait for navigation to complete
    await page.waitForLoadState('networkidle', { timeout: 65000 });
    await page.waitForTimeout(2000);

    // Wait for Personal Dashboard heading to confirm page loaded
    await expect(
      page.getByRole('heading', { name: /personal dashboard/i })
    ).toBeVisible({
      timeout: 65000,
    });

    // Wait for navbar to be fully rendered and interactive
    await expect(page.getByTestId('app-title')).toBeVisible({
      timeout: 65000,
    });

    // Wait for project selection to load
    await page.waitForTimeout(2000);

    // Click on Project A in the project selection sidebar
    // The project selection uses sessionStorage, so we click on the project item
    const projectText = page.getByText('E2E Project A', { exact: false });
    await expect(projectText).toBeVisible({ timeout: 65000 });
    await projectText.click();

    // Wait for navigation to Project Dashboard
    await page.waitForLoadState('networkidle', { timeout: 65000 });
    await page.waitForTimeout(2000);

    // Wait for Project Dashboard page to load (check for page h1, not calendar h2)
    await expect(
      page.getByRole('heading', { name: /E2E Project A/i }).first()
    ).toBeVisible({
      timeout: 65000,
    });

    // Click on "Calendar View" tab to show calendar
    const calendarTab = page.getByRole('button', { name: /calendar view/i });
    await expect(calendarTab).toBeVisible({ timeout: 65000 });
    await calendarTab.click();

    // Wait for calendar to render (it may take time to load data and render)
    await page.waitForTimeout(3000);

    // Calendar should now be visible
    await expect(page.getByTestId('task-calendar')).toBeVisible({
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

    // Create robust worker-specific namespace for test data isolation
    const workerId = process.env.PLAYWRIGHT_WORKER_INDEX || '0';
    const timestamp = Date.now();
    const processId = process.pid;
    const randomSuffix = crypto.randomUUID().slice(0, 8);
    testNamespace = `calendar-proj-w${workerId}_${timestamp}_${processId}_${randomSuffix}`;

    // Create unique credentials with worker-specific namespace
    managerEmail = `e2e.calendar.project.manager.${testNamespace}@example.com`;
    testPassword = 'Test123!@#';

    // 1. Create department hierarchy
    // Parent department
    const parentDeptResult = await pgClient.query(
      'INSERT INTO "department" (id, name, "isActive", "createdAt", "updatedAt") VALUES (gen_random_uuid(), $1, true, NOW(), NOW()) RETURNING id',
      [`E2E Parent Dept ${testNamespace}`]
    );
    parentDeptId = parentDeptResult.rows[0].id;

    // Child department (subordinate to parent)
    const childDeptResult = await pgClient.query(
      'INSERT INTO "department" (id, name, "parentId", "isActive", "createdAt", "updatedAt") VALUES (gen_random_uuid(), $1, $2, true, NOW(), NOW()) RETURNING id',
      [`E2E Child Dept ${testNamespace}`, parentDeptId]
    );
    childDeptId = childDeptResult.rows[0].id;

    // Peer department (sibling to parent, should NOT be visible)
    const peerDeptResult = await pgClient.query(
      'INSERT INTO "department" (id, name, "isActive", "createdAt", "updatedAt") VALUES (gen_random_uuid(), $1, true, NOW(), NOW()) RETURNING id',
      [`E2E Peer Dept ${testNamespace}`]
    );
    peerDeptId = peerDeptResult.rows[0].id;

    // Create a user in peer dept (for peer task assignment)
    const peerUserResult = await pgClient.query(
      'INSERT INTO "user_profile" (id, email, name, role, "departmentId", "isActive", "createdAt", "updatedAt") VALUES (gen_random_uuid(), $1, $2, $3, $4, true, NOW(), NOW()) RETURNING id',
      [
        `e2e.peer.${testNamespace}@example.com`,
        'Peer User',
        'STAFF',
        peerDeptId,
      ]
    );
    peerUserId = peerUserResult.rows[0].id;
    createdUserIds.push(peerUserId);

    // 2. Create manager user with Supabase auth
    const { data: authData, error } = await supabaseClient.auth.signUp({
      email: managerEmail,
      password: testPassword,
    });

    if (error || !authData.user) {
      throw new Error(`Failed to create manager user: ${error?.message}`);
    }

    // 3. Wait for trigger to create user_profile
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

    // Update the department, role, and name for manager
    await pgClient.query(
      'UPDATE "user_profile" SET "departmentId" = $1, role = $2, name = $3 WHERE id = $4',
      [parentDeptId, 'MANAGER', 'E2E Manager User', authData.user.id]
    );
    managerId = authData.user.id;

    // Set manager as department manager
    await pgClient.query(
      'UPDATE "department" SET "managerId" = $1 WHERE id = $2',
      [managerId, parentDeptId]
    );

    // 4. Create staff users (in parent and child depts)
    const staffParentResult = await pgClient.query(
      'INSERT INTO "user_profile" (id, email, name, role, "departmentId", "isActive", "createdAt", "updatedAt") VALUES (gen_random_uuid(), $1, $2, $3, $4, true, NOW(), NOW()) RETURNING id',
      [
        `e2e.staff.parent.${testNamespace}@example.com`,
        'Staff Parent',
        'STAFF',
        parentDeptId,
      ]
    );
    staffParentId = staffParentResult.rows[0].id;
    createdUserIds.push(staffParentId);

    const staffChildResult = await pgClient.query(
      'INSERT INTO "user_profile" (id, email, name, role, "departmentId", "isActive", "createdAt", "updatedAt") VALUES (gen_random_uuid(), $1, $2, $3, $4, true, NOW(), NOW()) RETURNING id',
      [
        `e2e.staff.child.${testNamespace}@example.com`,
        'Staff Child',
        'STAFF',
        childDeptId,
      ]
    );
    staffChildId = staffChildResult.rows[0].id;
    createdUserIds.push(staffChildId);

    // 5. Create projects
    // Project A (main project for calendar view)
    const projectAResult = await pgClient.query(
      'INSERT INTO "project" (id, name, description, "creatorId", "departmentId", "isArchived", "createdAt", "updatedAt") VALUES (gen_random_uuid(), $1, $2, $3, $4, false, NOW(), NOW()) RETURNING id',
      [
        `E2E Project A ${testNamespace}`,
        'Test project A for calendar',
        managerId,
        parentDeptId,
      ]
    );
    projectAId = projectAResult.rows[0].id;
    createdProjectIds.push(projectAId);

    // Project B (different project - tasks should NOT appear in Project A calendar)
    const projectBResult = await pgClient.query(
      'INSERT INTO "project" (id, name, description, "creatorId", "departmentId", "isArchived", "createdAt", "updatedAt") VALUES (gen_random_uuid(), $1, $2, $3, $4, false, NOW(), NOW()) RETURNING id',
      [
        `E2E Project B ${testNamespace}`,
        'Test project B for calendar',
        managerId,
        parentDeptId,
      ]
    );
    projectBId = projectBResult.rows[0].id;
    createdProjectIds.push(projectBId);

    // Add project department access for both projects (required by schema)
    await pgClient.query(
      'INSERT INTO "project_department_access" ("projectId", "departmentId", "grantedAt") VALUES ($1, $2, NOW()), ($3, $4, NOW())',
      [projectAId, parentDeptId, projectBId, parentDeptId]
    );

    // 6. Create tasks with RELATIVE dates (always visible in current month)
    const today = new Date();
    const in10Days = new Date(today.getTime() + 10 * 24 * 60 * 60 * 1000);
    const in12Days = new Date(today.getTime() + 12 * 24 * 60 * 60 * 1000);
    const in8Days = new Date(today.getTime() + 8 * 24 * 60 * 60 * 1000);
    const in11Days = new Date(today.getTime() + 11 * 24 * 60 * 60 * 1000);
    const in9Days = new Date(today.getTime() + 9 * 24 * 60 * 60 * 1000);

    // Task 1: Parent dept + Project A (SHOULD APPEAR)
    const task1Result = await pgClient.query(
      'INSERT INTO "task" (id, title, description, priority, "dueDate", "startDate", "ownerId", "departmentId", "projectId", status, "createdAt", "updatedAt") VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW()) RETURNING id',
      [
        'Parent Dept - Project A Task',
        'Task in parent dept assigned to Project A',
        7,
        in10Days,
        today,
        managerId,
        parentDeptId,
        projectAId,
        'IN_PROGRESS',
      ]
    );
    const task1Id = task1Result.rows[0].id;
    createdTaskIds.push(task1Id);
    await pgClient.query(
      'INSERT INTO "task_assignment" ("taskId", "userId", "assignedById", "assignedAt") VALUES ($1, $2, $3, NOW())',
      [task1Id, staffParentId, managerId]
    );

    // Task 2: Child dept + Project A (SHOULD APPEAR)
    const task2Result = await pgClient.query(
      'INSERT INTO "task" (id, title, description, priority, "dueDate", "startDate", "ownerId", "departmentId", "projectId", status, "createdAt", "updatedAt") VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW()) RETURNING id',
      [
        'Child Dept - Project A Task',
        'Task in child dept assigned to Project A',
        8,
        in12Days,
        today,
        managerId,
        childDeptId,
        projectAId,
        'IN_PROGRESS',
      ]
    );
    const task2Id = task2Result.rows[0].id;
    createdTaskIds.push(task2Id);
    await pgClient.query(
      'INSERT INTO "task_assignment" ("taskId", "userId", "assignedById", "assignedAt") VALUES ($1, $2, $3, NOW())',
      [task2Id, staffChildId, managerId]
    );

    // Task 3: Peer dept + Project A (SHOULD NOT APPEAR - outside dept hierarchy)
    const task3Result = await pgClient.query(
      'INSERT INTO "task" (id, title, description, priority, "dueDate", "ownerId", "departmentId", "projectId", status, "createdAt", "updatedAt") VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW()) RETURNING id',
      [
        'Peer Dept - Project A Task',
        'Task in peer dept assigned to Project A',
        5,
        in8Days,
        peerUserId,
        peerDeptId,
        projectAId,
        'TO_DO',
      ]
    );
    const task3Id = task3Result.rows[0].id;
    createdTaskIds.push(task3Id);
    await pgClient.query(
      'INSERT INTO "task_assignment" ("taskId", "userId", "assignedById", "assignedAt") VALUES ($1, $2, $3, NOW())',
      [task3Id, peerUserId, peerUserId]
    );

    // Task 4: Parent dept + Project B (SHOULD NOT APPEAR - different project)
    const task4Result = await pgClient.query(
      'INSERT INTO "task" (id, title, description, priority, "dueDate", "ownerId", "departmentId", "projectId", status, "createdAt", "updatedAt") VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW()) RETURNING id',
      [
        'Parent Dept - Project B Task',
        'Task in parent dept assigned to Project B',
        6,
        in11Days,
        managerId,
        parentDeptId,
        projectBId,
        'TO_DO',
      ]
    );
    const task4Id = task4Result.rows[0].id;
    createdTaskIds.push(task4Id);
    await pgClient.query(
      'INSERT INTO "task_assignment" ("taskId", "userId", "assignedById", "assignedAt") VALUES ($1, $2, $3, NOW())',
      [task4Id, staffParentId, managerId]
    );

    // Task 5: Parent dept + NO project (SHOULD NOT APPEAR - standalone task)
    const task5Result = await pgClient.query(
      'INSERT INTO "task" (id, title, description, priority, "dueDate", "ownerId", "departmentId", status, "createdAt", "updatedAt") VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, NOW(), NOW()) RETURNING id',
      [
        'Standalone Task',
        'Task with no project assignment',
        5,
        in9Days,
        managerId,
        parentDeptId,
        'TO_DO',
      ]
    );
    const task5Id = task5Result.rows[0].id;
    createdTaskIds.push(task5Id);
    await pgClient.query(
      'INSERT INTO "task_assignment" ("taskId", "userId", "assignedById", "assignedAt") VALUES ($1, $2, $3, NOW())',
      [task5Id, staffParentId, managerId]
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

      // 1. Delete project department access
      if (createdProjectIds.length > 0) {
        await pgClient.query(
          'DELETE FROM "project_department_access" WHERE "projectId" = ANY($1)',
          [createdProjectIds]
        );
      }

      // 2. Delete task assignments
      if (createdTaskIds.length > 0) {
        await pgClient.query(
          'DELETE FROM "task_assignment" WHERE "taskId" = ANY($1)',
          [createdTaskIds]
        );
      }

      // 3. Delete tasks
      if (createdTaskIds.length > 0) {
        await pgClient.query('DELETE FROM "task" WHERE id = ANY($1)', [
          createdTaskIds,
        ]);
      }

      // 4. Delete projects
      if (createdProjectIds.length > 0) {
        await pgClient.query('DELETE FROM "project" WHERE id = ANY($1)', [
          createdProjectIds,
        ]);
      }

      // 5. Delete user profiles (including peer user)
      if (managerId && createdUserIds.length > 0) {
        await pgClient.query('DELETE FROM "user_profile" WHERE id = ANY($1)', [
          [managerId, ...createdUserIds],
        ]);
      }

      // 6. Delete auth users
      await supabaseClient.auth.signOut();
      await pgClient.query('DELETE FROM auth.users WHERE email LIKE $1', [
        `e2e.%${testNamespace}%`,
      ]);

      // 7. Delete departments (order: child, then parents)
      if (childDeptId) {
        await pgClient.query('DELETE FROM "department" WHERE id = $1', [
          childDeptId,
        ]);
      }
      if (parentDeptId) {
        await pgClient.query('DELETE FROM "department" WHERE id = $1', [
          parentDeptId,
        ]);
      }
      if (peerDeptId) {
        await pgClient.query('DELETE FROM "department" WHERE id = $1', [
          peerDeptId,
        ]);
      }
    } catch (error) {
      console.error(
        `❌ Error during calendar project cleanup for namespace ${testNamespace}:`,
        error
      );
    } finally {
      // 8. Close connections
      if (pgClient) {
        await pgClient.end();
      }
    }
  });

  test('Setup: should login as manager and navigate to project calendar', async ({
    page,
  }) => {
    test.setTimeout(220000);

    await loginManagerAndNavigateToProjectCalendar(page);
  });

  test('should show only tasks from selected project within dept hierarchy', async ({
    page,
  }) => {
    test.setTimeout(220000);

    await loginManagerAndNavigateToProjectCalendar(page);

    // Wait for calendar to fully render and load events
    await page.waitForTimeout(3000);

    // Verify tasks from parent dept + Project A are in DOM (should exist)
    const parentProjectACount = await page
      .locator('[data-task-title="Parent Dept - Project A Task"]')
      .count();
    console.warn(`Parent Dept - Project A Task count: ${parentProjectACount}`);
    expect(parentProjectACount).toBeGreaterThan(0);

    // Verify tasks from child dept + Project A are in DOM (should exist)
    const childProjectACount = await page
      .locator('[data-task-title="Child Dept - Project A Task"]')
      .count();
    console.warn(`Child Dept - Project A Task count: ${childProjectACount}`);
    expect(childProjectACount).toBeGreaterThan(0);

    // Verify peer dept task does NOT appear (outside dept hierarchy)
    const peerProjectACount = await page
      .locator('[data-task-title="Peer Dept - Project A Task"]')
      .count();
    console.warn(`Peer Dept - Project A Task count: ${peerProjectACount}`);
    expect(peerProjectACount).toBe(0);

    // Verify Project B task does NOT appear (different project)
    const projectBCount = await page
      .locator('[data-task-title="Parent Dept - Project B Task"]')
      .count();
    console.warn(`Parent Dept - Project B Task count: ${projectBCount}`);
    expect(projectBCount).toBe(0);

    // Verify standalone task does NOT appear (no project)
    const standaloneCount = await page
      .locator('[data-task-title="Standalone Task"]')
      .count();
    console.warn(`Standalone Task count: ${standaloneCount}`);
    expect(standaloneCount).toBe(0);
  });

  test('should show task details when clicking event', async ({ page }) => {
    test.setTimeout(220000);

    await loginManagerAndNavigateToProjectCalendar(page);

    // Wait for calendar to render and load events
    await page.waitForTimeout(3000);

    // Click on parent dept task using data-task-title attribute
    const parentTask = page
      .locator('[data-task-title="Parent Dept - Project A Task"]')
      .first();
    await expect(parentTask).toBeVisible({ timeout: 65000 });
    await parentTask.click();

    // Wait for modal to open
    await page.waitForTimeout(2000);

    // Verify modal shows task details
    const modalHeading = page.getByRole('heading', {
      name: /Parent Dept - Project A Task/i,
    });
    await expect(modalHeading).toBeVisible({ timeout: 65000 });

    // Verify assignee name appears in task card assignee list (not dropdown)
    await expect(
      page
        .locator('[data-testid^="task-assignee-"]')
        .getByText(/Staff Parent/i)
        .first()
    ).toBeVisible({
      timeout: 65000,
    });

    // Close modal
    const closeButton = page.getByText('×').first();
    await expect(closeButton).toBeVisible({ timeout: 65000 });
    await closeButton.click();

    await page.waitForTimeout(1000);
  });
});
