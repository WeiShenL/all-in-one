/**
 * E2E Tests for Project Report Export Feature
 *
 * Tests the download functionality of PDF and XLSX export for project reports
 * - HR/Admin users can export reports from /dashboard/hr
 * - PDF export triggers download (blob URL verification)
 * - XLSX export triggers download (blob URL verification)
 *
 * Parallel execution: Uses worker-specific namespace for data isolation
 * Focus: Download functionality works
 */

import { test, expect, Page } from '@playwright/test';
import { Client } from 'pg';
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';

test.describe('Project Report Export - Download Functionality', () => {
  let pgClient: Client;
  let supabaseClient: ReturnType<typeof createClient>;
  let testNamespace: string;
  let testEmail: string;
  let testPassword: string;
  let testDepartmentId: string;
  let testUserId: string;
  let testProjectId: string;

  test.beforeAll(async () => {
    // Setup DB connection
    pgClient = new Client({ connectionString: process.env.DATABASE_URL });
    await pgClient.connect();

    supabaseClient = createClient(
      process.env.NEXT_PUBLIC_API_EXTERNAL_URL!,
      process.env.NEXT_PUBLIC_ANON_KEY!
    );

    // Create robust worker-specific namespace for parallel execution
    const workerId = process.env.PLAYWRIGHT_WORKER_INDEX || '0';
    const timestamp = Date.now();
    const processId = process.pid;
    const randomSuffix = crypto.randomUUID().slice(0, 8);
    testNamespace = `reports-w${workerId}_${timestamp}_${processId}_${randomSuffix}`;

    // Create unique credentials with worker-specific namespace
    testEmail = `e2e.hr.reports.${testNamespace}@example.com`;
    testPassword = 'Test123!@#';

    // Create department
    const deptResult = await pgClient.query(
      'INSERT INTO "department" (id, name, "isActive", "createdAt", "updatedAt") VALUES (gen_random_uuid(), $1, true, NOW(), NOW()) RETURNING id',
      [`HR Reports Test Dept ${testNamespace}`]
    );
    testDepartmentId = deptResult.rows[0].id;

    // Create HR/Admin user with Supabase auth
    const { data: authData, error } = await supabaseClient.auth.signUp({
      email: testEmail,
      password: testPassword,
    });

    if (error || !authData.user) {
      throw new Error(`Failed to create test user: ${error?.message}`);
    }

    // Wait for user_profile trigger to complete
    let profileExists = false;
    for (let i = 0; i < 10; i++) {
      const checkResult = await pgClient.query(
        'SELECT id FROM "user_profile" WHERE id = $1',
        [authData.user.id]
      );
      if (checkResult.rows.length > 0) {
        profileExists = true;
        break;
      }
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    if (!profileExists) {
      throw new Error('User profile was not created by trigger');
    }

    // Update department, role, and HR flag
    await pgClient.query(
      'UPDATE "user_profile" SET "departmentId" = $1, role = $2, "isHrAdmin" = $3, name = $4 WHERE id = $5',
      [
        testDepartmentId,
        'HR_ADMIN',
        true,
        `HR Reports Test User ${testNamespace}`,
        authData.user.id,
      ]
    );
    testUserId = authData.user.id;

    // Create test project
    const projectResult = await pgClient.query(
      'INSERT INTO "project" (id, name, description, priority, status, "departmentId", "creatorId", "isArchived", "createdAt", "updatedAt") VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, false, NOW(), NOW()) RETURNING id',
      [
        `Report Export Test Project ${testNamespace}`,
        'Project for testing report export',
        7,
        'ACTIVE',
        testDepartmentId,
        testUserId,
      ]
    );
    testProjectId = projectResult.rows[0].id;

    // Create test tasks
    await pgClient.query(
      'INSERT INTO "task" (id, title, description, priority, "dueDate", status, "ownerId", "departmentId", "projectId", "createdAt", "updatedAt") VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())',
      [
        `Task 1 ${testNamespace}`,
        'Test task 1',
        8,
        new Date('2025-12-31'),
        'COMPLETED',
        testUserId,
        testDepartmentId,
        testProjectId,
      ]
    );

    await pgClient.query(
      'INSERT INTO "task" (id, title, description, priority, "dueDate", status, "ownerId", "departmentId", "projectId", "createdAt", "updatedAt") VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())',
      [
        `Task 2 ${testNamespace}`,
        'Test task 2',
        6,
        new Date('2025-12-31'),
        'IN_PROGRESS',
        testUserId,
        testDepartmentId,
        testProjectId,
      ]
    );

    // Create project collaborator
    await pgClient.query(
      'INSERT INTO "project_collaborator" ("projectId", "userId", "departmentId", "addedAt") VALUES ($1, $2, $3, NOW())',
      [testProjectId, testUserId, testDepartmentId]
    );
  });

  test.afterEach(async ({ context }) => {
    // Only clear browser storage - no database cleanup to avoid race conditions
    await context.clearCookies();
    await context.clearPermissions();
  });

  test.afterAll(async () => {
    try {
      // Cleanup in reverse order of dependencies

      // 1. Get all task IDs for this project
      const taskIdsResult = await pgClient.query(
        'SELECT id FROM "task" WHERE "projectId" = $1',
        [testProjectId]
      );
      const taskIds = taskIdsResult.rows.map(row => row.id);

      if (taskIds.length > 0) {
        // 2. Delete task assignments
        await pgClient.query(
          'DELETE FROM "task_assignment" WHERE "taskId" = ANY($1)',
          [taskIds]
        );

        // 3. Delete task tags
        await pgClient.query(
          'DELETE FROM "task_tag" WHERE "taskId" = ANY($1)',
          [taskIds]
        );

        // 4. Delete tasks
        await pgClient.query('DELETE FROM "task" WHERE id = ANY($1)', [
          taskIds,
        ]);
      }

      // 5. Delete project collaborators
      if (testProjectId) {
        await pgClient.query(
          'DELETE FROM "project_collaborator" WHERE "projectId" = $1',
          [testProjectId]
        );
      }

      // 6. Delete project
      if (testProjectId) {
        await pgClient.query('DELETE FROM "project" WHERE id = $1', [
          testProjectId,
        ]);
      }

      // 7. Delete user profile
      if (testUserId) {
        await pgClient.query('DELETE FROM "user_profile" WHERE id = $1', [
          testUserId,
        ]);
      }

      // 8. Delete auth user
      await supabaseClient.auth.signOut();
      if (testUserId) {
        await pgClient.query('DELETE FROM auth.users WHERE id = $1', [
          testUserId,
        ]);
      }

      // 9. Delete department
      if (testDepartmentId) {
        await pgClient.query('DELETE FROM "department" WHERE id = $1', [
          testDepartmentId,
        ]);
      }
    } catch (error) {
      console.error(
        `❌ Error during cleanup for namespace ${testNamespace}:`,
        error
      );
    } finally {
      // 10. Close connections
      if (pgClient) {
        await pgClient.end();
      }
    }
  });

  /**
   * Helper function to login as HR/Admin user
   */
  async function loginAsHRAdmin(page: Page) {
    await page.goto('/auth/login', { timeout: 65000 });
    await page.waitForLoadState('domcontentloaded', { timeout: 65000 });

    await page.getByLabel('Email').fill(testEmail);
    await page.getByLabel('Password').fill(testPassword);
    await page.getByRole('button', { name: /sign in/i }).click();

    // Wait for redirect to dashboard
    await page.waitForURL(/dashboard/, { timeout: 65000 });
    await page.waitForLoadState('networkidle', { timeout: 65000 });
  }

  /**
   * Test 1: HR/Admin can export project report as PDF
   */
  test('should export project report as PDF (download works)', async ({
    page,
  }) => {
    test.setTimeout(180000); // 3 minutes

    // Login as HR/Admin
    await loginAsHRAdmin(page);

    // Navigate to HR dashboard
    await page.goto('/dashboard/hr', { timeout: 65000 });
    await page.waitForLoadState('networkidle', { timeout: 65000 });

    // Verify page loaded
    await expect(
      page.getByRole('heading', { name: /HR Admin Dashboard/i })
    ).toBeVisible({ timeout: 65000 });

    // Find and select the test project
    const projectDropdown = page.getByTestId('project-select-dropdown');
    await expect(projectDropdown).toBeVisible({ timeout: 65000 });

    // Wait for projects to load
    await page.waitForTimeout(2000);

    // Select project by value (ID)
    await projectDropdown.selectOption(testProjectId);

    // Wait for selection to register
    await page.waitForTimeout(1000);

    // Verify export button is visible
    const exportButton = page.getByTestId('export-report-button');
    await expect(exportButton).toBeVisible({ timeout: 65000 });
    await expect(exportButton).toBeEnabled({ timeout: 65000 });

    // Click export button to open dropdown
    await exportButton.click();

    // Wait for dropdown to appear
    await page.waitForTimeout(500);

    // Verify PDF export option is visible
    const pdfButton = page.getByTestId('export-pdf-button');
    await expect(pdfButton).toBeVisible({ timeout: 65000 });

    // Wait for download event (Playwright Download API)
    const downloadPromise = page.waitForEvent('download', { timeout: 65000 });
    await pdfButton.click();

    // Get download info
    const download = await downloadPromise;
    const fileName = download.suggestedFilename();

    // Verify PDF was downloaded
    expect(fileName).toBeTruthy();
    expect(fileName).toContain('.pdf');

    // Verify file path exists (download completed)
    const filePath = await download.path();
    expect(filePath).toBeTruthy();

    // Verify file is not empty/corrupted
    const stats = fs.statSync(filePath!);
    expect(stats.size).toBeGreaterThan(100);

    // Verify PDF integrity (magic bytes)
    const buffer = fs.readFileSync(filePath!);
    expect(buffer.toString('utf8', 0, 5)).toBe('%PDF-');
  });

  /**
   * Test 2: HR/Admin can export project report as XLSX
   */
  test('should export project report as XLSX (download works)', async ({
    page,
  }) => {
    test.setTimeout(180000); // 3 minutes

    // Login as HR/Admin
    await loginAsHRAdmin(page);

    // Navigate to HR dashboard
    await page.goto('/dashboard/hr', { timeout: 65000 });
    await page.waitForLoadState('networkidle', { timeout: 65000 });

    // Verify page loaded
    await expect(
      page.getByRole('heading', { name: /HR Admin Dashboard/i })
    ).toBeVisible({ timeout: 65000 });

    // Find and select the test project
    const projectDropdown = page.getByTestId('project-select-dropdown');
    await expect(projectDropdown).toBeVisible({ timeout: 65000 });

    // Wait for projects to load
    await page.waitForTimeout(2000);

    // Select project by value (ID)
    await projectDropdown.selectOption(testProjectId);

    // Wait for selection to register
    await page.waitForTimeout(1000);

    // Verify export button is visible
    const exportButton = page.getByTestId('export-report-button');
    await expect(exportButton).toBeVisible({ timeout: 65000 });
    await expect(exportButton).toBeEnabled({ timeout: 65000 });

    // Click export button to open dropdown
    await exportButton.click();

    // Wait for dropdown to appear
    await page.waitForTimeout(500);

    // Verify XLSX export option is visible
    const xlsxButton = page.getByTestId('export-xlsx-button');
    await expect(xlsxButton).toBeVisible({ timeout: 65000 });

    // Wait for download event (Playwright Download API)
    const downloadPromise = page.waitForEvent('download', { timeout: 65000 });
    await xlsxButton.click();

    // Get download info
    const download = await downloadPromise;
    const fileName = download.suggestedFilename();

    // Verify XLSX was downloaded
    expect(fileName).toBeTruthy();
    expect(fileName).toContain('.xlsx');

    // Verify file path exists (download completed)
    const filePath = await download.path();
    expect(filePath).toBeTruthy();

    // Verify file is not empty/corrupted
    const stats = fs.statSync(filePath!);
    expect(stats.size).toBeGreaterThan(100);

    // Verify XLSX integrity (ZIP magic bytes - XLSX is zipped XML)
    const buffer = fs.readFileSync(filePath!);
    expect(buffer[0]).toBe(0x50); // 'P' from PK
    expect(buffer[1]).toBe(0x4b); // 'K' from PK
  });
});
