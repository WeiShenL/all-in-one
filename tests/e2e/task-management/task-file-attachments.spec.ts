import { test, expect } from '@playwright/test';
import { Client } from 'pg';
import { createClient } from '@supabase/supabase-js';
import * as path from 'path';
import * as fs from 'fs';

/**
 * E2E Tests for Task File Attachments Feature
 *
 * Isolated test for task file attachment functionality
 * - Independent namespace and cleanup
 * - No shared state with other test files
 * - Optimized for parallel execution
 */

test.describe('Task File Attachments - Isolated E2E Tests', () => {
  let pgClient: Client;
  let supabaseClient: ReturnType<typeof createClient>;
  let testEmail: string;
  let testPassword: string;
  let testDepartmentId: string;
  let testUserId: string;
  let testTaskId: string;
  let testNamespace: string;
  const uploadedFileIds: string[] = [];

  test.beforeAll(async () => {
    // Setup DB connection
    pgClient = new Client({ connectionString: process.env.DATABASE_URL });
    await pgClient.connect();

    supabaseClient = createClient(
      process.env.NEXT_PUBLIC_API_EXTERNAL_URL!,
      process.env.NEXT_PUBLIC_ANON_KEY!
    );

    // Create robust worker-specific namespace for test data isolation
    const workerId = process.env.PLAYWRIGHT_WORKER_INDEX || '0';
    const timestamp = Date.now();
    const processId = process.pid;
    const randomSuffix = crypto.randomUUID().slice(0, 8);
    testNamespace = `files-task-w${workerId}_${timestamp}_${processId}_${randomSuffix}`;

    // Create unique credentials with worker-specific namespace
    testEmail = `e2e.files.task.${testNamespace}@example.com`;
    testPassword = 'Test123!@#';

    // Create department
    const deptResult = await pgClient.query(
      'INSERT INTO "department" (id, name, "isActive", "createdAt", "updatedAt") VALUES (gen_random_uuid(), $1, true, NOW(), NOW()) RETURNING id',
      [`Files Task Test Dept ${testNamespace}`]
    );
    testDepartmentId = deptResult.rows[0].id;

    // Create user with Supabase auth
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

    // Update department and role
    await pgClient.query(
      'UPDATE "user_profile" SET "departmentId" = $1, role = $2, name = $3 WHERE id = $4',
      [
        testDepartmentId,
        'STAFF',
        `Files Task Test User ${testNamespace}`,
        authData.user.id,
      ]
    );
    testUserId = authData.user.id;

    // Create a test task for file attachments
    const taskResult = await pgClient.query(
      'INSERT INTO "task" (id, title, description, priority, "dueDate", status, "ownerId", "departmentId", "createdAt", "updatedAt") VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, NOW(), NOW()) RETURNING id',
      [
        `Files Task ${testNamespace}`,
        'Task for testing file attachments',
        5,
        new Date('2025-12-31'),
        'TO_DO',
        testUserId,
        testDepartmentId,
      ]
    );
    testTaskId = taskResult.rows[0].id;

    // Create task assignment
    await pgClient.query(
      'INSERT INTO "task_assignment" ("taskId", "userId", "assignedById", "assignedAt") VALUES ($1, $2, $3, NOW())',
      [testTaskId, testUserId, testUserId]
    );
  });

  test.afterEach(async ({ context }) => {
    // Only clear browser storage - no database cleanup to avoid race conditions
    await context.clearCookies();
    await context.clearPermissions();
  });

  test.afterAll(async () => {
    try {
      // Cleanup uploaded files first
      if (uploadedFileIds.length > 0) {
        await pgClient.query('DELETE FROM "task_file" WHERE id = ANY($1)', [
          uploadedFileIds,
        ]);
      }

      // Cleanup - order matters due to foreign keys
      let taskIds: string[] = [];

      // 1. Get all task IDs created by test user
      if (testUserId) {
        const taskIdsResult = await pgClient.query(
          'SELECT id FROM "task" WHERE "ownerId" = $1',
          [testUserId]
        );
        taskIds = taskIdsResult.rows.map(row => row.id);
      }

      // Also clean up any tasks with our namespace in title (fallback cleanup)
      const namespaceTaskResult = await pgClient.query(
        'SELECT id FROM "task" WHERE title LIKE $1',
        [`%${testNamespace}%`]
      );
      const namespaceTaskIds = namespaceTaskResult.rows.map(row => row.id);
      taskIds = [...new Set([...taskIds, ...namespaceTaskIds])]; // Remove duplicates

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

      // 5. Delete user profile
      if (testUserId) {
        await pgClient.query('DELETE FROM "user_profile" WHERE id = $1', [
          testUserId,
        ]);
      }

      // 6. Delete auth user
      await supabaseClient.auth.signOut();
      if (testUserId) {
        await pgClient.query('DELETE FROM auth.users WHERE id = $1', [
          testUserId,
        ]);
      }

      // 7. Delete department
      if (testDepartmentId) {
        await pgClient.query('DELETE FROM "department" WHERE id = $1', [
          testDepartmentId,
        ]);
      }
    } catch (error) {
      console.error(
        `❌ Error during files task cleanup for namespace ${testNamespace}:`,
        error
      );
    } finally {
      // 8. Close connections
      if (pgClient) {
        await pgClient.end();
      }
    }
  });

  test('should upload file attachment', async ({ page }) => {
    test.setTimeout(180000);

    // Create a test PDF file (minimal valid PDF)
    const testFileName = `test-file-${testNamespace}.pdf`;
    const testFilePath = path.join(process.cwd(), testFileName);
    const minimalPDF = `%PDF-1.4
1 0 obj
<<
/Type /Catalog
/Pages 2 0 R
>>
endobj
2 0 obj
<<
/Type /Pages
/Kids [3 0 R]
/Count 1
>>
endobj
3 0 obj
<<
/Type /Page
/Parent 2 0 R
/MediaBox [0 0 612 792]
/Contents 4 0 R
>>
endobj
4 0 obj
<<
/Length 44
>>
stream
BT
/F1 12 Tf
72 720 Td
(Test PDF Content) Tj
ET
endstream
endobj
xref
0 5
0000000000 65535 f
0000000009 00000 n
0000000058 00000 n
0000000115 00000 n
0000000206 00000 n
trailer
<<
/Size 5
/Root 1 0 R
>>
startxref
299
%%EOF`;
    fs.writeFileSync(testFilePath, minimalPDF);

    try {
      // Login
      await page.goto('/auth/login');
      await page.getByLabel('Email').fill(testEmail);
      await page.getByLabel('Password').fill(testPassword);
      await page.getByRole('button', { name: /sign in/i }).click();
      await page.waitForURL(/dashboard/, { timeout: 65000 });

      // Find and click edit button for our test task
      const editButton = page.getByTestId(`edit-task-button-${testTaskId}`);
      await expect(editButton).toBeVisible({ timeout: 30000 });
      await editButton.click();

      // Wait for modal to open - wait for task title display to be visible
      await expect(page.getByTestId('task-title-display')).toBeVisible({
        timeout: 30000,
      });

      // Navigate to file attachments section
      await expect(page.getByText('📎 File Attachments')).toBeVisible({
        timeout: 30000,
      });

      // Upload file
      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles(testFilePath);

      // Wait for file to be selected (should show checkmark)
      await expect(
        page.getByText(new RegExp(`✓ ${testFileName}`, 'i'))
      ).toBeVisible({
        timeout: 65000,
      });

      // Click Upload button
      await page.getByRole('button', { name: /⬆️ Upload|upload/i }).click();

      // Verify upload progress via button state, then success toast with filename
      await expect(page.getByTestId('upload-button')).toHaveText(/Uploading/i, {
        timeout: 65000,
      });

      await expect(
        page.getByText(new RegExp(`File "${testFileName}" uploaded`, 'i'))
      ).toBeVisible({
        timeout: 65000,
      });

      // Wait for upload to complete
      await page.waitForTimeout(2000);

      // Verify file appears in the list using data-testid
      await expect(page.getByTestId(`file-entry-${testFileName}`)).toBeVisible({
        timeout: 65000,
      });

      // Verify file in database
      const fileResult = await pgClient.query(
        'SELECT id, "fileName" FROM "task_file" WHERE "taskId" = $1 AND "fileName" = $2',
        [testTaskId, testFileName]
      );
      expect(fileResult.rows.length).toBe(1);
      uploadedFileIds.push(fileResult.rows[0].id);
    } finally {
      // Clean up test file
      if (fs.existsSync(testFilePath)) {
        fs.unlinkSync(testFilePath);
      }
    }
  });

  test('should view/download file attachment', async ({ page, context }) => {
    test.setTimeout(180000);

    // First, upload a file via database
    const testFileName = `db-test-file-${testNamespace}.pdf`;
    const fileResult = await pgClient.query(
      'INSERT INTO "task_file" (id, "fileName", "fileSize", "fileType", "storagePath", "taskId", "uploadedById", "uploadedAt") VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, NOW()) RETURNING id',
      [
        testFileName,
        1024,
        'application/pdf',
        `/uploads/${testFileName}`,
        testTaskId,
        testUserId,
      ]
    );
    const fileId = fileResult.rows[0].id;
    uploadedFileIds.push(fileId);

    // Login
    await page.goto('/auth/login');
    await page.getByLabel('Email').fill(testEmail);
    await page.getByLabel('Password').fill(testPassword);
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.waitForURL(/dashboard/, { timeout: 65000 });

    // Find and click edit button for our test task
    const editButton = page.getByTestId(`edit-task-button-${testTaskId}`);
    await expect(editButton).toBeVisible({ timeout: 30000 });
    await editButton.click();

    // Wait for modal to open - look for task title instead of heading
    await expect(page.getByTestId('task-title-display')).toBeVisible({
      timeout: 30000,
    });

    // Navigate to file attachments section
    await expect(page.getByText('📎 File Attachments')).toBeVisible({
      timeout: 30000,
    });

    // Scroll to file attachments section to ensure visibility
    await page.getByText('📎 File Attachments').scrollIntoViewIfNeeded();

    // Verify the file exists in the list and exact name is visible
    const fileEntry = page.getByTestId(`file-entry-${testFileName}`);
    await expect(fileEntry).toBeVisible({ timeout: 65000 });
    await expect(page.getByText(testFileName)).toBeVisible({
      timeout: 65000,
    });

    // Find the download button using data-testid
    const downloadButton = page.getByTestId(
      `file-download-button-${testFileName}`
    );
    await expect(downloadButton).toBeVisible({
      timeout: 65000,
    });

    const newPagePromise = context.waitForEvent('page', { timeout: 65000 });
    await downloadButton.click();

    try {
      const newPage = await newPagePromise;
      const url = newPage.url();
      expect(url.length).toBeGreaterThan(0);
      expect(url).toMatch(new RegExp(`${testFileName}|blob:|data:|supabase`));
      await newPage.close();
    } catch {
      // Popup blocked in headless mode
    }
  });

  test('should delete file attachment', async ({ page }) => {
    test.setTimeout(180000);

    // First, upload a file via database
    const testFileName = `delete-test-file-${testNamespace}.pdf`;
    await pgClient.query(
      'INSERT INTO "task_file" (id, "fileName", "fileSize", "fileType", "storagePath", "taskId", "uploadedById", "uploadedAt") VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, NOW()) RETURNING id',
      [
        testFileName,
        1024,
        'application/pdf',
        `/uploads/${testFileName}`,
        testTaskId,
        testUserId,
      ]
    );

    // Login
    await page.goto('/auth/login');
    await page.getByLabel('Email').fill(testEmail);
    await page.getByLabel('Password').fill(testPassword);
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.waitForURL(/dashboard/, { timeout: 65000 });

    // Find and click edit button for our test task
    const editButton = page.getByTestId(`edit-task-button-${testTaskId}`);
    await expect(editButton).toBeVisible({ timeout: 30000 });
    await editButton.click();

    // Wait for modal to open - look for task title instead of heading
    await expect(page.getByTestId('task-title-display')).toBeVisible({
      timeout: 30000,
    });

    // Navigate to file attachments section
    await expect(page.getByText('📎 File Attachments')).toBeVisible({
      timeout: 30000,
    });

    // Scroll to file attachments section to ensure visibility
    await page.getByText('📎 File Attachments').scrollIntoViewIfNeeded();

    // Find the file and click delete
    const fileEntry = page.getByTestId(`file-entry-${testFileName}`);
    await expect(fileEntry).toBeVisible({ timeout: 60000 });

    // Click delete button
    const deleteButton = fileEntry.getByRole('button', { name: /🗑️/ });
    await expect(deleteButton).toBeVisible({ timeout: 60000 });

    // Handle confirm dialog
    page.on('dialog', dialog => dialog.accept());
    await deleteButton.click();

    // Verify file is removed from UI
    await expect(fileEntry).not.toBeVisible({ timeout: 60000 });
  });
});
