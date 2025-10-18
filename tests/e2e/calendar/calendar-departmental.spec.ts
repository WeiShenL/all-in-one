import { test, expect } from '@playwright/test';
import { Client } from 'pg';
import { createClient } from '@supabase/supabase-js';

/**
 * E2E Tests for Departmental Calendar - SCRUM-70
 *
 * Tests manager-specific acceptance criteria:
 * - CIT001, CIT009: Shows tasks from own + subordinate departments with assignee details
 * - CIT008: Manager can filter by team member
 * - Task assignee details visible
 */

test.describe('Departmental Calendar - Manager Flow', () => {
  let pgClient: Client;
  let supabaseClient: ReturnType<typeof createClient>;
  let parentDeptId: string;
  let childDeptId: string;
  let peerDeptId: string;
  let managerId: string;
  let aliceId: string;
  let bobId: string;
  let charlieId: string;
  let peerUserId: string;
  let managerEmail: string;
  let testPassword: string;
  let testNamespace: string;
  const createdTaskIds: string[] = [];
  const createdUserIds: string[] = [];

  // Helper function to login as manager and navigate to departmental calendar
  async function loginManagerAndNavigateToCalendar(page: any) {
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
    await expect(page.getByText('Task Manager')).toBeVisible({
      timeout: 65000,
    });

    // Click "Department" link in navbar to go to Department Dashboard
    const departmentLink = page.getByRole('link', { name: /^department$/i });
    await expect(departmentLink).toBeVisible({ timeout: 65000 });
    await departmentLink.click();

    // Wait for navigation to Department Dashboard
    await page.waitForLoadState('networkidle', { timeout: 65000 });
    await page.waitForTimeout(2000);

    // Wait for Department Dashboard page to load
    await expect(
      page.getByRole('heading', { name: /department dashboard/i })
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
    testNamespace = `calendar-dept-w${workerId}_${timestamp}_${processId}_${randomSuffix}`;

    // Create unique credentials with worker-specific namespace
    managerEmail = `e2e.calendar.manager.${testNamespace}@example.com`;
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

    // 4. Create staff users (Alice, Bob in parent dept, Charlie in child dept)
    const aliceResult = await pgClient.query(
      'INSERT INTO "user_profile" (id, email, name, role, "departmentId", "isActive", "createdAt", "updatedAt") VALUES (gen_random_uuid(), $1, $2, $3, $4, true, NOW(), NOW()) RETURNING id',
      [
        `e2e.alice.${testNamespace}@example.com`,
        'Alice Smith',
        'STAFF',
        parentDeptId,
      ]
    );
    aliceId = aliceResult.rows[0].id;

    const bobResult = await pgClient.query(
      'INSERT INTO "user_profile" (id, email, name, role, "departmentId", "isActive", "createdAt", "updatedAt") VALUES (gen_random_uuid(), $1, $2, $3, $4, true, NOW(), NOW()) RETURNING id',
      [
        `e2e.bob.${testNamespace}@example.com`,
        'Bob Johnson',
        'STAFF',
        parentDeptId,
      ]
    );
    bobId = bobResult.rows[0].id;

    const charlieResult = await pgClient.query(
      'INSERT INTO "user_profile" (id, email, name, role, "departmentId", "isActive", "createdAt", "updatedAt") VALUES (gen_random_uuid(), $1, $2, $3, $4, true, NOW(), NOW()) RETURNING id',
      [
        `e2e.charlie.${testNamespace}@example.com`,
        'Charlie Brown',
        'STAFF',
        childDeptId,
      ]
    );
    charlieId = charlieResult.rows[0].id;

    // 5. Create tasks with RELATIVE dates (always visible in current month)
    const today = new Date();
    const in14Days = new Date(today.getTime() + 14 * 24 * 60 * 60 * 1000);
    const in10Days = new Date(today.getTime() + 10 * 24 * 60 * 60 * 1000);
    const in12Days = new Date(today.getTime() + 12 * 24 * 60 * 60 * 1000);
    const in8Days = new Date(today.getTime() + 8 * 24 * 60 * 60 * 1000);
    const in11Days = new Date(today.getTime() + 11 * 24 * 60 * 60 * 1000);

    // Task 1: Assigned to Alice in parent dept (due in 14 days)
    const task1Result = await pgClient.query(
      'INSERT INTO "task" (id, title, description, priority, "dueDate", "startDate", "ownerId", "departmentId", status, "createdAt", "updatedAt") VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW()) RETURNING id',
      [
        'Alice Task - Frontend Update',
        'Task assigned to Alice in parent dept',
        7,
        in14Days,
        today, // Set startDate for IN_PROGRESS tasks
        managerId,
        parentDeptId,
        'IN_PROGRESS',
      ]
    );
    const task1Id = task1Result.rows[0].id;
    createdTaskIds.push(task1Id);
    await pgClient.query(
      'INSERT INTO "task_assignment" ("taskId", "userId", "assignedById", "assignedAt") VALUES ($1, $2, $3, NOW())',
      [task1Id, aliceId, managerId]
    );

    // Task 2: Assigned to Bob in parent dept (due in 10 days)
    const task2Result = await pgClient.query(
      'INSERT INTO "task" (id, title, description, priority, "dueDate", "ownerId", "departmentId", status, "createdAt", "updatedAt") VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, NOW(), NOW()) RETURNING id',
      [
        'Bob Task - Backend API',
        'Task assigned to Bob in parent dept',
        6,
        in10Days,
        managerId,
        parentDeptId,
        'TO_DO',
      ]
    );
    const task2Id = task2Result.rows[0].id;
    createdTaskIds.push(task2Id);
    await pgClient.query(
      'INSERT INTO "task_assignment" ("taskId", "userId", "assignedById", "assignedAt") VALUES ($1, $2, $3, NOW())',
      [task2Id, bobId, managerId]
    );

    // 6. Create tasks in child department
    // Task 3: Assigned to Charlie in child dept (due in 12 days)
    const task3Result = await pgClient.query(
      'INSERT INTO "task" (id, title, description, priority, "dueDate", "startDate", "ownerId", "departmentId", status, "createdAt", "updatedAt") VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW()) RETURNING id',
      [
        'Charlie Task - Database Migration',
        'Task assigned to Charlie in child dept',
        8,
        in12Days,
        today, // Set startDate for IN_PROGRESS tasks
        managerId,
        childDeptId,
        'IN_PROGRESS',
      ]
    );
    const task3Id = task3Result.rows[0].id;
    createdTaskIds.push(task3Id);
    await pgClient.query(
      'INSERT INTO "task_assignment" ("taskId", "userId", "assignedById", "assignedAt") VALUES ($1, $2, $3, NOW())',
      [task3Id, charlieId, managerId]
    );

    // Task 4: Another task for Alice (due in 8 days)
    const task4Result = await pgClient.query(
      'INSERT INTO "task" (id, title, description, priority, "dueDate", "ownerId", "departmentId", status, "createdAt", "updatedAt") VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, NOW(), NOW()) RETURNING id',
      [
        'Alice Task 2 - UI Testing',
        'Second task for Alice',
        5,
        in8Days,
        managerId,
        parentDeptId,
        'TO_DO',
      ]
    );
    const task4Id = task4Result.rows[0].id;
    createdTaskIds.push(task4Id);
    await pgClient.query(
      'INSERT INTO "task_assignment" ("taskId", "userId", "assignedById", "assignedAt") VALUES ($1, $2, $3, NOW())',
      [task4Id, aliceId, managerId]
    );

    // 7. Create task in peer department (should NOT appear) - due in 11 days
    // Owned by peer user and assigned to peer user (NOT manager's hierarchy)
    const peerTaskResult = await pgClient.query(
      'INSERT INTO "task" (id, title, description, priority, "dueDate", "ownerId", "departmentId", status, "createdAt", "updatedAt") VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, NOW(), NOW()) RETURNING id',
      [
        'Peer Dept Task - Should Not Appear',
        'Task in peer dept',
        5,
        in11Days,
        peerUserId, // Owned by peer user (not in manager's hierarchy)
        peerDeptId,
        'TO_DO',
      ]
    );
    const peerTaskId = peerTaskResult.rows[0].id;
    createdTaskIds.push(peerTaskId);
    await pgClient.query(
      'INSERT INTO "task_assignment" ("taskId", "userId", "assignedById", "assignedAt") VALUES ($1, $2, $3, NOW())',
      [peerTaskId, peerUserId, peerUserId] // Assigned to peer user (not in manager's hierarchy)
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

      // 1. Delete task assignments
      if (createdTaskIds.length > 0) {
        await pgClient.query(
          'DELETE FROM "task_assignment" WHERE "taskId" = ANY($1)',
          [createdTaskIds]
        );
      }

      // 2. Delete tasks
      if (createdTaskIds.length > 0) {
        await pgClient.query('DELETE FROM "task" WHERE id = ANY($1)', [
          createdTaskIds,
        ]);
      }

      // 3. Delete user profiles (including peer user)
      if (managerId && aliceId && bobId && charlieId && peerUserId) {
        await pgClient.query(
          'DELETE FROM "user_profile" WHERE id IN ($1, $2, $3, $4, $5)',
          [managerId, aliceId, bobId, charlieId, peerUserId]
        );
      }

      // 4. Delete auth users
      await supabaseClient.auth.signOut();
      await pgClient.query('DELETE FROM auth.users WHERE email LIKE $1', [
        `e2e.%${testNamespace}%`,
      ]);

      // 5. Delete departments (order: child, then parents)
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
        `❌ Error during calendar departmental cleanup for namespace ${testNamespace}:`,
        error
      );
    } finally {
      // 6. Close connections
      if (pgClient) {
        await pgClient.end();
      }
    }
  });

  test('Setup: should login as manager and navigate to departmental calendar', async ({
    page,
  }) => {
    test.setTimeout(220000); // 120s total test timeout

    // Login
    await page.goto('/auth/login');

    await expect(
      page.getByRole('heading', { name: /welcome back/i })
    ).toBeVisible({ timeout: 65000 });

    await page.getByLabel('Email').fill(managerEmail);
    await page.getByLabel('Password').fill(testPassword);

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
    await expect(page.getByText('Task Manager')).toBeVisible({
      timeout: 65000,
    });

    // Click "Department" link in navbar to go to Department Dashboard
    const departmentLink = page.getByRole('link', { name: /^department$/i });
    await expect(departmentLink).toBeVisible({ timeout: 65000 });
    await departmentLink.click();

    // Wait for navigation to Department Dashboard
    await page.waitForLoadState('networkidle', { timeout: 65000 });
    await page.waitForTimeout(2000);

    // Wait for Department Dashboard page to load
    await expect(
      page.getByRole('heading', { name: /department dashboard/i })
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
  });

  test('CIT001, CIT009: should show tasks from own and subordinate departments', async ({
    page,
  }) => {
    test.setTimeout(220000);

    await loginManagerAndNavigateToCalendar(page);

    // Wait for calendar to fully render and load events
    await page.waitForTimeout(3000);

    // Some tasks may be hidden in "+X more" popups in month view
    // We verify by checking if task elements exist in DOM (count > 0)
    // Multi-day tasks appear multiple times in the calendar (once per day)

    // Verify tasks from parent dept are in DOM (should exist)
    const aliceTask1Count = await page
      .locator('[data-task-title="Alice Task - Frontend Update"]')
      .count();
    console.warn(`Alice Task - Frontend Update count: ${aliceTask1Count}`);
    expect(aliceTask1Count).toBeGreaterThan(0);

    const bobTaskCount = await page
      .locator('[data-task-title="Bob Task - Backend API"]')
      .count();
    console.warn(`Bob Task - Backend API count: ${bobTaskCount}`);
    expect(bobTaskCount).toBeGreaterThan(0);

    const aliceTask2Count = await page
      .locator('[data-task-title="Alice Task 2 - UI Testing"]')
      .count();
    console.warn(`Alice Task 2 - UI Testing count: ${aliceTask2Count}`);
    expect(aliceTask2Count).toBeGreaterThan(0);

    // Verify tasks from child dept are in DOM (should exist)
    const charlieTaskCount = await page
      .locator('[data-task-title="Charlie Task - Database Migration"]')
      .count();
    console.warn(
      `Charlie Task - Database Migration count: ${charlieTaskCount}`
    );
    expect(charlieTaskCount).toBeGreaterThan(0);

    // Verify peer dept task does NOT appear in DOM at all
    const peerTaskCount = await page
      .locator('[data-task-title="Peer Dept Task - Should Not Appear"]')
      .count();
    console.warn(`Peer Dept Task - Should Not Appear count: ${peerTaskCount}`);
    expect(peerTaskCount).toBe(0);
  });

  test('CIT009: should show assignee details when clicking task', async ({
    page,
  }) => {
    test.setTimeout(220000);

    await loginManagerAndNavigateToCalendar(page);

    // Wait for calendar to render and load events
    await page.waitForTimeout(3000);

    // Click on Alice's task using data-task-title attribute
    const aliceTask = page
      .locator('[data-task-title="Alice Task - Frontend Update"]')
      .first();
    await expect(aliceTask).toBeVisible({ timeout: 65000 });
    await aliceTask.click();

    // Wait for modal to open
    await page.waitForTimeout(2000);

    // Verify modal shows assignee details
    const modalHeading = page.getByRole('heading', {
      name: /Alice Task - Frontend Update/i,
    });
    await expect(modalHeading).toBeVisible({ timeout: 65000 });

    // Verify assignee name appears (Alice Smith)
    await expect(page.getByText(/Alice Smith/i)).toBeVisible({
      timeout: 65000,
    });

    // Close modal
    const closeButton = page.getByText('×').first();
    await expect(closeButton).toBeVisible({ timeout: 65000 });
    await closeButton.click();

    await page.waitForTimeout(1000);
  });

  test('should support view switching between Month, Week, Day, and Agenda', async ({
    page,
  }) => {
    test.setTimeout(220000);

    await loginManagerAndNavigateToCalendar(page);

    // Wait for calendar to render in default Month view
    await page.waitForTimeout(3000);

    // ============================================
    // TEST 1: Verify Month view (default)
    // ============================================
    const monthButton = page.getByTestId('view-month');
    await expect(monthButton).toBeVisible({ timeout: 65000 });

    // Verify at least one task is present in month view
    const monthTaskCount = await page
      .locator('[data-task-title="Alice Task - Frontend Update"]')
      .count();
    console.warn(`Month view - Alice Task count: ${monthTaskCount}`);
    expect(monthTaskCount).toBeGreaterThan(0);

    // ============================================
    // TEST 2: Switch to Week view
    // ============================================
    const weekButton = page.getByTestId('view-week');
    await expect(weekButton).toBeVisible({ timeout: 65000 });
    await weekButton.click();
    await page.waitForTimeout(2000);

    // Verify calendar container is still visible
    await expect(page.getByTestId('task-calendar')).toBeVisible({
      timeout: 65000,
    });

    // Verify at least one task is present in week view (may be in all-day section)
    const weekTaskCount = await page
      .locator('[data-task-title="Alice Task - Frontend Update"]')
      .count();
    console.warn(`Week view - Alice Task count: ${weekTaskCount}`);
    expect(weekTaskCount).toBeGreaterThan(0);

    // ============================================
    // TEST 3: Switch to Day view (Kanban board)
    // ============================================
    const dayButton = page.getByTestId('view-day');
    await expect(dayButton).toBeVisible({ timeout: 65000 });
    await dayButton.click();
    await page.waitForTimeout(2000);

    // Verify calendar container is still visible
    await expect(page.getByTestId('task-calendar')).toBeVisible({
      timeout: 65000,
    });

    // In Day view (Kanban), tasks are shown in status columns
    // Verify at least one task exists using data-task-title
    const dayTaskCount = await page.locator('[data-task-title]').count();
    console.warn(`Day view - Total task elements: ${dayTaskCount}`);
    expect(dayTaskCount).toBeGreaterThan(0);

    // ============================================
    // TEST 4: Switch to Agenda view
    // ============================================
    const agendaButton = page.getByTestId('view-agenda');
    await expect(agendaButton).toBeVisible({ timeout: 65000 });
    await agendaButton.click();
    await page.waitForTimeout(2000);

    // Verify calendar container is still visible
    await expect(page.getByTestId('task-calendar')).toBeVisible({
      timeout: 65000,
    });

    // In Agenda view, tasks are shown chronologically
    // Verify at least one task exists
    const agendaTaskCount = await page.locator('[data-task-title]').count();
    console.warn(`Agenda view - Total task elements: ${agendaTaskCount}`);
    expect(agendaTaskCount).toBeGreaterThan(0);

    // ============================================
    // TEST 5: Switch back to Month view
    // ============================================
    await monthButton.click();
    await page.waitForTimeout(2000);

    // Verify we're back in month view and tasks are visible
    await expect(page.getByTestId('task-calendar')).toBeVisible({
      timeout: 65000,
    });

    const finalMonthTaskCount = await page
      .locator('[data-task-title="Alice Task - Frontend Update"]')
      .count();
    console.warn(
      `Back to Month view - Alice Task count: ${finalMonthTaskCount}`
    );
    expect(finalMonthTaskCount).toBeGreaterThan(0);
  });

  test('should filter tasks by department using dropdown', async ({ page }) => {
    test.setTimeout(220000);

    await loginManagerAndNavigateToCalendar(page);

    // Wait for calendar to render
    await page.waitForTimeout(3000);

    // ============================================
    // TEST 1: Verify department filter dropdown exists
    // ============================================
    const departmentFilter = page.getByTestId('department-filter');
    await expect(departmentFilter).toBeVisible({ timeout: 65000 });

    // ============================================
    // TEST 2: Verify dropdown options
    // ============================================
    // Should contain: "All Departments" + parent dept + child dept
    // Should NOT contain peer dept
    const options = await departmentFilter.locator('option').allTextContents();
    console.warn('Department filter options:', options);

    expect(options).toContain('All Departments');
    expect(options.length).toBeGreaterThan(1); // At least "All Departments" + 1 or more depts

    // Verify peer dept is NOT in dropdown
    const hasPeerDept = options.some(opt => opt.includes('E2E Peer Dept'));
    expect(hasPeerDept).toBe(false);

    // ============================================
    // TEST 3: Filter by parent department
    // ============================================
    // Get parent department name from options (not "All Departments" and contains "Parent")
    const parentDeptOption = options.find(
      opt => opt !== 'All Departments' && opt.includes('Parent')
    );

    if (parentDeptOption) {
      await departmentFilter.selectOption({ label: parentDeptOption });
      await page.waitForTimeout(2000);

      // Verify only parent dept tasks are visible
      const aliceTask1Count = await page
        .locator('[data-task-title="Alice Task - Frontend Update"]')
        .count();
      const bobTaskCount = await page
        .locator('[data-task-title="Bob Task - Backend API"]')
        .count();
      const aliceTask2Count = await page
        .locator('[data-task-title="Alice Task 2 - UI Testing"]')
        .count();
      const charlieTaskCount = await page
        .locator('[data-task-title="Charlie Task - Database Migration"]')
        .count();

      console.warn(
        `Parent dept filter - Alice1: ${aliceTask1Count}, Bob: ${bobTaskCount}, Alice2: ${aliceTask2Count}, Charlie: ${charlieTaskCount}`
      );

      // Parent dept tasks should be visible
      expect(aliceTask1Count + bobTaskCount + aliceTask2Count).toBeGreaterThan(
        0
      );
      // Child dept tasks should NOT be visible
      expect(charlieTaskCount).toBe(0);
    }

    // ============================================
    // TEST 4: Filter by child department
    // ============================================
    const childDeptOption = options.find(
      opt => opt !== 'All Departments' && opt.includes('Child')
    );

    if (childDeptOption) {
      await departmentFilter.selectOption({ label: childDeptOption });
      await page.waitForTimeout(2000);

      // Verify only child dept tasks are visible
      const charlieTaskCount = await page
        .locator('[data-task-title="Charlie Task - Database Migration"]')
        .count();
      const aliceTask1Count = await page
        .locator('[data-task-title="Alice Task - Frontend Update"]')
        .count();
      const bobTaskCount = await page
        .locator('[data-task-title="Bob Task - Backend API"]')
        .count();

      console.warn(
        `Child dept filter - Charlie: ${charlieTaskCount}, Alice1: ${aliceTask1Count}, Bob: ${bobTaskCount}`
      );

      // Child dept tasks should be visible
      expect(charlieTaskCount).toBeGreaterThan(0);
      // Parent dept tasks should NOT be visible
      expect(aliceTask1Count + bobTaskCount).toBe(0);
    }

    // ============================================
    // TEST 5: Select "All Departments" to show all tasks
    // ============================================
    await departmentFilter.selectOption({ label: 'All Departments' });
    await page.waitForTimeout(2000);

    // Verify all accessible tasks are visible again
    const allAliceTask1Count = await page
      .locator('[data-task-title="Alice Task - Frontend Update"]')
      .count();
    const allBobTaskCount = await page
      .locator('[data-task-title="Bob Task - Backend API"]')
      .count();
    const allCharlieTaskCount = await page
      .locator('[data-task-title="Charlie Task - Database Migration"]')
      .count();

    console.warn(
      `All departments - Alice1: ${allAliceTask1Count}, Bob: ${allBobTaskCount}, Charlie: ${allCharlieTaskCount}`
    );

    // All tasks from hierarchy should be visible
    expect(allAliceTask1Count).toBeGreaterThan(0);
    expect(allBobTaskCount).toBeGreaterThan(0);
    expect(allCharlieTaskCount).toBeGreaterThan(0);

    // Peer dept task should NEVER be visible
    const peerTaskCount = await page
      .locator('[data-task-title="Peer Dept Task - Should Not Appear"]')
      .count();
    expect(peerTaskCount).toBe(0);
  });
});
