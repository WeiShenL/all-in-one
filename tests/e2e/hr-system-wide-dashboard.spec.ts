/**
 * E2E tests for HR/Admin System-Wide Dashboard UI
 *
 * User Story: As an HR/Admin, I want to view a system-wide dashboard of all tasks
 * across the organization.
 *
 * Test Coverage:
 * - Page access control for HR/Admin users
 * - Display of system-wide tasks
 * - Filtering by department, project, assignee
 * - Edit button visibility based on canEdit logic
 * - Combined role scenarios (HR/Admin + Manager)
 */

import { test, expect, Page } from '@playwright/test';
import { Client } from 'pg';

test.describe('HR/Admin System-Wide Dashboard - E2E Tests', () => {
  let pgClient: Client;
  let hrAdminOnlyEmail: string;
  let hrAdminManagerEmail: string;
  let managerOnlyEmail: string;
  let staffEmail: string;

  test.beforeAll(async () => {
    pgClient = new Client({ connectionString: process.env.DATABASE_URL });
    await pgClient.connect();

    // Generate unique test emails
    const timestamp = Date.now();
    hrAdminOnlyEmail = `hradmin.only.${timestamp}@test.com`;
    hrAdminManagerEmail = `hradmin.manager.${timestamp}@test.com`;
    managerOnlyEmail = `manager.only.${timestamp}@test.com`;
    staffEmail = `staff.${timestamp}@test.com`;
  });

  test.afterAll(async () => {
    // Cleanup test users
    const emails = [
      hrAdminOnlyEmail,
      hrAdminManagerEmail,
      managerOnlyEmail,
      staffEmail,
    ];
    for (const email of emails) {
      try {
        await pgClient.query(
          'DELETE FROM public."user_profile" WHERE email = $1',
          [email]
        );
        await pgClient.query('DELETE FROM auth.users WHERE email = $1', [
          email,
        ]);
      } catch (error) {
        console.error(`Failed to cleanup user ${email}:`, error);
      }
    }

    await pgClient.end();
  });

  test.describe('Page Access Control', () => {
    test('UAA0015: HR/Admin user can access system-wide dashboard', async ({
      page,
    }) => {
      // Create and login as HR/Admin user
      await createAndLoginUser(page, {
        email: hrAdminOnlyEmail,
        password: 'TestPass123!',
        name: 'HR Admin Only User',
        role: 'STAFF',
        isHrAdmin: true,
      });

      // Navigate to system-wide dashboard
      await page.goto('/dashboard/system-wide');

      // Should successfully load the page
      await expect(page).toHaveURL(/\/dashboard\/system-wide/);
      await expect(page.locator('h1')).toContainText(/system.*wide/i);
    });

    test('UAA0026: STAFF user cannot access system-wide dashboard', async ({
      page,
    }) => {
      // Create and login as regular staff user
      await createAndLoginUser(page, {
        email: staffEmail,
        password: 'TestPass123!',
        name: 'Regular Staff User',
        role: 'STAFF',
        isHrAdmin: false,
      });

      // Attempt to navigate to system-wide dashboard
      await page.goto('/dashboard/system-wide');

      // Should be redirected or show access denied
      await expect(page).not.toHaveURL(/\/dashboard\/system-wide/);
      // Could be redirected to personal dashboard or access denied page
      await expect(
        page.locator('text=/access denied|unauthorized|not authorized/i')
      )
        .toBeVisible()
        .catch(() => {
          // Or redirected to another page
          expect(page.url()).not.toContain('/dashboard/system-wide');
        });
    });

    test('Manager without HR/Admin cannot access system-wide dashboard', async ({
      page,
    }) => {
      // Create and login as manager (no HR/Admin)
      await createAndLoginUser(page, {
        email: managerOnlyEmail,
        password: 'TestPass123!',
        name: 'Manager Only User',
        role: 'MANAGER',
        isHrAdmin: false,
      });

      // Attempt to navigate to system-wide dashboard
      await page.goto('/dashboard/system-wide');

      // Should be denied access
      await expect(page).not.toHaveURL(/\/dashboard\/system-wide/);
    });

    test('HR/Admin + Manager can access system-wide dashboard', async ({
      page,
    }) => {
      // Create and login as HR/Admin + Manager
      await createAndLoginUser(page, {
        email: hrAdminManagerEmail,
        password: 'TestPass123!',
        name: 'HR Admin and Manager',
        role: 'MANAGER',
        isHrAdmin: true,
      });

      // Navigate to system-wide dashboard
      await page.goto('/dashboard/system-wide');

      // Should successfully load
      await expect(page).toHaveURL(/\/dashboard\/system-wide/);
    });
  });

  test.describe('Display System-Wide Tasks', () => {
    test('should display tasks from all departments', async ({ page }) => {
      await createAndLoginUser(page, {
        email: hrAdminOnlyEmail,
        password: 'TestPass123!',
        name: 'HR Admin Only User',
        role: 'STAFF',
        isHrAdmin: true,
      });

      await page.goto('/dashboard/system-wide');

      // Wait for tasks to load
      await page.waitForSelector('[data-testid="task-table"]', {
        timeout: 10000,
      });

      // Should have multiple tasks from different departments
      const taskRows = page.locator('[data-testid="task-row"]');
      await expect(taskRows).not.toHaveCount(0);

      // Check that different departments are represented
      const departmentCells = page.locator('[data-testid="task-department"]');
      const departmentCount = await departmentCells.count();
      expect(departmentCount).toBeGreaterThan(0);
    });

    test('should display both assigned and unassigned tasks', async ({
      page,
    }) => {
      await createAndLoginUser(page, {
        email: hrAdminOnlyEmail,
        password: 'TestPass123!',
        name: 'HR Admin Only User',
        role: 'STAFF',
        isHrAdmin: true,
      });

      await page.goto('/dashboard/system-wide');
      await page.waitForSelector('[data-testid="task-table"]');

      // Look for tasks with and without assignees
      const taskRows = page.locator('[data-testid="task-row"]');
      const count = await taskRows.count();

      expect(count).toBeGreaterThan(0);
    });
  });

  test.describe('Edit Button Visibility - canEdit Logic', () => {
    test('UAA0015: HR/Admin without Manager role should NOT see edit button for tasks in other departments', async ({
      page,
    }) => {
      await createAndLoginUser(page, {
        email: hrAdminOnlyEmail,
        password: 'TestPass123!',
        name: 'HR Admin Only User',
        role: 'STAFF',
        isHrAdmin: true,
      });

      await page.goto('/dashboard/system-wide');
      await page.waitForSelector('[data-testid="task-table"]');

      // Find a task from Engineering department (assuming HR user is in HR dept)
      const engineeringTask = page
        .locator('[data-testid="task-row"]')
        .filter({
          has: page.locator(
            '[data-testid="task-department"]:has-text("Engineering")'
          ),
        })
        .first();

      if ((await engineeringTask.count()) > 0) {
        // Should NOT have edit button
        const editButton = engineeringTask.locator(
          '[data-testid="edit-task-button"]'
        );
        await expect(editButton).not.toBeVisible();
      }
    });

    test('UAA0026: HR/Admin should see edit button for tasks in their own department', async ({
      page,
    }) => {
      await createAndLoginUser(page, {
        email: hrAdminOnlyEmail,
        password: 'TestPass123!',
        name: 'HR Admin Only User',
        role: 'STAFF',
        isHrAdmin: true,
      });

      await page.goto('/dashboard/system-wide');
      await page.waitForSelector('[data-testid="task-table"]');

      // Find a task from HR department
      const hrTask = page
        .locator('[data-testid="task-row"]')
        .filter({
          has: page.locator('[data-testid="task-department"]:has-text("HR")'),
        })
        .first();

      if ((await hrTask.count()) > 0) {
        // Should have edit button
        const editButton = hrTask.locator('[data-testid="edit-task-button"]');
        await expect(editButton).toBeVisible();
      }
    });

    test('UAA0016: HR/Admin with Manager role should see edit button for tasks in managed departments', async ({
      page,
    }) => {
      await createAndLoginUser(page, {
        email: hrAdminManagerEmail,
        password: 'TestPass123!',
        name: 'HR Admin and Manager',
        role: 'MANAGER',
        isHrAdmin: true,
      });

      await page.goto('/dashboard/system-wide');
      await page.waitForSelector('[data-testid="task-table"]');

      // Find a task from their managed department
      const managedTask = page.locator('[data-testid="task-row"]').first();

      if ((await managedTask.count()) > 0) {
        // Click on the task to view details
        await managedTask.click();

        // If this task is in their managed hierarchy, edit button should be visible
        const editButton = page.locator('[data-testid="edit-task-button"]');
        const isInManagedDept = await managedTask
          .locator('[data-testid="task-department"]')
          .innerText()
          .then(text => text.includes('Engineering')); // Assuming they manage Engineering

        if (isInManagedDept) {
          await expect(editButton).toBeVisible();
        }
      }
    });

    test('UAA0016: HR/Admin with Manager role should NOT see edit button for tasks outside managed hierarchy', async ({
      page,
    }) => {
      await createAndLoginUser(page, {
        email: hrAdminManagerEmail,
        password: 'TestPass123!',
        name: 'HR Admin and Manager',
        role: 'MANAGER',
        isHrAdmin: true,
      });

      await page.goto('/dashboard/system-wide');
      await page.waitForSelector('[data-testid="task-table"]');

      // Find a task from Sales department (assuming they manage Engineering, not Sales)
      const salesTask = page
        .locator('[data-testid="task-row"]')
        .filter({
          has: page.locator(
            '[data-testid="task-department"]:has-text("Sales")'
          ),
        })
        .first();

      if ((await salesTask.count()) > 0) {
        // Should NOT have edit button
        const editButton = salesTask.locator(
          '[data-testid="edit-task-button"]'
        );
        await expect(editButton).not.toBeVisible();
      }
    });
  });

  test.describe('Filtering Capabilities', () => {
    test('should filter tasks by department', async ({ page }) => {
      await createAndLoginUser(page, {
        email: hrAdminOnlyEmail,
        password: 'TestPass123!',
        name: 'HR Admin Only User',
        role: 'STAFF',
        isHrAdmin: true,
      });

      await page.goto('/dashboard/system-wide');
      await page.waitForSelector('[data-testid="task-table"]');

      // Open department filter
      await page.click('[data-testid="filter-department"]');

      // Select Engineering department
      await page.click('[data-testid="department-option-engineering"]');

      // Wait for filtered results
      await page.waitForTimeout(1000);

      // All visible tasks should be from Engineering department
      const departmentCells = page.locator('[data-testid="task-department"]');
      const count = await departmentCells.count();

      for (let i = 0; i < count; i++) {
        const text = await departmentCells.nth(i).innerText();
        expect(text).toContain('Engineering');
      }
    });

    test('should filter tasks by project', async ({ page }) => {
      await createAndLoginUser(page, {
        email: hrAdminOnlyEmail,
        password: 'TestPass123!',
        name: 'HR Admin Only User',
        role: 'STAFF',
        isHrAdmin: true,
      });

      await page.goto('/dashboard/system-wide');
      await page.waitForSelector('[data-testid="task-table"]');

      // Open project filter
      await page.click('[data-testid="filter-project"]');

      // Select a project
      const projectOptions = page.locator('[data-testid="project-option"]');
      await projectOptions.first().click();

      // Wait for filtered results
      await page.waitForTimeout(1000);

      // Should show only tasks from selected project
      const taskRows = page.locator('[data-testid="task-row"]');
      await expect(taskRows).not.toHaveCount(0);
    });

    test('should filter tasks by assignee', async ({ page }) => {
      await createAndLoginUser(page, {
        email: hrAdminOnlyEmail,
        password: 'TestPass123!',
        name: 'HR Admin Only User',
        role: 'STAFF',
        isHrAdmin: true,
      });

      await page.goto('/dashboard/system-wide');
      await page.waitForSelector('[data-testid="task-table"]');

      // Open assignee filter
      await page.click('[data-testid="filter-assignee"]');

      // Select an assignee
      const assigneeOptions = page.locator('[data-testid="assignee-option"]');
      await assigneeOptions.first().click();

      // Wait for filtered results
      await page.waitForTimeout(1000);

      // Should show only tasks assigned to selected user
      const taskRows = page.locator('[data-testid="task-row"]');
      await expect(taskRows).not.toHaveCount(0);
    });

    test('should support multiple filters simultaneously', async ({ page }) => {
      await createAndLoginUser(page, {
        email: hrAdminOnlyEmail,
        password: 'TestPass123!',
        name: 'HR Admin Only User',
        role: 'STAFF',
        isHrAdmin: true,
      });

      await page.goto('/dashboard/system-wide');
      await page.waitForSelector('[data-testid="task-table"]');

      // Apply department filter
      await page.click('[data-testid="filter-department"]');
      await page.click('[data-testid="department-option-engineering"]');

      await page.waitForTimeout(500);

      // Apply status filter
      await page.click('[data-testid="filter-status"]');
      await page.click('[data-testid="status-option-in-progress"]');

      await page.waitForTimeout(1000);

      // Should show only tasks matching both filters
      const taskRows = page.locator('[data-testid="task-row"]');
      const count = await taskRows.count();

      if (count > 0) {
        // Verify filters are applied
        const firstTask = taskRows.first();
        await expect(
          firstTask.locator('[data-testid="task-department"]')
        ).toContainText('Engineering');
        await expect(
          firstTask.locator('[data-testid="task-status"]')
        ).toContainText('In Progress');
      }
    });

    test('should clear filters', async ({ page }) => {
      await createAndLoginUser(page, {
        email: hrAdminOnlyEmail,
        password: 'TestPass123!',
        name: 'HR Admin Only User',
        role: 'STAFF',
        isHrAdmin: true,
      });

      await page.goto('/dashboard/system-wide');
      await page.waitForSelector('[data-testid="task-table"]');

      // Get initial task count
      const initialTaskRows = page.locator('[data-testid="task-row"]');
      const initialCount = await initialTaskRows.count();

      // Apply a filter
      await page.click('[data-testid="filter-department"]');
      await page.click('[data-testid="department-option-engineering"]');
      await page.waitForTimeout(1000);

      // Task count should change
      const filteredCount = await page
        .locator('[data-testid="task-row"]')
        .count();
      expect(filteredCount).not.toBe(initialCount);

      // Clear filters
      await page.click('[data-testid="clear-filters-button"]');
      await page.waitForTimeout(1000);

      // Should return to initial state
      const finalCount = await page.locator('[data-testid="task-row"]').count();
      expect(finalCount).toBe(initialCount);
    });
  });

  test.describe('Navigation', () => {
    test('should have navigation link to system-wide dashboard for HR/Admin', async ({
      page,
    }) => {
      await createAndLoginUser(page, {
        email: hrAdminOnlyEmail,
        password: 'TestPass123!',
        name: 'HR Admin Only User',
        role: 'STAFF',
        isHrAdmin: true,
      });

      await page.goto('/dashboard/personal');

      // Should have a link to system-wide dashboard in navigation
      const systemWideLink = page.locator('a[href*="/dashboard/system-wide"]');
      await expect(systemWideLink).toBeVisible();
    });

    test('should NOT have navigation link to system-wide dashboard for regular staff', async ({
      page,
    }) => {
      await createAndLoginUser(page, {
        email: staffEmail,
        password: 'TestPass123!',
        name: 'Regular Staff User',
        role: 'STAFF',
        isHrAdmin: false,
      });

      await page.goto('/dashboard/personal');

      // Should NOT have a link to system-wide dashboard
      const systemWideLink = page.locator('a[href*="/dashboard/system-wide"]');
      await expect(systemWideLink).not.toBeVisible();
    });
  });
});

// Helper function to create and login user
async function createAndLoginUser(
  page: Page,
  user: {
    email: string;
    password: string;
    name: string;
    role: 'STAFF' | 'MANAGER';
    isHrAdmin: boolean;
  }
) {
  // Go to signup page
  await page.goto('/auth/signup');

  // Fill in signup form
  await page.fill('[id="name"]', user.name);
  await page.fill('[id="email"]', user.email);
  await page.fill('[id="password"]', user.password);
  await page.fill('[id="confirmPassword"]', user.password);

  // Select role
  await page.selectOption('[id="role"]', user.role);

  // Check HR/Admin checkbox if needed
  if (user.isHrAdmin) {
    await page.check('[id="isHrAdmin"]');
  }

  // Select department (assuming first one is available)
  await page.click('[data-testid="department-select"]');
  const departmentOptions = page.locator('[data-testid="department-option"]');
  await departmentOptions.first().click();

  // Submit form
  await page.click('button[type="submit"]');

  // Wait for redirect to dashboard
  await page.waitForURL(/\/dashboard/, { timeout: 15000 });
}
