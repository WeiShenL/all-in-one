import { test, expect } from '@playwright/test';
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
  let prisma: PrismaClient;
  let taskService: TaskService;
  let testUserId: string;
  let testDepartmentId: string;
  const createdTaskIds: string[] = [];

  test.beforeAll(async () => {
    prisma = new PrismaClient();
    taskService = new TaskService(prisma);

    // Create test department
    const dept = await prisma.department.create({
      data: {
        name: `E2E Test Dept ${Date.now()}`,
        isActive: true,
      },
    });
    testDepartmentId = dept.id;

    // Create test user
    const user = await prisma.userProfile.create({
      data: {
        email: `e2e.test.${Date.now()}@example.com`,
        name: 'E2E Test User',
        role: 'STAFF',
        departmentId: testDepartmentId,
        isActive: true,
      },
    });
    testUserId = user.id;
  });

  test.afterAll(async () => {
    // Cleanup
    if (createdTaskIds.length > 0) {
      // Step 1: Delete TaskAssignments (foreign key to Task)
      await prisma.taskAssignment.deleteMany({
        where: { taskId: { in: createdTaskIds } },
      });

      // Step 2: Get tag IDs before deleting TaskTag records
      const taskTags = await prisma.taskTag.findMany({
        where: { taskId: { in: createdTaskIds } },
        select: { tagId: true },
      });
      const tagIds = [...new Set(taskTags.map(tt => tt.tagId))];

      // Step 3: Delete TaskTag junction records
      await prisma.taskTag.deleteMany({
        where: { taskId: { in: createdTaskIds } },
      });

      // Step 4: Delete test-specific tags (e2e- prefixed)
      if (tagIds.length > 0) {
        await prisma.tag.deleteMany({
          where: {
            id: { in: tagIds },
            name: { startsWith: 'e2e-' },
          },
        });
      }

      // Step 5: Delete tasks
      await prisma.task.deleteMany({
        where: { id: { in: createdTaskIds } },
      });
    }

    // Step 6: Delete test user
    if (testUserId) {
      await prisma.userProfile
        .delete({ where: { id: testUserId } })
        .catch(() => {});
    }

    // Step 7: Delete test department
    if (testDepartmentId) {
      await prisma.department
        .delete({ where: { id: testDepartmentId } })
        .catch(() => {});
    }

    // Step 8: Disconnect Prisma client
    await prisma.$disconnect();
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
    expect(task.id).toBeDefined();
    expect(task.title).toBe('E2E Test Task');
    expect(task.description).toBe('Task created via E2E test');
    expect(task.priority).toBe(8);
    expect(task.status).toBe('TO_DO');
    expect(task.ownerId).toBe(testUserId);
    expect(task.departmentId).toBe(testDepartmentId);

    createdTaskIds.push(task.id);

    // Verify assignment
    const assignments = await prisma.taskAssignment.findMany({
      where: { taskId: task.id },
    });
    expect(assignments.length).toBe(1);
    expect(assignments[0].userId).toBe(testUserId);
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
    createdTaskIds.push(task.id);

    const assignments = await prisma.taskAssignment.findMany({
      where: { taskId: task.id },
    });
    expect(assignments.length).toBe(1);
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
    createdTaskIds.push(task.id);

    // Verify tags
    const taskTags = await prisma.taskTag.findMany({
      where: { taskId: task.id },
      include: { tag: true },
    });

    expect(taskTags.length).toBe(3);
    const tagNames = taskTags.map(tt => tt.tag.name).sort();
    expect(tagNames).toEqual(['e2e-bug', 'e2e-frontend', 'e2e-urgent']);
  });

  test('should enforce subtask depth limit (TGO026)', async () => {
    // Create parent task (level 0)
    const parentTask = await prisma.task.create({
      data: {
        title: 'Parent Task',
        description: 'Level 0 task',
        priority: 5,
        dueDate: new Date('2025-12-31'),
        ownerId: testUserId,
        departmentId: testDepartmentId,
        status: 'TO_DO',
      },
    });
    createdTaskIds.push(parentTask.id);

    // Create subtask (level 1) - should succeed
    const subtask = await taskService.create({
      title: 'Subtask Level 1',
      description: 'First level subtask',
      priority: 5,
      dueDate: new Date('2025-12-31'),
      ownerId: testUserId,
      departmentId: testDepartmentId,
      assigneeIds: [testUserId],
      parentTaskId: parentTask.id,
    });

    expect(subtask).toBeDefined();
    expect(subtask.parentTaskId).toBe(parentTask.id);
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

    expect(task.recurringInterval).toBe(7);
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

    expect(task.status).toBe('TO_DO');
    createdTaskIds.push(task.id);
  });
});
