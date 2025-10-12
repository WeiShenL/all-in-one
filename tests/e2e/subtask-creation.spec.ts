import { test, expect } from '@playwright/test';
import { Client } from 'pg';
import { PrismaClient } from '@prisma/client';
import {
  SubtaskService,
  UserContext,
} from '@/app/server/services/SubtaskService';
import { PrismaTaskRepository } from '@/repositories/PrismaTaskRepository';

/**
 * E2E Test for Subtask Creation - SCRUM-65
 *
 * Happy path test: Staff successfully creates a subtask under an assigned task
 */

test.describe('Subtask Creation E2E - SCRUM-65', () => {
  let pgClient: Client;
  let prisma: PrismaClient;
  let subtaskService: SubtaskService;
  let testUserId: string;
  let testDepartmentId: string;
  let testProjectId: string;
  let testParentTaskId: string;
  let userContext: UserContext;
  const createdTaskIds: string[] = [];

  test.beforeAll(async () => {
    pgClient = new Client({ connectionString: process.env.DATABASE_URL });
    await pgClient.connect();

    prisma = new PrismaClient();
    await prisma.$connect();

    const taskRepository = new PrismaTaskRepository(prisma);
    subtaskService = new SubtaskService(taskRepository);

    // Create test department
    const deptResult = await pgClient.query(
      'INSERT INTO "department" (id, name, "isActive", "createdAt", "updatedAt") VALUES (gen_random_uuid(), $1, true, NOW(), NOW()) RETURNING id',
      [`E2E Subtask Dept ${Date.now()}`]
    );
    testDepartmentId = deptResult.rows[0].id;

    // Create test user
    const userResult = await pgClient.query(
      'INSERT INTO "user_profile" (id, email, name, role, "departmentId", "isActive", "createdAt", "updatedAt") VALUES (gen_random_uuid(), $1, $2, $3, $4, true, NOW(), NOW()) RETURNING id',
      [
        `e2e.subtask.${Date.now()}@example.com`,
        'E2E Subtask User',
        'STAFF',
        testDepartmentId,
      ]
    );
    testUserId = userResult.rows[0].id;

    // Create test project
    const projectResult = await pgClient.query(
      'INSERT INTO "project" (id, name, description, priority, status, "departmentId", "creatorId", "isArchived", "createdAt", "updatedAt") VALUES (gen_random_uuid(), $1, $2, 5, $3, $4, $5, false, NOW(), NOW()) RETURNING id',
      [
        'E2E Subtask Project',
        'Test project',
        'ACTIVE',
        testDepartmentId,
        testUserId,
      ]
    );
    testProjectId = projectResult.rows[0].id;

    // Create parent task
    const parentResult = await pgClient.query(
      'INSERT INTO "task" (id, title, description, priority, "dueDate", status, "ownerId", "departmentId", "projectId", "parentTaskId", "recurringInterval", "isArchived", "createdAt", "updatedAt") VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, NULL, NULL, false, NOW(), NOW()) RETURNING id',
      [
        'E2E Parent Task',
        'Parent task for subtasks',
        5,
        new Date('2025-12-31'),
        'TO_DO',
        testUserId,
        testDepartmentId,
        testProjectId,
      ]
    );
    testParentTaskId = parentResult.rows[0].id;

    // Assign user to parent task
    await pgClient.query(
      'INSERT INTO "task_assignment" ("taskId", "userId", "assignedById", "assignedAt") VALUES ($1, $2, $2, NOW())',
      [testParentTaskId, testUserId]
    );

    userContext = {
      userId: testUserId,
      role: 'STAFF',
      departmentId: testDepartmentId,
    };
  });

  test.afterAll(async () => {
    // Cleanup
    for (const taskId of createdTaskIds) {
      await pgClient.query('DELETE FROM "task" WHERE id = $1', [taskId]);
    }
    if (testParentTaskId) {
      await pgClient.query('DELETE FROM "task" WHERE id = $1', [
        testParentTaskId,
      ]);
    }
    if (testProjectId) {
      await pgClient.query('DELETE FROM "project" WHERE id = $1', [
        testProjectId,
      ]);
    }
    if (testUserId) {
      await pgClient.query('DELETE FROM "user_profile" WHERE id = $1', [
        testUserId,
      ]);
    }
    if (testDepartmentId) {
      await pgClient.query('DELETE FROM "department" WHERE id = $1', [
        testDepartmentId,
      ]);
    }

    await prisma.$disconnect();
    await pgClient.end();
  });

  test('should successfully create a subtask under parent task', async () => {
    // Create subtask
    const result = await subtaskService.createSubtask(
      {
        title: 'E2E Test Subtask',
        description: 'Subtask created via E2E test',
        priority: 7,
        dueDate: new Date('2025-12-30'),
        assigneeIds: [testUserId],
        parentTaskId: testParentTaskId,
        tags: ['e2e', 'test'],
      },
      userContext
    );

    expect(result).toBeDefined();
    expect(result.id).toBeDefined();
    createdTaskIds.push(result.id);

    // Verify subtask in database
    const subtaskResult = await pgClient.query(
      'SELECT * FROM "task" WHERE id = $1',
      [result.id]
    );

    const subtask = subtaskResult.rows[0];
    expect(subtask.title).toBe('E2E Test Subtask');
    expect(subtask.description).toBe('Subtask created via E2E test');
    expect(subtask.priority).toBe(7);
    expect(subtask.status).toBe('TO_DO');
    expect(subtask.parentTaskId).toBe(testParentTaskId);
    expect(subtask.departmentId).toBe(testDepartmentId);
    expect(subtask.projectId).toBe(testProjectId);
    expect(subtask.recurringInterval).toBeNull();

    // Verify assignment
    const assignmentResult = await pgClient.query(
      'SELECT * FROM "task_assignment" WHERE "taskId" = $1',
      [result.id]
    );
    expect(assignmentResult.rows.length).toBe(1);
    expect(assignmentResult.rows[0].userId).toBe(testUserId);
  });
});
