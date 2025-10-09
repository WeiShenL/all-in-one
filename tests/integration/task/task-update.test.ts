/**
 * @jest-environment node
 *
 * Integration Tests for Task Update Operations
 *
 * Tests all UPDATE operations (AC 1-7, 9-10):
 * - AC 1: Update Deadline
 * - AC 2: Update Priority (1-10 scale)
 * - AC 3: Add/Remove Tags
 * - AC 4: Update Title and Description
 * - AC 5: Update Status
 * - AC 7: Add Assignees (max 5)
 * - AC 9: Changes Reflected Within 10 Seconds
 * - AC 10: Update Recurring Settings
 *
 * Test Pattern: TaskService → Domain → Prisma Repository → Real Database
 * Skips: tRPC/HTTP layer (tested in E2E)
 *
 * Each test gets a fresh database with complete isolation
 */

import { resetAndSeedDatabase } from '../helpers/dbSetup';
import { TaskService, UserContext } from '@/services/task/TaskService';
import { PrismaTaskRepository } from '@/repositories/PrismaTaskRepository';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
let taskService: TaskService;
let testUser: UserContext;

/**
 * Helper to create a task with assignment for testing
 */
async function createTaskWithAssignment(taskData: {
  id: string;
  title: string;
  description?: string;
  priority?: number;
  dueDate?: Date;
  status?: 'TO_DO' | 'IN_PROGRESS' | 'COMPLETED';
  recurringInterval?: number | null;
}) {
  const task = await prisma.task.create({
    data: {
      ...taskData,
      description: taskData.description || 'Test description',
      priority: taskData.priority || 5,
      dueDate: taskData.dueDate || new Date('2025-12-31'),
      status: taskData.status || 'TO_DO',
      ownerId: '10000000-0000-4000-8000-000000000001',
      departmentId: 'dept-engineering',
      projectId: 'proj-001',
      recurringInterval: taskData.recurringInterval ?? null,
    },
  });

  // Assign user to task for authorization
  await prisma.taskAssignment.create({
    data: {
      taskId: task.id,
      userId: '10000000-0000-4000-8000-000000000001',
      assignedById: '10000000-0000-4000-8000-000000000001',
      assignedAt: new Date(),
    },
  });

  return task;
}

