import { test, expect } from '@playwright/test';
import { Client } from 'pg';
import { createClient } from '@supabase/supabase-js';

/**
 * E2E: Manager archives a task with subtasks (happy path, UI-only)
 *
 * What this test covers (UI flow only):
 * 1) Seed data: department, manager (auth + profile), staff, a parent task with 2 subtasks
 * 2) Login via the UI as manager
 * 3) Locate the seeded parent task on department dashboard
 * 4) Click the "Archive" button for the parent task
 * 5) Confirm archive in the modal
 * 6) Verify the parent task disappears from UI
 * 7) Verify subtasks also disappear (cascade archive)
 *
 * Acceptance Criteria covered:
 * - AC1: Only managers can archive tasks (manager role test)
 * - AC2: Archived tasks removed from UI (task disappears)
 * - AC3: Archiving parent archives all subtasks (both disappear)
 *
 * Notes:
 * - This mirrors tests/e2e/task-management/manager-remove-assignee.spec.ts structure
 * - UI-only assertions (no direct DB checks in main test body)
 */
test.describe('E2E - Manager archives task with subtasks (happy path)', () => {
  let pgClient: Client;
  let supabaseClient: ReturnType<typeof createClient>;

  // Seeded records to clean up
  let deptId: string;
  let managerId: string;
  let staffId: string;
  let parentTaskId: string;
  let subtask1Id: string;
  let subtask2Id: string;
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
    testNamespace = `archive-w${workerId}_${timestamp}_${processId}_${randomSuffix}`;

    // 3) Unique email to avoid collisions
    managerEmail = `e2e.manager.${testNamespace}@example.com`;

    // 4) Create department
    {
      const res = await pgClient.query(
        'INSERT INTO "department" (id, name, "isActive", "createdAt", "updatedAt") VALUES (gen_random_uuid(), $1, true, NOW(), NOW()) RETURNING id',
        [`E2E Archive Dept ${testNamespace}`]
      );
      deptId = res.rows[0].id;
    }

    // 5) Create manager via Supabase auth to login through the UI
    const { data: auth, error } = await supabaseClient.auth.signUp({
      email: managerEmail,
      password: managerPassword,
    });
    if (error || !auth.user) {
      throw new Error(`Failed to create manager auth user: ${error?.message}`);
    }

    // Wait for trigger to create user_profile, then set as MANAGER
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
      ['MANAGER', deptId, `E2E Manager ${testNamespace}`, auth.user.id]
    );
    managerId = auth.user.id;

    // 6) Create staff member
    {
      const r = await pgClient.query(
        'INSERT INTO "user_profile" (id, email, name, role, "departmentId", "isActive", "createdAt", "updatedAt") VALUES (gen_random_uuid(), $1, $2, $3, $4, true, NOW(), NOW()) RETURNING id',
        [
          `e2e.staff.${testNamespace}@example.com`,
          `Staff ${testNamespace}`,
          'STAFF',
          deptId,
        ]
      );
      staffId = r.rows[0].id;
    }

    // 7) Create parent task
    {
      const rTask = await pgClient.query(
        'INSERT INTO "task" (id, title, description, priority, "dueDate", status, "ownerId", "departmentId", "projectId", "parentTaskId", "recurringInterval", "isArchived", "createdAt", "updatedAt") VALUES (gen_random_uuid(), $1, $2, 5, NOW() + interval \'7 days\', $3, $4, $5, NULL, NULL, NULL, false, NOW(), NOW()) RETURNING id',
        [
          `E2E Parent Task ${testNamespace}`,
          'Parent task for archive test',
          'TO_DO',
          managerId,
          deptId,
        ]
      );
      parentTaskId = rTask.rows[0].id;

      // Assign manager to parent task
      await pgClient.query(
        'INSERT INTO "task_assignment" ("taskId", "userId", "assignedById", "assignedAt") VALUES ($1, $2, $3, NOW())',
        [parentTaskId, managerId, managerId]
      );
    }

    // 8) Create subtask 1
    {
      const rSub1 = await pgClient.query(
        'INSERT INTO "task" (id, title, description, priority, "dueDate", status, "ownerId", "departmentId", "projectId", "parentTaskId", "recurringInterval", "isArchived", "createdAt", "updatedAt") VALUES (gen_random_uuid(), $1, $2, 5, NOW() + interval \'6 days\', $3, $4, $5, NULL, $6, NULL, false, NOW(), NOW()) RETURNING id',
        [
          `E2E Subtask 1 ${testNamespace}`,
          'First subtask',
          'TO_DO',
          staffId,
          deptId,
          parentTaskId,
        ]
      );
      subtask1Id = rSub1.rows[0].id;

      await pgClient.query(
        'INSERT INTO "task_assignment" ("taskId", "userId", "assignedById", "assignedAt") VALUES ($1, $2, $3, NOW())',
        [subtask1Id, staffId, managerId]
      );
    }

    // 9) Create subtask 2
    {
      const rSub2 = await pgClient.query(
        'INSERT INTO "task" (id, title, description, priority, "dueDate", status, "ownerId", "departmentId", "projectId", "parentTaskId", "recurringInterval", "isArchived", "createdAt", "updatedAt") VALUES (gen_random_uuid(), $1, $2, 5, NOW() + interval \'5 days\', $3, $4, $5, NULL, $6, NULL, false, NOW(), NOW()) RETURNING id',
        [
          `E2E Subtask 2 ${testNamespace}`,
          'Second subtask',
          'TO_DO',
          staffId,
          deptId,
          parentTaskId,
        ]
      );
      subtask2Id = rSub2.rows[0].id;

      await pgClient.query(
        'INSERT INTO "task_assignment" ("taskId", "userId", "assignedById", "assignedAt") VALUES ($1, $2, $3, NOW())',
        [subtask2Id, staffId, managerId]
      );
    }
  });

  test.afterAll(async () => {
    // Cleanup in safe FK order
    try {
      // Clean up tasks (parent and subtasks)
      const taskIds = [parentTaskId, subtask1Id, subtask2Id].filter(Boolean);
      if (taskIds.length > 0) {
        await pgClient.query(
          'DELETE FROM "task_log" WHERE "taskId" = ANY($1)',
          [taskIds]
        );
        await pgClient.query(
          'DELETE FROM "task_assignment" WHERE "taskId" = ANY($1)',
          [taskIds]
        );
        await pgClient.query(
          'DELETE FROM "task_tag" WHERE "taskId" = ANY($1)',
          [taskIds]
        );
        await pgClient.query('DELETE FROM "task" WHERE id = ANY($1)', [
          taskIds,
        ]);
      }

      // Clean up users
      await pgClient.query('DELETE FROM "user_profile" WHERE id = ANY($1)', [
        [managerId, staffId],
      ]);

      // Clean up department
      await pgClient.query('DELETE FROM "department" WHERE id = $1', [deptId]);
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

  test('Manager can archive parent task and subtasks via UI (happy path)', async ({
    page,
  }) => {
    test.setTimeout(300000);

    // 1) Login via UI as manager
    await page.goto('/auth/login');
    await expect(
      page.getByRole('heading', { name: /welcome back/i })
    ).toBeVisible({ timeout: 40000 });
    await page.getByLabel('Email').fill(managerEmail);
    await page.getByLabel('Password').fill(managerPassword);
    await page.getByRole('button', { name: /sign in/i }).click();

    // 2) Wait for dashboard load, then navigate to department dashboard
    await expect(page).toHaveURL(/dashboard(\/personal)?|home|tasks/i, {
      timeout: 40000,
    });

    // Navigate to department dashboard where manager can archive tasks
    await page.goto('/dashboard/department');
    await expect(page).toHaveURL(/dashboard\/department/, {
      timeout: 40000,
    });

    // 3) Verify parent task is visible
    await expect(
      page.getByText(`E2E Parent Task ${testNamespace}`)
    ).toBeVisible({ timeout: 40000 });

    // 4) Expand subtasks to verify they're visible before archiving
    const parentRow = page
      .locator('tr', {
        hasText: `E2E Parent Task ${testNamespace}`,
      })
      .first();
    await expect(parentRow).toBeVisible({ timeout: 40000 });

    // Look for expand button (usually a chevron/arrow near task title)
    const expandButton = parentRow.locator('button').first();
    await expect(expandButton).toBeVisible({ timeout: 40000 });
    await expandButton.click();

    // Verify subtasks are now visible
    await expect(page.getByText(`E2E Subtask 1 ${testNamespace}`)).toBeVisible({
      timeout: 40000,
    });
    await expect(page.getByText(`E2E Subtask 2 ${testNamespace}`)).toBeVisible({
      timeout: 40000,
    });

    // 5) Click Archive button on parent task
    const archiveButton = parentRow.getByTestId(
      `archive-task-button-${parentTaskId}`
    );
    await expect(archiveButton).toBeVisible({ timeout: 40000 });
    await archiveButton.click();

    // 6) Confirm archive in modal
    // Modal should show confirmation message about archiving task and subtasks
    await expect(
      page.getByText(/are you sure you want to archive this task/i)
    ).toBeVisible({ timeout: 40000 });
    await expect(
      page.getByText(/this action will also archive all subtasks/i)
    ).toBeVisible({ timeout: 40000 });

    // Click "Confirm archive" button
    const confirmButton = page.getByRole('button', {
      name: /confirm archive/i,
    });
    await expect(confirmButton).toBeVisible({ timeout: 40000 });
    await confirmButton.click();

    // 7) Verify parent task disappears from UI (AC2: archived tasks removed from UI)
    await expect(
      page.getByText(`E2E Parent Task ${testNamespace}`)
    ).toHaveCount(0, { timeout: 40000 });

    // 8) Verify subtasks also disappear (AC3: cascade archive)
    await expect(page.getByText(`E2E Subtask 1 ${testNamespace}`)).toHaveCount(
      0,
      { timeout: 40000 }
    );
    await expect(page.getByText(`E2E Subtask 2 ${testNamespace}`)).toHaveCount(
      0,
      { timeout: 40000 }
    );

    // Optional: Verify in database that tasks are archived (not deleted)
    const result = await pgClient.query(
      'SELECT id, "isArchived" FROM "task" WHERE id = ANY($1)',
      [[parentTaskId, subtask1Id, subtask2Id]]
    );
    expect(result.rows.length).toBe(3);
    result.rows.forEach(row => {
      expect(row.isArchived).toBe(true);
    });
  });
});
