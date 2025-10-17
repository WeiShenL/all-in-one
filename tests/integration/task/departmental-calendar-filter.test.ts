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
import { TaskService } from '@/app/server/services/TaskService';
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

  beforeAll(async () => {
    // Connect to database
    pgClient = new Client({ connectionString: process.env.DATABASE_URL });
    await pgClient.connect();

    // Initialize Prisma client and service
    prisma = new PrismaClient();
    taskService = new TaskService(prisma);

    // Create unique names for this test run
    const unique = Date.now();
    parentDeptName = `Filter Parent Dept ${unique}`;
    childDeptName = `Filter Child Dept ${unique}`;
    peerDeptName = `Filter Peer Dept ${unique}`;

    // Clean up any leftover test data from previous failed runs
    await pgClient.query(
      `DELETE FROM "task_assignment" WHERE "assignedById" IN (
        SELECT id FROM "user_profile" WHERE email LIKE '%@filter.test.com'
      )`
    );
    await pgClient.query(
      `DELETE FROM "task" WHERE "ownerId" IN (
        SELECT id FROM "user_profile" WHERE email LIKE '%@filter.test.com'
      )`
    );
    await pgClient.query(
      `DELETE FROM "user_profile" WHERE email LIKE '%@filter.test.com'`
    );
    await pgClient.query(
      `DELETE FROM "department" WHERE name LIKE 'Filter % Dept %'`
    );

    // Create parent department (manager's department)
    const parentDeptResult = await pgClient.query(
      `INSERT INTO "department" (id, name, "isActive", "createdAt", "updatedAt")
       VALUES (gen_random_uuid(), $1, true, NOW(), NOW())
       RETURNING id`,
      [parentDeptName]
    );
    parentDeptId = parentDeptResult.rows[0].id;

    // Create child department (subordinate)
    const childDeptResult = await pgClient.query(
      `INSERT INTO "department" (id, name, "parentId", "isActive", "createdAt", "updatedAt")
       VALUES (gen_random_uuid(), $1, $2, true, NOW(), NOW())
       RETURNING id`,
      [childDeptName, parentDeptId]
    );
    childDeptId = childDeptResult.rows[0].id;

    // Create peer department (should NOT be accessible)
    const peerDeptResult = await pgClient.query(
      `INSERT INTO "department" (id, name, "isActive", "createdAt", "updatedAt")
       VALUES (gen_random_uuid(), $1, true, NOW(), NOW())
       RETURNING id`,
      [peerDeptName]
    );
    peerDeptId = peerDeptResult.rows[0].id;

    // Create manager user in parent department
    const managerResult = await pgClient.query(
      `INSERT INTO "user_profile" (id, email, name, role, "departmentId", "isActive", "createdAt", "updatedAt")
       VALUES (gen_random_uuid(), $1, $2, $3, $4, true, NOW(), NOW())
       RETURNING id`,
      [
        `filter.manager.${unique}@filter.test.com`,
        'Filter Manager',
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
        `filter.staff.parent.${unique}@filter.test.com`,
        'Staff Parent',
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
      [
        `filter.staff.child.${unique}@filter.test.com`,
        'Staff Child',
        'STAFF',
        childDeptId,
      ]
    );
    staffInChildId = staffChildResult.rows[0].id;

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
  });

  afterAll(async () => {
    // Clean up in proper order to avoid foreign key constraint violations

    // 1. Delete task assignments first
    if (parentTaskId && childTaskId && peerTaskId) {
      await pgClient.query(
        `DELETE FROM "task_assignment" WHERE "taskId" IN ($1, $2, $3)`,
        [parentTaskId, childTaskId, peerTaskId]
      );
    }

    // 2. Delete tasks
    if (parentTaskId && childTaskId && peerTaskId) {
      await pgClient.query(`DELETE FROM "task" WHERE id IN ($1, $2, $3)`, [
        parentTaskId,
        childTaskId,
        peerTaskId,
      ]);
    }

    // 3. Clean up test users
    if (managerId && staffInParentId && staffInChildId) {
      await pgClient.query(
        `DELETE FROM "user_profile" WHERE id IN ($1, $2, $3)`,
        [managerId, staffInParentId, staffInChildId]
      );
    }

    // 4. Clean up test departments (child first due to FK, then others)
    if (childDeptId && parentDeptId && peerDeptId) {
      await pgClient.query(
        `DELETE FROM "department" WHERE id IN ($1, $2, $3)`,
        [childDeptId, parentDeptId, peerDeptId]
      );
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
  }, 15000);
});
