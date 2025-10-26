/**
 * @jest-environment node
 *
 * Integration Tests for Task Involved Departments
 *
 * Tests API endpoints correctly return the dynamic list of involved departments
 * based on assignees in various scenarios.
 *
 * Acceptance Criteria:
 * - AC1: Task creation with assignee from Dept A → API returns Dept A in involvedDepartments
 * - AC2: Adding assignee from Dept B → API returns both Dept A and B
 * - AC3: Task with multiple department assignees → API returns all departments
 * - AC4: Removing last assignee from Dept A → API no longer returns Dept A
 *
 * Test Pattern: Real database + TaskService + tRPC endpoints
 * Uses pg client for setup/teardown and tRPC for API calls
 */

import { Client } from 'pg';
import { PrismaClient } from '@prisma/client';
import { appRouter } from '@/app/server/routers/_app';
import { createInnerTRPCContext } from '@/app/server/trpc';

// ============================================
// MOCK EMAILSERVICE TO PREVENT RESEND_API_KEY REQUIREMENT
// ============================================
jest.mock('@/app/server/services/EmailService', () => ({
  EmailService: jest.fn().mockImplementation(() => ({
    sendEmail: jest.fn().mockResolvedValue(undefined),
  })),
}));

// ============================================
// MOCK RESEND SDK (belt and suspenders)
// ============================================
jest.mock('resend', () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: {
      send: jest
        .fn()
        .mockResolvedValue({ data: { id: 'mock-email-id' }, error: null }),
    },
  })),
}));

// ============================================
// MOCK REALTIMESERVICE TO PREVENT SUPABASE CONNECTION
// ============================================
jest.mock('@/app/server/services/RealtimeService', () => ({
  RealtimeService: jest.fn().mockImplementation(() => ({
    sendNotification: jest.fn().mockResolvedValue(undefined),
  })),
}));

const prisma = new PrismaClient();
let pgClient: Client;

// Test data IDs
let testDepartmentAId: string;
let testDepartmentBId: string;
let testDepartmentCId: string;
let testUserDeptA: string;
let testUserDeptB: string;
let testUserDeptC: string;
let testProjectId: string;

// Track created tasks and users for cleanup
const createdTaskIds: string[] = [];
const createdManagerIds: string[] = [];

