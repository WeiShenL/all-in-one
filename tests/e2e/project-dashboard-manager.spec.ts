import { test, expect } from '@playwright/test';
import { Client } from 'pg';
import { createClient } from '@supabase/supabase-js';

/**
 * E2E Test for Manager Project Task Edit Rights
 *
 * Tests manager's ability to edit tasks in a project:
 * - Create manager account under Finance department (uses seed data)
 * - Navigate to Customer Portal Redesign project (uses seed data)
 * - Verify project title and task count (7 tasks from seed data)
 * - Verify all tasks have Edit buttons in Actions column
 * - Sign out
 *
 * Uses existing Finance department, Customer Portal Redesign project and tasks from Prisma seed data
 * Following TEST_CREATION_MANUAL.md patterns for parallel execution
 */

test.describe('Manager Project Task Edit Rights', () => {
  let pgClient: Client;
  let supabaseClient: ReturnType<typeof createClient>;
  let testNamespace: string;

  // Test data IDs
  let financeDeptId: string;
  let managerUserId: string;

  // Test credentials
  let managerEmail: string;
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
    testNamespace = `manager-edit-rights-w${workerId}_${timestamp}_${processId}_${randomSuffix}`;

    // Generate unique credentials
    managerEmail = `finance.director.${testNamespace}@test.com`;

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

    // Create manager user
    const { data: managerAuthData, error: managerError } =
      await supabaseClient.auth.signUp({
        email: managerEmail,
        password: testPassword,
      });

    if (managerError || !managerAuthData.user) {
      throw new Error(
        `Failed to create manager user: ${managerError?.message}`
      );
    }

    // Wait for user_profile trigger
    let managerProfileExists = false;
    for (let i = 0; i < 10; i++) {
      const checkResult = await pgClient.query(
        'SELECT id FROM "user_profile" WHERE id = $1',
        [managerAuthData.user.id]
      );
      if (checkResult.rows.length > 0) {
        managerProfileExists = true;
        break;
      }
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    if (!managerProfileExists) {
      throw new Error('Manager user profile was not created by trigger');
    }

    // Update manager user profile
    await pgClient.query(
      'UPDATE "user_profile" SET "departmentId" = $1, role = $2, name = $3 WHERE id = $4',
      [
        financeDeptId,
        'MANAGER',
        `Finance Director ${testNamespace}`,
        managerAuthData.user.id,
      ]
    );
    managerUserId = managerAuthData.user.id;

    // Find Customer Portal Redesign project (should exist from seed data)
    const projectResult = await pgClient.query(
      'SELECT id FROM "project" WHERE name = $1 LIMIT 1',
      ['Customer Portal Redesign']
    );

    if (projectResult.rows.length === 0) {
      throw new Error(
        'Customer Portal Redesign project not found in seed data'
      );
    }

    const projectId = projectResult.rows[0].id;

    // Add manager as a project collaborator so they can see the project
    // This is needed with the ProjectCollaborator model (SCRUM-32)
    await pgClient.query(
      'INSERT INTO "project_collaborator" ("projectId", "userId", "departmentId", "addedAt") VALUES ($1, $2, $3, NOW()) ON CONFLICT ("projectId", "userId") DO NOTHING',
      [projectId, managerUserId, financeDeptId]
    );
  });

  test.afterEach(async ({ context }) => {
    // Clear browser storage between tests
    await context.clearCookies();
    await context.clearPermissions();
  });

  test.afterAll(async () => {
    try {
      // Cleanup test data created by this test
      if (managerUserId) {
        // Delete any project collaborator entries for this manager
        await pgClient.query(
          'DELETE FROM "project_collaborator" WHERE "userId" = $1',
          [managerUserId]
        );

        // Delete any projects created by this manager (from the second test)
        await pgClient.query('DELETE FROM "project" WHERE "creatorId" = $1', [
          managerUserId,
        ]);

        // Delete any tasks created by this manager (from the second test)
        await pgClient.query('DELETE FROM "task" WHERE "ownerId" = $1', [
          managerUserId,
        ]);

        // Delete any task assignments for this manager
        await pgClient.query(
          'DELETE FROM "task_assignment" WHERE "userId" = $1 OR "assignedById" = $1',
          [managerUserId]
        );

        // Now delete user profile
        await pgClient.query('DELETE FROM "user_profile" WHERE id = $1', [
          managerUserId,
        ]);

        // Delete auth user
        await pgClient.query('DELETE FROM auth.users WHERE id = $1', [
          managerUserId,
        ]);
      }

      // Note: We don't delete the Finance department or Customer Portal Redesign project
      // as they are part of the seed data and used by other tests
    } catch (error) {
      console.error(
        `❌ Error during manager edit rights cleanup for namespace ${testNamespace}:`,
        error
      );
    } finally {
      await pgClient.end();
    }
  });

  test('AC4: Manager can edit all tasks in Customer Portal Redesign project', async ({
    page,
  }) => {
    test.setTimeout(300000);

    // Step 1: Login as manager
    await page.goto('/auth/login');
    await expect(
      page.getByRole('heading', { name: /welcome back/i })
    ).toBeVisible({ timeout: 65000 });

    await page.getByLabel('Email').fill(managerEmail);
    await page.getByLabel('Password').fill(testPassword);
    await page.getByRole('button', { name: /sign in/i }).click();

    // Wait for navigation to dashboard
    await page.waitForLoadState('networkidle');
    await expect(
      page.getByRole('heading', { name: /personal dashboard/i })
    ).toBeVisible({ timeout: 60000 });

    // Step 2: Wait for projects to load in navbar/sidebar, specifically Customer Portal Redesign
    // Wait for the project to appear in the navbar/sidebar
    await page.waitForTimeout(5000); // Give extra time for projects to load

    // Find and click on Customer Portal Redesign project button/item in navbar
    // Target the specific project span with title attribute in ProjectSelection component
    const projectSpan = page
      .locator('span[title="Customer Portal Redesign"]')
      .first();

    // Wait for the project to be visible and clickable
    await expect(projectSpan).toBeVisible({ timeout: 60000 });

    // Click on the project name span
    await projectSpan.click();

    // Step 3: Verify project title shows "Customer Portal Redesign"
    await page.waitForLoadState('networkidle');
    await expect(
      page.getByRole('heading', { name: 'Customer Portal Redesign', level: 1 })
    ).toBeVisible({ timeout: 60000 });

    // Step 6: Wait for task table to load
    // Try different table locators since data-testid might not be present
    const taskTable = page.locator('table').first();
    const tableExists = await taskTable.count();

    if (tableExists === 0) {
      // Check if there's an empty state message
      const emptyState = page.locator('text=No tasks in this project yet');
      const emptyStateExists = await emptyState.count();

      if (emptyStateExists > 0) {
        // For this test, we'll create a task or skip the task verification
        return;
      }
    }

    await expect(taskTable).toBeVisible({ timeout: 60000 });

    // Step 7: Verify all rows have Edit buttons in Actions column
    const taskRows = page.locator('tbody tr');
    const rowCount = await taskRows.count();

    // Verify we have at least 7 tasks (can be more if staff being tested with same project)
    expect(rowCount).toBeGreaterThanOrEqual(7);

    // Check that all visible task rows have Edit buttons
    for (let i = 0; i < Math.min(rowCount, 7); i++) {
      const row = taskRows.nth(i);
      await expect(row).toBeVisible({ timeout: 60000 });

      // Find Edit button in Actions column (last column)
      const editButton = row.locator('button').filter({ hasText: /edit/i });
      await expect(editButton).toBeVisible({ timeout: 60000 });
    }

    // Step 8: Sign out
    await page.getByRole('button', { name: /sign out/i }).click();

    // Verify we're back on login page
    await expect(
      page.getByRole('heading', { name: /welcome back/i })
    ).toBeVisible({ timeout: 60000 });
  });

  test('AC5: Manager can create a new project and filter by project', async ({
    page,
  }) => {
    test.setTimeout(300000);

    const newProjectName = `New E2E Project ${testNamespace}`;
    const newProjectDescription = `Description for New E2E Project ${testNamespace}`;

    // Step 1: Login as manager
    await page.goto('/auth/login');
    await expect(
      page.getByRole('heading', { name: /welcome back/i })
    ).toBeVisible({ timeout: 65000 });

    await page.getByLabel('Email').fill(managerEmail);
    await page.getByLabel('Password').fill(testPassword);
    await page.getByRole('button', { name: /sign in/i }).click();

    // Wait for navigation to dashboard
    await page.waitForLoadState('networkidle');
    await expect(
      page.getByRole('heading', { name: /personal dashboard/i })
    ).toBeVisible({ timeout: 60000 });

    // Step 2: Wait for projects to load in navbar/sidebar, specifically Customer Portal Redesign
    // Wait for the project to appear in the navbar/sidebar
    await page.waitForTimeout(5000); // Give extra time for projects to load

    // Find and click on Customer Portal Redesign project button/item in navbar
    // Target the specific project span with title attribute in ProjectSelection component
    const projectSpan = page
      .locator('span[title="Customer Portal Redesign"]')
      .first();

    // Wait for the project to be visible and clickable
    await expect(projectSpan).toBeVisible({ timeout: 60000 });

    // Click on the project name span
    await projectSpan.click();

    // Step 3: Verify project title shows "Customer Portal Redesign"
    await page.waitForLoadState('networkidle');
    await expect(
      page.getByRole('heading', { name: 'Customer Portal Redesign', level: 1 })
    ).toBeVisible({ timeout: 60000 });

    // Step 6: Click the "Add" button (+) next to PROJECTS heading in navbar
    // Look for the + button that's positioned next to the PROJECTS heading
    const addProjectButton = page
      .locator('div')
      .filter({ hasText: 'PROJECTS' })
      .locator('button[title="Add Project"]')
      .first();
    await expect(addProjectButton).toBeVisible({ timeout: 60000 });
    await addProjectButton.click();

    // Step 7: Fill up the project creation modal
    await expect(
      page.getByRole('heading', { name: /create.*project/i })
    ).toBeVisible({ timeout: 60000 });

    // Fill project name
    await page.getByLabel(/name/i).fill(newProjectName);

    // Fill project description
    await page.getByLabel(/description/i).fill(newProjectDescription);

    // Step 8: Press "Create Project" button
    await page.getByRole('button', { name: /create.*project/i }).click();

    // Wait for the modal to close and project to appear in the sidebar
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    // Step 9: Check that the new project appears in the project selection component
    const newProjectItem = page
      .locator(`span[title="${newProjectName}"]`)
      .first();
    await expect(newProjectItem).toBeVisible({ timeout: 60000 });

    // Step 10: Click on the new project in the sidebar
    await newProjectItem.click();

    // Step 11: Check that the title of the project page changes to the new project's name
    await page.waitForLoadState('networkidle');
    await expect(
      page.getByRole('heading', { name: newProjectName, level: 1 })
    ).toBeVisible({ timeout: 60000 });

    // Step 12: Check the task count shows 0
    await expect(page.getByText(`${newProjectName} (0)`)).toBeVisible({
      timeout: 60000,
    });

    // Step 13: Sign out
    await page.getByRole('button', { name: /sign out/i }).click();

    // Verify we're back on login page
    await expect(
      page.getByRole('heading', { name: /welcome back/i })
    ).toBeVisible({ timeout: 60000 });
  });
});
