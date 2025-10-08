/**
 * @jest-environment node
 *
 * Integration Tests for Recurring Task Functionality
 * Tests automatic generation of next recurring task instance with real database
 */

import { PrismaClient } from '@prisma/client';
import { TaskService } from '@/app/server/services/TaskService';

const prisma = new PrismaClient();
const taskService = new TaskService(prisma);

describe('Integration Tests - Recurring Tasks', () => {
  let testDepartmentId: string;
  let testUserId1: string;
  let testUserId2: string;
  let testProjectId: string;
  const createdTaskIds: string[] = [];
  const createdTagIds: string[] = [];

  beforeAll(async () => {
    // connect to DB first
    await prisma.$connect();
    // Create test department
    const department = await prisma.department.create({
      data: {
        name: `Recurring Test Dept ${Date.now()}`,
        isActive: true,
      },
    });
    testDepartmentId = department.id;

    // Create test users
    const user1 = await prisma.userProfile.create({
      data: {
        email: `recurring.test1.${Date.now()}@example.com`,
        name: 'Recurring Test User 1',
        role: 'STAFF',
        departmentId: testDepartmentId,
        isActive: true,
      },
    });
    testUserId1 = user1.id;

    const user2 = await prisma.userProfile.create({
      data: {
        email: `recurring.test2.${Date.now()}@example.com`,
        name: 'Recurring Test User 2',
        role: 'STAFF',
        departmentId: testDepartmentId,
        isActive: true,
      },
    });
    testUserId2 = user2.id;

    // Create test project
    const project = await prisma.project.create({
      data: {
        name: `Recurring Test Project ${Date.now()}`,
        description: 'Project for recurring task tests',
        priority: 5,
        status: 'ACTIVE',
        departmentId: testDepartmentId,
        creatorId: testUserId1,
      },
    });
    testProjectId = project.id;
  });

  afterAll(async () => {
    // Cleanup in correct order
    if (createdTaskIds.length > 0) {
      await prisma.taskAssignment.deleteMany({
        where: { taskId: { in: createdTaskIds } },
      });

      await prisma.taskTag.deleteMany({
        where: { taskId: { in: createdTaskIds } },
      });

      await prisma.task.deleteMany({
        where: { id: { in: createdTaskIds } },
      });
    }

    if (createdTagIds.length > 0) {
      await prisma.tag.deleteMany({
        where: { id: { in: createdTagIds } },
      });
    }

    if (testProjectId) {
      await prisma.project
        .delete({ where: { id: testProjectId } })
        .catch(() => {});
    }

    if (testUserId1) {
      await prisma.userProfile
        .delete({ where: { id: testUserId1 } })
        .catch(() => {});
    }

    if (testUserId2) {
      await prisma.userProfile
        .delete({ where: { id: testUserId2 } })
        .catch(() => {});
    }

    if (testDepartmentId) {
      await prisma.department
        .delete({ where: { id: testDepartmentId } })
        .catch(() => {});
    }

    await prisma.$disconnect();
  });

  describe('Recurring Task Generation', () => {
    it('should automatically create next instance when recurring task is completed', async () => {
      // Create a recurring task - weekly report due next Monday
      const originalDueDate = new Date('2025-01-13T00:00:00.000Z');

      const task = await taskService.create({
        title: 'Weekly Status Report',
        description: 'Submit weekly progress to manager',
        priority: 7,
        dueDate: originalDueDate,
        ownerId: testUserId1,
        assigneeIds: [testUserId1, testUserId2],
        departmentId: testDepartmentId,
        projectId: testProjectId,
        recurringInterval: 7, // Weekly
      });

      expect(task).toBeDefined();
      if (!task) {
        throw new Error('Task should be defined');
      }
      expect(task.recurringInterval).toBe(7);
      createdTaskIds.push(task.id);

      // Mark task as COMPLETED
      const completedTask = await taskService.updateStatus(
        task.id,
        'COMPLETED'
      );
      expect(completedTask?.status).toBe('COMPLETED');

      // Wait a bit for async generation
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Verify next instance was created
      const allTasks = await prisma.task.findMany({
        where: {
          title: 'Weekly Status Report',
          ownerId: testUserId1,
          isArchived: false,
        },
        include: {
          assignments: true,
          tags: true,
        },
        orderBy: {
          createdAt: 'asc',
        },
      });

      expect(allTasks.length).toBe(2); // Original + new instance

      const originalTask = allTasks[0];
      const nextTask = allTasks[1];
      createdTaskIds.push(nextTask.id);

      // Verify original task is completed
      expect(originalTask.status).toBe('COMPLETED');
      expect(originalTask.id).toBe(task.id);

      // Verify next task properties
      expect(nextTask.id).not.toBe(task.id); // Different ID
      expect(nextTask.title).toBe('Weekly Status Report'); // Same title
      expect(nextTask.description).toBe('Submit weekly progress to manager');
      expect(nextTask.priority).toBe(7);
      expect(nextTask.status).toBe('TO_DO'); // Reset to TO_DO
      expect(nextTask.ownerId).toBe(testUserId1);
      expect(nextTask.departmentId).toBe(testDepartmentId);
      expect(nextTask.projectId).toBe(testProjectId);
      expect(nextTask.recurringInterval).toBe(7); // Preserved

      // Verify due date is 7 days later
      const expectedDueDate = new Date('2025-01-20T00:00:00.000Z');
      expect(nextTask.dueDate.toISOString()).toBe(
        expectedDueDate.toISOString()
      );

      // Verify assignees were copied
      expect(nextTask.assignments.length).toBe(2);
      const assigneeIds = nextTask.assignments.map(a => a.userId).sort();
      expect(assigneeIds).toEqual([testUserId1, testUserId2].sort());
    }, 30000);

    it('should preserve tags in next recurring instance', async () => {
      // Create tags
      const urgentTag = await prisma.tag.create({
        data: { name: `recurring-urgent-${Date.now()}` },
      });
      const reportTag = await prisma.tag.create({
        data: { name: `recurring-report-${Date.now()}` },
      });
      createdTagIds.push(urgentTag.id, reportTag.id);

      // Create recurring task with tags
      const task = await taskService.create({
        title: 'Monthly Report with Tags',
        description: 'Monthly recurring report',
        priority: 6,
        dueDate: new Date('2025-02-01T00:00:00.000Z'),
        ownerId: testUserId1,
        assigneeIds: [testUserId1],
        departmentId: testDepartmentId,
        recurringInterval: 30, // Monthly
        tags: [urgentTag.name, reportTag.name], // Pass tag names, not IDs
      });

      if (!task) {
        throw new Error('Task should be defined');
      }
      createdTaskIds.push(task.id);

      // Complete the task
      await taskService.updateStatus(task.id, 'COMPLETED');
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Find next instance
      const allTasks = await prisma.task.findMany({
        where: {
          title: 'Monthly Report with Tags',
          ownerId: testUserId1,
        },
        include: {
          tags: {
            include: {
              tag: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      expect(allTasks.length).toBe(2);
      const nextTask = allTasks[0];
      createdTaskIds.push(nextTask.id);

      // Verify tags were preserved
      expect(nextTask.tags.length).toBe(2);
      const tagNames = nextTask.tags.map(tt => tt.tag.name).sort();
      expect(tagNames).toContain(urgentTag.name);
      expect(tagNames).toContain(reportTag.name);
    }, 60000); // Increased timeout for staging database

    it('should support recurring subtasks', async () => {
      // Create parent task
      const parentTask = await taskService.create({
        title: 'Parent Project Task',
        description: 'Parent task',
        priority: 8,
        dueDate: new Date('2025-03-31T00:00:00.000Z'),
        ownerId: testUserId1,
        assigneeIds: [testUserId1],
        departmentId: testDepartmentId,
      });
      if (!parentTask) {
        throw new Error('Parent task should be defined');
      }
      createdTaskIds.push(parentTask.id);

      // Create recurring subtask
      const subtask = await taskService.create({
        title: 'Weekly Progress Update',
        description: 'Update parent task progress weekly',
        priority: 5,
        dueDate: new Date('2025-03-07T00:00:00.000Z'),
        ownerId: testUserId1,
        assigneeIds: [testUserId1],
        departmentId: testDepartmentId,
        parentTaskId: parentTask.id,
        recurringInterval: 7, // Weekly subtask
      });
      if (!subtask) {
        throw new Error('Subtask should be defined');
      }
      createdTaskIds.push(subtask.id);

      // Complete subtask
      await taskService.updateStatus(subtask.id, 'COMPLETED');
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Find next subtask instance
      const subtasks = await prisma.task.findMany({
        where: {
          title: 'Weekly Progress Update',
          parentTaskId: parentTask.id,
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      expect(subtasks.length).toBe(2);
      const nextSubtask = subtasks[0];
      createdTaskIds.push(nextSubtask.id);

      // Verify it's still a subtask of the same parent
      expect(nextSubtask.parentTaskId).toBe(parentTask.id);
      expect(nextSubtask.recurringInterval).toBe(7);
      expect(nextSubtask.dueDate.toISOString()).toBe(
        new Date('2025-03-14T00:00:00.000Z').toISOString()
      );
    }, 60000); // Increased timeout for staging database

    it('should NOT create next instance for non-recurring tasks', async () => {
      // Create one-time task (no recurringInterval)
      const task = await taskService.create({
        title: 'One-Time Task',
        description: 'This should not recur',
        priority: 5,
        dueDate: new Date('2025-04-01T00:00:00.000Z'),
        ownerId: testUserId1,
        assigneeIds: [testUserId1],
        departmentId: testDepartmentId,
        // NO recurringInterval
      });
      if (!task) {
        throw new Error('Task should be defined');
      }
      createdTaskIds.push(task.id);

      // Complete the task
      await taskService.updateStatus(task.id, 'COMPLETED');
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Verify no new instance was created
      const allTasks = await prisma.task.findMany({
        where: {
          title: 'One-Time Task',
          ownerId: testUserId1,
        },
      });

      expect(allTasks.length).toBe(1); // Only the original task
      expect(allTasks[0].status).toBe('COMPLETED');
    }, 30000);

    it('should NOT create next instance when task is marked as IN_PROGRESS', async () => {
      // Create recurring task
      const task = await taskService.create({
        title: 'Task Marked In Progress',
        description: 'Should not recur when in progress',
        priority: 5,
        dueDate: new Date('2025-05-01T00:00:00.000Z'),
        ownerId: testUserId1,
        assigneeIds: [testUserId1],
        departmentId: testDepartmentId,
        recurringInterval: 14, // Bi-weekly
      });
      if (!task) {
        throw new Error('Task should be defined');
      }
      createdTaskIds.push(task.id);

      // Mark as IN_PROGRESS (not COMPLETED)
      await taskService.updateStatus(task.id, 'IN_PROGRESS');
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Verify no new instance was created
      const allTasks = await prisma.task.findMany({
        where: {
          title: 'Task Marked In Progress',
          ownerId: testUserId1,
        },
      });

      expect(allTasks.length).toBe(1); // Only the original task
    }, 30000);

    it('should chain recurring tasks - complete 1st, complete 2nd, verify 3rd', async () => {
      // Create first recurring task
      const task1 = await taskService.create({
        title: 'Daily Standup',
        description: 'Daily team standup',
        priority: 3,
        dueDate: new Date('2025-06-01T00:00:00.000Z'),
        ownerId: testUserId1,
        assigneeIds: [testUserId1],
        departmentId: testDepartmentId,
        recurringInterval: 1, // Daily
      });
      if (!task1) {
        throw new Error('Task should be defined');
      }
      createdTaskIds.push(task1.id);

      // Complete first instance
      await taskService.updateStatus(task1.id, 'COMPLETED');
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Get second instance
      const allTasks1 = await prisma.task.findMany({
        where: {
          title: 'Daily Standup',
          ownerId: testUserId1,
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      expect(allTasks1.length).toBe(2);
      const task2 = allTasks1[0];
      createdTaskIds.push(task2.id);
      expect(task2.dueDate.toISOString()).toBe(
        new Date('2025-06-02T00:00:00.000Z').toISOString()
      );

      // Complete second instance
      await taskService.updateStatus(task2.id, 'COMPLETED');
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Get third instance
      const allTasks2 = await prisma.task.findMany({
        where: {
          title: 'Daily Standup',
          ownerId: testUserId1,
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      expect(allTasks2.length).toBe(3);
      const task3 = allTasks2[0];
      createdTaskIds.push(task3.id);
      expect(task3.dueDate.toISOString()).toBe(
        new Date('2025-06-03T00:00:00.000Z').toISOString()
      );
      expect(task3.recurringInterval).toBe(1); // Still daily
    }, 60000); // Increased timeout for staging database
  });
});
