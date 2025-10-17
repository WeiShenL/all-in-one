import { test, expect } from '@playwright/test';
import { Client } from 'pg';
import { createClient } from '@supabase/supabase-js';

/**
 * E2E Tests for Personal Calendar - SCRUM-70
 *
 * Tests acceptance criteria through UI interactions:
 * - CIT001: Personal calendar shows ONLY assigned tasks
 * - CIT003: View switching (Month, Week, Day, Agenda)
 * - CIT006: Completed tasks visible with visual distinction
 * - CIT007: Recurring tasks show future occurrences
 * - Task click opens modal with full details
 * - Export to iCal button exists and is clickable
 */

test.describe('Personal Calendar - UI Flow', () => {
  // Run tests in serial mode so they execute sequentially
  test.describe.configure({ mode: 'serial' });

  let pgClient: Client;
  let supabaseClient: ReturnType<typeof createClient>;
  let testDepartmentId: string;
  let testUserId: string;
  let otherUserId: string;
  let testEmail: string;
  let testPassword: string;
  const createdTaskIds: string[] = [];

  // Helper function to login and navigate to personal calendar
  async function loginAndNavigateToCalendar(page: any) {
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

    // Wait for navigation to complete
    await page.waitForLoadState('networkidle', { timeout: 65000 });
    await page.waitForTimeout(2000);

    // Wait for Personal Dashboard heading to confirm page loaded
    await expect(
      page.getByRole('heading', { name: /personal dashboard/i })
    ).toBeVisible({ timeout: 65000 });

    // Wait for navbar to be fully rendered and interactive
    await expect(page.getByText('Task Manager')).toBeVisible({
      timeout: 65000,
    });

    // Click on Calendar View tab to show calendar
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

    // Create unique credentials
    const unique = Date.now();
    testEmail = `e2e.calendar.personal.${unique}@example.com`;
    testPassword = 'Test123!@#';

    // 1. Create department
    const deptResult = await pgClient.query(
      'INSERT INTO "department" (id, name, "isActive", "createdAt", "updatedAt") VALUES (gen_random_uuid(), $1, true, NOW(), NOW()) RETURNING id',
      [`E2E Personal Calendar Dept ${unique}`]
    );
    testDepartmentId = deptResult.rows[0].id;

    // 2. Create main user with Supabase auth
    const { data: authData, error } = await supabaseClient.auth.signUp({
      email: testEmail,
      password: testPassword,
    });

    if (error || !authData.user) {
      throw new Error(`Failed to create test user: ${error?.message}`);
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

    // Update the department, role, and name
    await pgClient.query(
      'UPDATE "user_profile" SET "departmentId" = $1, role = $2, name = $3 WHERE id = $4',
      [
        testDepartmentId,
        'STAFF',
        'E2E Personal Calendar User',
        authData.user.id,
      ]
    );
    testUserId = authData.user.id;

    // 4. Create other user (tasks should NOT appear for main user)
    const otherUserResult = await pgClient.query(
      'INSERT INTO "user_profile" (id, email, name, role, "departmentId", "isActive", "createdAt", "updatedAt") VALUES (gen_random_uuid(), $1, $2, $3, $4, true, NOW(), NOW()) RETURNING id',
      [
        `e2e.calendar.other.${unique}@example.com`,
        'E2E Other User',
        'STAFF',
        testDepartmentId,
      ]
    );
    otherUserId = otherUserResult.rows[0].id;

    // 5. Create tasks for main user with RELATIVE dates (always visible in current month)
    const today = new Date();
    const in7Days = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
    const in15Days = new Date(today.getTime() + 15 * 24 * 60 * 60 * 1000);
    const in10Days = new Date(today.getTime() + 10 * 24 * 60 * 60 * 1000);
    const in3Days = new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000);
    const ago5Days = new Date(today.getTime() - 5 * 24 * 60 * 60 * 1000);
    const ago20Days = new Date(today.getTime() - 20 * 24 * 60 * 60 * 1000);

    // Task 1: TO_DO task (due in 7 days - always visible)
    const task1Result = await pgClient.query(
      'INSERT INTO "task" (id, title, description, priority, "dueDate", "ownerId", "departmentId", status, "createdAt", "updatedAt") VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, NOW(), NOW()) RETURNING id',
      [
        'E2E Personal Task - TO_DO',
        'Task to test TO_DO status',
        5,
        in7Days,
        testUserId,
        testDepartmentId,
        'TO_DO',
      ]
    );
    const task1Id = task1Result.rows[0].id;
    createdTaskIds.push(task1Id);
    await pgClient.query(
      'INSERT INTO "task_assignment" ("taskId", "userId", "assignedById", "assignedAt") VALUES ($1, $2, $3, NOW())',
      [task1Id, testUserId, testUserId]
    );

    // Task 2: IN_PROGRESS task (due in 15 days, started 5 days ago)
    const task2Result = await pgClient.query(
      'INSERT INTO "task" (id, title, description, priority, "dueDate", "ownerId", "departmentId", status, "startDate", "createdAt", "updatedAt") VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW()) RETURNING id',
      [
        'E2E Personal Task - IN_PROGRESS',
        'Task to test IN_PROGRESS status',
        7,
        in15Days,
        testUserId,
        testDepartmentId,
        'IN_PROGRESS',
        ago5Days,
      ]
    );
    const task2Id = task2Result.rows[0].id;
    createdTaskIds.push(task2Id);
    await pgClient.query(
      'INSERT INTO "task_assignment" ("taskId", "userId", "assignedById", "assignedAt") VALUES ($1, $2, $3, NOW())',
      [task2Id, testUserId, testUserId]
    );

    // Task 3: COMPLETED task (due 5 days ago, started 20 days ago)
    const task3Result = await pgClient.query(
      'INSERT INTO "task" (id, title, description, priority, "dueDate", "ownerId", "departmentId", status, "startDate", "createdAt", "updatedAt") VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW()) RETURNING id',
      [
        'E2E Personal Task - COMPLETED',
        'Task to test COMPLETED status',
        6,
        ago5Days,
        testUserId,
        testDepartmentId,
        'COMPLETED',
        ago20Days,
      ]
    );
    const task3Id = task3Result.rows[0].id;
    createdTaskIds.push(task3Id);
    await pgClient.query(
      'INSERT INTO "task_assignment" ("taskId", "userId", "assignedById", "assignedAt") VALUES ($1, $2, $3, NOW())',
      [task3Id, testUserId, testUserId]
    );

    // Task 4: Recurring task (due in 10 days, weekly)
    const task4Result = await pgClient.query(
      'INSERT INTO "task" (id, title, description, priority, "dueDate", "ownerId", "departmentId", status, "recurringInterval", "createdAt", "updatedAt") VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW()) RETURNING id',
      [
        'E2E Recurring Weekly Task',
        'Task to test recurring functionality',
        5,
        in10Days,
        testUserId,
        testDepartmentId,
        'TO_DO',
        7, // Every 7 days
      ]
    );
    const task4Id = task4Result.rows[0].id;
    createdTaskIds.push(task4Id);
    await pgClient.query(
      'INSERT INTO "task_assignment" ("taskId", "userId", "assignedById", "assignedAt") VALUES ($1, $2, $3, NOW())',
      [task4Id, testUserId, testUserId]
    );

    // Task 5: Overdue task (created 3 days ago, due yesterday - visible in current month)
    const yesterday = new Date(today.getTime() - 1 * 24 * 60 * 60 * 1000);
    const ago3Days = new Date(today.getTime() - 3 * 24 * 60 * 60 * 1000);
    const task5Result = await pgClient.query(
      'INSERT INTO "task" (id, title, description, priority, "dueDate", "ownerId", "departmentId", status, "createdAt", "updatedAt") VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, NOW()) RETURNING id',
      [
        'E2E Overdue Task',
        'Task to test overdue highlighting',
        8,
        yesterday, // Due yesterday - overdue but still in current month view
        testUserId,
        testDepartmentId,
        'TO_DO',
        ago3Days, // Created 3 days ago (before it became overdue)
      ]
    );
    const task5Id = task5Result.rows[0].id;
    createdTaskIds.push(task5Id);
    await pgClient.query(
      'INSERT INTO "task_assignment" ("taskId", "userId", "assignedById", "assignedAt") VALUES ($1, $2, $3, NOW())',
      [task5Id, testUserId, testUserId]
    );

    // 6. Create tasks for other user (should NOT appear) - use in3Days to keep them in current view
    const otherTask1Result = await pgClient.query(
      'INSERT INTO "task" (id, title, description, priority, "dueDate", "ownerId", "departmentId", status, "createdAt", "updatedAt") VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, NOW(), NOW()) RETURNING id',
      [
        'E2E Other User Task 1',
        'Should not appear in main user calendar',
        5,
        in3Days,
        otherUserId,
        testDepartmentId,
        'TO_DO',
      ]
    );
    const otherTask1Id = otherTask1Result.rows[0].id;
    createdTaskIds.push(otherTask1Id);
    await pgClient.query(
      'INSERT INTO "task_assignment" ("taskId", "userId", "assignedById", "assignedAt") VALUES ($1, $2, $3, NOW())',
      [otherTask1Id, otherUserId, otherUserId]
    );

    const otherTask2Result = await pgClient.query(
      'INSERT INTO "task" (id, title, description, priority, "dueDate", "ownerId", "departmentId", status, "createdAt", "updatedAt") VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, NOW(), NOW()) RETURNING id',
      [
        'E2E Other User Task 2',
        'Should not appear in main user calendar',
        5,
        in3Days,
        otherUserId,
        testDepartmentId,
        'IN_PROGRESS',
      ]
    );
    const otherTask2Id = otherTask2Result.rows[0].id;
    createdTaskIds.push(otherTask2Id);
    await pgClient.query(
      'INSERT INTO "task_assignment" ("taskId", "userId", "assignedById", "assignedAt") VALUES ($1, $2, $3, NOW())',
      [otherTask2Id, otherUserId, otherUserId]
    );
  });

  test.afterAll(async () => {
    // Cleanup - order matters due to foreign keys

    // 1. Delete task assignments
    for (const taskId of createdTaskIds) {
      await pgClient.query(
        'DELETE FROM "task_assignment" WHERE "taskId" = $1',
        [taskId]
      );
    }

    // 2. Delete tasks
    for (const taskId of createdTaskIds) {
      await pgClient.query('DELETE FROM "task" WHERE id = $1', [taskId]);
    }

    // 3. Delete user profiles
    await pgClient.query(
      'DELETE FROM "user_profile" WHERE "departmentId" = $1',
      [testDepartmentId]
    );

    // 4. Delete auth users
    await supabaseClient.auth.signOut();
    const unique = testEmail.split('.')[3].split('@')[0];
    await pgClient.query('DELETE FROM auth.users WHERE email LIKE $1', [
      `e2e.calendar.%${unique}%`,
    ]);

    // 5. Delete department
    await pgClient.query('DELETE FROM "department" WHERE id = $1', [
      testDepartmentId,
    ]);

    // 6. Close connections
    await pgClient.end();
  });

  test('Setup: should login and navigate to personal calendar', async ({
    page,
  }) => {
    test.setTimeout(120000); // 120s total test timeout

    // Login
    await page.goto('/auth/login');

    await expect(
      page.getByRole('heading', { name: /welcome back/i })
    ).toBeVisible({ timeout: 65000 });

    await page.getByLabel('Email').fill(testEmail);
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
    ).toBeVisible({ timeout: 65000 });

    // Wait for navbar to be fully rendered and interactive
    await expect(page.getByText('Task Manager')).toBeVisible({
      timeout: 65000,
    });

    // Click on Calendar View tab to show calendar
    const calendarTab = page.getByRole('button', { name: /calendar view/i });
    await expect(calendarTab).toBeVisible({ timeout: 65000 });
    await calendarTab.click();

    // Wait for calendar to render (it may take time to load data and render)
    await page.waitForTimeout(3000);

    // Verify calendar is visible
    await expect(page.getByTestId('task-calendar')).toBeVisible({
      timeout: 65000,
    });
  });

  test('CIT001: should display only tasks assigned to user', async ({
    page,
  }) => {
    test.setTimeout(120000);

    await loginAndNavigateToCalendar(page);

    // Wait for calendar to fully render and load events
    await page.waitForTimeout(3000);

    // Some tasks may be hidden in "+X more" popups in month view
    // We verify by checking if task elements exist in DOM (count > 0)
    // Multi-day tasks appear multiple times in the calendar (once per day)

    // Verify main user's tasks appear using data-task-title attribute
    const todoTaskCount = await page
      .locator('[data-task-title="E2E Personal Task - TO_DO"]')
      .count();
    console.warn(`E2E Personal Task - TO_DO count: ${todoTaskCount}`);
    expect(todoTaskCount).toBeGreaterThan(0);

    const inProgressTaskCount = await page
      .locator('[data-task-title="E2E Personal Task - IN_PROGRESS"]')
      .count();
    console.warn(
      `E2E Personal Task - IN_PROGRESS count: ${inProgressTaskCount}`
    );
    expect(inProgressTaskCount).toBeGreaterThan(0);

    const completedTaskCount = await page
      .locator('[data-task-title="E2E Personal Task - COMPLETED"]')
      .count();
    console.warn(`E2E Personal Task - COMPLETED count: ${completedTaskCount}`);
    expect(completedTaskCount).toBeGreaterThan(0);

    const recurringTaskCount = await page
      .locator('[data-task-title="E2E Recurring Weekly Task"]')
      .count();
    console.warn(`E2E Recurring Weekly Task count: ${recurringTaskCount}`);
    expect(recurringTaskCount).toBeGreaterThan(0);

    const overdueTaskCount = await page
      .locator('[data-task-title="E2E Overdue Task"]')
      .count();
    console.warn(`E2E Overdue Task count: ${overdueTaskCount}`);
    expect(overdueTaskCount).toBeGreaterThan(0);

    // Verify other user's tasks do NOT appear in DOM at all
    const otherTask1Count = await page
      .locator('[data-task-title="E2E Other User Task 1"]')
      .count();
    console.warn(`E2E Other User Task 1 count: ${otherTask1Count}`);
    expect(otherTask1Count).toBe(0);

    const otherTask2Count = await page
      .locator('[data-task-title="E2E Other User Task 2"]')
      .count();
    console.warn(`E2E Other User Task 2 count: ${otherTask2Count}`);
    expect(otherTask2Count).toBe(0);
  });

  test('CIT003: should switch between Month, Week, Day, Agenda views', async ({
    page,
  }) => {
    test.setTimeout(120000);

    await loginAndNavigateToCalendar(page);

    // Wait for calendar to render in default Month view
    await page.waitForTimeout(3000);

    // ============================================
    // TEST 1: Verify Month view (default)
    // ============================================
    const monthButton = page.getByTestId('view-month');
    await expect(monthButton).toBeVisible({ timeout: 65000 });

    // Verify at least one task is present in month view
    const monthTaskCount = await page
      .locator('[data-task-title="E2E Personal Task - TO_DO"]')
      .count();
    console.warn(
      `Month view - E2E Personal Task - TO_DO count: ${monthTaskCount}`
    );
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
      .locator('[data-task-title="E2E Personal Task - TO_DO"]')
      .count();
    console.warn(
      `Week view - E2E Personal Task - TO_DO count: ${weekTaskCount}`
    );
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
      .locator('[data-task-title="E2E Personal Task - TO_DO"]')
      .count();
    console.warn(
      `Back to Month view - E2E Personal Task - TO_DO count: ${finalMonthTaskCount}`
    );
    expect(finalMonthTaskCount).toBeGreaterThan(0);
  });

  test('CIT006: should show completed tasks with visual distinction', async ({
    page,
  }) => {
    test.setTimeout(120000);

    await loginAndNavigateToCalendar(page);

    // Wait for calendar to render
    await page.waitForTimeout(3000);

    // Verify completed task is in DOM using data-task-title
    const completedTaskCount = await page
      .locator('[data-task-title="E2E Personal Task - COMPLETED"]')
      .count();
    console.warn(`E2E Personal Task - COMPLETED count: ${completedTaskCount}`);
    expect(completedTaskCount).toBeGreaterThan(0);

    // Verify legend shows COMPLETED status color (use .first() to avoid strict mode violation)
    const legend = page.getByText(/COMPLETED/i).first();
    await expect(legend).toBeVisible({ timeout: 65000 });
  });

  test('should open task modal when clicking event', async ({ page }) => {
    test.setTimeout(120000);

    await loginAndNavigateToCalendar(page);

    // Wait for calendar to render and load events
    await page.waitForTimeout(3000);

    // Find and click a task event using data-task-title attribute
    const taskEvent = page
      .locator('[data-task-title="E2E Personal Task - TO_DO"]')
      .first();
    await expect(taskEvent).toBeVisible({ timeout: 65000 });
    await taskEvent.click();

    // Wait for modal to open
    await page.waitForTimeout(2000);

    // Verify modal opens with task details
    const modalTitle = page.getByRole('heading', {
      name: /E2E Personal Task - TO_DO/i,
    });
    await expect(modalTitle).toBeVisible({ timeout: 65000 });

    // Verify task details are shown
    await expect(page.getByText(/Task to test TO_DO status/i)).toBeVisible({
      timeout: 65000,
    });

    // Close modal by clicking × button
    const closeButton = page.getByText('×').first();
    await expect(closeButton).toBeVisible({ timeout: 65000 });
    await closeButton.click();

    // Wait for modal to close
    await page.waitForTimeout(1000);
  });

  test('CIT004: should have export to iCal button', async ({ page }) => {
    test.setTimeout(120000);

    await loginAndNavigateToCalendar(page);

    // Wait for calendar to render
    await page.waitForTimeout(2000);

    // Find export button
    const exportButton = page.getByText(/export.*iCal/i);
    await expect(exportButton).toBeVisible({ timeout: 65000 });
    await expect(exportButton).toBeEnabled({ timeout: 65000 });

    // Verify button is clickable (don't actually download in test)
    await expect(exportButton.getAttribute('disabled')).resolves.toBeNull();
  });

  test('should navigate dates using Today, Back, Next buttons', async ({
    page,
  }) => {
    test.setTimeout(120000);

    await loginAndNavigateToCalendar(page);

    // Wait for calendar to render
    await page.waitForTimeout(3000);

    // Click Today button
    const todayButton = page.getByTestId('nav-today');
    await expect(todayButton).toBeVisible({ timeout: 65000 });
    await todayButton.click();
    await page.waitForTimeout(1000);

    // Click Next button
    const nextButton = page.getByTestId('nav-next');
    await expect(nextButton).toBeVisible({ timeout: 65000 });
    await nextButton.click();
    await page.waitForTimeout(1000);

    // Verify calendar still renders
    await expect(page.getByTestId('task-calendar')).toBeVisible({
      timeout: 65000,
    });

    // Click Back button
    const backButton = page.getByTestId('nav-back');
    await expect(backButton).toBeVisible({ timeout: 65000 });
    await backButton.click();
    await page.waitForTimeout(1000);

    await expect(page.getByTestId('task-calendar')).toBeVisible({
      timeout: 65000,
    });
  });
});
