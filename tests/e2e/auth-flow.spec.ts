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
  let createdEmail: string | null = null;
  let supabaseClient: ReturnType<typeof createClient>;

  test.beforeAll(async () => {
    supabaseClient = createClient(
      process.env.NEXT_PUBLIC_API_EXTERNAL_URL!,
      process.env.NEXT_PUBLIC_ANON_KEY!
    );
    pgClient = new Client({ connectionString: process.env.DATABASE_URL });
    await pgClient.connect();
  });

  test.afterAll(async () => {
    await pgClient.end();
  });

  test.afterEach(async () => {
    await supabaseClient.auth.signOut();
    if (!createdEmail) {
      return;
    }
    try {
      await pgClient.query(
        'DELETE FROM public."user_profile" WHERE email = $1',
        [createdEmail]
      );
      await pgClient.query('DELETE FROM auth.users WHERE email = $1', [
        createdEmail,
      ]);
    } finally {
      createdEmail = null;
    }
  });

  test('login page -> signup -> dashboard -> logout -> login page + log back in -> dashboard -> logout', async ({
    page,
  }) => {
    // Prepare unique credentials
    const unique = Date.now();
    const email = `e2e.user.${unique}@example.com`;
    createdEmail = email;
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
    await page.getByLabel('Name (Optional)').fill('E2E User');
    await page.getByLabel('Email').fill(email);

    // Role (defaults to STAFF)
    await page.getByLabel('Role').selectOption('STAFF');

    // DepartmentSelect: wait, search, pick IT
    await page.getByRole('button', { name: /select a department/i }).click();
    const deptSearch = page.getByPlaceholder('Search departments...');
    await expect(deptSearch).toBeVisible();
    await deptSearch.fill('IT');
    const itOption = page.getByText(/^\s*└─\s*IT\s*$/);
    await expect(itOption).toBeVisible({ timeout: 5000 });
    await itOption.click();

    // Passwords
    await page.getByLabel(/^password$/i).fill(password);
    await page.getByLabel('Confirm Password').fill(password);

    // Submit
    await page.getByRole('button', { name: /create account/i }).click();

    // Expect redirect to Staff Dashboard
    await expect(
      page.getByRole('heading', { name: /staff dashboard/i })
    ).toBeVisible({ timeout: 3000 });

    // Logout via Navbar
    await page.getByRole('button', { name: /sign out/i }).click();

    // Back on Login Page
    await expect(
      page.getByRole('heading', { name: /welcome back/i })
    ).toBeVisible();
    // Login again with created credentials
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').fill(password);
    await page.getByRole('button', { name: /sign in/i }).click();

    // Expect redirect to Staff Dashboard
    await expect(
      page.getByRole('heading', { name: /staff dashboard/i })
    ).toBeVisible({ timeout: 3000 });

    // Final logout
    await page.getByRole('button', { name: /sign out/i }).click();

    // Ensure we're back on Login Page
    await expect(
      page.getByRole('heading', { name: /welcome back/i })
    ).toBeVisible();
  });
});
