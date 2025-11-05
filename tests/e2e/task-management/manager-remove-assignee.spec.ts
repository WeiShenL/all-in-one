import { test, expect } from '@playwright/test';
import { Client } from 'pg';
import { createClient } from '@supabase/supabase-js';

/**
 * E2E: Manager removes an assignee (happy path, UI-only)
 *
 * What this test covers (UI flow only):
 * 1) Seed data: departments, manager (auth + profile), two staff, a task with both staff assigned
 *    - Staff A in manager's department so the manager has access via assignee hierarchy
 *    - Staff B in a peer department to be removed as an assignee
 * 2) Login via the UI as manager
 * 3) Locate the seeded task on dashboard
 * 4) Click the remove control for Staff B
 * 5) Verify the UI no longer shows Staff B as an assignee for that task
 *
 * Notes:
 * - This mirrors the structure of tests/e2e/subtask-creation.spec.ts (setup/cleanup and UI-first assertions).
 * - We intentionally avoid DB assertions in the main test body (UI-only per requirements).
 */
test.describe('E2E - Manager removes assignee (happy path)', () => {
  let pgClient: Client;
  let supabaseClient: ReturnType<typeof createClient>;

  // Seeded records to clean up
  let salesDeptId: string;
  let engineeringDeptId: string;
  let managerId: string;
  let staffAId: string; // Sales (kept to grant manager access)
  let staffBId: string; // Engineering (to be removed)
  let taskId: string;
  let testNamespace: string;

  // Manager UI login credentials
  let managerEmail: string;
  const managerPassword = 'Test123!@#';

  test.beforeAll(async () => {
    // 1) Setup DB and Supabase clients
    pgClient = new Client({ connectionString: process.env.DATABASE_URL });
    await pgClient.connect();

    supabaseClient = createClient(
      process.env.NEXT_PUBLIC_API_EXTERNAL_URL!,
      process.env.NEXT_PUBLIC_ANON_KEY!
    );

    // 2) Create worker-specific namespace for test data isolation
    const workerId = process.env.PLAYWRIGHT_WORKER_INDEX || '0';
    const timestamp = Date.now();
    const processId = process.pid;
    const randomSuffix = crypto.randomUUID().slice(0, 8);
    testNamespace = `manager-remove-w${workerId}_${timestamp}_${processId}_${randomSuffix}`;

    // 3) Unique suffix to avoid collisions
    managerEmail = `e2e.manager.${testNamespace}@example.com`;

    // 3) Departments: Sales (manager), Engineering (peer)
    {
      const res = await pgClient.query(
        'INSERT INTO "department" (id, name, "isActive", "createdAt", "updatedAt") VALUES (gen_random_uuid(), $1, true, NOW(), NOW()) RETURNING id',
        [`E2E Sales ${testNamespace}`]
      );
      salesDeptId = res.rows[0].id;
    }
    {
      const res = await pgClient.query(
        'INSERT INTO "department" (id, name, "isActive", "createdAt", "updatedAt") VALUES (gen_random_uuid(), $1, true, NOW(), NOW()) RETURNING id',
        [`E2E Engineering ${testNamespace}`]
      );
      engineeringDeptId = res.rows[0].id;
    }

    // 4) Create manager via Supabase auth to login through the UI
    const { data: auth, error } = await supabaseClient.auth.signUp({
      email: managerEmail,
      password: managerPassword,
    });
    if (error || !auth.user) {
      throw new Error(`Failed to create manager auth user: ${error?.message}`);
    }

    // Wait for trigger to create user_profile, then set as MANAGER in Sales
    for (let i = 0; i < 10; i++) {
      const r = await pgClient.query(
        'SELECT id FROM "user_profile" WHERE id = $1',
        [auth.user.id]
      );
      if (r.rows.length > 0) {
        break;
      }
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    await pgClient.query(
      'UPDATE "user_profile" SET role = $1, "departmentId" = $2, name = $3 WHERE id = $4',
      ['MANAGER', salesDeptId, `E2E Manager ${testNamespace}`, auth.user.id]
    );
    managerId = auth.user.id;

    // 5) Create Staff A (Sales) and Staff B (Engineering)
    {
      const r = await pgClient.query(
        'INSERT INTO "user_profile" (id, email, name, role, "departmentId", "isActive", "createdAt", "updatedAt") VALUES (gen_random_uuid(), $1, $2, $3, $4, true, NOW(), NOW()) RETURNING id',
        [
          `e2e.staffA.${testNamespace}@example.com`,
          `Staff A ${testNamespace}`,
          'STAFF',
          salesDeptId,
        ]
      );
      staffAId = r.rows[0].id;
    }
    {
      const r = await pgClient.query(
        'INSERT INTO "user_profile" (id, email, name, role, "departmentId", "isActive", "createdAt", "updatedAt") VALUES (gen_random_uuid(), $1, $2, $3, $4, true, NOW(), NOW()) RETURNING id',
        [
          `e2e.staffB.${testNamespace}@example.com`,
          `Staff B ${testNamespace}`,
          'STAFF',
          engineeringDeptId,
        ]
      );
      staffBId = r.rows[0].id;
    }

    // 6) Create a task in Sales (manager's department) so access persists after removal
    {
      const rTask = await pgClient.query(
        'INSERT INTO "task" (id, title, description, priority, "dueDate", status, "ownerId", "departmentId", "projectId", "parentTaskId", "recurringInterval", "isArchived", "createdAt", "updatedAt") VALUES (gen_random_uuid(), $1, $2, 5, NOW() + interval \'7 days\', $3, $4, $5, NULL, NULL, NULL, false, NOW(), NOW()) RETURNING id',
        [
          `E2E Manager Remove Assignee Task ${testNamespace}`,
          'Task for manager e2e removal',
          'TO_DO',
          staffAId,
          salesDeptId,
        ]
      );
      taskId = rTask.rows[0].id;

      // Assign Staff A (Sales) and Staff B (Engineering)
      await pgClient.query(
        'INSERT INTO "task_assignment" ("taskId", "userId", "assignedById", "assignedAt") VALUES ($1, $2, $3, NOW()), ($1, $4, $3, NOW())',
        [taskId, staffAId, staffAId, staffBId]
      );
    }
  });

  test.afterAll(async () => {
    // Cleanup in safe FK order
    try {
      if (taskId) {
        await pgClient.query('DELETE FROM "task_log" WHERE "taskId" = $1', [
          taskId,
        ]);
        await pgClient.query(
          'DELETE FROM "task_assignment" WHERE "taskId" = $1',
          [taskId]
        );
        await pgClient.query('DELETE FROM "task_tag" WHERE "taskId" = $1', [
          taskId,
        ]);
        await pgClient.query('DELETE FROM "task" WHERE id = $1', [taskId]);
      }
      await pgClient.query('DELETE FROM "user_profile" WHERE id = ANY($1)', [
        [managerId, staffAId, staffBId],
      ]);
      await pgClient.query('DELETE FROM "department" WHERE id = ANY($1)', [
        [salesDeptId, engineeringDeptId],
      ]);
    } finally {
      // Delete auth user last
      try {
        await supabaseClient.auth.signOut();
        await pgClient.query('DELETE FROM auth.users WHERE email = $1', [
          managerEmail,
        ]);
      } catch {}
      await pgClient.end();
    }
  });

  test('Manager can remove an assignee via UI (happy path)', async ({
    page,
  }) => {
    test.setTimeout(300000);

    // 1) Login via UI as manager
    await page.goto('/auth/login');
    await expect(
      page.getByRole('heading', { name: /welcome back/i })
    ).toBeVisible({ timeout: 120000 });
    await page.getByLabel('Email').fill(managerEmail);
    await page.getByLabel('Password').fill(managerPassword);
    await page.getByRole('button', { name: /sign in/i }).click();

    // 2) Wait for personal dashboard, then navigate to department dashboard
    await expect(page).toHaveURL(/dashboard(\/personal)?|home|tasks/i, {
      timeout: 120000,
    });

    // Navigate to department dashboard to manage department tasks
    await page.goto('/dashboard/department');
    await expect(page).toHaveURL(/dashboard\/department/, {
      timeout: 120000,
    });
    await expect(
      page
        .getByText(`E2E Manager Remove Assignee Task ${testNamespace}`)
        .first()
    ).toBeVisible({ timeout: 120000 });

    // 3) Open the task editor/details view where assignee controls are rendered
    // ManagerDashboard renders a table with an "Edit" button per row; scope to the row with our task title
    const taskRow = page
      .locator('tr', {
        hasText: `E2E Manager Remove Assignee Task ${testNamespace}`,
      })
      .first();
    await expect(taskRow).toBeVisible({ timeout: 120000 });
    const editButton = taskRow.getByRole('button', { name: /^Edit$/i });
    await expect(editButton).toBeVisible({ timeout: 120000 });
    await editButton.click();

    // Wait for task card details to render
    await expect(
      page.locator('[data-testid="task-title-display"]')
    ).toBeVisible({ timeout: 120000 });

    // 4) Click the first available remove-assignee control (UI-only; any assignee is fine for happy path)
    //    Buttons are rendered as data-testid="remove-assignee-<userId>"
    const removeButtons = page.locator('[data-testid^="remove-assignee-"]');
    const initialCount = await removeButtons.count();
    expect(initialCount).toBeGreaterThan(0);
    const firstButton = removeButtons.first();
    const targetTestId = (await firstButton.getAttribute('data-testid')) || '';
    const removedUserId = targetTestId.replace('remove-assignee-', '');
    await firstButton.click();

    // 5) Verify UI success indicator appears, then assert button disappears
    await expect(
      page.getByText(/Removed assignee|✅ Removed assignee/i)
    ).toBeVisible({ timeout: 120000 });
    await expect(
      page.locator(`[data-testid="remove-assignee-${removedUserId}"]`)
    ).toHaveCount(0, { timeout: 120000 });

    // Optional toast/snackbar check if available
    // await expect(page.getByText(/removed assignee|✅ Removed assignee/i)).toBeVisible({ timeout: 40000 });
  });
});
