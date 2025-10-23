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

  // Track created resources for comprehensive cleanup
  const createdTaskIds: string[] = [];
  const createdUserIds: string[] = [];
  const createdDepartmentIds: string[] = [];

  // Generate unique namespace for parallel test execution
  const testNamespace = `deptcal-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  /**
   * Helper function to create test user
   */
  async function createTestUser(
    email: string,
    name: string,
    role: 'STAFF' | 'MANAGER',
    departmentId: string
  ): Promise<string> {
    const userResult = await pgClient.query(
      `INSERT INTO "user_profile" (id, email, name, role, "departmentId", "isActive", "createdAt", "updatedAt")
       VALUES (gen_random_uuid(), $1, $2, $3, $4, true, NOW(), NOW())
       RETURNING id`,
      [email, name, role, departmentId]
    );
    const userId = userResult.rows[0].id;
    createdUserIds.push(userId);
    return userId;
  }

  /**
   * Helper function to create test task
   */
  async function createTestTask(
    title: string,
    description: string,
    priority: number,
    dueDate: Date,
    status: 'TO_DO' | 'IN_PROGRESS' | 'COMPLETED' | 'BLOCKED',
    ownerId: string,
    departmentId: string,
    isArchived: boolean = false
  ): Promise<string> {
    const taskResult = await pgClient.query(
      `INSERT INTO "task" (id, title, description, priority, "dueDate", status, "ownerId", "departmentId", "isArchived", "createdAt", "updatedAt")
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
       RETURNING id`,
      [
        title,
        description,
        priority,
        dueDate,
        status,
        ownerId,
        departmentId,
        isArchived,
      ]
    );
    const taskId = taskResult.rows[0].id;
    createdTaskIds.push(taskId);
    return taskId;
  }

  /**
   * Helper function to assign task to user
   */
  async function assignTask(
    taskId: string,
    userId: string,
    assignedById: string
  ): Promise<void> {
    await pgClient.query(
      `INSERT INTO "task_assignment" ("taskId", "userId", "assignedById", "assignedAt")
       VALUES ($1, $2, $3, NOW())`,
      [taskId, userId, assignedById]
    );
  }

  beforeAll(async () => {
    // Connect to database
    pgClient = new Client({
      connectionString: process.env.DATABASE_URL,
      connectionTimeoutMillis: 10000,
    });
    await pgClient.connect();

    // Initialize Prisma client and service
    prisma = new PrismaClient();
    taskService = new TaskService(prisma);

    // Create parent department (manager's department)
    const parentDeptResult = await pgClient.query(
      `INSERT INTO "department" (id, name, "parentId", "isActive", "createdAt", "updatedAt")
       VALUES (gen_random_uuid(), $1, NULL, true, NOW(), NOW())
       RETURNING id`,
      [`Parent Dept ${testNamespace}`]
    );
    parentDeptId = parentDeptResult.rows[0].id;
    createdDepartmentIds.push(parentDeptId);

    // Create child department (subordinate)
    const childDeptResult = await pgClient.query(
      `INSERT INTO "department" (id, name, "parentId", "isActive", "createdAt", "updatedAt")
       VALUES (gen_random_uuid(), $1, $2, true, NOW(), NOW())
       RETURNING id`,
      [`Child Dept ${testNamespace}`, parentDeptId]
    );
    childDeptId = childDeptResult.rows[0].id;
    createdDepartmentIds.push(childDeptId);

    // Create peer department (same level as parent)
    const peerDeptResult = await pgClient.query(
      `INSERT INTO "department" (id, name, "parentId", "isActive", "createdAt", "updatedAt")
       VALUES (gen_random_uuid(), $1, NULL, true, NOW(), NOW())
       RETURNING id`,
      [`Peer Dept ${testNamespace}`]
    );
    peerDeptId = peerDeptResult.rows[0].id;
    createdDepartmentIds.push(peerDeptId);

    // Create test users with namespaced emails
    managerId = await createTestUser(
      `manager-${testNamespace}@test.com`,
      'Department Manager',
      'MANAGER',
      parentDeptId
    );

    staffInParentId = await createTestUser(
      `staff-parent-${testNamespace}@test.com`,
      'Staff in Parent',
      'STAFF',
      parentDeptId
    );

    staffInChildId = await createTestUser(
      `staff-child-${testNamespace}@test.com`,
      'Staff in Child',
      'STAFF',
      childDeptId
    );

    staffInPeerId = await createTestUser(
      `staff-peer-${testNamespace}@test.com`,
      'Staff in Peer',
      'STAFF',
      peerDeptId
    );
  }, 60000);

  afterAll(async () => {
    // Clean up in proper order to respect foreign key constraints

    // 1. Delete task assignments first
    if (createdTaskIds.length > 0) {
      await pgClient.query(
        `DELETE FROM "task_assignment" WHERE "taskId" = ANY($1)`,
        [createdTaskIds]
      );
    }

    // 2. Delete created tasks
    if (createdTaskIds.length > 0) {
      await pgClient.query(`DELETE FROM "task" WHERE id = ANY($1)`, [
        createdTaskIds,
      ]);
    }

    // 3. Clean up test users
    if (createdUserIds.length > 0) {
      await pgClient.query(`DELETE FROM "user_profile" WHERE id = ANY($1)`, [
        createdUserIds,
      ]);
    }

    // 4. Clean up test departments (child first due to FK)
    if (childDeptId) {
      await pgClient.query(`DELETE FROM "department" WHERE id = $1`, [
        childDeptId,
      ]);
    }
    if (parentDeptId || peerDeptId) {
      await pgClient.query(`DELETE FROM "department" WHERE id = ANY($1)`, [
        [parentDeptId, peerDeptId],
      ]);
    }

    await pgClient.end();
    await prisma.$disconnect();
  });

  describe('Manager Departmental Calendar (CIT001, CIT009)', () => {
    it("should include tasks from manager's own department", async () => {
      // Create task in parent department
      const taskId = await createTestTask(
        'Parent Dept Task',
        "Task in manager's department",
        5,
        new Date('2025-12-31'),
        'TO_DO',
        managerId,
        parentDeptId
      );

      // Assign to staff in parent
      await assignTask(taskId, staffInParentId, managerId);

      // Get departmental tasks for manager
      const result = await taskService.getManagerDashboardTasks(managerId);

      // Verify task is included
      expect(result).toBeDefined();
      const taskIds = result!.tasks.map(t => t.id);
      expect(taskIds).toContain(taskId);
    }, 40000);

    it('should include tasks from subordinate departments', async () => {
      // Create task in child department
      const taskId = await createTestTask(
        'Child Dept Task',
        'Task in subordinate department',
        5,
        new Date('2025-12-31'),
        'IN_PROGRESS',
        managerId,
        childDeptId
      );

      // Assign to staff in child
      await assignTask(taskId, staffInChildId, managerId);

      // Get departmental tasks for manager
      const result = await taskService.getManagerDashboardTasks(managerId);

      // Verify child dept task is included
      expect(result).toBeDefined();
      const taskIds = result!.tasks.map(t => t.id);
      expect(taskIds).toContain(taskId);
    }, 40000);

    it('should NOT include tasks from peer departments', async () => {
      // Create task in peer department
      const peerTaskId = await createTestTask(
        'Peer Dept Task',
        'Task in peer department (should not be visible)',
        5,
        new Date('2025-12-31'),
        'TO_DO',
        staffInPeerId,
        peerDeptId
      );

      // Assign to staff in peer
      await assignTask(peerTaskId, staffInPeerId, staffInPeerId);

      // Get departmental tasks for manager
      const result = await taskService.getManagerDashboardTasks(managerId);

      // Verify peer dept task is NOT included
      expect(result).toBeDefined();
      const taskIds = result!.tasks.map(t => t.id);
      expect(taskIds).not.toContain(peerTaskId);
    }, 40000);

    it('should include assignee details for visual distinction (CIT009)', async () => {
      // Create tasks assigned to different team members
      const task1Id = await createTestTask(
        'Task for Staff Parent',
        'Assigned to parent dept staff',
        5,
        new Date('2025-12-31'),
        'TO_DO',
        managerId,
        parentDeptId
      );
      await assignTask(task1Id, staffInParentId, managerId);

      const task2Id = await createTestTask(
        'Task for Staff Child',
        'Assigned to child dept staff',
        5,
        new Date('2025-12-31'),
        'IN_PROGRESS',
        managerId,
        childDeptId
      );
      await assignTask(task2Id, staffInChildId, managerId);

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
    }, 40000);
  });

  describe('Manager Filtering by Team Member (CIT008)', () => {
    it('should allow filtering tasks by specific team member', async () => {
      // Create tasks for different staff members
      const task1Id = await createTestTask(
        'Task for Parent Staff',
        'Parent staff task',
        5,
        new Date('2025-12-31'),
        'TO_DO',
        managerId,
        parentDeptId
      );
      await assignTask(task1Id, staffInParentId, managerId);

      const task2Id = await createTestTask(
        'Task for Child Staff',
        'Child staff task',
        5,
        new Date('2025-12-31'),
        'IN_PROGRESS',
        managerId,
        childDeptId
      );
      await assignTask(task2Id, staffInChildId, managerId);

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
    }, 40000);

    it('should return all tasks when no filter is applied', async () => {
      // Create multiple tasks across departments
      for (let i = 1; i <= 3; i++) {
        const taskId = await createTestTask(
          `Task ${i}`,
          `Description ${i}`,
          5,
          new Date('2025-12-31'),
          'TO_DO',
          managerId,
          i % 2 === 0 ? parentDeptId : childDeptId
        );

        const assigneeId = i % 2 === 0 ? staffInParentId : staffInChildId;
        await assignTask(taskId, assigneeId, managerId);
      }

      // Get all tasks (no filter)
      const result = await taskService.getManagerDashboardTasks(managerId);

      // Verify all tasks are returned
      expect(result).toBeDefined();
      expect(result!.tasks.length).toBeGreaterThan(0);
    }, 40000);
  });

  describe('Edge Cases', () => {
    it('should handle department with no tasks', async () => {
      // Create empty department with manager
      const emptyDeptResult = await pgClient.query(
        `INSERT INTO "department" (id, name, "isActive", "createdAt", "updatedAt")
         VALUES (gen_random_uuid(), $1, true, NOW(), NOW())
         RETURNING id`,
        [`Empty Dept ${testNamespace}`]
      );
      const emptyDeptId = emptyDeptResult.rows[0].id;
      createdDepartmentIds.push(emptyDeptId);

      const emptyManagerId = await createTestUser(
        `empty-mgr-${testNamespace}@test.com`,
        'Empty Manager',
        'MANAGER',
        emptyDeptId
      );

      // Get tasks for empty department
      const result = await taskService.getManagerDashboardTasks(emptyManagerId);

      // Verify empty result
      expect(result).toBeDefined();
      expect(result!.tasks.length).toBe(0);
      expect(result!.metrics.toDo).toBe(0);
      expect(result!.metrics.inProgress).toBe(0);
      expect(result!.metrics.completed).toBe(0);
      expect(result!.metrics.blocked).toBe(0);

      // Cleanup (delete user first, then department)
      await pgClient.query(`DELETE FROM "user_profile" WHERE id = $1`, [
        emptyManagerId,
      ]);
      await pgClient.query(`DELETE FROM "department" WHERE id = $1`, [
        emptyDeptId,
      ]);
    }, 40000);

    it('should not return archived tasks', async () => {
      // Create archived task
      const archivedTaskId = await createTestTask(
        'Archived Dept Task',
        'Should not appear',
        5,
        new Date('2025-12-31'),
        'COMPLETED',
        managerId,
        parentDeptId,
        true // Archived
      );

      // Assign task
      await assignTask(archivedTaskId, staffInParentId, managerId);

      // Get departmental tasks
      const result = await taskService.getManagerDashboardTasks(managerId);

      // Verify archived task is not included
      expect(result).toBeDefined();
      const taskIds = result!.tasks.map(t => t.id);
      expect(taskIds).not.toContain(archivedTaskId);
    }, 40000);
  });
});
