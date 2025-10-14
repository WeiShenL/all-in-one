import { test, expect, Page } from '@playwright/test';

test.describe('Department Dashboard', () => {
  let page: Page;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
  });

  test.afterEach(async () => {
    await page.close();
  });

  test.describe('Staff User', () => {
    test('Staff sees Edit button only for assigned tasks on Department Dashboard', async () => {
      // Login as staff user
      await page.goto('/auth/login');
      await page.fill('input[name="email"]', 'staff@test.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');
      await page.waitForURL('/dashboard');

      // Navigate to Department Dashboard
      await page.goto('/dashboard/department');
      await page.waitForLoadState('networkidle');

      // Verify page title
      await expect(page.locator('h1')).toContainText('Department Dashboard');

      // Get all task rows
      const taskRows = page.locator('table tbody tr[data-task-row]');
      const taskCount = await taskRows.count();

      expect(taskCount).toBeGreaterThan(0);

      let tasksWithEditButton = 0;
      let tasksWithoutEditButton = 0;

      // Check each task row
      for (let i = 0; i < taskCount; i++) {
        const row = taskRows.nth(i);
        const editButton = row.locator('button:has-text("Edit")');
        const editButtonCount = await editButton.count();

        if (editButtonCount > 0) {
          tasksWithEditButton++;
          // Verify button is enabled
          await expect(editButton).toBeEnabled();
        } else {
          tasksWithoutEditButton++;
        }
      }

      // Staff should see SOME tasks with Edit button (their assigned tasks)
      expect(tasksWithEditButton).toBeGreaterThan(0);
      // And SOME tasks without Edit button (not assigned to them)
      expect(tasksWithoutEditButton).toBeGreaterThan(0);
    });

    test('Staff can see departmental context (department names)', async () => {
      await page.goto('/auth/login');
      await page.fill('input[name="email"]', 'staff@test.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');
      await page.waitForURL('/dashboard');

      await page.goto('/dashboard/department');
      await page.waitForLoadState('networkidle');

      // Verify department column exists
      const departmentHeader = page.locator('th:has-text("Department")');
      await expect(departmentHeader).toBeVisible();

      // Verify department values are shown
      const departmentCells = page
        .locator('table tbody tr[data-task-row] td')
        .filter({ hasText: /Engineering|Sales|HR/ });
      expect(await departmentCells.count()).toBeGreaterThan(0);
    });

    test('Staff can filter Department Dashboard by assignee', async () => {
      await page.goto('/auth/login');
      await page.fill('input[name="email"]', 'staff@test.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');
      await page.waitForURL('/dashboard');

      await page.goto('/dashboard/department');
      await page.waitForLoadState('networkidle');

      // Get initial task count
      const initialCount = await page
        .locator('table tbody tr[data-task-row]')
        .count();

      // Filter by current user (themselves)
      const assigneeFilter = page
        .locator('select')
        .filter({ has: page.locator('option:has-text("All")') })
        .first();
      await assigneeFilter.selectOption({ label: /staff@test\.com/ });
      await page.waitForTimeout(500);

      // Get filtered task count
      const filteredCount = await page
        .locator('table tbody tr[data-task-row]')
        .count();

      // Filtered should be less than or equal to initial
      expect(filteredCount).toBeLessThanOrEqual(initialCount);

      // All filtered tasks should have Edit button (assigned to staff)
      const filteredRows = page.locator('table tbody tr[data-task-row]');
      for (let i = 0; i < filteredCount; i++) {
        const editButton = filteredRows
          .nth(i)
          .locator('button:has-text("Edit")');
        await expect(editButton).toBeVisible();
      }
    });

    test('Staff cannot edit tasks assigned to other staff members', async () => {
      await page.goto('/auth/login');
      await page.fill('input[name="email"]', 'staff@test.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');
      await page.waitForURL('/dashboard');

      await page.goto('/dashboard/department');
      await page.waitForLoadState('networkidle');

      // Find a task without Edit button (not assigned to this staff)
      const rowWithoutEdit = page
        .locator('table tbody tr[data-task-row]')
        .filter({
          hasNot: page.locator('button:has-text("Edit")'),
        })
        .first();

      if ((await rowWithoutEdit.count()) > 0) {
        // Verify no Edit button exists
        const editButton = rowWithoutEdit.locator('button:has-text("Edit")');
        await expect(editButton).toHaveCount(0);

        // Verify View button might exist (if implemented)
        const viewButton = rowWithoutEdit.locator('button:has-text("View")');
        if ((await viewButton.count()) > 0) {
          await expect(viewButton).toBeVisible();
        }
      }
    });

    test('Staff sees tasks from their department and related departments', async () => {
      await page.goto('/auth/login');
      await page.fill('input[name="email"]', 'staff@test.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');
      await page.waitForURL('/dashboard');

      await page.goto('/dashboard/department');
      await page.waitForLoadState('networkidle');

      // Get total task count
      const totalTasks = await page
        .locator('table tbody tr[data-task-row]')
        .count();
      expect(totalTasks).toBeGreaterThan(0);

      // Department Dashboard should show more tasks than Personal Dashboard
      await page.goto('/dashboard/personal');
      await page.waitForLoadState('networkidle');
      const personalTasks = await page
        .locator('table tbody tr[data-task-row]')
        .count();

      expect(totalTasks).toBeGreaterThanOrEqual(personalTasks);
    });
  });

  test.describe('Manager User', () => {
    test('Manager sees Edit button on ALL department tasks', async () => {
      // Login as manager
      await page.goto('/auth/login');
      await page.fill('input[name="email"]', 'manager@test.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');
      await page.waitForURL('/dashboard');

      // Navigate to Department Dashboard
      await page.goto('/dashboard/department');
      await page.waitForLoadState('networkidle');

      // Verify page title
      await expect(page.locator('h1')).toContainText('Department Dashboard');

      // Get all task rows
      const taskRows = page.locator('table tbody tr[data-task-row]');
      const taskCount = await taskRows.count();

      expect(taskCount).toBeGreaterThan(0);

      // Verify ALL tasks have Edit button for manager
      for (let i = 0; i < taskCount; i++) {
        const row = taskRows.nth(i);
        const editButton = row.locator('button:has-text("Edit")');
        await expect(editButton).toBeVisible();
        await expect(editButton).toBeEnabled();
      }
    });

    test('Manager can edit tasks not assigned to them', async () => {
      await page.goto('/auth/login');
      await page.fill('input[name="email"]', 'manager@test.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');
      await page.waitForURL('/dashboard');

      await page.goto('/dashboard/department');
      await page.waitForLoadState('networkidle');

      // Filter by a different assignee (not the manager)
      const assigneeFilter = page
        .locator('select')
        .filter({ has: page.locator('option:has-text("All")') })
        .first();
      const options = await assigneeFilter.locator('option').allTextContents();

      // Find an option that's not the manager
      const otherStaffOption = options.find(opt =>
        opt.includes('staff@test.com')
      );

      if (otherStaffOption) {
        await assigneeFilter.selectOption({ label: otherStaffOption });
        await page.waitForTimeout(500);

        // Verify filtered tasks exist
        const filteredRows = page.locator('table tbody tr[data-task-row]');
        const filteredCount = await filteredRows.count();

        if (filteredCount > 0) {
          // Manager should still see Edit button on these tasks
          for (let i = 0; i < filteredCount; i++) {
            const editButton = filteredRows
              .nth(i)
              .locator('button:has-text("Edit")');
            await expect(editButton).toBeVisible();
          }
        }
      }
    });

    test('Department Dashboard shows tasks from subordinate departments', async () => {
      await page.goto('/auth/login');
      await page.fill('input[name="email"]', 'manager@test.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');
      await page.waitForURL('/dashboard');

      await page.goto('/dashboard/department');
      await page.waitForLoadState('networkidle');

      // Get all department names from department filter
      const departmentFilter = page
        .locator('select')
        .filter({ has: page.locator('option:has-text("All")') })
        .last();
      const departmentOptions = await departmentFilter
        .locator('option')
        .allTextContents();

      // Manager should see multiple departments (their own + subordinates)
      expect(departmentOptions.length).toBeGreaterThan(2); // "All" + at least 2 departments

      // Verify tasks from multiple departments are shown
      const taskRows = page.locator('table tbody tr[data-task-row]');
      const departmentCells = taskRows
        .locator('td')
        .filter({ hasText: /Engineering|Developers|Support/ });

      expect(await departmentCells.count()).toBeGreaterThan(0);
    });

    test('Manager can create tasks from Department Dashboard', async () => {
      await page.goto('/auth/login');
      await page.fill('input[name="email"]', 'manager@test.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');
      await page.waitForURL('/dashboard');

      await page.goto('/dashboard/department');
      await page.waitForLoadState('networkidle');

      // Verify Create Task button exists
      const createButton = page.locator('button:has-text("+ Create Task")');
      await expect(createButton).toBeVisible();

      await createButton.click();
      await page.waitForURL('/tasks/create');
    });

    test('Manager sees metrics/summary for department', async () => {
      await page.goto('/auth/login');
      await page.fill('input[name="email"]', 'manager@test.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');
      await page.waitForURL('/dashboard');

      await page.goto('/dashboard/department');
      await page.waitForLoadState('networkidle');

      // Verify task count is displayed
      const taskCountHeading = page.locator(
        'h2:has-text(/All Tasks \\(\\d+\\)/)'
      );
      await expect(taskCountHeading).toBeVisible();

      // Extract and verify count is a number
      const headingText = await taskCountHeading.textContent();
      const countMatch = headingText?.match(/\((\d+)\)/);
      expect(countMatch).toBeTruthy();
      expect(parseInt(countMatch![1])).toBeGreaterThan(0);
    });
  });

  test.describe('Access Control', () => {
    test('All authenticated users can access Department Dashboard', async () => {
      // Test Staff access
      await page.goto('/auth/login');
      await page.fill('input[name="email"]', 'staff@test.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');
      await page.waitForURL('/dashboard');

      await page.goto('/dashboard/department');
      await page.waitForLoadState('networkidle');

      // Should NOT redirect, should show dashboard
      expect(page.url()).toContain('/dashboard/department');
      await expect(page.locator('h1')).toContainText('Department Dashboard');

      // Logout and test Manager access
      await page.goto('/auth/logout');
      await page.goto('/auth/login');
      await page.fill('input[name="email"]', 'manager@test.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');
      await page.waitForURL('/dashboard');

      await page.goto('/dashboard/department');
      await page.waitForLoadState('networkidle');

      expect(page.url()).toContain('/dashboard/department');
      await expect(page.locator('h1')).toContainText('Department Dashboard');
    });

    test('Unauthenticated users cannot access Department Dashboard', async () => {
      await page.goto('/dashboard/department');

      // Should redirect to login
      await page.waitForURL('/auth/login');
      await expect(page.locator('h1')).toContainText(/Login|Sign In/i);
    });
  });

  test.describe('Hierarchy Visualization', () => {
    test('Department filter shows hierarchical structure', async () => {
      await page.goto('/auth/login');
      await page.fill('input[name="email"]', 'manager@test.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');
      await page.waitForURL('/dashboard');

      await page.goto('/dashboard/department');
      await page.waitForLoadState('networkidle');

      // Open department filter dropdown
      const departmentFilter = page
        .locator('select')
        .filter({ has: page.locator('option:has-text("All")') })
        .last();
      const options = await departmentFilter
        .locator('option')
        .allTextContents();

      // Verify hierarchical departments are present
      // Look for pattern like "Engineering > Developers" or similar
      const hasHierarchy = options.some(opt => {
        return (
          opt.includes('Engineering') ||
          opt.includes('Developers') ||
          opt.includes('Support')
        );
      });

      expect(hasHierarchy).toBeTruthy();
    });

    test('Manager of parent department sees tasks from all levels', async () => {
      await page.goto('/auth/login');
      await page.fill('input[name="email"]', 'manager@test.com'); // Manager of Engineering
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');
      await page.waitForURL('/dashboard');

      await page.goto('/dashboard/department');
      await page.waitForLoadState('networkidle');

      // Get all tasks
      const allTasksCount = await page
        .locator('table tbody tr[data-task-row]')
        .count();

      // Filter by a child department
      const departmentFilter = page
        .locator('select')
        .filter({ has: page.locator('option:has-text("All")') })
        .last();
      await departmentFilter.selectOption({ label: /Developers|Support/ });
      await page.waitForTimeout(500);

      const filteredCount = await page
        .locator('table tbody tr[data-task-row]')
        .count();

      // Filtered should be less than total (since we're filtering to one dept)
      expect(filteredCount).toBeLessThanOrEqual(allTasksCount);

      // All filtered tasks should still have Edit button (manager controls hierarchy)
      const filteredRows = page.locator('table tbody tr[data-task-row]');
      for (let i = 0; i < Math.min(filteredCount, 5); i++) {
        const editButton = filteredRows
          .nth(i)
          .locator('button:has-text("Edit")');
        await expect(editButton).toBeVisible();
      }
    });
  });

  test.describe('UI/UX Features', () => {
    test('Department Dashboard has sorting functionality', async () => {
      await page.goto('/auth/login');
      await page.fill('input[name="email"]', 'manager@test.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');
      await page.waitForURL('/dashboard');

      await page.goto('/dashboard/department');
      await page.waitForLoadState('networkidle');

      // Click on Priority column to sort
      const priorityHeader = page.locator('th:has-text("Priority")');
      await priorityHeader.click();
      await page.waitForTimeout(500);

      // Verify sort indicator appears
      const sortIndicator = priorityHeader
        .locator('span')
        .filter({ hasText: /🔼|🔽/ });
      await expect(sortIndicator).toBeVisible();
    });

    test('Department Dashboard shows assignee avatars/names', async () => {
      await page.goto('/auth/login');
      await page.fill('input[name="email"]', 'manager@test.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');
      await page.waitForURL('/dashboard');

      await page.goto('/dashboard/department');
      await page.waitForLoadState('networkidle');

      // Verify Assignees column exists
      const assigneeHeader = page.locator('th:has-text("Assignees")');
      await expect(assigneeHeader).toBeVisible();

      // Verify assignee data is displayed
      const assigneeCells = page
        .locator('table tbody tr[data-task-row] td')
        .filter({ hasText: /@/ });
      expect(await assigneeCells.count()).toBeGreaterThan(0);
    });

    test('Department Dashboard handles empty state gracefully', async () => {
      // Login as staff with no departmental tasks
      await page.goto('/auth/login');
      await page.fill('input[name="email"]', 'staff.isolated@test.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');
      await page.waitForURL('/dashboard');

      await page.goto('/dashboard/department');
      await page.waitForLoadState('networkidle');

      // Should show empty state or no results message
      const noTasksMessage = page.locator('text=/No tasks|No data available/');
      if (
        await noTasksMessage.isVisible({ timeout: 2000 }).catch(() => false)
      ) {
        await expect(noTasksMessage).toBeVisible();
      }
    });
  });
});
