import { test, expect } from '@playwright/test';
import { Client } from 'pg';
import { createClient } from '@supabase/supabase-js';

/**
 * E2E Test for Staff Project Task Edit Rights
 *
 * Tests staff member's ability to edit only assigned tasks in a project:
 * - Create staff account under Finance department (uses seed data)
 * - Navigate to Customer Portal Redesign project (uses seed data)
 * - Verify project title and task count (7 seed tasks + 1 assigned task = 8 total)
 * - Verify ONLY assigned task has Edit button (staff can edit assigned tasks only)
 * - Verify seed data tasks have NO Edit buttons (staff cannot edit unassigned tasks)
 * - Sign out
 *
 * Test data: Finance dept + Customer Portal project + 7 tasks from seed data + 1 additional task assigned to staff
 * Following TEST_CREATION_MANUAL.md patterns for parallel execution
 */

test.describe('Staff Project Task Edit Rights', () => {
  let pgClient: Client;
  let supabaseClient: ReturnType<typeof createClient>;
  let testNamespace: string;

  // Test data IDs
  let financeDeptId: string;
  let staffUserId: string;
  let customerPortalProjectId: string;

  // Test credentials
  let staffEmail: string;
  const testPassword = 'Test123!@#';

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
    const timestamp = Date.now();
    const processId = process.pid;
    const randomSuffix = crypto.randomUUID().slice(0, 8);
    testNamespace = `staff-view-rights-w${workerId}_${timestamp}_${processId}_${randomSuffix}`;

    // Generate unique credentials
    staffEmail = `finance.staff.${testNamespace}@test.com`;

    // Find Finance department (should exist from seed data)
    const financeDeptResult = await pgClient.query(
      'SELECT id FROM "department" WHERE name = $1 LIMIT 1',
      ['Finance']
    );

    if (financeDeptResult.rows.length > 0) {
      financeDeptId = financeDeptResult.rows[0].id;
    } else {
      throw new Error('Finance department not found in seed data');
    }

    // Create staff user
    const { data: staffAuthData, error: staffError } =
      await supabaseClient.auth.signUp({
        email: staffEmail,
        password: testPassword,
      });

    if (staffError || !staffAuthData.user) {
      throw new Error(`Failed to create staff user: ${staffError?.message}`);
    }

    // Wait for user_profile trigger
    let staffProfileExists = false;
    for (let i = 0; i < 10; i++) {
      const checkResult = await pgClient.query(
        'SELECT id FROM "user_profile" WHERE id = $1',
        [staffAuthData.user.id]
      );
      if (checkResult.rows.length > 0) {
        staffProfileExists = true;
        break;
      }
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    if (!staffProfileExists) {
      throw new Error('Staff user profile was not created by trigger');
    }

    // Update staff user profile
    await pgClient.query(
      'UPDATE "user_profile" SET "departmentId" = $1, role = $2, name = $3 WHERE id = $4',
      [
        financeDeptId,
        'STAFF',
        `Finance Staff ${testNamespace}`,
        staffAuthData.user.id,
      ]
    );
    staffUserId = staffAuthData.user.id;

    // Find Customer Portal Redesign project (should exist from seed data)
    const projectResult = await pgClient.query(
      'SELECT id FROM "project" WHERE name = $1 LIMIT 1',
      ['Customer Portal Redesign']
    );

    if (projectResult.rows.length > 0) {
      customerPortalProjectId = projectResult.rows[0].id;

      // Add one additional task where staff member is assigned
      const additionalTaskResult = await pgClient.query(
        'INSERT INTO "task" (id, title, description, priority, "dueDate", status, "ownerId", "departmentId", "projectId", "createdAt", "updatedAt") VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW()) RETURNING id',
        [
          `Task assigned to staff member ${testNamespace}`,
          `Additional task for testing staff edit permissions - ${testNamespace}`,
          5,
          new Date('2025-10-31'),
          'TO_DO',
          staffUserId,
          financeDeptId,
          customerPortalProjectId,
        ]
      );

      // Assign this additional task to the staff member
      await pgClient.query(
        'INSERT INTO "task_assignment" ("taskId", "userId", "assignedById", "assignedAt") VALUES ($1, $2, $3, NOW())',
        [additionalTaskResult.rows[0].id, staffUserId, staffUserId]
      );

      // Add staff as a project collaborator so they can see the project
      // This is needed with the ProjectCollaborator model (SCRUM-32)
      await pgClient.query(
        'INSERT INTO "project_collaborator" ("projectId", "userId", "departmentId", "addedAt") VALUES ($1, $2, $3, NOW()) ON CONFLICT ("projectId", "userId") DO NOTHING',
        [customerPortalProjectId, staffUserId, financeDeptId]
      );
    } else {
      throw new Error(
        'Customer Portal Redesign project not found in seed data'
      );
    }
  });

  test.afterEach(async ({ context }) => {
    // Clear browser storage between tests
    await context.clearCookies();
    await context.clearPermissions();
  });

  test.afterAll(async () => {
    try {
      // Cleanup test data created by this test
      if (staffUserId) {
        // Delete any project collaborator entries for this staff
        await pgClient.query(
          'DELETE FROM "project_collaborator" WHERE "userId" = $1',
          [staffUserId]
        );

        // First, delete any projects created by this staff to avoid foreign key constraints
        await pgClient.query('DELETE FROM "project" WHERE "creatorId" = $1', [
          staffUserId,
        ]);

        // Delete any tasks created by this staff
        await pgClient.query('DELETE FROM "task" WHERE "ownerId" = $1', [
          staffUserId,
        ]);

        // Delete any task assignments for this staff
        await pgClient.query(
          'DELETE FROM "task_assignment" WHERE "userId" = $1 OR "assignedById" = $1',
          [staffUserId]
        );

        // Now delete user profile
        await pgClient.query('DELETE FROM "user_profile" WHERE id = $1', [
          staffUserId,
        ]);

        // Delete auth user
        await pgClient.query('DELETE FROM auth.users WHERE id = $1', [
          staffUserId,
        ]);
      }

      // Note: We don't delete the Finance department or Customer Portal Redesign project
      // as they are part of the seed data and used by other tests
    } catch (error) {
      console.error(
        `❌ Error during staff view rights cleanup for namespace ${testNamespace}:`,
        error
      );
    } finally {
      await pgClient.end();
    }
  });

  test('AC 1,2,3: staff can can only view subordinate tasks in Customer Portal Redesign project and edit if assigned to task', async ({
    page,
  }) => {
    test.setTimeout(300000);

    // Step 1: Login as staff member
    await page.goto('/auth/login');
    await expect(
      page.getByRole('heading', { name: /welcome back/i })
    ).toBeVisible({ timeout: 65000 });

    await page.getByLabel('Email').fill(staffEmail);
    await page.getByLabel('Password').fill(testPassword);
    await page.getByRole('button', { name: /sign in/i }).click();

    // Wait for navigation to dashboard
    await page.waitForLoadState('networkidle');
    await expect(
      page.getByRole('heading', { name: /personal dashboard/i })
    ).toBeVisible({ timeout: 60000 });

    // Step 2: Wait for projects to load in navbar/sidebar, specifically Customer Portal Redesign
    await page.waitForTimeout(5000); // Give extra time for projects to load

    // Find and click on Customer Portal Redesign project button/item in navbar
    const projectSpan = page
      .locator('span[title="Customer Portal Redesign"]')
      .first();
    await expect(projectSpan).toBeVisible({ timeout: 60000 });
    await projectSpan.click();

    // Step 3: Verify project title shows "Customer Portal Redesign"
    await page.waitForLoadState('networkidle');
    await expect(
      page.getByRole('heading', { name: 'Customer Portal Redesign', level: 1 })
    ).toBeVisible({ timeout: 60000 });

    // Step 4: Verify project dashboard shows "Customer Portal Redesign (8)" - 7 seed tasks + 1 assigned task
    await expect(page.getByText('Customer Portal Redesign (8)')).toBeVisible({
      timeout: 60000,
    });

    // Step 5: Wait for task table to load
    const taskTable = page.locator('table').first();
    await expect(taskTable).toBeVisible({ timeout: 60000 });

    // Step 6: Verify edit button visibility based on task assignment
    const taskRows = page.locator('tbody tr');
    const rowCount = await taskRows.count();
    expect(rowCount).toBeGreaterThanOrEqual(8);

    // Find the task assigned to staff member (should have edit button)
    const assignedTaskRow = page
      .locator('tbody tr')
      .filter({ hasText: `Task assigned to staff member ${testNamespace}` });
    await expect(assignedTaskRow).toBeVisible({ timeout: 60000 });

    // Verify the assigned task has an edit button
    const assignedTaskEditButton = assignedTaskRow
      .locator('button')
      .filter({ hasText: /edit/i });
    await expect(assignedTaskEditButton).toBeVisible({ timeout: 60000 });

    // Check that all other tasks (seed data tasks) do NOT have edit buttons
    for (let i = 0; i < rowCount; i++) {
      const row = taskRows.nth(i);
      await expect(row).toBeVisible({ timeout: 60000 });

      // Skip the assigned task row (we already checked it)
      const rowText = await row.textContent();
      if (rowText?.includes(`Task assigned to staff member ${testNamespace}`)) {
        continue;
      }

      // All other tasks should NOT have edit buttons
      const editButton = row.locator('button').filter({ hasText: /edit/i });
      await expect(editButton).not.toBeVisible({ timeout: 60000 });
    }

    // Step 7: Sign out
    await page.getByRole('button', { name: /sign out/i }).click();

    // Verify we're back on login page
    await expect(
      page.getByRole('heading', { name: /welcome back/i })
    ).toBeVisible({ timeout: 60000 });
  });
});
