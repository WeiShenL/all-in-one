/**
 * @jest-environment node
 *
 * Integration Tests for Recurring Task Functionality
 * Tests recurring task database operations with pgClient
 */

import { Client } from 'pg';

describe('Integration Tests - Recurring Tasks', () => {
  let pgClient: Client;
  let testDepartmentId: string;
  let testUserId1: string;
  let testUserId2: string;
  let testProjectId: string;
  const createdTaskIds: string[] = [];
  const createdTagIds: string[] = [];

  beforeAll(async () => {
    // Explicit pg connection like auth-api.test.ts
    pgClient = new Client({ connectionString: process.env.DATABASE_URL });
    await pgClient.connect();

    // Create test department
    const deptResult = await pgClient.query(
      `INSERT INTO "department" (id, name, "isActive", "createdAt", "updatedAt")
       VALUES (gen_random_uuid(), $1, true, NOW(), NOW())
       RETURNING id`,
      [`Recurring Test Dept ${Date.now()}`]
    );
    testDepartmentId = deptResult.rows[0].id;

    // Create test users
    const user1Result = await pgClient.query(
      `INSERT INTO "user_profile" (id, email, name, role, "departmentId", "isActive", "createdAt", "updatedAt")
       VALUES (gen_random_uuid(), $1, $2, $3, $4, true, NOW(), NOW())
       RETURNING id`,
      [
        `recurring.test1.${Date.now()}@example.com`,
        'Recurring Test User 1',
        'STAFF',
        testDepartmentId,
      ]
    );
    testUserId1 = user1Result.rows[0].id;

    const user2Result = await pgClient.query(
      `INSERT INTO "user_profile" (id, email, name, role, "departmentId", "isActive", "createdAt", "updatedAt")
       VALUES (gen_random_uuid(), $1, $2, $3, $4, true, NOW(), NOW())
       RETURNING id`,
      [
        `recurring.test2.${Date.now()}@example.com`,
        'Recurring Test User 2',
        'STAFF',
        testDepartmentId,
      ]
    );
    testUserId2 = user2Result.rows[0].id;

    // Create test project
    const projectResult = await pgClient.query(
      `INSERT INTO "project" (id, name, description, priority, status, "departmentId", "creatorId", "createdAt", "updatedAt")
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, NOW(), NOW())
       RETURNING id`,
      [
        `Recurring Test Project ${Date.now()}`,
        'Project for recurring task tests',
        5,
        'ACTIVE',
        testDepartmentId,
        testUserId1,
      ]
    );
    testProjectId = projectResult.rows[0].id;
  }, 60000);

  afterAll(async () => {
    // Cleanup in correct order
    if (createdTaskIds.length > 0) {
      await pgClient.query(
        `DELETE FROM "task_assignment" WHERE "taskId" = ANY($1)`,
        [createdTaskIds]
      );

      await pgClient.query(`DELETE FROM "task_tag" WHERE "taskId" = ANY($1)`, [
        createdTaskIds,
      ]);

      await pgClient.query(`DELETE FROM "task" WHERE id = ANY($1)`, [
        createdTaskIds,
      ]);
    }

    if (createdTagIds.length > 0) {
      await pgClient.query(`DELETE FROM "tag" WHERE id = ANY($1)`, [
        createdTagIds,
      ]);
    }

    if (testProjectId) {
      await pgClient.query(`DELETE FROM "project" WHERE id = $1`, [
        testProjectId,
      ]);
    }

    if (testUserId1) {
      await pgClient.query(`DELETE FROM "user_profile" WHERE id = $1`, [
        testUserId1,
      ]);
    }

    if (testUserId2) {
      await pgClient.query(`DELETE FROM "user_profile" WHERE id = $1`, [
        testUserId2,
      ]);
    }

    if (testDepartmentId) {
      await pgClient.query(`DELETE FROM "department" WHERE id = $1`, [
        testDepartmentId,
      ]);
    }

    await pgClient.end();
  }, 60000);

  describe('Recurring Task Database Operations', () => {
    it('should store recurring task with interval', async () => {
      const originalDueDate = new Date('2025-01-13T00:00:00.000Z');

      // Create recurring task with raw SQL
      const taskResult = await pgClient.query(
        `INSERT INTO "task" (id, title, description, priority, "dueDate", "ownerId", "departmentId", "projectId", "recurringInterval", status, "createdAt", "updatedAt")
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
         RETURNING *`,
        [
          'Weekly Status Report',
          'Submit weekly progress to manager',
          7,
          originalDueDate,
          testUserId1,
          testDepartmentId,
          testProjectId,
          7, // Weekly
          'TO_DO',
        ]
      );
      const task = taskResult.rows[0];
      createdTaskIds.push(task.id);

      expect(task.recurringInterval).toBe(7);
      expect(task.status).toBe('TO_DO');

      // Create assignments
      await pgClient.query(
        `INSERT INTO "task_assignment" ("taskId", "userId", "assignedById", "assignedAt")
         VALUES ($1, $2, $3, NOW()), ($1, $4, $3, NOW())`,
        [task.id, testUserId1, testUserId1, testUserId2]
      );

      // Verify assignments
      const assignmentsResult = await pgClient.query(
        `SELECT * FROM "task_assignment" WHERE "taskId" = $1`,
        [task.id]
      );
      expect(assignmentsResult.rows.length).toBe(2);
    }, 60000);

    it('should allow manual creation of next recurring instance with preserved properties', async () => {
      const originalDueDate = new Date('2025-02-01T00:00:00.000Z');

      // Create original recurring task
      const task1Result = await pgClient.query(
        `INSERT INTO "task" (id, title, description, priority, "dueDate", "ownerId", "departmentId", "projectId", "recurringInterval", status, "createdAt", "updatedAt")
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
         RETURNING *`,
        [
          'Monthly Report',
          'Monthly progress report',
          6,
          originalDueDate,
          testUserId1,
          testDepartmentId,
          testProjectId,
          30, // Monthly
          'TO_DO',
        ]
      );
      const task1 = task1Result.rows[0];
      createdTaskIds.push(task1.id);

      // Mark as completed
      await pgClient.query(`UPDATE "task" SET status = $1 WHERE id = $2`, [
        'COMPLETED',
        task1.id,
      ]);

      // Manually create next instance (simulating what TaskService would do)
      const nextDueDate = new Date(originalDueDate);
      nextDueDate.setDate(nextDueDate.getDate() + 30);

      const task2Result = await pgClient.query(
        `INSERT INTO "task" (id, title, description, priority, "dueDate", "ownerId", "departmentId", "projectId", "recurringInterval", status, "createdAt", "updatedAt")
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
         RETURNING *`,
        [
          task1.title,
          task1.description,
          task1.priority,
          nextDueDate,
          task1.ownerId,
          task1.departmentId,
          task1.projectId,
          task1.recurringInterval,
          'TO_DO',
        ]
      );
      const task2 = task2Result.rows[0];
      createdTaskIds.push(task2.id);

      // Verify properties preserved
      expect(task2.id).not.toBe(task1.id);
      expect(task2.title).toBe(task1.title);
      expect(task2.description).toBe(task1.description);
      expect(task2.priority).toBe(task1.priority);
      expect(task2.status).toBe('TO_DO');
      expect(task2.recurringInterval).toBe(30);
      expect(task2.dueDate.toISOString()).toBe(nextDueDate.toISOString());
    }, 60000);

    it('should preserve tags when creating next recurring instance', async () => {
      // Create tags
      const urgentTagResult = await pgClient.query(
        `INSERT INTO "tag" (id, name, "createdAt")
         VALUES (gen_random_uuid(), $1, NOW())
         RETURNING *`,
        [`recurring-urgent-${Date.now()}`]
      );
      const urgentTag = urgentTagResult.rows[0];
      createdTagIds.push(urgentTag.id);

      const reportTagResult = await pgClient.query(
        `INSERT INTO "tag" (id, name, "createdAt")
         VALUES (gen_random_uuid(), $1, NOW())
         RETURNING *`,
        [`recurring-report-${Date.now()}`]
      );
      const reportTag = reportTagResult.rows[0];
      createdTagIds.push(reportTag.id);

      // Create recurring task with tags
      const task1Result = await pgClient.query(
        `INSERT INTO "task" (id, title, description, priority, "dueDate", "ownerId", "departmentId", "recurringInterval", status, "createdAt", "updatedAt")
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
         RETURNING *`,
        [
          'Tagged Recurring Task',
          'Task with tags',
          6,
          new Date('2025-03-01T00:00:00.000Z'),
          testUserId1,
          testDepartmentId,
          30,
          'TO_DO',
        ]
      );
      const task1 = task1Result.rows[0];
      createdTaskIds.push(task1.id);

      // Link tags to task
      await pgClient.query(
        `INSERT INTO "task_tag" ("taskId", "tagId") VALUES ($1, $2), ($1, $3)`,
        [task1.id, urgentTag.id, reportTag.id]
      );

      // Get tags from original task
      const originalTagsResult = await pgClient.query(
        `SELECT "tagId" FROM "task_tag" WHERE "taskId" = $1`,
        [task1.id]
      );
      const originalTagIds = originalTagsResult.rows.map(r => r.tagId);

      // Mark as completed
      await pgClient.query(`UPDATE "task" SET status = $1 WHERE id = $2`, [
        'COMPLETED',
        task1.id,
      ]);

      // Create next instance
      const nextDueDate = new Date('2025-04-01T00:00:00.000Z');
      const task2Result = await pgClient.query(
        `INSERT INTO "task" (id, title, description, priority, "dueDate", "ownerId", "departmentId", "recurringInterval", status, "createdAt", "updatedAt")
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
         RETURNING *`,
        [
          task1.title,
          task1.description,
          task1.priority,
          nextDueDate,
          task1.ownerId,
          task1.departmentId,
          task1.recurringInterval,
          'TO_DO',
        ]
      );
      const task2 = task2Result.rows[0];
      createdTaskIds.push(task2.id);

      // Copy tags to next instance
      for (const tagId of originalTagIds) {
        await pgClient.query(
          `INSERT INTO "task_tag" ("taskId", "tagId") VALUES ($1, $2)`,
          [task2.id, tagId]
        );
      }

      // Verify tags preserved
      const nextTagsResult = await pgClient.query(
        `SELECT t.name FROM "task_tag" tt
         JOIN "tag" t ON tt."tagId" = t.id
         WHERE tt."taskId" = $1
         ORDER BY t.name`,
        [task2.id]
      );

      expect(nextTagsResult.rows.length).toBe(2);
      const tagNames = nextTagsResult.rows.map(r => r.name);
      expect(tagNames).toContain(urgentTag.name);
      expect(tagNames).toContain(reportTag.name);
    }, 60000);

    it('should support recurring subtasks', async () => {
      // Create parent task
      const parentResult = await pgClient.query(
        `INSERT INTO "task" (id, title, description, priority, "dueDate", "ownerId", "departmentId", status, "createdAt", "updatedAt")
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
         RETURNING *`,
        [
          'Parent Project Task',
          'Parent task',
          8,
          new Date('2025-03-31T00:00:00.000Z'),
          testUserId1,
          testDepartmentId,
          'TO_DO',
        ]
      );
      const parentTask = parentResult.rows[0];
      createdTaskIds.push(parentTask.id);

      // Create recurring subtask
      const subtask1Result = await pgClient.query(
        `INSERT INTO "task" (id, title, description, priority, "dueDate", "ownerId", "departmentId", "parentTaskId", "recurringInterval", status, "createdAt", "updatedAt")
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
         RETURNING *`,
        [
          'Weekly Progress Update',
          'Update parent task progress weekly',
          5,
          new Date('2025-03-07T00:00:00.000Z'),
          testUserId1,
          testDepartmentId,
          parentTask.id,
          7,
          'TO_DO',
        ]
      );
      const subtask1 = subtask1Result.rows[0];
      createdTaskIds.push(subtask1.id);

      expect(subtask1.parentTaskId).toBe(parentTask.id);
      expect(subtask1.recurringInterval).toBe(7);

      // Mark subtask as completed
      await pgClient.query(`UPDATE "task" SET status = $1 WHERE id = $2`, [
        'COMPLETED',
        subtask1.id,
      ]);

      // Create next subtask instance
      const nextDueDate = new Date('2025-03-14T00:00:00.000Z');
      const subtask2Result = await pgClient.query(
        `INSERT INTO "task" (id, title, description, priority, "dueDate", "ownerId", "departmentId", "parentTaskId", "recurringInterval", status, "createdAt", "updatedAt")
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
         RETURNING *`,
        [
          subtask1.title,
          subtask1.description,
          subtask1.priority,
          nextDueDate,
          subtask1.ownerId,
          subtask1.departmentId,
          subtask1.parentTaskId,
          subtask1.recurringInterval,
          'TO_DO',
        ]
      );
      const subtask2 = subtask2Result.rows[0];
      createdTaskIds.push(subtask2.id);

      // Verify it's still a subtask of the same parent
      expect(subtask2.parentTaskId).toBe(parentTask.id);
      expect(subtask2.recurringInterval).toBe(7);
      expect(subtask2.dueDate.toISOString()).toBe(nextDueDate.toISOString());
    }, 60000);

    it('should handle non-recurring tasks correctly', async () => {
      // Create one-time task (no recurringInterval)
      const taskResult = await pgClient.query(
        `INSERT INTO "task" (id, title, description, priority, "dueDate", "ownerId", "departmentId", status, "createdAt", "updatedAt")
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
         RETURNING *`,
        [
          'One-Time Task',
          'This should not recur',
          5,
          new Date('2025-04-01T00:00:00.000Z'),
          testUserId1,
          testDepartmentId,
          'TO_DO',
        ]
      );
      const task = taskResult.rows[0];
      createdTaskIds.push(task.id);

      expect(task.recurringInterval).toBeNull();

      // Complete the task
      await pgClient.query(`UPDATE "task" SET status = $1 WHERE id = $2`, [
        'COMPLETED',
        task.id,
      ]);

      // Verify task is completed (and stays as a single task)
      const taskCheck = await pgClient.query(
        `SELECT * FROM "task" WHERE id = $1`,
        [task.id]
      );
      expect(taskCheck.rows[0].status).toBe('COMPLETED');
      expect(taskCheck.rows[0].recurringInterval).toBeNull();
    }, 60000);

    it('should allow multiple recurring instances (chaining)', async () => {
      // Create first recurring task
      const task1Result = await pgClient.query(
        `INSERT INTO "task" (id, title, description, priority, "dueDate", "ownerId", "departmentId", "recurringInterval", status, "createdAt", "updatedAt")
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
         RETURNING *`,
        [
          'Daily Standup',
          'Daily team standup',
          3,
          new Date('2025-06-01T00:00:00.000Z'),
          testUserId1,
          testDepartmentId,
          1,
          'TO_DO',
        ]
      );
      const task1 = task1Result.rows[0];
      createdTaskIds.push(task1.id);

      // Complete first instance
      await pgClient.query(`UPDATE "task" SET status = $1 WHERE id = $2`, [
        'COMPLETED',
        task1.id,
      ]);

      // Create second instance
      const task2Result = await pgClient.query(
        `INSERT INTO "task" (id, title, description, priority, "dueDate", "ownerId", "departmentId", "recurringInterval", status, "createdAt", "updatedAt")
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
         RETURNING *`,
        [
          task1.title,
          task1.description,
          task1.priority,
          new Date('2025-06-02T00:00:00.000Z'),
          task1.ownerId,
          task1.departmentId,
          task1.recurringInterval,
          'TO_DO',
        ]
      );
      const task2 = task2Result.rows[0];
      createdTaskIds.push(task2.id);

      expect(task2.dueDate.toISOString()).toBe(
        new Date('2025-06-02T00:00:00.000Z').toISOString()
      );

      // Complete second instance
      await pgClient.query(`UPDATE "task" SET status = $1 WHERE id = $2`, [
        'COMPLETED',
        task2.id,
      ]);

      // Create third instance
      const task3Result = await pgClient.query(
        `INSERT INTO "task" (id, title, description, priority, "dueDate", "ownerId", "departmentId", "recurringInterval", status, "createdAt", "updatedAt")
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
         RETURNING *`,
        [
          task1.title,
          task1.description,
          task1.priority,
          new Date('2025-06-03T00:00:00.000Z'),
          task1.ownerId,
          task1.departmentId,
          task1.recurringInterval,
          'TO_DO',
        ]
      );
      const task3 = task3Result.rows[0];
      createdTaskIds.push(task3.id);

      expect(task3.dueDate.toISOString()).toBe(
        new Date('2025-06-03T00:00:00.000Z').toISOString()
      );
      expect(task3.recurringInterval).toBe(1);

      // Verify all three tasks exist with correct statuses
      const allTasksResult = await pgClient.query(
        `SELECT * FROM "task" WHERE title = $1 AND "ownerId" = $2 ORDER BY "createdAt" ASC`,
        ['Daily Standup', testUserId1]
      );

      expect(allTasksResult.rows.length).toBe(3);
      expect(allTasksResult.rows[0].status).toBe('COMPLETED');
      expect(allTasksResult.rows[1].status).toBe('COMPLETED');
      expect(allTasksResult.rows[2].status).toBe('TO_DO');
    }, 60000);

    it('should preserve assignees when creating next recurring instance', async () => {
      // Create recurring task
      const task1Result = await pgClient.query(
        `INSERT INTO "task" (id, title, description, priority, "dueDate", "ownerId", "departmentId", "recurringInterval", status, "createdAt", "updatedAt")
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
         RETURNING *`,
        [
          'Team Review',
          'Weekly team review',
          5,
          new Date('2025-07-01T00:00:00.000Z'),
          testUserId1,
          testDepartmentId,
          7,
          'TO_DO',
        ]
      );
      const task1 = task1Result.rows[0];
      createdTaskIds.push(task1.id);

      // Create assignments
      await pgClient.query(
        `INSERT INTO "task_assignment" ("taskId", "userId", "assignedById", "assignedAt")
         VALUES ($1, $2, $3, NOW()), ($1, $4, $3, NOW())`,
        [task1.id, testUserId1, testUserId1, testUserId2]
      );

      // Get assignments from original task
      const originalAssignmentsResult = await pgClient.query(
        `SELECT "userId", "assignedById" FROM "task_assignment" WHERE "taskId" = $1`,
        [task1.id]
      );

      // Complete task
      await pgClient.query(`UPDATE "task" SET status = $1 WHERE id = $2`, [
        'COMPLETED',
        task1.id,
      ]);

      // Create next instance
      const task2Result = await pgClient.query(
        `INSERT INTO "task" (id, title, description, priority, "dueDate", "ownerId", "departmentId", "recurringInterval", status, "createdAt", "updatedAt")
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
         RETURNING *`,
        [
          task1.title,
          task1.description,
          task1.priority,
          new Date('2025-07-08T00:00:00.000Z'),
          task1.ownerId,
          task1.departmentId,
          task1.recurringInterval,
          'TO_DO',
        ]
      );
      const task2 = task2Result.rows[0];
      createdTaskIds.push(task2.id);

      // Copy assignments to next instance
      for (const assignment of originalAssignmentsResult.rows) {
        await pgClient.query(
          `INSERT INTO "task_assignment" ("taskId", "userId", "assignedById", "assignedAt")
           VALUES ($1, $2, $3, NOW())`,
          [task2.id, assignment.userId, assignment.assignedById]
        );
      }

      // Verify assignments preserved
      const nextAssignmentsResult = await pgClient.query(
        `SELECT "userId" FROM "task_assignment" WHERE "taskId" = $1 ORDER BY "userId"`,
        [task2.id]
      );

      expect(nextAssignmentsResult.rows.length).toBe(2);
      const assigneeIds = nextAssignmentsResult.rows.map(r => r.userId);
      expect(assigneeIds).toEqual([testUserId1, testUserId2].sort());
    }, 60000);
  });
});
