/**
 * @jest-environment node
 *
 * Integration Tests for Departmental Calendar
 *
 * Tests departmental calendar task fetching with real database operations:
 * - Manager departmental calendar viewing (CIT001, CIT009)
 * - Task filtering by team members (CIT008)
 * - Department hierarchy access control
 * - Visual distinction by assignee
 *
 * Test Coverage:
 * - AC: Manager sees all tasks for their department and subordinate departments
 * - AC: Tasks are visually distinguished by their assignee
 * - AC: Manager can filter view by specific team members
 * - AC: Manager cannot see peer department tasks
 */

import { Client } from 'pg';
import { TaskService } from '@/app/server/services/TaskService';
import { PrismaClient } from '@prisma/client';

describe('Integration Tests - Departmental Calendar', () => {
  let pgClient: Client;
  let prisma: PrismaClient;
  let taskService: TaskService;

  // Test data IDs
  let parentDeptId: string; // Manager's department
  let childDeptId: string; // Subordinate department
  let peerDeptId: string; // Peer department (same level)
  let managerId: string;
  let staffInParentId: string;
  let staffInChildId: string;
  let staffInPeerId: string;

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
        SELECT id FROM "user_profile" WHERE email LIKE '%@deptcal.test.com'
      )`
    );
    await pgClient.query(
      `DELETE FROM "task" WHERE "ownerId" IN (
        SELECT id FROM "user_profile" WHERE email LIKE '%@deptcal.test.com'
      )`
    );
    await pgClient.query(
      `DELETE FROM "user_profile" WHERE email LIKE '%@deptcal.test.com'`
    );
    await pgClient.query(
      `DELETE FROM "department" WHERE name IN ('Parent Dept Test', 'Child Dept Test', 'Peer Dept Test')`
    );

    // Create parent department (manager's department)
    const parentDeptResult = await pgClient.query(
      `INSERT INTO "department" (id, name, "parentId", "isActive", "createdAt", "updatedAt")
       VALUES (gen_random_uuid(), $1, NULL, true, NOW(), NOW())
       RETURNING id`,
      ['Parent Dept Test']
    );
    parentDeptId = parentDeptResult.rows[0].id;

    // Create child department (subordinate)
    const childDeptResult = await pgClient.query(
      `INSERT INTO "department" (id, name, "parentId", "isActive", "createdAt", "updatedAt")
       VALUES (gen_random_uuid(), $1, $2, true, NOW(), NOW())
       RETURNING id`,
      ['Child Dept Test', parentDeptId]
    );
    childDeptId = childDeptResult.rows[0].id;

    // Create peer department (same level as parent)
    const peerDeptResult = await pgClient.query(
      `INSERT INTO "department" (id, name, "parentId", "isActive", "createdAt", "updatedAt")
       VALUES (gen_random_uuid(), $1, NULL, true, NOW(), NOW())
       RETURNING id`,
      ['Peer Dept Test']
    );
    peerDeptId = peerDeptResult.rows[0].id;

    // Create manager in parent department
    const managerResult = await pgClient.query(
      `INSERT INTO "user_profile" (id, email, name, role, "departmentId", "isActive", "createdAt", "updatedAt")
       VALUES (gen_random_uuid(), $1, $2, $3, $4, true, NOW(), NOW())
       RETURNING id`,
      [
        'manager@deptcal.test.com',
        'Department Manager',
        'MANAGER',
        parentDeptId,
      ]
    );
    managerId = managerResult.rows[0].id;

    // Create staff in parent department
    const staffParentResult = await pgClient.query(
      `INSERT INTO "user_profile" (id, email, name, role, "departmentId", "isActive", "createdAt", "updatedAt")
       VALUES (gen_random_uuid(), $1, $2, $3, $4, true, NOW(), NOW())
       RETURNING id`,
      [
        'staff-parent@deptcal.test.com',
        'Staff in Parent',
        'STAFF',
        parentDeptId,
      ]
    );
    staffInParentId = staffParentResult.rows[0].id;

    // Create staff in child department
    const staffChildResult = await pgClient.query(
      `INSERT INTO "user_profile" (id, email, name, role, "departmentId", "isActive", "createdAt", "updatedAt")
       VALUES (gen_random_uuid(), $1, $2, $3, $4, true, NOW(), NOW())
       RETURNING id`,
      ['staff-child@deptcal.test.com', 'Staff in Child', 'STAFF', childDeptId]
    );
    staffInChildId = staffChildResult.rows[0].id;

    // Create staff in peer department
    const staffPeerResult = await pgClient.query(
      `INSERT INTO "user_profile" (id, email, name, role, "departmentId", "isActive", "createdAt", "updatedAt")
       VALUES (gen_random_uuid(), $1, $2, $3, $4, true, NOW(), NOW())
       RETURNING id`,
      ['staff-peer@deptcal.test.com', 'Staff in Peer', 'STAFF', peerDeptId]
    );
    staffInPeerId = staffPeerResult.rows[0].id;
  });

  afterAll(async () => {
    // Clean up in proper order to avoid foreign key constraint violations

    // 1. Delete task assignments first
    await pgClient.query(
      `DELETE FROM "task_assignment" WHERE "assignedById" IN (
        SELECT id FROM "user_profile" WHERE email LIKE '%@deptcal.test.com'
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
        SELECT id FROM "user_profile" WHERE email LIKE '%@deptcal.test.com'
      )`
    );

    // 4. Clean up test users
    await pgClient.query(
      `DELETE FROM "user_profile" WHERE email LIKE '%@deptcal.test.com'`
    );

    // 5. Clean up test departments (child first due to FK)
    await pgClient.query(
      `DELETE FROM "department" WHERE name IN ('Child Dept Test')`
    );
    await pgClient.query(
      `DELETE FROM "department" WHERE name IN ('Parent Dept Test', 'Peer Dept Test')`
    );

    await pgClient.end();
    await prisma.$disconnect();
  });

  afterEach(() => {
    // Clear the task IDs array after each test cleanup
    createdTaskIds.length = 0;
  });

  describe('Manager Departmental Calendar (CIT001, CIT009)', () => {
    it("should include tasks from manager's own department", async () => {
      // Create task in parent department
      const taskResult = await pgClient.query(
        `INSERT INTO "task" (id, title, description, priority, "dueDate", status, "ownerId", "departmentId", "isArchived", "createdAt", "updatedAt")
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, false, NOW(), NOW())
         RETURNING id`,
        [
          'Parent Dept Task',
          "Task in manager's department",
          5,
          new Date('2025-12-31'),
          'TO_DO',
          managerId,
          parentDeptId,
        ]
      );
      const taskId = taskResult.rows[0].id;
      createdTaskIds.push(taskId);

      // Assign to staff in parent
      await pgClient.query(
        `INSERT INTO "task_assignment" ("taskId", "userId", "assignedById", "assignedAt")
         VALUES ($1, $2, $3, NOW())`,
        [taskId, staffInParentId, managerId]
      );

      // Get departmental tasks for manager
      const result = await taskService.getManagerDashboardTasks(managerId);

      // Verify task is included
      expect(result).toBeDefined();
      const taskIds = result!.tasks.map(t => t.id);
      expect(taskIds).toContain(taskId);
    }, 15000);

    it('should include tasks from subordinate departments', async () => {
      // Create task in child department
      const taskResult = await pgClient.query(
        `INSERT INTO "task" (id, title, description, priority, "dueDate", status, "ownerId", "departmentId", "isArchived", "createdAt", "updatedAt")
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, false, NOW(), NOW())
         RETURNING id`,
        [
          'Child Dept Task',
          'Task in subordinate department',
          5,
          new Date('2025-12-31'),
          'IN_PROGRESS',
          managerId,
          childDeptId,
        ]
      );
      const taskId = taskResult.rows[0].id;
      createdTaskIds.push(taskId);

      // Assign to staff in child
      await pgClient.query(
        `INSERT INTO "task_assignment" ("taskId", "userId", "assignedById", "assignedAt")
         VALUES ($1, $2, $3, NOW())`,
        [taskId, staffInChildId, managerId]
      );

      // Get departmental tasks for manager
      const result = await taskService.getManagerDashboardTasks(managerId);

      // Verify child dept task is included
      expect(result).toBeDefined();
      const taskIds = result!.tasks.map(t => t.id);
      expect(taskIds).toContain(taskId);
    }, 15000);

    it('should NOT include tasks from peer departments', async () => {
      // Create task in peer department
      const taskResult = await pgClient.query(
        `INSERT INTO "task" (id, title, description, priority, "dueDate", status, "ownerId", "departmentId", "isArchived", "createdAt", "updatedAt")
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, false, NOW(), NOW())
         RETURNING id`,
        [
          'Peer Dept Task',
          'Task in peer department (should not be visible)',
          5,
          new Date('2025-12-31'),
          'TO_DO',
          staffInPeerId,
          peerDeptId,
        ]
      );
      const peerTaskId = taskResult.rows[0].id;
      createdTaskIds.push(peerTaskId);

      // Assign to staff in peer
      await pgClient.query(
        `INSERT INTO "task_assignment" ("taskId", "userId", "assignedById", "assignedAt")
         VALUES ($1, $2, $3, NOW())`,
        [peerTaskId, staffInPeerId, staffInPeerId]
      );

      // Get departmental tasks for manager
      const result = await taskService.getManagerDashboardTasks(managerId);

      // Verify peer dept task is NOT included
      expect(result).toBeDefined();
      const taskIds = result!.tasks.map(t => t.id);
      expect(taskIds).not.toContain(peerTaskId);
    }, 15000);

    it('should include assignee details for visual distinction (CIT009)', async () => {
      // Create tasks assigned to different team members
      const task1Result = await pgClient.query(
        `INSERT INTO "task" (id, title, description, priority, "dueDate", status, "ownerId", "departmentId", "isArchived", "createdAt", "updatedAt")
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, false, NOW(), NOW())
         RETURNING id`,
        [
          'Task for Staff Parent',
          'Assigned to parent dept staff',
          5,
          new Date('2025-12-31'),
          'TO_DO',
          managerId,
          parentDeptId,
        ]
      );
      const task1Id = task1Result.rows[0].id;
      createdTaskIds.push(task1Id);

      await pgClient.query(
        `INSERT INTO "task_assignment" ("taskId", "userId", "assignedById", "assignedAt")
         VALUES ($1, $2, $3, NOW())`,
        [task1Id, staffInParentId, managerId]
      );

      const task2Result = await pgClient.query(
        `INSERT INTO "task" (id, title, description, priority, "dueDate", status, "ownerId", "departmentId", "isArchived", "createdAt", "updatedAt")
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, false, NOW(), NOW())
         RETURNING id`,
        [
          'Task for Staff Child',
          'Assigned to child dept staff',
          5,
          new Date('2025-12-31'),
          'IN_PROGRESS',
          managerId,
          childDeptId,
        ]
      );
      const task2Id = task2Result.rows[0].id;
      createdTaskIds.push(task2Id);

      await pgClient.query(
        `INSERT INTO "task_assignment" ("taskId", "userId", "assignedById", "assignedAt")
         VALUES ($1, $2, $3, NOW())`,
        [task2Id, staffInChildId, managerId]
      );

      // Get departmental tasks
      const result = await taskService.getManagerDashboardTasks(managerId);

      // Verify assignee details are included for visual distinction
      expect(result).toBeDefined();
      const task1 = result!.tasks.find(t => t.id === task1Id);
      const task2 = result!.tasks.find(t => t.id === task2Id);

      expect(task1).toBeDefined();
      expect(task1!.assignments).toBeDefined();
      expect(task1!.assignments.length).toBeGreaterThan(0);
      expect(task1!.assignments[0].user.id).toBe(staffInParentId);

      expect(task2).toBeDefined();
      expect(task2!.assignments).toBeDefined();
      expect(task2!.assignments.length).toBeGreaterThan(0);
      expect(task2!.assignments[0].user.id).toBe(staffInChildId);
    }, 15000);
  });

  describe('Manager Filtering by Team Member (CIT008)', () => {
    it('should allow filtering tasks by specific team member', async () => {
      // Create tasks for different staff members
      const task1Result = await pgClient.query(
        `INSERT INTO "task" (id, title, description, priority, "dueDate", status, "ownerId", "departmentId", "isArchived", "createdAt", "updatedAt")
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, false, NOW(), NOW())
         RETURNING id`,
        [
          'Task for Parent Staff',
          'Parent staff task',
          5,
          new Date('2025-12-31'),
          'TO_DO',
          managerId,
          parentDeptId,
        ]
      );
      const task1Id = task1Result.rows[0].id;
      createdTaskIds.push(task1Id);

      await pgClient.query(
        `INSERT INTO "task_assignment" ("taskId", "userId", "assignedById", "assignedAt")
         VALUES ($1, $2, $3, NOW())`,
        [task1Id, staffInParentId, managerId]
      );

      const task2Result = await pgClient.query(
        `INSERT INTO "task" (id, title, description, priority, "dueDate", status, "ownerId", "departmentId", "isArchived", "createdAt", "updatedAt")
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, false, NOW(), NOW())
         RETURNING id`,
        [
          'Task for Child Staff',
          'Child staff task',
          5,
          new Date('2025-12-31'),
          'IN_PROGRESS',
          managerId,
          childDeptId,
        ]
      );
      const task2Id = task2Result.rows[0].id;
      createdTaskIds.push(task2Id);

      await pgClient.query(
        `INSERT INTO "task_assignment" ("taskId", "userId", "assignedById", "assignedAt")
         VALUES ($1, $2, $3, NOW())`,
        [task2Id, staffInChildId, managerId]
      );

      // Get all departmental tasks
      const allTasks = await taskService.getManagerDashboardTasks(managerId);

      // Filter client-side by specific team member (simulating frontend filter)
      const filteredTasks = allTasks!.tasks.filter(task =>
        task.assignments.some(a => a.user.id === staffInParentId)
      );

      // Verify filtering works
      expect(filteredTasks.length).toBeGreaterThan(0);
      expect(filteredTasks.some(t => t.id === task1Id)).toBe(true);
      expect(filteredTasks.some(t => t.id === task2Id)).toBe(false);
    }, 15000);

    it('should return all tasks when no filter is applied', async () => {
      // Create multiple tasks across departments
      for (let i = 1; i <= 3; i++) {
        const taskResult = await pgClient.query(
          `INSERT INTO "task" (id, title, description, priority, "dueDate", status, "ownerId", "departmentId", "isArchived", "createdAt", "updatedAt")
           VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, false, NOW(), NOW())
           RETURNING id`,
          [
            `Task ${i}`,
            `Description ${i}`,
            5,
            new Date('2025-12-31'),
            'TO_DO',
            managerId,
            i % 2 === 0 ? parentDeptId : childDeptId,
          ]
        );
        const taskId = taskResult.rows[0].id;
        createdTaskIds.push(taskId);

        const assigneeId = i % 2 === 0 ? staffInParentId : staffInChildId;
        await pgClient.query(
          `INSERT INTO "task_assignment" ("taskId", "userId", "assignedById", "assignedAt")
           VALUES ($1, $2, $3, NOW())`,
          [taskId, assigneeId, managerId]
        );
      }

      // Get all tasks (no filter)
      const result = await taskService.getManagerDashboardTasks(managerId);

      // Verify all tasks are returned
      expect(result).toBeDefined();
      expect(result!.tasks.length).toBeGreaterThan(0);
    }, 15000);
  });

  describe('Edge Cases', () => {
    it('should handle department with no tasks', async () => {
      // Create empty department with manager
      const emptyDeptResult = await pgClient.query(
        `INSERT INTO "department" (id, name, "isActive", "createdAt", "updatedAt")
         VALUES (gen_random_uuid(), $1, true, NOW(), NOW())
         RETURNING id`,
        ['Empty Dept Test']
      );
      const emptyDeptId = emptyDeptResult.rows[0].id;

      const emptyManagerResult = await pgClient.query(
        `INSERT INTO "user_profile" (id, email, name, role, "departmentId", "isActive", "createdAt", "updatedAt")
         VALUES (gen_random_uuid(), $1, $2, $3, $4, true, NOW(), NOW())
         RETURNING id`,
        ['empty-mgr@deptcal.test.com', 'Empty Manager', 'MANAGER', emptyDeptId]
      );
      const emptyManagerId = emptyManagerResult.rows[0].id;

      // Get tasks for empty department
      const result = await taskService.getManagerDashboardTasks(emptyManagerId);

      // Verify empty result
      expect(result).toBeDefined();
      expect(result!.tasks.length).toBe(0);
      expect(result!.metrics.toDo).toBe(0);
      expect(result!.metrics.inProgress).toBe(0);
      expect(result!.metrics.completed).toBe(0);
      expect(result!.metrics.blocked).toBe(0);

      // Cleanup
      await pgClient.query(
        `DELETE FROM "user_profile" WHERE email = 'empty-mgr@deptcal.test.com'`
      );
      await pgClient.query(
        `DELETE FROM "department" WHERE name = 'Empty Dept Test'`
      );
    }, 15000);

    it('should not return archived tasks', async () => {
      // Create archived task
      const taskResult = await pgClient.query(
        `INSERT INTO "task" (id, title, description, priority, "dueDate", status, "ownerId", "departmentId", "isArchived", "createdAt", "updatedAt")
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, true, NOW(), NOW())
         RETURNING id`,
        [
          'Archived Dept Task',
          'Should not appear',
          5,
          new Date('2025-12-31'),
          'COMPLETED',
          managerId,
          parentDeptId,
        ]
      );
      const archivedTaskId = taskResult.rows[0].id;
      createdTaskIds.push(archivedTaskId);

      // Assign task
      await pgClient.query(
        `INSERT INTO "task_assignment" ("taskId", "userId", "assignedById", "assignedAt")
         VALUES ($1, $2, $3, NOW())`,
        [archivedTaskId, staffInParentId, managerId]
      );

      // Get departmental tasks
      const result = await taskService.getManagerDashboardTasks(managerId);

      // Verify archived task is not included
      expect(result).toBeDefined();
      const taskIds = result!.tasks.map(t => t.id);
      expect(taskIds).not.toContain(archivedTaskId);
    }, 15000);
  });
});
