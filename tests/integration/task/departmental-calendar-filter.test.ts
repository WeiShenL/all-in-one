/**
 * @jest-environment node
 *
 * Integration Test for Departmental Calendar Filtering
 *
 * Tests that managers can filter departmental tasks by department name.
 * This simulates the frontend filtering logic in TaskCalendar component.
 *
 * Test Coverage:
 * - Manager can fetch tasks from their department hierarchy
 * - Frontend filtering by department name returns correct tasks
 * - Only departments within manager's hierarchy are accessible
 */

import { Client } from 'pg';
import { DashboardTaskService as TaskService } from '@/app/server/services/DashboardTaskService';
import { PrismaClient } from '@prisma/client';

describe('Integration Test - Departmental Calendar Filtering', () => {
  let pgClient: Client;
  let prisma: PrismaClient;
  let taskService: TaskService;

  // Test data IDs
  let parentDeptId: string;
  let parentDeptName: string;
  let childDeptId: string;
  let childDeptName: string;
  let peerDeptId: string;
  let peerDeptName: string;
  let managerId: string;
  let staffInParentId: string;
  let staffInChildId: string;
  let parentTaskId: string;
  let childTaskId: string;
  let peerTaskId: string;

  // Track created resources for comprehensive cleanup
  const createdUserIds: string[] = [];
  const createdDepartmentIds: string[] = [];

  // Generate unique namespace for parallel test execution
  const testNamespace = `filtercal-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

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

    // Create unique names for this test run
    parentDeptName = `Filter Parent Dept ${testNamespace}`;
    childDeptName = `Filter Child Dept ${testNamespace}`;
    peerDeptName = `Filter Peer Dept ${testNamespace}`;

    // Create parent department (manager's department)
    const parentDeptResult = await pgClient.query(
      `INSERT INTO "department" (id, name, "isActive", "createdAt", "updatedAt")
       VALUES (gen_random_uuid(), $1, true, NOW(), NOW())
       RETURNING id`,
      [parentDeptName]
    );
    parentDeptId = parentDeptResult.rows[0].id;
    createdDepartmentIds.push(parentDeptId);

    // Create child department (subordinate)
    const childDeptResult = await pgClient.query(
      `INSERT INTO "department" (id, name, "parentId", "isActive", "createdAt", "updatedAt")
       VALUES (gen_random_uuid(), $1, $2, true, NOW(), NOW())
       RETURNING id`,
      [childDeptName, parentDeptId]
    );
    childDeptId = childDeptResult.rows[0].id;
    createdDepartmentIds.push(childDeptId);

    // Create peer department (should NOT be accessible)
    const peerDeptResult = await pgClient.query(
      `INSERT INTO "department" (id, name, "isActive", "createdAt", "updatedAt")
       VALUES (gen_random_uuid(), $1, true, NOW(), NOW())
       RETURNING id`,
      [peerDeptName]
    );
    peerDeptId = peerDeptResult.rows[0].id;
    createdDepartmentIds.push(peerDeptId);

    // Create test users with namespaced emails
    managerId = await createTestUser(
      `filter.manager.${testNamespace}@test.com`,
      'Filter Manager',
      'MANAGER',
      parentDeptId
    );

    staffInParentId = await createTestUser(
      `filter.staff.parent.${testNamespace}@test.com`,
      'Staff Parent',
      'STAFF',
      parentDeptId
    );

    staffInChildId = await createTestUser(
      `filter.staff.child.${testNamespace}@test.com`,
      'Staff Child',
      'STAFF',
      childDeptId
    );

    // Create task in parent department
    const parentTaskResult = await pgClient.query(
      `INSERT INTO "task" (id, title, description, priority, "dueDate", status, "ownerId", "departmentId", "isArchived", "createdAt", "updatedAt")
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, false, NOW(), NOW())
       RETURNING id`,
      [
        'Parent Department Task',
        'Task in parent department',
        5,
        new Date('2025-12-31'),
        'TO_DO',
        managerId,
        parentDeptId,
      ]
    );
    parentTaskId = parentTaskResult.rows[0].id;
    await pgClient.query(
      `INSERT INTO "task_assignment" ("taskId", "userId", "assignedById", "assignedAt")
       VALUES ($1, $2, $3, NOW())`,
      [parentTaskId, staffInParentId, managerId]
    );

    // Create task in child department
    const childTaskResult = await pgClient.query(
      `INSERT INTO "task" (id, title, description, priority, "dueDate", status, "ownerId", "departmentId", "isArchived", "createdAt", "updatedAt")
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, false, NOW(), NOW())
       RETURNING id`,
      [
        'Child Department Task',
        'Task in child department',
        5,
        new Date('2025-12-31'),
        'IN_PROGRESS',
        managerId,
        childDeptId,
      ]
    );
    childTaskId = childTaskResult.rows[0].id;
    await pgClient.query(
      `INSERT INTO "task_assignment" ("taskId", "userId", "assignedById", "assignedAt")
       VALUES ($1, $2, $3, NOW())`,
      [childTaskId, staffInChildId, managerId]
    );

    // Create task in peer department (should NOT be fetched)
    const peerTaskResult = await pgClient.query(
      `INSERT INTO "task" (id, title, description, priority, "dueDate", status, "ownerId", "departmentId", "isArchived", "createdAt", "updatedAt")
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, false, NOW(), NOW())
       RETURNING id`,
      [
        'Peer Department Task',
        'Task in peer department',
        5,
        new Date('2025-12-31'),
        'TO_DO',
        managerId,
        peerDeptId,
      ]
    );
    peerTaskId = peerTaskResult.rows[0].id;
  }, 60000);

  afterAll(async () => {
    // Clean up in proper order to respect foreign key constraints

    // 1. Delete task assignments first
    if (parentTaskId && childTaskId && peerTaskId) {
      await pgClient.query(
        `DELETE FROM "task_assignment" WHERE "taskId" = ANY($1)`,
        [[parentTaskId, childTaskId, peerTaskId]]
      );
    }

    // 2. Delete tasks
    if (parentTaskId && childTaskId && peerTaskId) {
      await pgClient.query(`DELETE FROM "task" WHERE id = ANY($1)`, [
        [parentTaskId, childTaskId, peerTaskId],
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

  it('should filter tasks by department name (simulating frontend filter)', async () => {
    // Fetch all departmental tasks for manager
    const allTasks = await taskService.getDepartmentTasksForUser(managerId);

    expect(allTasks).toBeDefined();
    expect(allTasks.length).toBeGreaterThanOrEqual(2);

    // Extract unique department names (what would appear in the dropdown)
    const departments = Array.from(
      new Set(allTasks.map(task => task.department?.name).filter(Boolean))
    );

    // Verify departments list contains only accessible departments
    expect(departments).toContain(parentDeptName);
    expect(departments).toContain(childDeptName);
    expect(departments).not.toContain(peerDeptName); // Peer dept should NOT be accessible

    // Simulate frontend filtering by parent department
    const parentDeptTasks = allTasks.filter(
      task => task.department?.name === parentDeptName
    );
    expect(parentDeptTasks.length).toBeGreaterThan(0);
    expect(parentDeptTasks.some(t => t.id === parentTaskId)).toBe(true);
    expect(parentDeptTasks.some(t => t.id === childTaskId)).toBe(false);
    expect(parentDeptTasks.some(t => t.id === peerTaskId)).toBe(false);

    // Simulate frontend filtering by child department
    const childDeptTasks = allTasks.filter(
      task => task.department?.name === childDeptName
    );
    expect(childDeptTasks.length).toBeGreaterThan(0);
    expect(childDeptTasks.some(t => t.id === childTaskId)).toBe(true);
    expect(childDeptTasks.some(t => t.id === parentTaskId)).toBe(false);
    expect(childDeptTasks.some(t => t.id === peerTaskId)).toBe(false);

    // Verify "All Departments" (no filter) shows both parent and child tasks
    expect(allTasks.some(t => t.id === parentTaskId)).toBe(true);
    expect(allTasks.some(t => t.id === childTaskId)).toBe(true);
    expect(allTasks.some(t => t.id === peerTaskId)).toBe(false); // Peer never included
  }, 40000);
});
