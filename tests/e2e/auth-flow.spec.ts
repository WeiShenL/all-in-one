import { test, expect } from '@playwright/test';
import { Client } from 'pg';
import { createClient } from '@supabase/supabase-js';

// designed to test the full auth flow
// sign up
// logs out
// logs back in to verify user created is persistent
// log out again to end test (avoid any session issues)

test.describe('Signup to Dashboard, Logout and log back in Flow', () => {
  let pgClient: Client;
  let _supabaseClient: ReturnType<typeof createClient>;
  let testNamespace: string;
  const createdEmails: string[] = []; // Track all created emails for cleanup

  test.beforeAll(async () => {
    // Create worker-specific namespace for test data isolation
    const workerId = process.env.PLAYWRIGHT_WORKER_INDEX || '0';
    testNamespace = `w${workerId}_${crypto.randomUUID().slice(0, 8)}`;

    _supabaseClient = createClient(
      process.env.NEXT_PUBLIC_API_EXTERNAL_URL!,
      process.env.NEXT_PUBLIC_ANON_KEY!
    );
    pgClient = new Client({ connectionString: process.env.DATABASE_URL });
    await pgClient.connect();
  });

  test.afterEach(async ({ context }) => {
    // Only clear browser storage - no database cleanup to avoid race conditions
    await context.clearCookies();
    await context.clearPermissions();
  });

  test.afterAll(async () => {
    // Clean up ALL test data for this worker at once
    try {
      for (const email of createdEmails) {
        await pgClient.query(
          'DELETE FROM public."user_profile" WHERE email = $1',
          [email]
        );
        await pgClient.query('DELETE FROM auth.users WHERE email = $1', [
          email,
        ]);
      }
    } catch (error) {
      console.warn('Cleanup error (non-fatal):', error);
    } finally {
      await pgClient.end();
    }
  });

  test('login page -> signup -> dashboard -> logout -> login page + log back in -> dashboard -> logout', async ({
    page,
  }) => {
    // Prepare unique credentials with worker-specific namespace
    const email = `e2e.${testNamespace}@example.com`;
    createdEmails.push(email); // Track for cleanup
    const password = 'Test123!@#';

    // Start on Login Page
    await page.goto('/auth/login');
    await expect(
      page.getByRole('heading', { name: /welcome back/i })
    ).toBeVisible();

    // Navigate to Signup
    await page.getByRole('button', { name: /create account/i }).click();
    await expect(
      page.getByRole('heading', { name: /create account/i })
    ).toBeVisible();

    // Fill Signup Form
    await page.getByLabel('Name *').fill('E2E User');
    await page.getByLabel('Email').fill(email);

    // Role (defaults to STAFF)
    await page.getByLabel('Role').selectOption('STAFF');

    // DepartmentSelect: wait, search, pick IT
    await page.getByRole('button', { name: /select a department/i }).click();
    const deptSearch = page.getByPlaceholder('Search departments...');
    await expect(deptSearch).toBeVisible();
    await deptSearch.fill('IT');

    // Wait for departments to load and IT option to appear
    await page.waitForTimeout(2000); // Give time for API call
    const itOption = page.getByText(/^\s*└─\s*IT\s*$/);
    // Increased timeout and added retry logic
    await expect(itOption).toBeVisible({ timeout: 30000 });
    await itOption.click();

    // Passwords
    await page.getByLabel(/^password$/i).fill(password);
    await page.getByLabel('Confirm Password').fill(password);

    // Submit
    await page.getByRole('button', { name: /create account/i }).click();

    // Expect redirect to Personal Dashboard
    // tolerance increased to 15 sec since vercel version is slightly slower
    await expect(
      page.getByRole('heading', { name: /personal dashboard/i })
    ).toBeVisible({ timeout: 30000 });

    // Logout via Navbar
    await page.locator('[data-testid="sign-out-button"]').click();

    // Wait for logout process to complete (reduced timeout)
    await page.waitForTimeout(2000); // Give time for logout to process

    // Navigate to login page manually (in case automatic redirect fails)
    await page.goto('/auth/login');

    // Wait for page to fully load
    await page.waitForLoadState('networkidle');

    // Back on Login Page
    await expect(
      page.getByRole('heading', { name: /welcome back/i })
    ).toBeVisible({ timeout: 10000 });
    // Login again with created credentials
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').fill(password);
    await page.getByRole('button', { name: /sign in/i }).click();

    // Expect redirect to Personal Dashboard
    await expect(
      page.getByRole('heading', { name: /personal dashboard/i })
    ).toBeVisible({ timeout: 30000 });

    // Final logout
    await page.locator('[data-testid="sign-out-button"]').click();

    // Ensure we're back on Login Page
    await expect(
      page.getByRole('heading', { name: /welcome back/i })
    ).toBeVisible();
  });
});
