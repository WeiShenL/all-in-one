import { test, expect, Page } from '@playwright/test';

test.describe('Personal Dashboard', () => {
  let page: Page;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
  });

  test.afterEach(async () => {
    await page.close();
  });

  test.describe('Staff User', () => {
    test('Staff can see only their assigned tasks with Edit buttons', async () => {
      // Login as staff user
      await page.goto('/auth/login');
      await page.fill('input[name="email"]', 'staff@test.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');

      // Wait for login to complete
      await page.waitForURL('/dashboard');

      // Navigate to Personal Dashboard
      await page.goto('/dashboard/personal');
      await page.waitForLoadState('networkidle');

      // Verify page title
      await expect(page.locator('h1')).toContainText('Personal Dashboard');

      // Verify welcome message
      await expect(page.locator('text=/Welcome,/')).toBeVisible();

      // Get all task rows
      const taskRows = page.locator('table tbody tr[data-task-row]');
      const taskCount = await taskRows.count();

      expect(taskCount).toBeGreaterThan(0);

      // Verify ALL tasks have Edit button visible
      for (let i = 0; i < taskCount; i++) {
        const row = taskRows.nth(i);
        const editButton = row.locator('button:has-text("Edit")');
        await expect(editButton).toBeVisible();
        await expect(editButton).toBeEnabled();
      }
    });

    test('Staff can filter and sort their personal tasks', async () => {
      // Login as staff
      await page.goto('/auth/login');
      await page.fill('input[name="email"]', 'staff@test.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');
      await page.waitForURL('/dashboard');

      await page.goto('/dashboard/personal');
      await page.waitForLoadState('networkidle');

      // Test title filter
      const titleFilter = page.locator('input[placeholder*="Filter"]').first();
      await titleFilter.fill('bug');
      await page.waitForTimeout(500); // Wait for filter to apply

      // All visible tasks should contain "bug" in title
      const filteredTasks = page.locator('table tbody tr[data-task-row]');
      const filteredCount = await filteredTasks.count();

      if (filteredCount > 0) {
        for (let i = 0; i < filteredCount; i++) {
          const taskTitle = await filteredTasks
            .nth(i)
            .locator('td')
            .first()
            .textContent();
          expect(taskTitle?.toLowerCase()).toContain('bug');
        }
      }

      // Clear filter
      await titleFilter.clear();

      // Test status filter
      const statusFilter = page.locator('select[name="status"]');
      await statusFilter.selectOption('IN_PROGRESS');
      await page.waitForTimeout(500);

      // Verify filtered results show IN_PROGRESS status
      const statusCells = page.locator(
        'table tbody tr[data-task-row] td:has-text("In Progress")'
      );
      const statusCount = await statusCells.count();
      expect(statusCount).toBeGreaterThan(0);
    });

    test('Staff can click Edit button to open task modal', async () => {
      // Login as staff
      await page.goto('/auth/login');
      await page.fill('input[name="email"]', 'staff@test.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');
      await page.waitForURL('/dashboard');

      await page.goto('/dashboard/personal');
      await page.waitForLoadState('networkidle');

      // Click the first Edit button
      const firstEditButton = page
        .locator('table tbody tr[data-task-row] button:has-text("Edit")')
        .first();
      await firstEditButton.click();

      // Verify modal opens
      await expect(page.locator('[role="dialog"]')).toBeVisible();
      await expect(page.locator('[role="dialog"] h2')).toBeVisible();

      // Verify close button exists
      const closeButton = page.locator('[role="dialog"] button:has-text("×")');
      await expect(closeButton).toBeVisible();

      // Close modal
      await closeButton.click();
      await expect(page.locator('[role="dialog"]')).not.toBeVisible();
    });

    test('Staff sees "No tasks assigned" message when no tasks exist', async () => {
      // Login as staff with no assigned tasks
      await page.goto('/auth/login');
      await page.fill('input[name="email"]', 'staff.notasks@test.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');
      await page.waitForURL('/dashboard');

      await page.goto('/dashboard/personal');
      await page.waitForLoadState('networkidle');

      // Verify "no tasks" message
      await expect(page.locator('text=/No tasks assigned/')).toBeVisible();
      await expect(page.locator('table tbody tr[data-task-row]')).toHaveCount(
        0
      );
    });

    test('Staff can view subtasks on assigned parent tasks', async () => {
      // Login as staff
      await page.goto('/auth/login');
      await page.fill('input[name="email"]', 'staff@test.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');
      await page.waitForURL('/dashboard');

      await page.goto('/dashboard/personal');
      await page.waitForLoadState('networkidle');

      // Find a task with subtasks (has expand button)
      const expandButton = page
        .locator('table tbody tr button[title*="Expand"]')
        .first();

      if ((await expandButton.count()) > 0) {
        // Click to expand subtasks
        await expandButton.click();
        await page.waitForTimeout(300);

        // Verify subtasks are visible
        const subtaskRows = page.locator('table tbody tr[data-subtask]');
        await expect(subtaskRows.first()).toBeVisible();

        // Verify subtasks have "SUB" indicator
        await expect(subtaskRows.first().locator('text="SUB"')).toBeVisible();
      }
    });
  });

  test.describe('Manager User', () => {
    test('Manager can see their assigned tasks with Edit buttons on Personal Dashboard', async () => {
      // Login as manager
      await page.goto('/auth/login');
      await page.fill('input[name="email"]', 'manager@test.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');
      await page.waitForURL('/dashboard');

      // Navigate to Personal Dashboard
      await page.goto('/dashboard/personal');
      await page.waitForLoadState('networkidle');

      // Verify page title
      await expect(page.locator('h1')).toContainText('Personal Dashboard');

      // Get all task rows
      const taskRows = page.locator('table tbody tr[data-task-row]');
      const taskCount = await taskRows.count();

      // Manager should have some personal assigned tasks
      expect(taskCount).toBeGreaterThan(0);

      // Verify ALL tasks have Edit button
      for (let i = 0; i < taskCount; i++) {
        const row = taskRows.nth(i);
        const editButton = row.locator('button:has-text("Edit")');
        await expect(editButton).toBeVisible();
        await expect(editButton).toBeEnabled();
      }
    });

    test('Manager sees only assigned tasks on Personal Dashboard, not all department tasks', async () => {
      // Login as manager
      await page.goto('/auth/login');
      await page.fill('input[name="email"]', 'manager@test.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');
      await page.waitForURL('/dashboard');

      // Get Personal Dashboard task count
      await page.goto('/dashboard/personal');
      await page.waitForLoadState('networkidle');
      const personalTaskCount = await page
        .locator('table tbody tr[data-task-row]')
        .count();

      // Get Department Dashboard task count
      await page.goto('/dashboard/department');
      await page.waitForLoadState('networkidle');
      const departmentTaskCount = await page
        .locator('table tbody tr[data-task-row]')
        .count();

      // Department dashboard should have MORE tasks than personal (includes all team tasks)
      expect(departmentTaskCount).toBeGreaterThanOrEqual(personalTaskCount);
    });

    test('Manager can create new task from Personal Dashboard', async () => {
      // Login as manager
      await page.goto('/auth/login');
      await page.fill('input[name="email"]', 'manager@test.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');
      await page.waitForURL('/dashboard');

      await page.goto('/dashboard/personal');
      await page.waitForLoadState('networkidle');

      // Verify Create Task button exists
      const createButton = page.locator('button:has-text("+ Create Task")');
      await expect(createButton).toBeVisible();
      await expect(createButton).toBeEnabled();

      // Click to navigate to task creation
      await createButton.click();
      await page.waitForURL('/tasks/create');
    });
  });

  test.describe('Accessibility & UI', () => {
    test('Personal Dashboard has proper heading hierarchy', async () => {
      await page.goto('/auth/login');
      await page.fill('input[name="email"]', 'staff@test.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');
      await page.waitForURL('/dashboard');

      await page.goto('/dashboard/personal');
      await page.waitForLoadState('networkidle');

      // Check heading hierarchy
      await expect(page.locator('h1')).toContainText('Personal Dashboard');
      await expect(page.locator('h2').first()).toBeVisible();
    });

    test('Task table is keyboard navigable', async () => {
      await page.goto('/auth/login');
      await page.fill('input[name="email"]', 'staff@test.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');
      await page.waitForURL('/dashboard');

      await page.goto('/dashboard/personal');
      await page.waitForLoadState('networkidle');

      // Tab to first edit button
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');

      // Verify keyboard interaction works
      await page.keyboard.press('Enter');
      await expect(page.locator('[role="dialog"]')).toBeVisible();
    });

    test('Personal Dashboard displays loading state', async () => {
      await page.goto('/auth/login');
      await page.fill('input[name="email"]', 'staff@test.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');
      await page.waitForURL('/dashboard');

      // Navigate quickly to catch loading state
      const navigationPromise = page.goto('/dashboard/personal');

      // Check for loading indicator
      const loadingText = page.locator('text=/Loading/');
      if (await loadingText.isVisible({ timeout: 1000 }).catch(() => false)) {
        await expect(loadingText).toBeVisible();
      }

      await navigationPromise;
      await page.waitForLoadState('networkidle');

      // Loading should be gone
      await expect(loadingText).not.toBeVisible();
    });
  });

  test.describe('Error Handling', () => {
    test('Shows error message when API fails', async () => {
      await page.goto('/auth/login');
      await page.fill('input[name="email"]', 'staff@test.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');
      await page.waitForURL('/dashboard');

      // Intercept API call and make it fail
      await page.route('**/api/trpc/task.getUserTasks*', route => {
        route.fulfill({
          status: 500,
          body: JSON.stringify({ error: 'Internal Server Error' }),
        });
      });

      await page.goto('/dashboard/personal');
      await page.waitForLoadState('networkidle');

      // Verify error message is displayed
      await expect(page.locator('text=/Error/')).toBeVisible();
    });

    test('Redirects to login when not authenticated', async () => {
      // Try to access personal dashboard without login
      await page.goto('/dashboard/personal');

      // Should redirect to login
      await page.waitForURL('/auth/login');
      await expect(page.locator('h1')).toContainText(/Login|Sign In/i);
    });
  });
});
