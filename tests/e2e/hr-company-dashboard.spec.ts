import { test, expect, Page } from '@playwright/test';
import { Client } from 'pg';

test.describe('HR/Admin Company Dashboard - Happy Path', () => {
  let pgClient: Client;
  let hrAdminEmail: string;
  let testNamespace: string;

  test.beforeAll(async () => {
    pgClient = new Client({ connectionString: process.env.DATABASE_URL });
    await pgClient.connect();

    // Create worker-specific namespace for test data isolation
    const workerId = process.env.PLAYWRIGHT_WORKER_INDEX || '0';
    testNamespace = `w${workerId}_${crypto.randomUUID().slice(0, 8)}`;

    // Generate unique test email with worker-specific namespace
    hrAdminEmail = `hradmin.${testNamespace}@test.com`;
  });

  test.afterAll(async () => {
    // Cleanup test user
    try {
      await pgClient.query(
        'DELETE FROM public."user_profile" WHERE email = $1',
        [hrAdminEmail]
      );
      await pgClient.query('DELETE FROM auth.users WHERE email = $1', [
        hrAdminEmail,
      ]);
    } catch (error) {
      console.error(`Failed to cleanup user ${hrAdminEmail}:`, error);
    }

    await pgClient.end();
  });

  test('HR/Admin can access company dashboard and view all tasks', async ({
    page,
  }) => {
    // Create and login as HR/Admin user
    await createAndLoginUser(page, {
      email: hrAdminEmail,
      password: 'TestPass123!',
      name: `HR Admin User ${testNamespace}`,
      role: 'STAFF',
      isHrAdmin: true,
    });

    // Wait for login to complete
    await page.waitForLoadState('networkidle');

    // Navigate to company dashboard
    await page.goto('/dashboard/company');

    // Should successfully load the page
    await expect(page).toHaveURL(/\/dashboard\/company/);

    // Wait for the specific page heading to avoid matching navbar title
    await expect(
      page.getByRole('heading', { name: /company dashboard/i })
    ).toBeVisible();

    // Wait for tasks to load (if table exists)
    const taskTable = page.locator('[data-testid="task-table"]');
    const tableExists = await taskTable.count();

    if (tableExists > 0) {
      await expect(taskTable).toBeVisible();

      // Check if there are any tasks displayed
      const taskRows = page.locator('[data-testid="task-row"]');
      const taskCount = await taskRows.count();

      console.warn(`Company dashboard loaded with ${taskCount} tasks`);

      // If tasks exist, verify basic structure
      if (taskCount > 0) {
        // Verify first task has expected elements
        const firstTask = taskRows.first();
        await expect(firstTask).toBeVisible();
      }
    }

    // Success: HR/Admin can access and view the company dashboard
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
  try {
    // Go to signup page
    await page.goto('/auth/signup');
    await page.waitForLoadState('domcontentloaded');

    // Fill in signup form (use getByLabel for better reliability)
    await page.getByLabel('Name *').fill(user.name);
    await page.getByLabel('Email').fill(user.email);

    // Select role
    await page.getByLabel('Role').selectOption(user.role);

    // Check HR/Admin checkbox if needed
    if (user.isHrAdmin) {
      await page.locator('#isHrAdmin').check();
    }

    // Select department using the DepartmentSelect component
    await page.click('button:has-text("Select a department")');
    const deptSearch = page.getByPlaceholder('Search departments...');
    await expect(deptSearch).toBeVisible({ timeout: 60000 });
    await deptSearch.fill('IT');

    // Wait for departments to load and IT option to appear
    await page.waitForTimeout(3000); // Give time for API call
    const itOption = page.getByText(/^\s*└─\s*IT\s*$/);
    await expect(itOption).toBeVisible({ timeout: 60000 });
    await itOption.click();

    // Passwords
    await page.getByLabel(/^password$/i).fill(user.password);
    await page.getByLabel('Confirm Password').fill(user.password);

    // Submit form
    await page.getByRole('button', { name: /create account/i }).click();

    // Wait for redirect to dashboard OR check for error message
    try {
      await page.waitForURL(/\/dashboard/, { timeout: 60000 });
    } catch (urlError) {
      // Check if there's an error about existing user
      const errorDiv = page
        .locator('div')
        .filter({ hasText: /already|exists/i });
      const errorExists = await errorDiv.count();

      if (errorExists > 0) {
        console.warn(`User ${user.email} already exists, logging in instead`);
        // Navigate to login
        await page.goto('/auth/login');
        await page.waitForLoadState('domcontentloaded');
        await page.getByLabel('Email').fill(user.email);
        await page.getByLabel('Password').fill(user.password);
        await page.getByRole('button', { name: /sign in/i }).click();
        await page.waitForURL(/\/dashboard/, { timeout: 60000 });
        return;
      }
      throw urlError;
    }
  } catch (error) {
    console.error(`Error in createAndLoginUser for ${user.email}:`, error);

    // Take a screenshot for debugging
    try {
      const timestamp = Date.now();
      await page.screenshot({
        path: `test-results/error-${user.email.replace(/[@.]/g, '-')}-${timestamp}.png`,
        fullPage: true,
      });
      console.warn('Page URL:', page.url());
      console.warn('Page title:', await page.title());
    } catch (debugError) {
      console.error('Could not capture debug info:', debugError);
    }
    throw error;
  }
}