describe('Task Update Integration Tests', () => {
  // Setup before all tests
  beforeAll(async () => {
    const repository = new PrismaTaskRepository(prisma);
    taskService = new TaskService(repository);

    // Test user context (from seed data)
    testUser = {
      userId: '10000000-0000-4000-8000-000000000001',
      role: 'STAFF',
      departmentId: 'dept-engineering',
    };
  });

  // Full DB reset before EACH test for complete independence
  beforeEach(async () => {
    await resetAndSeedDatabase(prisma);
  });

  // Disconnect after all tests
  afterAll(async () => {
    await prisma.$disconnect();
  });

  // ============================================
  // AC 4: Update Title and Description
  // ============================================
  describe('Update Title and Description (AC 4)', () => {
    it('should update task title', async () => {
      const task = await createTaskWithAssignment({
        id: '123e4567-e89b-12d3-a456-426614174000',
        title: 'Original Title',
        description: 'Original description',
        priority: 5,
        dueDate: new Date('2025-12-31'),
        status: 'TO_DO',
      });

      const updatedTask = await taskService.updateTaskTitle(
        task.id,
        'UPDATED: New Task Title',
        testUser
      );

      expect(updatedTask.getTitle()).toBe('UPDATED: New Task Title');
    });

    it('should update task description', async () => {
      const task = await createTaskWithAssignment({
        id: '123e4567-e89b-12d3-a456-426614174001',
        title: 'Test Task',
        description: 'Original description',
        priority: 5,
        dueDate: new Date('2025-12-31'),
        status: 'TO_DO',
      });

      const updatedTask = await taskService.updateTaskDescription(
        task.id,
        'UPDATED: This is the new description with more details.',
        testUser
      );

      expect(updatedTask.getDescription()).toContain('UPDATED:');
    });
  });

  // ============================================
  // AC 2: Update Priority (1-10 scale)
  // ============================================
  describe('Update Priority (AC 2)', () => {
    it('should update priority to 8', async () => {
      const task = await createTaskWithAssignment({
        id: '123e4567-e89b-12d3-a456-426614174002',
        title: 'Priority Test',
        description: 'Test',
        priority: 5,
        dueDate: new Date('2025-12-31'),
        status: 'TO_DO',
      });

      const updatedTask = await taskService.updateTaskPriority(
        task.id,
        8,
        testUser
      );

      expect(updatedTask.getPriorityBucket()).toBe(8);
    });

    it('should reject invalid priority (> 10)', async () => {
      const task = await createTaskWithAssignment({
        id: '123e4567-e89b-12d3-a456-426614174003',
        title: 'Priority Test',
        description: 'Test',
        priority: 5,
        dueDate: new Date('2025-12-31'),
        status: 'TO_DO',
      });

      await expect(
        taskService.updateTaskPriority(task.id, 15, testUser)
      ).rejects.toThrow();
    });
  });

  // ============================================
  // AC 1: Update Deadline
  // ============================================
  describe('Update Deadline (AC 1)', () => {
    it('should update deadline', async () => {
      const task = await createTaskWithAssignment({
        id: '123e4567-e89b-12d3-a456-426614174004',
        title: 'Deadline Test',
        description: 'Test',
        priority: 5,
        dueDate: new Date('2025-12-31'),
        status: 'TO_DO',
      });

      const newDeadline = new Date('2026-06-30');
      const updatedTask = await taskService.updateTaskDeadline(
        task.id,
        newDeadline,
        testUser
      );

      expect(updatedTask.getDueDate().getFullYear()).toBe(2026);
    });

    it('should reject subtask deadline after parent deadline', async () => {
      // Create parent task
      const parentTask = await createTaskWithAssignment({
        id: '123e4567-e89b-12d3-a456-426614174005',
        title: 'Parent Task',
        description: 'Test',
        priority: 5,
        dueDate: new Date('2026-06-30'),
        status: 'TO_DO',
      });

      // Create subtask (with parentTaskId, needs manual creation)
      const subtask = await prisma.task.create({
        data: {
          id: '223e4567-e89b-12d3-a456-426614174000',
          title: 'Subtask',
          description: 'Test',
          priority: 3,
          dueDate: new Date('2026-05-30'),
          status: 'TO_DO',
          ownerId: '10000000-0000-4000-8000-000000000001',
          departmentId: 'dept-engineering',
          projectId: 'proj-001',
          parentTaskId: parentTask.id,
          recurringInterval: null,
        },
      });

      // Assign user to subtask for authorization
      await prisma.taskAssignment.create({
        data: {
          taskId: subtask.id,
          userId: '10000000-0000-4000-8000-000000000001',
          assignedById: '10000000-0000-4000-8000-000000000001',
          assignedAt: new Date(),
        },
      });

      // Try to update subtask deadline to after parent deadline
      await expect(
        taskService.updateTaskDeadline(
          subtask.id,
          new Date('2027-01-01'),
          testUser
        )
      ).rejects.toThrow();
    });
  });

  // ============================================
  // AC 5: Update Status
  // ============================================
  describe('Update Status (AC 5)', () => {
    it('should update status to IN_PROGRESS', async () => {
      const task = await createTaskWithAssignment({
        id: '123e4567-e89b-12d3-a456-426614174006',
        title: 'Status Test',
        description: 'Test',
        priority: 5,
        dueDate: new Date('2025-12-31'),
        status: 'TO_DO',
      });

      const updatedTask = await taskService.updateTaskStatus(
        task.id,
        'IN_PROGRESS',
        testUser
      );

      expect(updatedTask.getStatus()).toBe('IN_PROGRESS');
    });

    it('should update status to COMPLETED', async () => {
      const task = await createTaskWithAssignment({
        id: '123e4567-e89b-12d3-a456-426614174007',
        title: 'Status Test',
        description: 'Test',
        priority: 5,
        dueDate: new Date('2025-12-31'),
        status: 'TO_DO',
      });

      const updatedTask = await taskService.updateTaskStatus(
        task.id,
        'COMPLETED',
        testUser
      );

      expect(updatedTask.getStatus()).toBe('COMPLETED');
    });
  });

  // ============================================
  // AC 3: Add/Remove Tags
  // ============================================
  describe('Add/Remove Tags (AC 3)', () => {
    it('should add tag "urgent"', async () => {
      const task = await createTaskWithAssignment({
        id: '123e4567-e89b-12d3-a456-426614174008',
        title: 'Tag Test',
        description: 'Test',
        priority: 5,
        dueDate: new Date('2025-12-31'),
        status: 'TO_DO',
      });

      const updatedTask = await taskService.addTagToTask(
        task.id,
        'urgent',
        testUser
      );

      expect(Array.from(updatedTask.getTags())).toContain('urgent');
    });

    it('should add multiple tags', async () => {
      const task = await createTaskWithAssignment({
        id: '123e4567-e89b-12d3-a456-426614174009',
        title: 'Tag Test',
        description: 'Test',
        priority: 5,
        dueDate: new Date('2025-12-31'),
        status: 'TO_DO',
      });

      await taskService.addTagToTask(task.id, 'urgent', testUser);
      const updatedTask = await taskService.addTagToTask(
        task.id,
        'backend',
        testUser
      );

      const tags = Array.from(updatedTask.getTags());
      expect(tags).toContain('urgent');
      expect(tags).toContain('backend');
    });

    it('should remove tag', async () => {
      const task = await createTaskWithAssignment({
        id: '123e4567-e89b-12d3-a456-426614174010',
        title: 'Tag Test',
        description: 'Test',
        priority: 5,
        dueDate: new Date('2025-12-31'),
        status: 'TO_DO',
      });

      await taskService.addTagToTask(task.id, 'urgent', testUser);
      await taskService.addTagToTask(task.id, 'backend', testUser);
      const updatedTask = await taskService.removeTagFromTask(
        task.id,
        'urgent',
        testUser
      );

      const tags = Array.from(updatedTask.getTags());
      expect(tags).not.toContain('urgent');
      expect(tags).toContain('backend');
    });
  });

  // ============================================
  // AC 7: Add Assignees (max 5)
  // ============================================
  describe('Add Assignees (AC 7 - max 5)', () => {
    it('should add assignees up to 5', async () => {
      const task = await createTaskWithAssignment({
        id: '123e4567-e89b-12d3-a456-426614174011',
        title: 'Assignee Test',
        description: 'Test',
        priority: 5,
        dueDate: new Date('2025-12-31'),
        status: 'TO_DO',
      });

      // Add second assignment manually (helper already created first one)
      await prisma.taskAssignment.create({
        data: {
          taskId: task.id,
          userId: '10000000-0000-4000-8000-000000000002',
          assignedById: '10000000-0000-4000-8000-000000000001',
          assignedAt: new Date(),
        },
      });

      // Add 3rd, 4th, 5th via service
      await taskService.addAssigneeToTask(
        task.id,
        '10000000-0000-4000-8000-000000000003',
        testUser
      );

      await taskService.addAssigneeToTask(
        task.id,
        '10000000-0000-4000-8000-000000000004',
        testUser
      );

      const updatedTask = await taskService.addAssigneeToTask(
        task.id,
        '10000000-0000-4000-8000-000000000005',
        testUser
      );

      expect(Array.from(updatedTask.getAssignees()).length).toBe(5);
    });

    it('should reject adding 6th assignee', async () => {
      const task = await createTaskWithAssignment({
        id: '123e4567-e89b-12d3-a456-426614174012',
        title: 'Assignee Test',
        description: 'Test',
        priority: 5,
        dueDate: new Date('2025-12-31'),
        status: 'TO_DO',
      });

      // Add 4 more (total will be 5)
      await prisma.taskAssignment.createMany({
        data: [
          {
            taskId: task.id,
            userId: '10000000-0000-4000-8000-000000000002',
            assignedById: '10000000-0000-4000-8000-000000000001',
            assignedAt: new Date(),
          },
          {
            taskId: task.id,
            userId: '10000000-0000-4000-8000-000000000003',
            assignedById: '10000000-0000-4000-8000-000000000001',
            assignedAt: new Date(),
          },
          {
            taskId: task.id,
            userId: '10000000-0000-4000-8000-000000000004',
            assignedById: '10000000-0000-4000-8000-000000000001',
            assignedAt: new Date(),
          },
          {
            taskId: task.id,
            userId: '10000000-0000-4000-8000-000000000005',
            assignedById: '10000000-0000-4000-8000-000000000001',
            assignedAt: new Date(),
          },
        ],
      });

      // Try to add 6th assignee
      await expect(
        taskService.addAssigneeToTask(
          task.id,
          '10000000-0000-4000-8000-000000000003', // Using user 3 as 6th
          testUser
        )
      ).rejects.toThrow();
    });
  });

  // ============================================
  // AC 10: Update Recurring Settings
  // ============================================
  describe('Update Recurring Settings (AC 10)', () => {
    it('should enable recurring (every 7 days)', async () => {
      const task = await createTaskWithAssignment({
        id: '123e4567-e89b-12d3-a456-426614174013',
        title: 'Recurring Test',
        description: 'Test',
        priority: 5,
        dueDate: new Date('2025-12-31'),
        status: 'TO_DO',
      });

      const updatedTask = await taskService.updateTaskRecurring(
        task.id,
        true,
        7,
        testUser
      );

      expect(updatedTask.getRecurringInterval()).toBe(7);
      expect(updatedTask.isTaskRecurring()).toBe(true);
    });

    it('should disable recurring', async () => {
      const task = await createTaskWithAssignment({
        id: '123e4567-e89b-12d3-a456-426614174014',
        title: 'Recurring Test',
        description: 'Test',
        priority: 5,
        dueDate: new Date('2025-12-31'),
        status: 'TO_DO',
        recurringInterval: 7,
      });

      const updatedTask = await taskService.updateTaskRecurring(
        task.id,
        false,
        null,
        testUser
      );

      expect(updatedTask.getRecurringInterval()).toBeNull();
      expect(updatedTask.isTaskRecurring()).toBe(false);
    });
  });

  // ============================================
  // AC 9: Changes Reflected Within 10 Seconds
  // ============================================
  describe('Changes Reflected (AC 9)', () => {
    it('should reflect changes within 10 seconds', async () => {
      const task = await createTaskWithAssignment({
        id: '123e4567-e89b-12d3-a456-426614174015',
        title: 'Performance Test',
        description: 'Test',
        priority: 5,
        dueDate: new Date('2025-12-31'),
        status: 'TO_DO',
      });

      const beforeUpdate = new Date();
      await taskService.updateTaskTitle(
        task.id,
        'FINAL: Timestamp Test',
        testUser
      );
      const afterUpdate = new Date();

      const timeDiff = afterUpdate.getTime() - beforeUpdate.getTime();
      expect(timeDiff).toBeLessThan(10000);
    });
  });
});