describe('Task Involved Departments - Integration Tests', () => {
  // Unique namespace for this test run
  const testNamespace = `dept-test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  /**
   * Helper to create tRPC caller with user context
   */
  function createCaller(
    userId: string,
    _role: 'STAFF' | 'MANAGER' | 'HR_ADMIN',
    _departmentId: string
  ) {
    const ctx = createInnerTRPCContext({
      session: {
        user: { id: userId },
        expires: new Date(Date.now() + 3600000).toISOString(),
      },
    });
    return appRouter.createCaller(ctx);
  }

  // Setup before all tests
  beforeAll(async () => {
    // Initialize pg client
    pgClient = new Client({
      connectionString: process.env.DATABASE_URL,
      connectionTimeoutMillis: 10000,
    });
    await pgClient.connect();

    // Create test departments
    const deptAResult = await pgClient.query(
      `INSERT INTO "department" (id, name, "isActive", "createdAt", "updatedAt")
       VALUES (gen_random_uuid(), $1, true, NOW(), NOW())
       RETURNING id`,
      [`Engineering-${testNamespace}`]
    );
    testDepartmentAId = deptAResult.rows[0].id;

    const deptBResult = await pgClient.query(
      `INSERT INTO "department" (id, name, "isActive", "createdAt", "updatedAt")
       VALUES (gen_random_uuid(), $1, true, NOW(), NOW())
       RETURNING id`,
      [`Marketing-${testNamespace}`]
    );
    testDepartmentBId = deptBResult.rows[0].id;

    const deptCResult = await pgClient.query(
      `INSERT INTO "department" (id, name, "isActive", "createdAt", "updatedAt")
       VALUES (gen_random_uuid(), $1, true, NOW(), NOW())
       RETURNING id`,
      [`Sales-${testNamespace}`]
    );
    testDepartmentCId = deptCResult.rows[0].id;

    // Create test users in different departments
    const userAResult = await pgClient.query(
      `INSERT INTO "user_profile" (id, email, name, role, "departmentId", "isActive", "createdAt", "updatedAt")
       VALUES (gen_random_uuid(), $1, $2, 'STAFF', $3, true, NOW(), NOW())
       RETURNING id`,
      [
        `user-deptA-${testNamespace}@test.com`,
        `User Dept A ${testNamespace}`,
        testDepartmentAId,
      ]
    );
    testUserDeptA = userAResult.rows[0].id;

    const userBResult = await pgClient.query(
      `INSERT INTO "user_profile" (id, email, name, role, "departmentId", "isActive", "createdAt", "updatedAt")
       VALUES (gen_random_uuid(), $1, $2, 'STAFF', $3, true, NOW(), NOW())
       RETURNING id`,
      [
        `user-deptB-${testNamespace}@test.com`,
        `User Dept B ${testNamespace}`,
        testDepartmentBId,
      ]
    );
    testUserDeptB = userBResult.rows[0].id;

    const userCResult = await pgClient.query(
      `INSERT INTO "user_profile" (id, email, name, role, "departmentId", "isActive", "createdAt", "updatedAt")
       VALUES (gen_random_uuid(), $1, $2, 'STAFF', $3, true, NOW(), NOW())
       RETURNING id`,
      [
        `user-deptC-${testNamespace}@test.com`,
        `User Dept C ${testNamespace}`,
        testDepartmentCId,
      ]
    );
    testUserDeptC = userCResult.rows[0].id;

    // Create test project
    const projectResult = await pgClient.query(
      `INSERT INTO "project" (id, name, "departmentId", "creatorId", "createdAt", "updatedAt")
       VALUES (gen_random_uuid(), $1, $2, $3, NOW(), NOW())
       RETURNING id`,
      [`Test Project ${testNamespace}`, testDepartmentAId, testUserDeptA]
    );
    testProjectId = projectResult.rows[0].id;
  }, 30000);

  // Cleanup after all tests
  afterAll(async () => {
    try {
      // Cleanup in reverse dependency order
      await pgClient.query('DELETE FROM "task_log" WHERE "taskId" = ANY($1)', [
        createdTaskIds,
      ]);
      await pgClient.query('DELETE FROM "comment" WHERE "taskId" = ANY($1)', [
        createdTaskIds,
      ]);
      await pgClient.query('DELETE FROM "task_tag" WHERE "taskId" = ANY($1)', [
        createdTaskIds,
      ]);
      await pgClient.query(
        'DELETE FROM "task_assignment" WHERE "taskId" = ANY($1)',
        [createdTaskIds]
      );
      await pgClient.query('DELETE FROM "task" WHERE id = ANY($1)', [
        createdTaskIds,
      ]);
      await pgClient.query('DELETE FROM "project" WHERE id = $1', [
        testProjectId,
      ]);
      await pgClient.query('DELETE FROM "user_profile" WHERE id = ANY($1)', [
        [testUserDeptA, testUserDeptB, testUserDeptC, ...createdManagerIds],
      ]);
      await pgClient.query('DELETE FROM "department" WHERE id = ANY($1)', [
        [testDepartmentAId, testDepartmentBId, testDepartmentCId],
      ]);
    } catch (error) {
      console.error('Cleanup failed:', error);
    } finally {
      await pgClient.end();
      await prisma.$disconnect();
    }
  }, 30000);

  // AC1: GIVEN a task is created and assigned to a user from Department A,
  // WHEN the task is saved, THEN Department A should show up as a department tag.
  test('AC1: should return Department A in involvedDepartments when task is created with assignee from Dept A', async () => {
    const caller = createCaller(testUserDeptA, 'STAFF', testDepartmentAId);

    // Create task with assignee from Department A
    const result = await caller.task.create({
      title: 'Task AC1',
      description: 'Test task for AC1',
      priority: 5,
      dueDate: new Date('2025-12-31'),
      assigneeIds: [testUserDeptA],
      projectId: testProjectId,
    });

    createdTaskIds.push(result.id);

    // Fetch task details to check involvedDepartments
    const task = await caller.task.getById({ taskId: result.id });

    expect(task).not.toBeNull();
    expect(task!.involvedDepartments).toBeDefined();
    expect(task!.involvedDepartments).toHaveLength(1);
    expect(task!.involvedDepartments![0]).toEqual({
      id: testDepartmentAId,
      name: `Engineering-${testNamespace}`,
      isActive: true,
    });
  }, 30000);

  // AC2: GIVEN a task currently linked to Department A, WHEN a user from Department B is assigned to the task,
  // THEN a new department tag is created for Department B AND the task now shows both the department tags for Department A and Department B.
  test('AC2: should return both Dept A and B after adding assignee from Dept B', async () => {
    const caller = createCaller(testUserDeptA, 'STAFF', testDepartmentAId);

    // Create task with assignee from Department A
    const result = await caller.task.create({
      title: 'Task AC2',
      description: 'Test task for AC2',
      priority: 5,
      dueDate: new Date('2025-12-31'),
      assigneeIds: [testUserDeptA],
      projectId: testProjectId,
    });

    createdTaskIds.push(result.id);

    // Add assignee from Department B
    await caller.task.addAssignee({
      taskId: result.id,
      userId: testUserDeptB,
    });

    // Fetch task details to check involvedDepartments
    const task = await caller.task.getById({ taskId: result.id });

    expect(task).not.toBeNull();
    expect(task!.involvedDepartments).toBeDefined();
    expect(task!.involvedDepartments).toHaveLength(2);
    expect(task!.involvedDepartments).toContainEqual({
      id: testDepartmentAId,
      name: `Engineering-${testNamespace}`,
      isActive: true,
    });
    expect(task!.involvedDepartments).toContainEqual({
      id: testDepartmentBId,
      name: `Marketing-${testNamespace}`,
      isActive: true,
    });
  }, 30000);

  // AC3: GIVEN a task linked to multiple departments (Dept A, Dept B, Dept C),
  // WHEN a user opens the task details/modal, THEN all linked departments are displayed in department tags.
  test('AC3: should return all three departments (A, B, C) when task has assignees from all three', async () => {
    const caller = createCaller(testUserDeptA, 'STAFF', testDepartmentAId);

    // Create task with assignees from all three departments
    const result = await caller.task.create({
      title: 'Task AC3',
      description: 'Test task for AC3',
      priority: 5,
      dueDate: new Date('2025-12-31'),
      assigneeIds: [testUserDeptA, testUserDeptB, testUserDeptC],
      projectId: testProjectId,
    });

    createdTaskIds.push(result.id);

    // Fetch task details to check involvedDepartments
    const task = await caller.task.getById({ taskId: result.id });

    expect(task).not.toBeNull();
    expect(task!.involvedDepartments).toBeDefined();
    expect(task!.involvedDepartments).toHaveLength(3);
    expect(task!.involvedDepartments).toContainEqual({
      id: testDepartmentAId,
      name: `Engineering-${testNamespace}`,
      isActive: true,
    });
    expect(task!.involvedDepartments).toContainEqual({
      id: testDepartmentBId,
      name: `Marketing-${testNamespace}`,
      isActive: true,
    });
    expect(task!.involvedDepartments).toContainEqual({
      id: testDepartmentCId,
      name: `Sales-${testNamespace}`,
      isActive: true,
    });
  }, 30000);

  // AC4: GIVEN a task has only one assignee from Department A, WHEN that assignee is removed from the task,
  // THEN the department tag for Department A is removed (while others are unchanged).
  test('AC4: should remove Department A from involvedDepartments when last assignee from Dept A is removed', async () => {
    // Create a manager user from Department B to avoid auto-assignment from Dept A
    const managerResult = await pgClient.query(
      `INSERT INTO "user_profile" (id, email, name, role, "departmentId", "isActive", "createdAt", "updatedAt")
       VALUES (gen_random_uuid(), $1, $2, 'MANAGER', $3, true, NOW(), NOW())
       RETURNING id`,
      [
        `manager-${testNamespace}@test.com`,
        `Manager ${testNamespace}`,
        testDepartmentBId, // Use Dept B so manager doesn't add Dept A
      ]
    );
    const managerId = managerResult.rows[0].id;
    createdManagerIds.push(managerId);

    const caller = createCaller(managerId, 'MANAGER', testDepartmentBId);

    // Create task with assignees from Dept A and B
    const result = await caller.task.create({
      title: 'Task AC4',
      description: 'Test task for AC4',
      priority: 5,
      dueDate: new Date('2025-12-31'),
      assigneeIds: [testUserDeptA, testUserDeptB],
      projectId: testProjectId,
    });

    createdTaskIds.push(result.id);

    // Remove assignee from Department A
    await caller.task.removeAssignee({
      taskId: result.id,
      userId: testUserDeptA,
    });

    // Fetch task details to check involvedDepartments
    const task = await caller.task.getById({ taskId: result.id });

    expect(task).not.toBeNull();
    expect(task!.involvedDepartments).toBeDefined();
    // Only parent department (Marketing/Dept B) should remain since we removed Dept A assignee
    expect(task!.involvedDepartments).toHaveLength(1);

    // Marketing (parent) should be present and active
    const marketingDept = task!.involvedDepartments!.find(
      d => d.id === testDepartmentBId
    );
    expect(marketingDept).toBeDefined();
    expect(marketingDept!.name).toBe(`Marketing-${testNamespace}`);
    expect(marketingDept!.isActive).toBe(true); // Has assignees (testUserDeptB)

    // Engineering (NOT parent) should be removed since no assignees left
    const engineeringDept = task!.involvedDepartments!.find(
      d => d.id === testDepartmentAId
    );
    expect(engineeringDept).toBeUndefined();
  }, 30000);

  // Additional test: Parent department ID should appear first
  test('should return parent department first in involvedDepartments list', async () => {
    const caller = createCaller(testUserDeptA, 'STAFF', testDepartmentAId);

    // Create task with assignees from Dept B and C (parent is Dept A)
    const result = await caller.task.create({
      title: 'Task Parent Dept',
      description: 'Test task for parent department priority',
      priority: 5,
      dueDate: new Date('2025-12-31'),
      assigneeIds: [testUserDeptB, testUserDeptC],
      projectId: testProjectId,
    });

    createdTaskIds.push(result.id);

    // Fetch task details to check involvedDepartments
    const task = await caller.task.getById({ taskId: result.id });

    expect(task).not.toBeNull();
    expect(task!.involvedDepartments).toBeDefined();
    expect(task!.involvedDepartments).toHaveLength(3);

    // Parent department (task.departmentId) should be first
    // It's inactive because the task only has assignees from Dept B and C, not A
    expect(task!.involvedDepartments![0]).toEqual({
      id: testDepartmentAId,
      name: `Engineering-${testNamespace}`,
      isActive: false, // No assignees from parent department
    });
  }, 30000);
});
