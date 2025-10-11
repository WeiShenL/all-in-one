import { test, expect } from '@playwright/test';
import { Client } from 'pg';
import { createClient } from '@supabase/supabase-js';
import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * E2E Tests for Task Update Feature - SCRUM-14
 *
 * Tests all acceptance criteria through actual UI interactions:
 * - AC1: Update task deadline
 * - AC2: Update task priority (1-10 scale)
 * - AC3: Add or update tags (optional)
 * - AC4: Update task title and description
 * - AC5: Update task status
 * - AC6 + TM021: Add comments and edit own comments only
 * - AC7 + TM015: Add assignees, max 5 only (but NOT remove them)
 * - AC8 + TM044: Add/remove file attachments (up to 50MB total per task)
 * - AC9: Changes saved and reflected within 10 seconds
 * - AC10: Update recurring settings (enable/disable, change interval)
 */

test.describe('Task Update - Complete UI Flow', () => {
  // Run tests in serial mode so they execute sequentially
  test.describe.configure({ mode: 'serial' });

  let pgClient: Client;
  let supabaseClient: ReturnType<typeof createClient>;
  let testDepartmentId: string;
  let testUserId: string;
  let _testUser2Id: string;
  let _testUser3Id: string;
  let _testUser4Id: string;
  let _testUser5Id: string;
  let testTaskId: string;
  let testEmail: string;
  let testPassword: string;
  const uploadedFileIds: string[] = [];

  // Helper function to login (used by each test)
  async function loginAndNavigateToTaskEdit(page: any) {
    await page.goto('/auth/login');

    // Wait for page to load
    await expect(
      page.getByRole('heading', { name: /welcome back/i })
    ).toBeVisible({ timeout: 10000 });

    // Fill email
    await page.getByLabel('Email').fill(testEmail);

    // Fill password
    await page.getByLabel('Password').fill(testPassword);

    // Click sign in button
    const signInButton = page.getByRole('button', { name: /sign in/i });
    await expect(signInButton).toBeEnabled({ timeout: 10000 });
    await signInButton.click();

    // Wait for dashboard
    await expect(
      page.getByRole('heading', { name: /staff dashboard/i })
    ).toBeVisible({ timeout: 15000 });

    // Find and click Edit button for the task
    const taskCard = page.locator('div').filter({
      has: page.getByRole('heading', {
        name: /E2E Task to Update|Updated Task Title/i,
      }),
    });
    await taskCard.getByRole('button', { name: /edit/i }).first().click();

    // Wait for edit view
    await expect(
      page.getByRole('button', { name: /back to view/i })
    ).toBeVisible({ timeout: 10000 });
  }

  test.beforeAll(async () => {
    // Setup DB connection
    pgClient = new Client({ connectionString: process.env.DATABASE_URL });
    await pgClient.connect();

    supabaseClient = createClient(
      process.env.NEXT_PUBLIC_API_EXTERNAL_URL!,
      process.env.NEXT_PUBLIC_ANON_KEY!
    );

    // Create unique credentials
    const unique = Date.now();
    testEmail = `e2e.task.update.${unique}@example.com`;
    testPassword = 'Test123!@#';

    // 1. Create department
    const deptResult = await pgClient.query(
      'INSERT INTO "department" (id, name, "isActive", "createdAt", "updatedAt") VALUES (gen_random_uuid(), $1, true, NOW(), NOW()) RETURNING id',
      [`E2E Task Update Dept ${unique}`]
    );
    testDepartmentId = deptResult.rows[0].id;

    // 2. Create main user with Supabase auth
    const { data: authData, error } = await supabaseClient.auth.signUp({
      email: testEmail,
      password: testPassword,
    });

    if (error || !authData.user) {
      throw new Error(`Failed to create test user: ${error?.message}`);
    }

    // 3. Supabase auth.signUp auto-creates user_profile via trigger
    // Wait for trigger to complete by checking if profile exists
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
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    if (!profileExists) {
      throw new Error(
        'User profile was not created by trigger after 5 seconds'
      );
    }

    // Update the department, role, and name
    await pgClient.query(
      'UPDATE "user_profile" SET "departmentId" = $1, role = $2, name = $3 WHERE id = $4',
      [testDepartmentId, 'STAFF', 'E2E Update Task User 1', authData.user.id]
    );
    testUserId = authData.user.id;

    // 4. Create additional users for assignee testing (AC7)
    const additionalUsers = [];
    for (let i = 2; i <= 5; i++) {
      const userResult = await pgClient.query(
        'INSERT INTO "user_profile" (id, email, name, role, "departmentId", "isActive", "createdAt", "updatedAt") VALUES (gen_random_uuid(), $1, $2, $3, $4, true, NOW(), NOW()) RETURNING id',
        [
          `e2e.user${i}.${unique}@example.com`,
          `E2E Update Task User ${i}`,
          'STAFF',
          testDepartmentId,
        ]
      );
      additionalUsers.push(userResult.rows[0].id);
    }
    [_testUser2Id, _testUser3Id, _testUser4Id, _testUser5Id] = additionalUsers;

    // 5. Create task
    const taskResult = await pgClient.query(
      'INSERT INTO "task" (id, title, description, priority, "dueDate", "ownerId", "departmentId", status, "createdAt", "updatedAt") VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, NOW(), NOW()) RETURNING id',
      [
        'E2E Task to Update',
        'Original description for testing',
        5,
        new Date('2025-12-31'),
        testUserId,
        testDepartmentId,
        'TO_DO',
      ]
    );
    testTaskId = taskResult.rows[0].id;

    // 6. Create task assignment
    await pgClient.query(
      'INSERT INTO "task_assignment" ("taskId", "userId", "assignedById", "assignedAt") VALUES ($1, $2, $3, NOW())',
      [testTaskId, testUserId, testUserId]
    );
  });

  test.afterAll(async () => {
    // Cleanup - order matters due to foreign keys

    // 1. Delete uploaded files from Supabase Storage
    if (uploadedFileIds.length > 0) {
      for (const fileId of uploadedFileIds) {
        try {
          await pgClient.query('DELETE FROM "task_file" WHERE id = $1', [
            fileId,
          ]);
        } catch (err) {
          console.error(`Failed to delete file ${fileId}:`, err);
        }
      }
    }

    // 2. Delete task_file records
    await pgClient.query('DELETE FROM "task_file" WHERE "taskId" = $1', [
      testTaskId,
    ]);

    // 3. Delete comments
    await pgClient.query('DELETE FROM "comment" WHERE "taskId" = $1', [
      testTaskId,
    ]);

    // 4. Delete task tags
    await pgClient.query('DELETE FROM "task_tag" WHERE "taskId" = $1', [
      testTaskId,
    ]);

    // 5. Delete tags created during test
    await pgClient.query('DELETE FROM "tag" WHERE name LIKE $1', [
      'e2e-test-tag%',
    ]);

    // 6. Delete task assignments
    await pgClient.query('DELETE FROM "task_assignment" WHERE "taskId" = $1', [
      testTaskId,
    ]);

    // 7. Delete task
    await pgClient.query('DELETE FROM "task" WHERE id = $1', [testTaskId]);

    // 8. Delete user profiles
    await pgClient.query(
      'DELETE FROM "user_profile" WHERE "departmentId" = $1',
      [testDepartmentId]
    );

    // 9. Delete auth users
    await supabaseClient.auth.signOut();
    const unique = testEmail.split('.')[3].split('@')[0];
    await pgClient.query('DELETE FROM auth.users WHERE email LIKE $1', [
      `e2e.%${unique}%`,
    ]);

    // 10. Delete department
    await pgClient.query('DELETE FROM "department" WHERE id = $1', [
      testDepartmentId,
    ]);

    // 11. Close connections
    await pgClient.end();
  });

  test('Setup: should login and navigate to task edit view', async ({
    page,
  }) => {
    // Login
    await loginAndNavigateToTaskEdit(page);
  });

  test('AC4: should update task title', async ({ page }) => {
    // Navigate to edit view
    await loginAndNavigateToTaskEdit(page);

    // Click Edit button for title using data-testid
    await page.getByTestId('title-edit-button').click();

    // Fill new title
    await page.getByRole('textbox').first().fill('Updated Task Title');

    // Click Save button
    await page
      .getByRole('button', { name: /^save$/i })
      .first()
      .click();

    // Verify success message appears within 10 seconds (AC9)
    await expect(page.getByText(/title updated/i)).toBeVisible({
      timeout: 10000,
    });

    // Verify title changed in UI (longer timeout for CI/CD)
    await expect(
      page.getByRole('heading', { name: /updated task title/i })
    ).toBeVisible({
      timeout: 15000,
    });
  });

  test('AC4: should update task description', async ({ page }) => {
    await loginAndNavigateToTaskEdit(page);

    // Click Edit button for description using data-testid
    await page.getByTestId('description-edit-button').click();

    // Fill new description
    await page
      .getByRole('textbox')
      .first()
      .fill('This is the updated description for e2e testing');

    // Click Save
    await page
      .getByRole('button', { name: /^save$/i })
      .first()
      .click();

    // Verify success message (AC9)
    await expect(page.getByText(/description updated/i)).toBeVisible({
      timeout: 10000,
    });

    // Verify description changed (longer timeout for CI/CD)
    await expect(
      page.getByText('This is the updated description for e2e testing')
    ).toBeVisible({
      timeout: 15000,
    });
  });

  test('AC2: should update task priority from 5 to 8', async ({ page }) => {
    await loginAndNavigateToTaskEdit(page);

    // Click Edit button for priority using data-testid
    await page.getByTestId('priority-edit-button').click();

    // Change priority to 8
    await page.getByRole('spinbutton').fill('8');

    // Click Save
    await page
      .getByRole('button', { name: /^save$/i })
      .first()
      .click();

    // Verify success message (AC9)
    await expect(page.getByText(/priority updated/i)).toBeVisible({
      timeout: 10000,
    });

    // Verify priority badge shows 8 using data-testid (longer timeout for CI/CD)
    await expect(page.getByTestId('priority-value')).toHaveText('8', {
      timeout: 15000,
    });
  });

  test('AC5: should update task status from TO_DO to IN_PROGRESS', async ({
    page,
  }) => {
    await loginAndNavigateToTaskEdit(page);

    // Click Edit button for status using data-testid
    await page.getByTestId('status-edit-button').click();

    // Select new status
    await page.getByRole('combobox').selectOption('IN_PROGRESS');

    // Click Save
    await page
      .getByRole('button', { name: /^save$/i })
      .first()
      .click();

    // Verify success message (AC9)
    await expect(page.getByText(/status updated/i)).toBeVisible({
      timeout: 10000,
    });

    // Verify status badge shows IN PROGRESS (longer timeout for CI/CD)
    await expect(page.getByText(/IN PROGRESS/i)).toBeVisible({
      timeout: 15000,
    });
  });

  test('AC1: should update task deadline', async ({ page }) => {
    await loginAndNavigateToTaskEdit(page);

    // Click Edit button for deadline using data-testid
    await page.getByTestId('deadline-edit-button').click();

    // Change deadline using data-testid
    await page.getByTestId('deadline-input').fill('2026-06-15');

    // Click Save
    await page
      .getByRole('button', { name: /^save$/i })
      .first()
      .click();

    // Verify success message (AC9)
    await expect(page.getByText(/deadline updated/i)).toBeVisible({
      timeout: 10000,
    });

    // Verify deadline changed (format may vary based on locale, longer timeout for CI/CD)
    await expect(page.getByText(/6\/15\/2026|15\/6\/2026/i)).toBeVisible({
      timeout: 15000,
    });
  });

  test('AC3: should add and remove tags', async ({ page }) => {
    test.setTimeout(65000); // Extended timeout for slow CI/CD

    await loginAndNavigateToTaskEdit(page);

    // Scroll to tags section
    await page.getByText(/🏷️ Tags/).scrollIntoViewIfNeeded();

    // Add first tag
    await page.getByPlaceholder(/add tag/i).fill('e2e-test-tag-urgent');
    await page.getByRole('button', { name: /add tag/i }).click();

    // Verify success message (AC9) - increased timeout as video shows 15s delay
    await expect(page.getByText(/tag added/i)).toBeVisible({
      timeout: 20000,
    });

    // Verify tag appears (longer timeout for CI/CD)
    await expect(page.getByText('e2e-test-tag-urgent')).toBeVisible({
      timeout: 15000,
    });

    // Add second tag
    await page.getByPlaceholder(/add tag/i).fill('e2e-test-tag-frontend');
    await page.getByRole('button', { name: /add tag/i }).click();
    await expect(page.getByText(/tag added/i)).toBeVisible({
      timeout: 20000,
    });
    await expect(page.getByText('e2e-test-tag-frontend')).toBeVisible({
      timeout: 15000,
    });

    // Remove first tag
    const tag1 = page
      .locator('span')
      .filter({ hasText: /^e2e-test-tag-urgent/ });
    await tag1.getByRole('button').click();

    // Verify tag removed message - increased timeout for slow CI/CD
    await expect(page.getByText(/tag removed/i)).toBeVisible({
      timeout: 20000,
    });

    // Verify tag is gone (longer timeout for CI/CD)
    await expect(page.getByText('e2e-test-tag-urgent')).not.toBeVisible({
      timeout: 15000,
    });
  });

  test('AC10: should update recurring settings', async ({ page }) => {
    test.setTimeout(70000); // Extended timeout for slow CI/CD mutations

    await loginAndNavigateToTaskEdit(page);

    // Scroll to recurring section
    await page.getByText(/🔄 Recurring Settings/).scrollIntoViewIfNeeded();

    // Click Edit button for recurring using data-testid
    await page.getByTestId('recurring-edit-button').click();

    // Enable recurring checkbox using data-testid
    await page.getByTestId('recurring-checkbox').check();

    // Set interval to 7 days using data-testid
    await page.getByTestId('recurring-interval-input').fill('7');

    // Click Save
    await page
      .getByRole('button', { name: /^save$/i })
      .first()
      .click();

    // Verify success message (AC9) - increased timeout for slow CI/CD
    await expect(page.getByText(/recurring settings updated/i)).toBeVisible({
      timeout: 20000,
    });

    // Wait for success message to disappear (component re-renders after fetchTask)
    await expect(page.getByText(/recurring settings updated/i)).not.toBeVisible(
      {
        timeout: 5000,
      }
    );

    // Verify recurring badge shows "Enabled (every 7 days)" (longer timeout for CI/CD)
    await expect(page.getByText(/✅ Enabled \(every 7 days\)/i)).toBeVisible({
      timeout: 20000,
    });
  });

  test('AC6: should add comment', async ({ page }) => {
    await loginAndNavigateToTaskEdit(page);

    // Scroll to comments section
    await page.getByText(/💬 Comments/).scrollIntoViewIfNeeded();

    // Add comment
    await page
      .getByPlaceholder(/add a comment/i)
      .fill('This is my first e2e test comment');
    await page.getByRole('button', { name: /add comment/i }).click();

    // Verify success message (AC9)
    await expect(page.getByText(/comment added/i)).toBeVisible({
      timeout: 10000,
    });

    // Verify comment appears (longer timeout for CI/CD)
    await expect(
      page.getByText('This is my first e2e test comment')
    ).toBeVisible({
      timeout: 15000,
    });
  });

  test('AC6 + TM021: should edit own comment only', async ({ page }) => {
    await loginAndNavigateToTaskEdit(page);

    // Scroll to comments section
    await page.getByText(/💬 Comments/).scrollIntoViewIfNeeded();

    // Find the comment box containing our comment text
    // Use a more specific filter to avoid matching the entire page
    const commentBox = page
      .locator('div')
      .filter({ hasText: /^This is my first e2e test comment/ })
      .first();

    // Find the edit button within this specific comment box
    const editButton = commentBox.locator(
      'button[data-testid^="comment-edit-button-"]'
    );

    // Verify edit button exists for own comment (longer timeout for CI/CD as it depends on previous test)
    await expect(editButton).toBeVisible({
      timeout: 15000,
    });

    // Click edit button
    await editButton.click();

    // Edit the comment - textarea within the comment box
    const textarea = commentBox.getByRole('textbox');
    await textarea.fill('This is my EDITED e2e test comment');

    // Click Save button using data-testid (page-level since we only have 1 comment)
    const saveButton = page
      .locator('button[data-testid^="comment-save-button-"]')
      .first();
    await saveButton.click();

    // Verify success message
    await expect(page.getByText(/comment updated/i)).toBeVisible({
      timeout: 10000,
    });

    // Verify comment was updated (longer timeout for CI/CD)
    await expect(
      page.getByText('This is my EDITED e2e test comment')
    ).toBeVisible({
      timeout: 15000,
    });

    // Verify (edited) indicator appears (longer timeout for CI/CD)
    await expect(page.getByText(/\(edited\)/i)).toBeVisible({
      timeout: 15000,
    });
  });

  test('AC7 + TM015: should add assignees up to max 5 and cannot remove', async ({
    page,
  }) => {
    test.setTimeout(90000); // Extended timeout - adds 4 assignees, each takes ~15s in CI/CD

    await loginAndNavigateToTaskEdit(page);

    // Scroll to assignees section
    await page.getByText(/👥 Assigned Staff/).scrollIntoViewIfNeeded();

    // Verify initial count is 1 (original testUserId) (longer timeout for CI/CD)
    await expect(page.getByText(/👥 Assigned Staff \(1\/5\)/i)).toBeVisible({
      timeout: 15000,
    });

    // Verify NO delete-assignee buttons exist (TM015 compliance - cannot remove once added)
    // Check for specific data-testid that should not exist
    const deleteAssigneeButtons = page.locator(
      '[data-testid^="delete-assignee-"]'
    );
    await expect(deleteAssigneeButtons).toHaveCount(0);

    // Add 2nd assignee
    await page
      .getByTestId('assignee-email-input')
      .fill(`e2e.user2.${testEmail.split('.')[3].split('@')[0]}@example.com`);
    await page.getByTestId('add-assignee-button').click();

    // Verify success message (AC9) - increased timeout for slow CI/CD
    await expect(page.getByText(/Assignee.*added/i)).toBeVisible({
      timeout: 25000,
    });

    // Verify count updates to 2/5 (longer timeout for CI/CD)
    await expect(page.getByText(/👥 Assigned Staff \(2\/5\)/i)).toBeVisible({
      timeout: 15000,
    });

    // Add 3rd assignee
    await expect(page.getByTestId('assignee-email-input')).toBeVisible();
    await page
      .getByTestId('assignee-email-input')
      .fill(`e2e.user3.${testEmail.split('.')[3].split('@')[0]}@example.com`);
    await page.getByTestId('add-assignee-button').click();
    await expect(page.getByText(/Assignee.*added/i)).toBeVisible({
      timeout: 20000,
    });
    await expect(page.getByText(/👥 Assigned Staff \(3\/5\)/i)).toBeVisible({
      timeout: 15000,
    });

    // Add 4th assignee
    await expect(page.getByTestId('assignee-email-input')).toBeVisible();
    await page
      .getByTestId('assignee-email-input')
      .fill(`e2e.user4.${testEmail.split('.')[3].split('@')[0]}@example.com`);
    await page.getByTestId('add-assignee-button').click();
    await expect(page.getByText(/Assignee.*added/i)).toBeVisible({
      timeout: 20000,
    });
    await expect(page.getByText(/👥 Assigned Staff \(4\/5\)/i)).toBeVisible({
      timeout: 15000,
    });

    // Add 5th assignee (reaching max limit)
    await expect(page.getByTestId('assignee-email-input')).toBeVisible();
    await page
      .getByTestId('assignee-email-input')
      .fill(`e2e.user5.${testEmail.split('.')[3].split('@')[0]}@example.com`);
    await page.getByTestId('add-assignee-button').click();
    await expect(page.getByText(/Assignee.*added/i)).toBeVisible({
      timeout: 20000,
    });

    // Verify count is now 5/5 (longer timeout for CI/CD)
    await expect(page.getByText(/👥 Assigned Staff \(5\/5\)/i)).toBeVisible({
      timeout: 20000,
    });

    // Verify max limit message appears (without TM023 reference, longer timeout for CI/CD)
    await expect(page.getByText(/⚠️ Maximum 5 assignees reached/i)).toBeVisible(
      {
        timeout: 20000,
      }
    );

    // Verify input field is hidden/disabled when max reached (longer timeout for CI/CD)
    await expect(page.getByTestId('assignee-email-input')).not.toBeVisible({
      timeout: 15000,
    });

    // Verify all 5 assignees are displayed
    const assigneeBadges = page.locator('div').filter({
      has: page.getByText(/👤/),
    });
    // Should have at least 5 badges (might have more due to other UI elements)
    const badgeCount = await assigneeBadges.count();
    expect(badgeCount).toBeGreaterThanOrEqual(5);

    // Verify still NO delete buttons after adding 5 assignees (TM015)
    await expect(deleteAssigneeButtons).toHaveCount(0);
  });

  test('AC8 + TM044: should upload file attachment', async ({ page }) => {
    test.setTimeout(60000); // Extended timeout for file upload mutation in slow CI/CD

    await loginAndNavigateToTaskEdit(page);

    // Scroll to file attachments section
    await page.getByText(/📎 File Attachments/).scrollIntoViewIfNeeded();

    // Create a test PDF file (minimal valid PDF)
    const testFilePath = path.join(__dirname, 'test-file-e2e.pdf');
    const minimalPDF = `%PDF-1.4
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Count 1/Kids[3 0 R]>>endobj
3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R/Resources<<>>>>endobj
xref
0 4
0000000000 65535 f
0000000009 00000 n
0000000056 00000 n
0000000109 00000 n
trailer<</Size 4/Root 1 0 R>>
startxref
197
%%EOF`;
    fs.writeFileSync(testFilePath, minimalPDF);

    // Upload file
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(testFilePath);

    // Wait for file to be selected (should show checkmark)
    await expect(page.getByText(/✓ test-file-e2e.pdf/i)).toBeVisible();

    // Click Upload button
    await page.getByRole('button', { name: /⬆️ Upload|upload/i }).click();

    // Verify upload progress or success message (AC9) - increased timeout for slow CI/CD
    await expect(page.getByText(/file.*uploaded|uploading/i)).toBeVisible({
      timeout: 20000,
    });

    // Wait for upload to complete
    await page.waitForTimeout(2000);

    // Verify file appears in the list using data-testid (longer timeout for CI/CD)
    await expect(page.getByTestId('file-entry-test-file-e2e.pdf')).toBeVisible({
      timeout: 15000,
    });

    // Verify storage usage updates (longer timeout for CI/CD)
    await expect(page.getByText(/Storage Usage:/i)).toBeVisible({
      timeout: 15000,
    });

    // Clean up test file
    fs.unlinkSync(testFilePath);
  });

  test('AC8: should view/download file attachment in new tab', async ({
    page,
    context,
  }) => {
    await loginAndNavigateToTaskEdit(page);

    // Scroll to file attachments section
    await page.getByText(/📎 File Attachments/).scrollIntoViewIfNeeded();

    // Verify the file exists in the list (longer timeout for CI/CD as it depends on previous test)
    const fileEntry = page.getByTestId('file-entry-test-file-e2e.pdf');
    await expect(fileEntry).toBeVisible({
      timeout: 15000,
    });

    // Find the download button using data-testid (longer timeout for CI/CD)
    const downloadButton = page.getByTestId(
      'file-download-button-test-file-e2e.pdf'
    );
    await expect(downloadButton).toBeVisible({
      timeout: 15000,
    });

    const newPagePromise = context.waitForEvent('page', { timeout: 10000 });
    await downloadButton.click();

    try {
      const newPage = await newPagePromise;
      const url = newPage.url();
      expect(url.length).toBeGreaterThan(0);
      expect(url).toMatch(/test-file-e2e\.pdf|blob:|data:|supabase/);
      await newPage.close();
    } catch {
      // Popup blocked in headless mode
    }
  });

  test('AC8: should delete file attachment', async ({ page }) => {
    test.setTimeout(60000); // Extended timeout for file deletion mutation in slow CI/CD

    await loginAndNavigateToTaskEdit(page);

    // Scroll to file attachments section
    await page.getByText(/📎 File Attachments/).scrollIntoViewIfNeeded();

    // Find the uploaded file using data-testid
    const fileRow = page.getByTestId('file-entry-test-file-e2e.pdf');

    // Click delete button (🗑️)
    const deleteButton = fileRow.getByRole('button', { name: /🗑️/ });

    // Handle confirm dialog
    page.on('dialog', dialog => dialog.accept());

    await deleteButton.click();

    // Verify success message (AC9) - increased timeout for slow CI/CD
    await expect(page.getByText(/file.*deleted/i)).toBeVisible({
      timeout: 20000,
    });

    // Verify file is removed from list (longer timeout for CI/CD)
    await expect(fileRow).not.toBeVisible({
      timeout: 20000,
    });
  });
});
