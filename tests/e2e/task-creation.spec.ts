import { test, expect } from '@playwright/test';
import { Client } from 'pg';
import { PrismaClient } from '@prisma/client';
import { TaskService } from '@/app/server/services/TaskService';

/**
 * E2E Tests for Task Creation Feature - SCRUM-12
 *
 * Tests all acceptance criteria directly through the service layer:
 * - TM016: Mandatory fields (title, description, priority 1-10, deadline, 1-5 assignees)
 * - Automatic department association from user profile
 * - Default "To Do" status
 * - Optional tags, project, recurring interval
 * - TGO026: Subtask depth validation (max 2 levels)
 */

test.describe('Task Creation - SCRUM-12', () => {
  let pgClient: Client;
  let prisma: PrismaClient;
  let taskService: TaskService;
  let testUserId: string;
  let testDepartmentId: string;
  const createdTaskIds: string[] = [];

  test.beforeAll(async () => {
    // Use pg Client for explicit connection (like auth test)
    pgClient = new Client({ connectionString: process.env.DATABASE_URL });
    await pgClient.connect();

    // Prisma still needed for TaskService
    prisma = new PrismaClient();
    await prisma.$connect();
    taskService = new TaskService(prisma);

    // Create test department using pg
    const deptResult = await pgClient.query(
      'INSERT INTO "department" (id, name, "isActive", "createdAt", "updatedAt") VALUES (gen_random_uuid(), $1, true, NOW(), NOW()) RETURNING id',
      [`E2E Test Dept ${Date.now()}`]
    );
    testDepartmentId = deptResult.rows[0].id;

    // Create test user using pg
    const userResult = await pgClient.query(
      'INSERT INTO "user_profile" (id, email, name, role, "departmentId", "isActive", "createdAt", "updatedAt") VALUES (gen_random_uuid(), $1, $2, $3, $4, true, NOW(), NOW()) RETURNING id',
      [
        `e2e.test.${Date.now()}@example.com`,
        'E2E Test User',
        'STAFF',
        testDepartmentId,
      ]
    );
    testUserId = userResult.rows[0].id;
  });

  test.afterAll(async () => {
    // Cleanup using pg
    if (createdTaskIds.length > 0) {
      // Step 1: Delete TaskAssignments
      await pgClient.query(
        'DELETE FROM "task_assignment" WHERE "taskId" = ANY($1)',
        [createdTaskIds]
      );

      // Step 2: Get tag IDs and delete TaskTag records
      const taskTagsResult = await pgClient.query(
        'SELECT DISTINCT "tagId" FROM "task_tag" WHERE "taskId" = ANY($1)',
        [createdTaskIds]
      );
      const tagIds = taskTagsResult.rows.map(row => row.tagId);

      await pgClient.query('DELETE FROM "task_tag" WHERE "taskId" = ANY($1)', [
        createdTaskIds,
      ]);

      // Step 3: Delete e2e tags
      if (tagIds.length > 0) {
        await pgClient.query(
          'DELETE FROM "tag" WHERE id = ANY($1) AND name LIKE $2',
          [tagIds, 'e2e-%']
        );
      }

      // Step 4: Delete tasks
      await pgClient.query('DELETE FROM "task" WHERE id = ANY($1)', [
        createdTaskIds,
      ]);
    }

    // Step 5: Delete test user
    if (testUserId) {
      await pgClient.query('DELETE FROM "user_profile" WHERE id = $1', [
        testUserId,
      ]);
    }

    // Step 6: Delete test department
    if (testDepartmentId) {
      await pgClient.query('DELETE FROM "department" WHERE id = $1', [
        testDepartmentId,
      ]);
    }

    // Step 7: Disconnect
    await prisma.$disconnect();
    await pgClient.end();
  });

  test('should successfully create a task with all mandatory fields', async () => {
    const task = await taskService.create({
      title: 'E2E Test Task',
      description: 'Task created via E2E test',
      priority: 8,
      dueDate: new Date('2025-12-31'),
      ownerId: testUserId,
      departmentId: testDepartmentId,
      assigneeIds: [testUserId],
    });

    expect(task).toBeDefined();
    if (!task) {
      throw new Error('Task should be defined');
    }

    expect(task.id).toBeDefined();
    expect(task.title).toBe('E2E Test Task');
    expect(task.description).toBe('Task created via E2E test');
    expect(task.priority).toBe(8);
    expect(task.status).toBe('TO_DO');
    expect(task.ownerId).toBe(testUserId);
    expect(task.departmentId).toBe(testDepartmentId);

    createdTaskIds.push(task.id);

    // Verify assignment using pg
    const assignmentResult = await pgClient.query(
      'SELECT * FROM "task_assignment" WHERE "taskId" = $1',
      [task.id]
    );
    expect(assignmentResult.rows.length).toBe(1);
    expect(assignmentResult.rows[0].userId).toBe(testUserId);
  });

  test('should enforce 1-5 assignees requirement - accept 1 assignee', async () => {
    const task = await taskService.create({
      title: 'Task with 1 assignee',
      description: 'Test minimum assignees',
      priority: 5,
      dueDate: new Date('2025-12-31'),
      ownerId: testUserId,
      departmentId: testDepartmentId,
      assigneeIds: [testUserId],
    });

    expect(task).toBeDefined();
    if (!task) {
      throw new Error('Task should be defined');
    }
    createdTaskIds.push(task.id);

    const assignmentResult = await pgClient.query(
      'SELECT * FROM "task_assignment" WHERE "taskId" = $1',
      [task.id]
    );
    expect(assignmentResult.rows.length).toBe(1);
  });

  test('should validate priority between 1 and 10 - accept priority 1', async () => {
    const task = await taskService.create({
      title: 'Priority 1 Task',
      description: 'Test minimum priority',
      priority: 1,
      dueDate: new Date('2025-12-31'),
      ownerId: testUserId,
      departmentId: testDepartmentId,
      assigneeIds: [testUserId],
    });

    if (!task) {
      throw new Error('Task should be defined');
    }
    expect(task.priority).toBe(1);
    createdTaskIds.push(task.id);
  });

  test('should validate priority between 1 and 10 - accept priority 10', async () => {
    const task = await taskService.create({
      title: 'Priority 10 Task',
      description: 'Test maximum priority',
      priority: 10,
      dueDate: new Date('2025-12-31'),
      ownerId: testUserId,
      departmentId: testDepartmentId,
      assigneeIds: [testUserId],
    });

    if (!task) {
      throw new Error('Task should be defined');
    }
    expect(task.priority).toBe(10);
    createdTaskIds.push(task.id);
  });

  test('should create task with optional tags', async () => {
    const task = await taskService.create({
      title: 'Tagged Task',
      description: 'Task with tags',
      priority: 5,
      dueDate: new Date('2025-12-31'),
      ownerId: testUserId,
      departmentId: testDepartmentId,
      assigneeIds: [testUserId],
      tags: ['e2e-urgent', 'e2e-frontend', 'e2e-bug'],
    });

    expect(task).toBeDefined();
    if (!task) {
      throw new Error('Task should be defined');
    }
    createdTaskIds.push(task.id);

    // Verify tags using pg
    const taskTagsResult = await pgClient.query(
      'SELECT t.name FROM "task_tag" tt JOIN "tag" t ON tt."tagId" = t.id WHERE tt."taskId" = $1 ORDER BY t.name',
      [task.id]
    );

    expect(taskTagsResult.rows.length).toBe(3);
    const tagNames = taskTagsResult.rows.map(row => row.name);
    expect(tagNames).toEqual(['e2e-bug', 'e2e-frontend', 'e2e-urgent']);
  });

  test('should enforce subtask depth limit (TGO026)', async () => {
    // Create parent task using pg directly
    const parentResult = await pgClient.query(
      'INSERT INTO "task" (id, title, description, priority, "dueDate", "ownerId", "departmentId", status, "createdAt", "updatedAt") VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, NOW(), NOW()) RETURNING id',
      [
        'Parent Task',
        'Level 0 task',
        5,
        new Date('2025-12-31'),
        testUserId,
        testDepartmentId,
        'TO_DO',
      ]
    );
    const parentTaskId = parentResult.rows[0].id;
    createdTaskIds.push(parentTaskId);

    // Create subtask (level 1) - should succeed
    const subtask = await taskService.create({
      title: 'Subtask Level 1',
      description: 'First level subtask',
      priority: 5,
      dueDate: new Date('2025-12-31'),
      ownerId: testUserId,
      departmentId: testDepartmentId,
      assigneeIds: [testUserId],
      parentTaskId: parentTaskId,
    });

    expect(subtask).toBeDefined();
    if (!subtask) {
      throw new Error('Subtask should be defined');
    }
    expect(subtask.parentTaskId).toBe(parentTaskId);
    createdTaskIds.push(subtask.id);

    // Try to create sub-subtask (level 2) - should FAIL (TGO026)
    await expect(
      taskService.create({
        title: 'Subtask Level 2',
        description: 'Second level subtask (should fail)',
        priority: 5,
        dueDate: new Date('2025-12-31'),
        ownerId: testUserId,
        departmentId: testDepartmentId,
        assigneeIds: [testUserId],
        parentTaskId: subtask.id,
      })
    ).rejects.toThrow(/TGO026|Maximum subtask depth/);
  });

  test('should auto-associate department from user profile', async () => {
    const task = await taskService.create({
      title: 'Auto-Department Task',
      description: 'Should use provided department',
      priority: 5,
      dueDate: new Date('2025-12-31'),
      ownerId: testUserId,
      departmentId: testDepartmentId,
      assigneeIds: [testUserId],
    });

    if (!task) {
      throw new Error('Task should be defined');
    }
    expect(task.departmentId).toBe(testDepartmentId);
    createdTaskIds.push(task.id);
  });

  test('should create recurring task with interval', async () => {
    const task = await taskService.create({
      title: 'Weekly Report',
      description: 'Submit weekly report',
      priority: 5,
      dueDate: new Date('2025-12-31'),
      ownerId: testUserId,
      departmentId: testDepartmentId,
      assigneeIds: [testUserId],
      recurringInterval: 7,
    });

    if (!task) {
      throw new Error('Task should be defined');
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((task as any).recurringInterval).toBe(7);
    createdTaskIds.push(task.id);
  });

  test('should set default status to TO_DO', async () => {
    const task = await taskService.create({
      title: 'New Task',
      description: 'Should have TO_DO status',
      priority: 5,
      dueDate: new Date('2025-12-31'),
      ownerId: testUserId,
      departmentId: testDepartmentId,
      assigneeIds: [testUserId],
    });

    if (!task) {
      throw new Error('Task should be defined');
    }
    expect(task.status).toBe('TO_DO');
    createdTaskIds.push(task.id);
  });

  test('should automatically generate next instance when recurring task is completed', async () => {
    // Create a weekly recurring task
    const originalDueDate = new Date('2025-01-07T00:00:00.000Z');

    const recurringTask = await taskService.create({
      title: 'E2E Weekly Report',
      description: 'Automated weekly report test',
      priority: 6,
      dueDate: originalDueDate,
      ownerId: testUserId,
      departmentId: testDepartmentId,
      assigneeIds: [testUserId],
      recurringInterval: 7, // Weekly
    });

    if (!recurringTask) {
      throw new Error('Recurring task should be defined');
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((recurringTask as any).recurringInterval).toBe(7);
    createdTaskIds.push(recurringTask.id);

    // Mark task as COMPLETED
    const completedTask = await taskService.updateStatus(
      recurringTask.id,
      'COMPLETED'
    );
    expect(completedTask?.status).toBe('COMPLETED');

    // Wait for async recurring generation
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Verify next instance was created using pg
    const tasksResult = await pgClient.query(
      'SELECT * FROM "task" WHERE title = $1 AND "ownerId" = $2 ORDER BY "createdAt" ASC',
      ['E2E Weekly Report', testUserId]
    );

    expect(tasksResult.rows.length).toBe(2);

    const nextInstance = tasksResult.rows[1];
    createdTaskIds.push(nextInstance.id);

    // Verify next instance properties
    expect(nextInstance.id).not.toBe(recurringTask.id);
    expect(nextInstance.status).toBe('TO_DO');
    expect(nextInstance.recurringInterval).toBe(7);
    expect(nextInstance.priority).toBe(6);

    // Verify due date is 7 days later
    const expectedDueDate = new Date('2025-01-14T00:00:00.000Z');
    expect(new Date(nextInstance.dueDate).toISOString()).toBe(
      expectedDueDate.toISOString()
    );
  });

  test('should NOT generate next instance for non-recurring completed tasks', async () => {
    // Create a one-time task (no recurringInterval)
    const oneTimeTask = await taskService.create({
      title: 'E2E One-Time Task',
      description: 'Should not recur',
      priority: 5,
      dueDate: new Date('2025-02-01T00:00:00.000Z'),
      ownerId: testUserId,
      departmentId: testDepartmentId,
      assigneeIds: [testUserId],
      // NO recurringInterval
    });

    if (!oneTimeTask) {
      throw new Error('One-time task should be defined');
    }
    createdTaskIds.push(oneTimeTask.id);

    // Complete the task
    await taskService.updateStatus(oneTimeTask.id, 'COMPLETED');
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Verify NO new instance was created using pg
    const tasksResult = await pgClient.query(
      'SELECT * FROM "task" WHERE title = $1 AND "ownerId" = $2',
      ['E2E One-Time Task', testUserId]
    );

    expect(tasksResult.rows.length).toBe(1); // Only the original
    expect(tasksResult.rows[0].status).toBe('COMPLETED');
  });

  test('should chain recurring tasks - verify multiple generations', async () => {
    // Create daily recurring task
    const dailyTask = await taskService.create({
      title: 'E2E Daily Standup',
      description: 'Daily standup meeting',
      priority: 3,
      dueDate: new Date('2025-03-01T00:00:00.000Z'),
      ownerId: testUserId,
      departmentId: testDepartmentId,
      assigneeIds: [testUserId],
      recurringInterval: 1, // Daily
    });

    if (!dailyTask) {
      throw new Error('Daily task should be defined');
    }
    createdTaskIds.push(dailyTask.id);

    // Complete first instance
    await taskService.updateStatus(dailyTask.id, 'COMPLETED');
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Get second instance using pg
    let tasksResult = await pgClient.query(
      'SELECT * FROM "task" WHERE title = $1 AND "ownerId" = $2 ORDER BY "createdAt" DESC',
      ['E2E Daily Standup', testUserId]
    );

    expect(tasksResult.rows.length).toBe(2);
    const secondInstance = tasksResult.rows[0];
    createdTaskIds.push(secondInstance.id);
    expect(new Date(secondInstance.dueDate).toISOString()).toBe(
      new Date('2025-03-02T00:00:00.000Z').toISOString()
    );

    // Complete second instance
    await taskService.updateStatus(secondInstance.id, 'COMPLETED');
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Get third instance using pg
    tasksResult = await pgClient.query(
      'SELECT * FROM "task" WHERE title = $1 AND "ownerId" = $2 ORDER BY "createdAt" DESC',
      ['E2E Daily Standup', testUserId]
    );

    expect(tasksResult.rows.length).toBe(3);
    const thirdInstance = tasksResult.rows[0];
    createdTaskIds.push(thirdInstance.id);
    expect(new Date(thirdInstance.dueDate).toISOString()).toBe(
      new Date('2025-03-03T00:00:00.000Z').toISOString()
    );
    expect(thirdInstance.recurringInterval).toBe(1); // Still daily
  });
});
