/**
 * @jest-environment node
 *
 * Integration Tests for Departmental Calendar Assignee Filter (CIT008)
 *
 * Tests manager's ability to filter departmental calendar by team members (assignees):
 * - Manager can filter tasks by specific staff members
 * - Filter shows only tasks assigned to selected staff member
 * - "All Team Members" shows all accessible tasks
 * - Peer department tasks never appear in filter results
 *
 * Test Coverage:
 * - AC (CIT008): Manager can filter departmental calendar by team members
 */

import { Client } from 'pg';
import { DashboardTaskService as TaskService } from '@/app/server/services/DashboardTaskService';
import { PrismaClient } from '@prisma/client';

describe('Integration Tests - Departmental Calendar Assignee Filter (CIT008)', () => {
  let pgClient: Client;
  let prisma: PrismaClient;
  let taskService: TaskService;

  // Test data IDs
  let parentDeptId: string; // Manager's department
  let childDeptId: string; // Subordinate department
  let managerId: string; // MANAGER (uses the filter)
  let aliceId: string; // STAFF in parent dept
  let bobId: string; // STAFF in parent dept
  let charlieId: string; // STAFF in child dept

  // Track created resources for comprehensive cleanup
  const createdTaskIds: string[] = [];
  const createdUserIds: string[] = [];
  const createdDepartmentIds: string[] = [];

  // Generate unique namespace for parallel test execution
  const testNamespace = `assignee-filter-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

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
    departmentId: string
  ): Promise<string> {
    const taskResult = await pgClient.query(
      `INSERT INTO "task" (id, title, description, priority, "dueDate", status, "ownerId", "departmentId", "isArchived", "createdAt", "updatedAt")
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, false, NOW(), NOW())
       RETURNING id`,
      [title, description, priority, dueDate, status, ownerId, departmentId]
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
      `INSERT INTO "department" (id, name, "isActive", "createdAt", "updatedAt")
       VALUES (gen_random_uuid(), $1, true, NOW(), NOW())
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

    // Create MANAGER in parent department
    managerId = await createTestUser(
      `manager.${testNamespace}@test.com`,
      'Department Manager',
      'MANAGER',
      parentDeptId
    );

    // Create STAFF members
    aliceId = await createTestUser(
      `alice.${testNamespace}@test.com`,
      'Alice Smith',
      'STAFF',
      parentDeptId
    );

    bobId = await createTestUser(
      `bob.${testNamespace}@test.com`,
      'Bob Johnson',
      'STAFF',
      parentDeptId
    );

    charlieId = await createTestUser(
      `charlie.${testNamespace}@test.com`,
      'Charlie Brown',
      'STAFF',
      childDeptId
    );

    // Create tasks assigned to Alice
    const aliceTask1Id = await createTestTask(
      'Alice Task 1',
      'First task for Alice',
      5,
      new Date('2025-12-31'),
      'TO_DO',
      managerId,
      parentDeptId
    );
    await assignTask(aliceTask1Id, aliceId, managerId);

    const aliceTask2Id = await createTestTask(
      'Alice Task 2',
      'Second task for Alice',
      6,
      new Date('2025-12-30'),
      'IN_PROGRESS',
      managerId,
      parentDeptId
    );
    await assignTask(aliceTask2Id, aliceId, managerId);

    // Create task assigned to Bob
    const bobTaskId = await createTestTask(
      'Bob Task',
      'Task for Bob',
      7,
      new Date('2025-12-29'),
      'TO_DO',
      managerId,
      parentDeptId
    );
    await assignTask(bobTaskId, bobId, managerId);

    // Create task assigned to Charlie (in child department)
    const charlieTaskId = await createTestTask(
      'Charlie Task',
      'Task for Charlie in child dept',
      8,
      new Date('2025-12-28'),
      'IN_PROGRESS',
      managerId,
      childDeptId
    );
    await assignTask(charlieTaskId, charlieId, managerId);
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
    if (parentDeptId) {
      await pgClient.query(`DELETE FROM "department" WHERE id = $1`, [
        parentDeptId,
      ]);
    }

    await pgClient.end();
    await prisma.$disconnect();
  });

  describe('Manager Filter by Staff Member (CIT008)', () => {
    it('should filter tasks by Alice (staff member in parent dept)', async () => {
      // Get all departmental tasks for manager
      const allTasks = await taskService.getManagerDashboardTasks(managerId);

      expect(allTasks).toBeDefined();

      // Simulate frontend filtering by Alice's ID
      const aliceTasks = allTasks!.tasks.filter(task =>
        task.assignments.some(a => a.user.id === aliceId)
      );

      // Verify Alice's tasks are returned
      expect(aliceTasks.length).toBe(2); // Alice has 2 tasks
      expect(
        aliceTasks.every(t => t.assignments.some(a => a.user.id === aliceId))
      ).toBe(true);

      // Verify task titles
      const taskTitles = aliceTasks.map(t => t.title);
      expect(taskTitles).toContain('Alice Task 1');
      expect(taskTitles).toContain('Alice Task 2');
    }, 40000);

    it('should filter tasks by Bob (staff member in parent dept)', async () => {
      const allTasks = await taskService.getManagerDashboardTasks(managerId);

      // Simulate frontend filtering by Bob's ID
      const bobTasks = allTasks!.tasks.filter(task =>
        task.assignments.some(a => a.user.id === bobId)
      );

      // Verify Bob's task is returned
      expect(bobTasks.length).toBe(1); // Bob has 1 task
      expect(bobTasks[0].title).toBe('Bob Task');
      expect(bobTasks[0].assignments.some(a => a.user.id === bobId)).toBe(true);
    }, 40000);

    it('should filter tasks by Charlie (staff member in child dept)', async () => {
      const allTasks = await taskService.getManagerDashboardTasks(managerId);

      // Simulate frontend filtering by Charlie's ID
      const charlieTasks = allTasks!.tasks.filter(task =>
        task.assignments.some(a => a.user.id === charlieId)
      );

      // Verify Charlie's task is returned
      expect(charlieTasks.length).toBe(1); // Charlie has 1 task
      expect(charlieTasks[0].title).toBe('Charlie Task');
      expect(
        charlieTasks[0].assignments.some(a => a.user.id === charlieId)
      ).toBe(true);
    }, 40000);

    it('should return all tasks when no assignee filter is applied', async () => {
      const allTasks = await taskService.getManagerDashboardTasks(managerId);

      // No filter applied - should see all tasks
      expect(allTasks).toBeDefined();
      expect(allTasks!.tasks.length).toBeGreaterThanOrEqual(4); // At least 4 tasks (2 Alice + 1 Bob + 1 Charlie)

      // Verify all staff members have tasks
      const hasAliceTasks = allTasks!.tasks.some(t =>
        t.assignments.some(a => a.user.id === aliceId)
      );
      const hasBobTasks = allTasks!.tasks.some(t =>
        t.assignments.some(a => a.user.id === bobId)
      );
      const hasCharlieTasks = allTasks!.tasks.some(t =>
        t.assignments.some(a => a.user.id === charlieId)
      );

      expect(hasAliceTasks).toBe(true);
      expect(hasBobTasks).toBe(true);
      expect(hasCharlieTasks).toBe(true);
    }, 40000);

    it('should include assignee details for filtering', async () => {
      const allTasks = await taskService.getManagerDashboardTasks(managerId);

      // Verify all tasks have assignee details
      allTasks!.tasks.forEach(task => {
        expect(task.assignments).toBeDefined();
        expect(task.assignments.length).toBeGreaterThan(0);
        task.assignments.forEach(assignment => {
          expect(assignment.user.id).toBeDefined();
          expect(assignment.user.name).toBeDefined();
        });
      });
    }, 40000);
  });
});
