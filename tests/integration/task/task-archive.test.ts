/**
 * @jest-environment node
 *
 * Integration Tests for Task Archive Feature
 *
 * Tests the complete archive workflow through the API layer:
 * - AC1: Only managers can archive tasks within their department hierarchy
 * - AC2: Archived tasks are excluded from standard list views
 * - AC3: Archiving a parent task cascades to all subtasks
 *
 * Story: SCRUM-73 - Manager Archive Tasks/Subtasks
 */

import { Client } from 'pg';
import { PrismaClient } from '@prisma/client';
import { appRouter } from '@/app/server/routers/_app';
import { createInnerTRPCContext } from '@/app/server/trpc';

jest.setTimeout(180000); // 3 minutes timeout for ALL tests

describe('Integration Tests - Task Archive', () => {
  let pgClient: Client;
  const prisma = new PrismaClient();

  // Generate unique test run ID to avoid conflicts in parallel execution
  const testRunId = Date.now();

  // Test data IDs (will be populated by gen_random_uuid())
  let testDeptSalesId: string;
  let testDeptEngineeringId: string;
  let testManagerSalesId: string;
  let testStaffSalesId: string;
  let testManagerEngineeringId: string;

  // Track created resources for cleanup
  const createdTaskIds: string[] = [];
  const createdDepartmentIds: string[] = [];
  const createdUserIds: string[] = [];

  // Generate unique emails with namespace
  const managerSalesEmail = `manager.sales.${testRunId}@test.com`;
  const staffSalesEmail = `staff.sales.${testRunId}@test.com`;
  const managerEngEmail = `manager.eng.${testRunId}@test.com`;

  beforeAll(async () => {
    pgClient = new Client({ connectionString: process.env.DATABASE_URL });
    await pgClient.connect();

    // Create test departments
    const deptSalesResult = await pgClient.query(
      `INSERT INTO public."department" (id, name, "parentId", "createdAt", "updatedAt")
       VALUES (gen_random_uuid(), $1, NULL, NOW(), NOW())
       RETURNING id`,
      [`Sales Department ${testRunId}`]
    );
    testDeptSalesId = deptSalesResult.rows[0].id;
    createdDepartmentIds.push(testDeptSalesId);

    const deptEngResult = await pgClient.query(
      `INSERT INTO public."department" (id, name, "parentId", "createdAt", "updatedAt")
       VALUES (gen_random_uuid(), $1, NULL, NOW(), NOW())
       RETURNING id`,
      [`Engineering Department ${testRunId}`]
    );
    testDeptEngineeringId = deptEngResult.rows[0].id;
    createdDepartmentIds.push(testDeptEngineeringId);

    // Create test users
    const managerSalesResult = await pgClient.query(
      `INSERT INTO public."user_profile" (id, name, email, role, "departmentId", "isActive", "createdAt", "updatedAt")
       VALUES (gen_random_uuid(), $1, $2, 'MANAGER', $3, true, NOW(), NOW())
       RETURNING id`,
      [`Sales Manager ${testRunId}`, managerSalesEmail, testDeptSalesId]
    );
    testManagerSalesId = managerSalesResult.rows[0].id;
    createdUserIds.push(testManagerSalesId);

    const staffSalesResult = await pgClient.query(
      `INSERT INTO public."user_profile" (id, name, email, role, "departmentId", "isActive", "createdAt", "updatedAt")
       VALUES (gen_random_uuid(), $1, $2, 'STAFF', $3, true, NOW(), NOW())
       RETURNING id`,
      [`Sales Staff ${testRunId}`, staffSalesEmail, testDeptSalesId]
    );
    testStaffSalesId = staffSalesResult.rows[0].id;
    createdUserIds.push(testStaffSalesId);

    const managerEngResult = await pgClient.query(
      `INSERT INTO public."user_profile" (id, name, email, role, "departmentId", "isActive", "createdAt", "updatedAt")
       VALUES (gen_random_uuid(), $1, $2, 'MANAGER', $3, true, NOW(), NOW())
       RETURNING id`,
      [
        `Engineering Manager ${testRunId}`,
        managerEngEmail,
        testDeptEngineeringId,
      ]
    );
    testManagerEngineeringId = managerEngResult.rows[0].id;
    createdUserIds.push(testManagerEngineeringId);
  });

  afterAll(async () => {
    // Cleanup in reverse dependency order
    try {
      // Delete task logs
      if (createdTaskIds.length > 0) {
        await pgClient.query(
          `DELETE FROM public."task_log" WHERE "taskId" = ANY($1)`,
          [createdTaskIds]
        );
      }

      // Delete task assignments
      if (createdTaskIds.length > 0) {
        await pgClient.query(
          `DELETE FROM public."task_assignment" WHERE "taskId" = ANY($1)`,
          [createdTaskIds]
        );
      }

      // Delete tasks
      if (createdTaskIds.length > 0) {
        await pgClient.query(`DELETE FROM public."task" WHERE id = ANY($1)`, [
          createdTaskIds,
        ]);
      }

      // Delete user profiles
      if (createdUserIds.length > 0) {
        await pgClient.query(
          `DELETE FROM public."user_profile" WHERE id = ANY($1)`,
          [createdUserIds]
        );
      }

      // Delete departments
      if (createdDepartmentIds.length > 0) {
        await pgClient.query(
          `DELETE FROM public."department" WHERE id = ANY($1)`,
          [createdDepartmentIds]
        );
      }
    } catch (error) {
      console.error('Cleanup failed:', error);
    } finally {
      await pgClient.end();
      await prisma.$disconnect();
    }
  });

  // ============================================
  // AC1: Only Managers Can Archive Tasks
  // ============================================

  describe('AC1: Manager Authorization', () => {
    it('should allow manager to archive task in their department', async () => {
      // Arrange - Create a task
      const taskResult = await pgClient.query(
        `INSERT INTO public."task" (id, title, description, priority, status, "dueDate", "ownerId", "departmentId", "isArchived", "createdAt", "updatedAt")
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, false, NOW(), NOW())
         RETURNING id`,
        [
          `Standalone Task ${testRunId}`,
          'Task to be archived',
          5,
          'TO_DO',
          new Date('2025-12-31'),
          testManagerSalesId,
          testDeptSalesId,
        ]
      );
      const taskId = taskResult.rows[0].id;
      createdTaskIds.push(taskId);

      const ctx = createInnerTRPCContext({
        session: {
          user: { id: testManagerSalesId },
          expires: new Date(Date.now() + 86400000).toISOString(),
        },
      });
      const caller = appRouter.createCaller(ctx);

      // Act
      const result = await caller.task.archive({ taskId });

      // Assert
      expect(result).toBeDefined();
      expect(result.isArchived).toBe(true);

      // Verify in database
      const dbResult = await pgClient.query(
        `SELECT "isArchived" FROM public."task" WHERE id = $1`,
        [taskId]
      );
      expect(dbResult.rows[0].isArchived).toBe(true);
    });

    it('should reject when staff tries to archive a task', async () => {
      // Arrange - Create a task
      const taskResult = await pgClient.query(
        `INSERT INTO public."task" (id, title, description, priority, status, "dueDate", "ownerId", "departmentId", "isArchived", "createdAt", "updatedAt")
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, false, NOW(), NOW())
         RETURNING id`,
        [
          `Staff Test Task ${testRunId}`,
          'Task that staff cannot archive',
          5,
          'TO_DO',
          new Date('2025-12-31'),
          testManagerSalesId,
          testDeptSalesId,
        ]
      );
      const taskId = taskResult.rows[0].id;
      createdTaskIds.push(taskId);

      const ctx = createInnerTRPCContext({
        session: {
          user: { id: testStaffSalesId },
          expires: new Date(Date.now() + 86400000).toISOString(),
        },
      });
      const caller = appRouter.createCaller(ctx);

      // Act & Assert
      await expect(caller.task.archive({ taskId })).rejects.toThrow(
        'Unauthorized: Only managers can archive tasks'
      );
    });

    it('should reject when manager tries to archive task in unrelated department', async () => {
      // Arrange - Create a task in engineering department
      const taskResult = await pgClient.query(
        `INSERT INTO public."task" (id, title, description, priority, status, "dueDate", "ownerId", "departmentId", "isArchived", "createdAt", "updatedAt")
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, false, NOW(), NOW())
         RETURNING id`,
        [
          `Engineering Task ${testRunId}`,
          'Task in different department',
          5,
          'TO_DO',
          new Date('2025-12-31'),
          testManagerEngineeringId,
          testDeptEngineeringId,
        ]
      );
      const taskId = taskResult.rows[0].id;
      createdTaskIds.push(taskId);

      const ctx = createInnerTRPCContext({
        session: {
          user: { id: testManagerSalesId },
          expires: new Date(Date.now() + 86400000).toISOString(),
        },
      });
      const caller = appRouter.createCaller(ctx);

      // Act & Assert
      await expect(caller.task.archive({ taskId })).rejects.toThrow();
    });
  });

  // ============================================
  // AC2: Archived Tasks Excluded from Views
  // ============================================

  describe('AC2: Archived Tasks Excluded from Views', () => {
    it('should exclude archived tasks from getUserTasks query', async () => {
      // Arrange - Create and assign a task
      const taskResult = await pgClient.query(
        `INSERT INTO public."task" (id, title, description, priority, status, "dueDate", "ownerId", "departmentId", "isArchived", "createdAt", "updatedAt")
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, false, NOW(), NOW())
         RETURNING id`,
        [
          `View Test Task ${testRunId}`,
          'Will be archived',
          5,
          'TO_DO',
          new Date('2025-12-31'),
          testManagerSalesId,
          testDeptSalesId,
        ]
      );
      const taskId = taskResult.rows[0].id;
      createdTaskIds.push(taskId);

      await pgClient.query(
        `INSERT INTO public."task_assignment" ("taskId", "userId", "assignedById")
         VALUES ($1, $2, $3)`,
        [taskId, testStaffSalesId, testManagerSalesId]
      );

      const ctx = createInnerTRPCContext({
        session: {
          user: { id: testManagerSalesId },
          expires: new Date(Date.now() + 86400000).toISOString(),
        },
      });
      const caller = appRouter.createCaller(ctx);

      // Archive the task
      await caller.task.archive({ taskId });

      // Act - Query user tasks
      const tasks = await caller.task.getUserTasks({
        userId: testStaffSalesId,
        includeArchived: false,
      });

      // Assert - Archived task should not be in the list
      const archivedTask = tasks.find((t: any) => t.id === taskId);
      expect(archivedTask).toBeUndefined();
    });
  });

  // ============================================
  // AC3: Cascade Archive to Subtasks
  // ============================================

  describe('AC3: Cascade Archive to Subtasks', () => {
    it('should archive all subtasks when parent task is archived', async () => {
      // Arrange - Create parent and subtasks
      const parentResult = await pgClient.query(
        `INSERT INTO public."task" (id, title, description, priority, status, "dueDate", "ownerId", "departmentId", "isArchived", "createdAt", "updatedAt")
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, false, NOW(), NOW())
         RETURNING id`,
        [
          `Parent Task ${testRunId}`,
          'Parent with subtasks',
          5,
          'TO_DO',
          new Date('2025-12-31'),
          testManagerSalesId,
          testDeptSalesId,
        ]
      );
      const parentTaskId = parentResult.rows[0].id;
      createdTaskIds.push(parentTaskId);

      // Create subtasks
      const subtask1Result = await pgClient.query(
        `INSERT INTO public."task" (id, title, description, priority, status, "dueDate", "ownerId", "departmentId", "parentTaskId", "isArchived", "createdAt", "updatedAt")
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, false, NOW(), NOW())
         RETURNING id`,
        [
          `Subtask 1 ${testRunId}`,
          'First subtask',
          5,
          'TO_DO',
          new Date('2025-12-31'),
          testManagerSalesId,
          testDeptSalesId,
          parentTaskId,
        ]
      );
      const subtask1Id = subtask1Result.rows[0].id;
      createdTaskIds.push(subtask1Id);

      const subtask2Result = await pgClient.query(
        `INSERT INTO public."task" (id, title, description, priority, status, "dueDate", "ownerId", "departmentId", "parentTaskId", "isArchived", "createdAt", "updatedAt")
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, false, NOW(), NOW())
         RETURNING id`,
        [
          `Subtask 2 ${testRunId}`,
          'Second subtask',
          5,
          'TO_DO',
          new Date('2025-12-31'),
          testManagerSalesId,
          testDeptSalesId,
          parentTaskId,
        ]
      );
      const subtask2Id = subtask2Result.rows[0].id;
      createdTaskIds.push(subtask2Id);

      const ctx = createInnerTRPCContext({
        session: {
          user: { id: testManagerSalesId },
          expires: new Date(Date.now() + 86400000).toISOString(),
        },
      });
      const caller = appRouter.createCaller(ctx);

      // Act - Archive parent task
      await caller.task.archive({ taskId: parentTaskId });

      // Assert - Parent and all subtasks should be archived
      const result = await pgClient.query(
        `SELECT id, "isArchived" FROM public."task" WHERE id = ANY($1)`,
        [[parentTaskId, subtask1Id, subtask2Id]]
      );

      expect(result.rows).toHaveLength(3);
      result.rows.forEach((row: any) => {
        expect(row.isArchived).toBe(true);
      });
    });

    it('should exclude archived subtasks from getSubtasks query', async () => {
      // Arrange - Create parent and subtasks
      const parentResult = await pgClient.query(
        `INSERT INTO public."task" (id, title, description, priority, status, "dueDate", "ownerId", "departmentId", "isArchived", "createdAt", "updatedAt")
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, false, NOW(), NOW())
         RETURNING id`,
        [
          `Parent Task 2 ${testRunId}`,
          'Parent with subtasks',
          5,
          'TO_DO',
          new Date('2025-12-31'),
          testManagerSalesId,
          testDeptSalesId,
        ]
      );
      const parentTaskId = parentResult.rows[0].id;
      createdTaskIds.push(parentTaskId);

      // Create subtasks
      const subtask1Result = await pgClient.query(
        `INSERT INTO public."task" (id, title, description, priority, status, "dueDate", "ownerId", "departmentId", "parentTaskId", "isArchived", "createdAt", "updatedAt")
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, false, NOW(), NOW())
         RETURNING id`,
        [
          `Subtask 1B ${testRunId}`,
          'First subtask',
          5,
          'TO_DO',
          new Date('2025-12-31'),
          testManagerSalesId,
          testDeptSalesId,
          parentTaskId,
        ]
      );
      createdTaskIds.push(subtask1Result.rows[0].id);

      const subtask2Result = await pgClient.query(
        `INSERT INTO public."task" (id, title, description, priority, status, "dueDate", "ownerId", "departmentId", "parentTaskId", "isArchived", "createdAt", "updatedAt")
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, false, NOW(), NOW())
         RETURNING id`,
        [
          `Subtask 2B ${testRunId}`,
          'Second subtask',
          5,
          'TO_DO',
          new Date('2025-12-31'),
          testManagerSalesId,
          testDeptSalesId,
          parentTaskId,
        ]
      );
      createdTaskIds.push(subtask2Result.rows[0].id);

      const ctx = createInnerTRPCContext({
        session: {
          user: { id: testManagerSalesId },
          expires: new Date(Date.now() + 86400000).toISOString(),
        },
      });
      const caller = appRouter.createCaller(ctx);

      // Archive parent (which cascades to subtasks)
      await caller.task.archive({ taskId: parentTaskId });

      // Act - Query subtasks
      const subtasks = await caller.task.getSubtasks({
        parentTaskId: parentTaskId,
      });

      // Assert - No subtasks should be returned (all are archived)
      expect(subtasks).toHaveLength(0);
    });
  });
});
