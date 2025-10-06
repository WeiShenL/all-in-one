import { test, expect } from '@playwright/test';

test.describe('Login Page', () => {
  test('loads and shows essential UI', async ({ page }) => {
    await page.goto('/auth/login');

    // Title or heading
    await expect(
      page.getByRole('heading', { name: /welcome back/i })
    ).toBeVisible();

    // Form fields
    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.getByLabel('Password')).toBeVisible();

    // Primary action
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();

    // Secondary actions
    await expect(
      page.getByRole('button', { name: /create account/i })
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: /reset password/i })
    ).toBeVisible();
  });
});
