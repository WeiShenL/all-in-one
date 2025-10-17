/**
 * @jest-environment node
 *
 * Integration Tests for Personal Calendar
 *
 * Tests the personal calendar task fetching with real database operations:
 * - Personal task viewing (CIT001)
 * - Tasks assigned to user only
 * - Recurring task handling
 * - Completed task visibility
 *
 * Test Coverage:
 * - AC: Personal calendar displays ONLY tasks assigned to the user
 * - AC: Completed tasks are visible with visual distinction
 * - AC: Recurring tasks show future occurrences correctly
 */

import { Client } from 'pg';
import { TaskService } from '@/app/server/services/TaskService';
import { PrismaClient } from '@prisma/client';

describe('Integration Tests - Personal Calendar', () => {
  let pgClient: Client;
  let prisma: PrismaClient;
  let taskService: TaskService;

  // Test data IDs
  let deptId: string;
  let user1Id: string; // Primary user
  let user2Id: string; // Other user
  let managerId: string;

  // Track created tasks for cleanup
  const createdTaskIds: string[] = [];

  beforeAll(async () => {
    // Connect to database
    pgClient = new Client({ connectionString: process.env.DATABASE_URL });
    await pgClient.connect();

    // Initialize Prisma client and service
    prisma = new PrismaClient();
    taskService = new TaskService(prisma);

    // Clean up any leftover test data from previous failed runs
    await pgClient.query(
      `DELETE FROM "task_assignment" WHERE "assignedById" IN (
        SELECT id FROM "user_profile" WHERE email LIKE '%@personalcal.test.com'
      )`
    );
    await pgClient.query(
      `DELETE FROM "task" WHERE "ownerId" IN (
        SELECT id FROM "user_profile" WHERE email LIKE '%@personalcal.test.com'
      )`
    );
    await pgClient.query(
      `DELETE FROM "user_profile" WHERE email LIKE '%@personalcal.test.com'`
    );
    await pgClient.query(
      `DELETE FROM "department" WHERE name = 'Personal Calendar Test Dept'`
    );

    // Create test department
    const deptResult = await pgClient.query(
      `INSERT INTO "department" (id, name, "isActive", "createdAt", "updatedAt")
       VALUES (gen_random_uuid(), $1, true, NOW(), NOW())
       RETURNING id`,
      ['Personal Calendar Test Dept']
    );
    deptId = deptResult.rows[0].id;

    // Create manager
    const managerResult = await pgClient.query(
      `INSERT INTO "user_profile" (id, email, name, role, "departmentId", "isActive", "createdAt", "updatedAt")
       VALUES (gen_random_uuid(), $1, $2, $3, $4, true, NOW(), NOW())
       RETURNING id`,
      ['manager@personalcal.test.com', 'Test Manager', 'MANAGER', deptId]
    );
    managerId = managerResult.rows[0].id;

    // Create user1 (primary test user)
    const user1Result = await pgClient.query(
      `INSERT INTO "user_profile" (id, email, name, role, "departmentId", "isActive", "createdAt", "updatedAt")
       VALUES (gen_random_uuid(), $1, $2, $3, $4, true, NOW(), NOW())
       RETURNING id`,
      ['user1@personalcal.test.com', 'User One', 'STAFF', deptId]
    );
    user1Id = user1Result.rows[0].id;

    // Create user2 (other user)
    const user2Result = await pgClient.query(
      `INSERT INTO "user_profile" (id, email, name, role, "departmentId", "isActive", "createdAt", "updatedAt")
       VALUES (gen_random_uuid(), $1, $2, $3, $4, true, NOW(), NOW())
       RETURNING id`,
      ['user2@personalcal.test.com', 'User Two', 'STAFF', deptId]
    );
    user2Id = user2Result.rows[0].id;
  });

  afterAll(async () => {
    // Clean up in proper order to avoid foreign key constraint violations

    // 1. Delete task assignments first
    await pgClient.query(
      `DELETE FROM "task_assignment" WHERE "assignedById" IN (
        SELECT id FROM "user_profile" WHERE email LIKE '%@personalcal.test.com'
      )`
    );

    // 2. Delete created tasks
    if (createdTaskIds.length > 0) {
      await pgClient.query(`DELETE FROM "task" WHERE id = ANY($1::uuid[])`, [
        createdTaskIds,
      ]);
    }

    // 3. Delete all tasks related to test users
    await pgClient.query(
      `DELETE FROM "task" WHERE "ownerId" IN (
        SELECT id FROM "user_profile" WHERE email LIKE '%@personalcal.test.com'
      )`
    );

    // 4. Clean up test users
    await pgClient.query(
      `DELETE FROM "user_profile" WHERE email LIKE '%@personalcal.test.com'`
    );

    // 5. Clean up test department
    await pgClient.query(
      `DELETE FROM "department" WHERE name = 'Personal Calendar Test Dept'`
    );

    await pgClient.end();
    await prisma.$disconnect();
  });

  afterEach(() => {
    // Clear the task IDs array after each test cleanup
    createdTaskIds.length = 0;
  });

  describe('Personal Task Fetching (CIT001)', () => {
    it('should fetch only tasks assigned to the authenticated user', async () => {
      // Create task assigned to user1
      const task1Result = await pgClient.query(
        `INSERT INTO "task" (id, title, description, priority, "dueDate", status, "ownerId", "departmentId", "isArchived", "createdAt", "updatedAt")
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, false, NOW(), NOW())
         RETURNING id`,
        [
          'User1 Task',
          'Assigned to user1',
          5,
          new Date('2025-12-31'),
          'TO_DO',
          managerId,
          deptId,
        ]
      );
      const task1Id = task1Result.rows[0].id;
      createdTaskIds.push(task1Id);

      // Assign to user1
      await pgClient.query(
        `INSERT INTO "task_assignment" ("taskId", "userId", "assignedById", "assignedAt")
         VALUES ($1, $2, $3, NOW())`,
        [task1Id, user1Id, managerId]
      );

      // Create task assigned to user2 (should NOT appear for user1)
      const task2Result = await pgClient.query(
        `INSERT INTO "task" (id, title, description, priority, "dueDate", status, "ownerId", "departmentId", "isArchived", "createdAt", "updatedAt")
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, false, NOW(), NOW())
         RETURNING id`,
        [
          'User2 Task',
          'Assigned to user2 only',
          5,
          new Date('2025-12-31'),
          'TO_DO',
          managerId,
          deptId,
        ]
      );
      const task2Id = task2Result.rows[0].id;
      createdTaskIds.push(task2Id);

      // Assign to user2
      await pgClient.query(
        `INSERT INTO "task_assignment" ("taskId", "userId", "assignedById", "assignedAt")
         VALUES ($1, $2, $3, NOW())`,
        [task2Id, user2Id, managerId]
      );

      // Get tasks for user1
      const user1Tasks = await taskService.getByAssignee(user1Id);

      // Verify only user1's tasks are returned
      expect(user1Tasks).toBeDefined();
      const user1TaskIds = user1Tasks!.map((t: any) => t.id);
      expect(user1TaskIds).toContain(task1Id);
      expect(user1TaskIds).not.toContain(task2Id);
    }, 15000);

    it('should not return tasks assigned to other users', async () => {
      // Create multiple tasks for user2
      for (let i = 1; i <= 3; i++) {
        const taskResult = await pgClient.query(
          `INSERT INTO "task" (id, title, description, priority, "dueDate", status, "ownerId", "departmentId", "isArchived", "createdAt", "updatedAt")
           VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, false, NOW(), NOW())
           RETURNING id`,
          [
            `User2 Task ${i}`,
            'Should not appear for user1',
            5,
            new Date('2025-12-31'),
            'TO_DO',
            managerId,
            deptId,
          ]
        );
        const taskId = taskResult.rows[0].id;
        createdTaskIds.push(taskId);

        // Assign to user2
        await pgClient.query(
          `INSERT INTO "task_assignment" ("taskId", "userId", "assignedById", "assignedAt")
           VALUES ($1, $2, $3, NOW())`,
          [taskId, user2Id, managerId]
        );
      }

      // Get tasks for user1
      const user1Tasks = await taskService.getByAssignee(user1Id);

      // Verify none of user2's tasks appear
      const user1TaskTitles = user1Tasks!.map((t: any) => t.title);
      expect(user1TaskTitles).not.toContain('User2 Task 1');
      expect(user1TaskTitles).not.toContain('User2 Task 2');
      expect(user1TaskTitles).not.toContain('User2 Task 3');
    }, 15000);

    it('should include task details needed for calendar display', async () => {
      // Create task with all details
      const taskResult = await pgClient.query(
        `INSERT INTO "task" (id, title, description, priority, "dueDate", status, "ownerId", "departmentId", "isArchived", "recurringInterval", "createdAt", "updatedAt")
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, false, 7, NOW(), NOW())
         RETURNING id`,
        [
          'Detailed Task',
          'Task with full details',
          8,
          new Date('2025-12-31'),
          'IN_PROGRESS',
          managerId,
          deptId,
        ]
      );
      const taskId = taskResult.rows[0].id;
      createdTaskIds.push(taskId);

      // Assign to user1
      await pgClient.query(
        `INSERT INTO "task_assignment" ("taskId", "userId", "assignedById", "assignedAt")
         VALUES ($1, $2, $3, NOW())`,
        [taskId, user1Id, managerId]
      );

      // Get tasks
      const tasks = await taskService.getByAssignee(user1Id);
      const task = tasks!.find((t: any) => t.id === taskId);

      // Verify calendar-required fields
      expect(task).toBeDefined();
      expect(task!.id).toBeDefined();
      expect(task!.title).toBe('Detailed Task');
      expect(task!.description).toBe('Task with full details');
      expect(task!.priority).toBe(8);
      expect(task!.dueDate).toBeDefined();
      expect(task!.status).toBe('IN_PROGRESS');
      expect(task!.owner).toBeDefined();
      expect(task!.department).toBeDefined();
      expect(task!.recurringInterval).toBe(7);
    }, 15000);
  });

  describe('Completed Task Visibility (CIT006)', () => {
    it('should show completed tasks on personal calendar', async () => {
      // Create completed task
      const taskResult = await pgClient.query(
        `INSERT INTO "task" (id, title, description, priority, "dueDate", status, "ownerId", "departmentId", "isArchived", "createdAt", "updatedAt")
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, false, NOW(), NOW())
         RETURNING id`,
        [
          'Completed Task',
          'Task that is done',
          5,
          new Date('2025-10-15'),
          'COMPLETED',
          managerId,
          deptId,
        ]
      );
      const taskId = taskResult.rows[0].id;
      createdTaskIds.push(taskId);

      // Assign to user1
      await pgClient.query(
        `INSERT INTO "task_assignment" ("taskId", "userId", "assignedById", "assignedAt")
         VALUES ($1, $2, $3, NOW())`,
        [taskId, user1Id, managerId]
      );

      // Get tasks
      const tasks = await taskService.getByAssignee(user1Id);

      // Verify completed task is included
      const completedTask = tasks!.find((t: any) => t.id === taskId);
      expect(completedTask).toBeDefined();
      expect(completedTask!.status).toBe('COMPLETED');
    }, 15000);

    it('should include status field for visual distinction of completed tasks', async () => {
      // Create mix of tasks with different statuses
      const statuses = ['TO_DO', 'IN_PROGRESS', 'COMPLETED', 'BLOCKED'];

      for (const status of statuses) {
        const taskResult = await pgClient.query(
          `INSERT INTO "task" (id, title, description, priority, "dueDate", status, "ownerId", "departmentId", "isArchived", "createdAt", "updatedAt")
           VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, false, NOW(), NOW())
           RETURNING id`,
          [
            `${status} Task`,
            `Task with ${status} status`,
            5,
            new Date('2025-12-31'),
            status,
            managerId,
            deptId,
          ]
        );
        const taskId = taskResult.rows[0].id;
        createdTaskIds.push(taskId);

        // Assign to user1
        await pgClient.query(
          `INSERT INTO "task_assignment" ("taskId", "userId", "assignedById", "assignedAt")
           VALUES ($1, $2, $3, NOW())`,
          [taskId, user1Id, managerId]
        );
      }

      // Get tasks
      const tasks = await taskService.getByAssignee(user1Id);

      // Verify all statuses are present
      const taskStatuses = tasks!.map((t: any) => t.status);
      expect(taskStatuses).toContain('TO_DO');
      expect(taskStatuses).toContain('IN_PROGRESS');
      expect(taskStatuses).toContain('COMPLETED');
      expect(taskStatuses).toContain('BLOCKED');
    }, 15000);
  });

  describe('Recurring Task Handling (CIT007)', () => {
    it('should include recurring task metadata', async () => {
      // Create recurring task
      const taskResult = await pgClient.query(
        `INSERT INTO "task" (id, title, description, priority, "dueDate", status, "ownerId", "departmentId", "isArchived", "recurringInterval", "createdAt", "updatedAt")
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, false, 7, NOW(), NOW())
         RETURNING id`,
        [
          'Weekly Standup',
          'Recurring weekly meeting',
          5,
          new Date('2025-12-31'),
          'TO_DO',
          managerId,
          deptId,
        ]
      );
      const taskId = taskResult.rows[0].id;
      createdTaskIds.push(taskId);

      // Assign to user1
      await pgClient.query(
        `INSERT INTO "task_assignment" ("taskId", "userId", "assignedById", "assignedAt")
         VALUES ($1, $2, $3, NOW())`,
        [taskId, user1Id, managerId]
      );

      // Get tasks
      const tasks = await taskService.getByAssignee(user1Id);
      const recurringTask = tasks!.find((t: any) => t.id === taskId);

      // Verify recurring metadata is present
      expect(recurringTask).toBeDefined();
      expect(recurringTask!.recurringInterval).toBe(7);
    }, 15000);

    it('should handle non-recurring tasks correctly', async () => {
      // Create non-recurring task
      const taskResult = await pgClient.query(
        `INSERT INTO "task" (id, title, description, priority, "dueDate", status, "ownerId", "departmentId", "isArchived", "createdAt", "updatedAt")
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, false, NOW(), NOW())
         RETURNING id`,
        [
          'One-time Task',
          'Single occurrence',
          5,
          new Date('2025-12-31'),
          'TO_DO',
          managerId,
          deptId,
        ]
      );
      const taskId = taskResult.rows[0].id;
      createdTaskIds.push(taskId);

      // Assign to user1
      await pgClient.query(
        `INSERT INTO "task_assignment" ("taskId", "userId", "assignedById", "assignedAt")
         VALUES ($1, $2, $3, NOW())`,
        [taskId, user1Id, managerId]
      );

      // Get tasks
      const tasks = await taskService.getByAssignee(user1Id);
      const oneTimeTask = tasks!.find((t: any) => t.id === taskId);

      // Verify non-recurring task
      expect(oneTimeTask).toBeDefined();
      expect(oneTimeTask!.recurringInterval).toBeNull();
    }, 15000);
  });

  describe('Edge Cases', () => {
    it('should handle empty results when user has no assignments', async () => {
      // Create new user with no tasks
      const newUserResult = await pgClient.query(
        `INSERT INTO "user_profile" (id, email, name, role, "departmentId", "isActive", "createdAt", "updatedAt")
         VALUES (gen_random_uuid(), $1, $2, $3, $4, true, NOW(), NOW())
         RETURNING id`,
        ['newuser@personalcal.test.com', 'New User', 'STAFF', deptId]
      );
      const newUserId = newUserResult.rows[0].id;

      // Get tasks
      const tasks = await taskService.getByAssignee(newUserId);

      // Verify empty result
      expect(tasks).toBeDefined();
      expect(tasks!.length).toBe(0);
    }, 15000);

    it('should not return archived tasks', async () => {
      // Create archived task
      const taskResult = await pgClient.query(
        `INSERT INTO "task" (id, title, description, priority, "dueDate", status, "ownerId", "departmentId", "isArchived", "createdAt", "updatedAt")
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, true, NOW(), NOW())
         RETURNING id`,
        [
          'Archived Task',
          'Should not appear',
          5,
          new Date('2025-12-31'),
          'COMPLETED',
          managerId,
          deptId,
        ]
      );
      const archivedTaskId = taskResult.rows[0].id;
      createdTaskIds.push(archivedTaskId);

      // Assign to user1
      await pgClient.query(
        `INSERT INTO "task_assignment" ("taskId", "userId", "assignedById", "assignedAt")
         VALUES ($1, $2, $3, NOW())`,
        [archivedTaskId, user1Id, managerId]
      );

      // Get tasks
      const tasks = await taskService.getByAssignee(user1Id);

      // Verify archived task is not included
      const archivedTask = tasks!.find((t: any) => t.id === archivedTaskId);
      expect(archivedTask).toBeUndefined();
    }, 15000);
  });
});
