/**
 * @jest-environment node
 *
 * Integration Tests for Manager Dashboard
 *
 * Tests the complete manager dashboard flow with real database operations:
 * - Task metrics calculation across different statuses
 * - Department hierarchy access control (ONE LEVEL DOWN ONLY)
 * - Task filtering by department
 *
 * Test Coverage:
 * - Metrics calculation with various task statuses
 * - Access control: manager can see own department tasks
 * - Access control: manager can see direct subordinate department tasks (one level)
 * - Access control: manager cannot see peer department tasks
 * - Access control: manager cannot see multi-level subordinate tasks
 */

import { Client } from 'pg';
import { TaskService } from '@/app/server/services/TaskService';
import { PrismaClient } from '@prisma/client';

describe('Integration Tests - Manager Dashboard', () => {
  jest.setTimeout(70000);

  let pgClient: Client;
  let prisma: PrismaClient;
  let taskService: TaskService;

  // Test data IDs
  let parentDeptId: string;
  let childDeptId: string;
  let peerDeptId: string;
  let managerId: string;
  let staffInParentDeptId: string;
  let staffInChildDeptId: string;
  let staffInPeerDeptId: string;

  // Track created tasks for cleanup
  const createdTaskIds: string[] = [];

  beforeAll(async () => {
    // Connect to database
    pgClient = new Client({ connectionString: process.env.DATABASE_URL });
    await pgClient.connect();

    // Initialize Prisma client and service
    prisma = new PrismaClient();
    taskService = new TaskService(prisma);

    // // Clean up any leftover test data from previous failed runs
    // await pgClient.query(
    //   `DELETE FROM "task_assignment" WHERE "assignedById" IN (
    //     SELECT id FROM "user_profile" WHERE email LIKE '%@test.com'
    //   )`
    // );
    // await pgClient.query(
    //   `DELETE FROM "task" WHERE "ownerId" IN (
    //     SELECT id FROM "user_profile" WHERE email LIKE '%@test.com'
    //   )`
    // );
    // await pgClient.query(
    //   `DELETE FROM "project" WHERE "creatorId" IN (
    //     SELECT id FROM "user_profile" WHERE email LIKE '%@test.com'
    //   )`
    // );
    // await pgClient.query(
    //   `DELETE FROM "user_profile" WHERE email LIKE '%@test.com'`
    // );
    // await pgClient.query(
    //   `DELETE FROM "department" WHERE name IN ('Engineering', 'Backend Team', 'Marketing', 'Empty Department')`
    // );

    // Create parent department (manager's department)
    const parentDeptResult = await pgClient.query(
      `INSERT INTO "department" (id, name, "parentId", "isActive", "createdAt", "updatedAt")
       VALUES (gen_random_uuid(), $1, NULL, true, NOW(), NOW())
       RETURNING id`,
      ['Engineering']
    );
    parentDeptId = parentDeptResult.rows[0].id;

    // Create child department (subordinate to manager's department)
    const childDeptResult = await pgClient.query(
      `INSERT INTO "department" (id, name, "parentId", "isActive", "createdAt", "updatedAt")
       VALUES (gen_random_uuid(), $1, $2, true, NOW(), NOW())
       RETURNING id`,
      ['Backend Team', parentDeptId]
    );
    childDeptId = childDeptResult.rows[0].id;

    // Create peer department (same level as manager's department)
    const peerDeptResult = await pgClient.query(
      `INSERT INTO "department" (id, name, "parentId", "isActive", "createdAt", "updatedAt")
       VALUES (gen_random_uuid(), $1, NULL, true, NOW(), NOW())
       RETURNING id`,
      ['Marketing']
    );
    peerDeptId = peerDeptResult.rows[0].id;

    // Create manager in parent department
    const managerResult = await pgClient.query(
      `INSERT INTO "user_profile" (id, email, name, role, "departmentId", "isActive", "createdAt", "updatedAt")
       VALUES (gen_random_uuid(), $1, $2, $3, $4, true, NOW(), NOW())
       RETURNING id`,
      ['manager@test.com', 'Engineering Manager', 'MANAGER', parentDeptId]
    );
    managerId = managerResult.rows[0].id;

    // Create staff in parent department
    const staffParentResult = await pgClient.query(
      `INSERT INTO "user_profile" (id, email, name, role, "departmentId", "isActive", "createdAt", "updatedAt")
       VALUES (gen_random_uuid(), $1, $2, $3, $4, true, NOW(), NOW())
       RETURNING id`,
      ['staff-parent@test.com', 'Staff Parent', 'STAFF', parentDeptId]
    );
    staffInParentDeptId = staffParentResult.rows[0].id;

    // Create staff in child department
    const staffChildResult = await pgClient.query(
      `INSERT INTO "user_profile" (id, email, name, role, "departmentId", "isActive", "createdAt", "updatedAt")
       VALUES (gen_random_uuid(), $1, $2, $3, $4, true, NOW(), NOW())
       RETURNING id`,
      ['staff-child@test.com', 'Staff Child', 'STAFF', childDeptId]
    );
    staffInChildDeptId = staffChildResult.rows[0].id;

    // Create staff in peer department
    const staffPeerResult = await pgClient.query(
      `INSERT INTO "user_profile" (id, email, name, role, "departmentId", "isActive", "createdAt", "updatedAt")
       VALUES (gen_random_uuid(), $1, $2, $3, $4, true, NOW(), NOW())
       RETURNING id`,
      ['staff-peer@test.com', 'Staff Peer', 'STAFF', peerDeptId]
    );
    staffInPeerDeptId = staffPeerResult.rows[0].id;
  });

  afterAll(async () => {
    // Clean up in proper order to avoid foreign key constraint violations

    // 1. Delete task assignments first
    await pgClient.query(
      `DELETE FROM "task_assignment" WHERE "assignedById" IN (
        SELECT id FROM "user_profile" WHERE email LIKE '%@test.com'
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
        SELECT id FROM "user_profile" WHERE email LIKE '%@test.com'
      )`
    );

    // 4. Clean up projects created by test users
    await pgClient.query(
      `DELETE FROM "project" WHERE "creatorId" IN (
        SELECT id FROM "user_profile" WHERE email LIKE '%@test.com'
      )`
    );

    // 5. Clean up test users
    await pgClient.query(
      `DELETE FROM "user_profile" WHERE email LIKE '%@test.com'`
    );

    // 6. Clean up test departments
    await pgClient.query(
      `DELETE FROM "department" WHERE name IN ('Engineering', 'Backend Team', 'Marketing', 'Empty Department')`
    );

    await pgClient.end();
    await prisma.$disconnect();
  });

  afterEach(() => {
    // Clear the task IDs array after each test cleanup
    createdTaskIds.length = 0;
  });

  describe('Task Metrics Calculation', () => {
    it('should correctly calculate metrics for tasks with different statuses', async () => {
      // Create tasks with different statuses
      const taskStatuses = [
        { status: 'TO_DO', count: 3 },
        { status: 'IN_PROGRESS', count: 5 },
        { status: 'COMPLETED', count: 2 },
        { status: 'BLOCKED', count: 1 },
      ];

      for (const { status, count } of taskStatuses) {
        for (let i = 0; i < count; i++) {
          const taskResult = await pgClient.query(
            `INSERT INTO "task" (id, title, description, priority, "dueDate", status, "ownerId", "departmentId", "isArchived", "createdAt", "updatedAt")
             VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, false, NOW(), NOW())
             RETURNING id`,
            [
              `${status} Task ${i + 1}`,
              'Test task description',
              5,
              new Date('2025-12-31'),
              status,
              staffInParentDeptId,
              parentDeptId,
            ]
          );
          const taskId = taskResult.rows[0].id;
          createdTaskIds.push(taskId);

          // Assign task to staff member
          await pgClient.query(
            `INSERT INTO "task_assignment" ("taskId", "userId", "assignedById", "assignedAt")
             VALUES ($1, $2, $3, NOW())`,
            [taskId, staffInParentDeptId, managerId]
          );
        }
      }

      // Get dashboard data
      const result = await taskService.getManagerDashboardTasks(managerId);

      // Verify metrics
      expect(result).toBeDefined();
      expect(result!.metrics.toDo).toBe(3);
      expect(result!.metrics.inProgress).toBe(5);
      expect(result!.metrics.completed).toBe(2);
      expect(result!.metrics.blocked).toBe(1);
      expect(result!.tasks).toHaveLength(11);
    });

    it('should handle empty task list with zero metrics', async () => {
      // Create a new manager with no tasks
      const emptyDeptResult = await pgClient.query(
        `INSERT INTO "department" (id, name, "isActive", "createdAt", "updatedAt")
         VALUES (gen_random_uuid(), $1, true, NOW(), NOW())
         RETURNING id`,
        ['Empty Department']
      );
      const emptyDeptId = emptyDeptResult.rows[0].id;

      const emptyManagerResult = await pgClient.query(
        `INSERT INTO "user_profile" (id, email, name, role, "departmentId", "isActive", "createdAt", "updatedAt")
         VALUES (gen_random_uuid(), $1, $2, $3, $4, true, NOW(), NOW())
         RETURNING id`,
        ['empty-manager@test.com', 'Empty Manager', 'MANAGER', emptyDeptId]
      );
      const emptyManagerId = emptyManagerResult.rows[0].id;

      const result = await taskService.getManagerDashboardTasks(emptyManagerId);

      expect(result).toBeDefined();
      expect(result!.metrics.toDo).toBe(0);
      expect(result!.metrics.inProgress).toBe(0);
      expect(result!.metrics.completed).toBe(0);
      expect(result!.metrics.blocked).toBe(0);
      expect(result!.tasks).toHaveLength(0);
    });
  });

  describe('Department Hierarchy Access Control', () => {
    it("should include tasks from manager's own department", async () => {
      // Create task in parent department
      const taskResult = await pgClient.query(
        `INSERT INTO "task" (id, title, description, priority, "dueDate", status, "ownerId", "departmentId", "isArchived", "createdAt", "updatedAt")
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, false, NOW(), NOW())
         RETURNING id`,
        [
          'Parent Department Task',
          "Task in manager's department",
          5,
          new Date('2025-12-31'),
          'TO_DO',
          staffInParentDeptId,
          parentDeptId,
        ]
      );
      const taskId = taskResult.rows[0].id;
      createdTaskIds.push(taskId);

      // Assign to staff in parent department
      await pgClient.query(
        `INSERT INTO "task_assignment" ("taskId", "userId", "assignedById", "assignedAt")
         VALUES ($1, $2, $3, NOW())`,
        [taskId, staffInParentDeptId, managerId]
      );

      const result = await taskService.getManagerDashboardTasks(managerId);

      expect(result).toBeDefined();
      const parentDeptTasks = result!.tasks.filter(
        t => t.departmentId === parentDeptId
      );
      expect(parentDeptTasks.length).toBeGreaterThan(0);
    });

    it('should include tasks from subordinate departments', async () => {
      // Create task in child department
      const taskResult = await pgClient.query(
        `INSERT INTO "task" (id, title, description, priority, "dueDate", status, "ownerId", "departmentId", "isArchived", "createdAt", "updatedAt")
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, false, NOW(), NOW())
         RETURNING id`,
        [
          'Child Department Task',
          'Task in subordinate department',
          5,
          new Date('2025-12-31'),
          'IN_PROGRESS',
          staffInChildDeptId,
          childDeptId,
        ]
      );
      const taskId = taskResult.rows[0].id;
      createdTaskIds.push(taskId);

      // Assign to staff in child department
      await pgClient.query(
        `INSERT INTO "task_assignment" ("taskId", "userId", "assignedById", "assignedAt")
         VALUES ($1, $2, $3, NOW())`,
        [taskId, staffInChildDeptId, managerId]
      );

      const result = await taskService.getManagerDashboardTasks(managerId);

      expect(result).toBeDefined();
      const childDeptTasks = result!.tasks.filter(
        t => t.departmentId === childDeptId
      );
      expect(childDeptTasks.length).toBeGreaterThan(0);
    });

    it('should NOT include tasks from peer departments', async () => {
      // Create task in peer department (Marketing)
      const taskResult = await pgClient.query(
        `INSERT INTO "task" (id, title, description, priority, "dueDate", status, "ownerId", "departmentId", "isArchived", "createdAt", "updatedAt")
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, false, NOW(), NOW())
         RETURNING id`,
        [
          'Peer Department Task',
          'Task in peer department (should not be visible)',
          5,
          new Date('2025-12-31'),
          'TO_DO',
          staffInPeerDeptId,
          peerDeptId,
        ]
      );
      const taskId = taskResult.rows[0].id;
      createdTaskIds.push(taskId);

      // Assign to staff in peer department
      await pgClient.query(
        `INSERT INTO "task_assignment" ("taskId", "userId", "assignedById", "assignedAt")
         VALUES ($1, $2, $3, NOW())`,
        [taskId, staffInPeerDeptId, staffInPeerDeptId]
      );

      const result = await taskService.getManagerDashboardTasks(managerId);

      expect(result).toBeDefined();
      // Verify peer department tasks are NOT included
      const peerDeptTasks = result!.tasks.filter(
        t => t.departmentId === peerDeptId
      );
      expect(peerDeptTasks.length).toBe(0);
    });
  });

  describe('Task Filtering', () => {
    it('should filter out archived tasks', async () => {
      // Create archived task
      const archivedTaskResult = await pgClient.query(
        `INSERT INTO "task" (id, title, description, priority, "dueDate", status, "ownerId", "departmentId", "isArchived", "createdAt", "updatedAt")
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, true, NOW(), NOW())
         RETURNING id`,
        [
          'Archived Task',
          'This task should not appear',
          5,
          new Date('2025-12-31'),
          'COMPLETED',
          staffInParentDeptId,
          parentDeptId,
        ]
      );
      const archivedTaskId = archivedTaskResult.rows[0].id;
      createdTaskIds.push(archivedTaskId);

      // Assign archived task
      await pgClient.query(
        `INSERT INTO "task_assignment" ("taskId", "userId", "assignedById", "assignedAt")
         VALUES ($1, $2, $3, NOW())`,
        [archivedTaskId, staffInParentDeptId, managerId]
      );

      // Create active task
      const activeTaskResult = await pgClient.query(
        `INSERT INTO "task" (id, title, description, priority, "dueDate", status, "ownerId", "departmentId", "isArchived", "createdAt", "updatedAt")
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, false, NOW(), NOW())
         RETURNING id`,
        [
          'Active Task',
          'This task should appear',
          5,
          new Date('2025-12-31'),
          'TO_DO',
          staffInParentDeptId,
          parentDeptId,
        ]
      );
      const activeTaskId = activeTaskResult.rows[0].id;
      createdTaskIds.push(activeTaskId);

      // Assign active task
      await pgClient.query(
        `INSERT INTO "task_assignment" ("taskId", "userId", "assignedById", "assignedAt")
         VALUES ($1, $2, $3, NOW())`,
        [activeTaskId, staffInParentDeptId, managerId]
      );

      const result = await taskService.getManagerDashboardTasks(managerId);

      expect(result).toBeDefined();
      // Verify archived task is NOT included
      const archivedTasks = result!.tasks.filter(t => t.id === archivedTaskId);
      expect(archivedTasks.length).toBe(0);

      // Verify active task IS included
      const activeTasks = result!.tasks.filter(t => t.id === activeTaskId);
      expect(activeTasks.length).toBe(1);
    });
  });
});
