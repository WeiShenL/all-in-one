/**
 * Integration Tests for Task Update Endpoints
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
 * Each test gets a fresh database with complete isolation
 */

import {
  resetAndSeedDatabase,
  getPrisma,
  disconnectPrisma,
} from '../helpers/dbSetup';
import { createTestTRPCClient } from '../helpers/trpcTestClient';

const prisma = getPrisma();
const client = createTestTRPCClient();

/**
 * Helper to create a task with assignment for testing
 * The user (10000000-0000-4000-8000-000000000001) is assigned to authorize updates
 */
async function createTaskWithAssignment(taskData: {
  id: string;
  title: string;
  description?: string;
  priority?: number;
  dueDate?: Date;
  status?: 'TO_DO' | 'IN_PROGRESS' | 'COMPLETED';
  isRecurring?: boolean;
  recurrenceDays?: number | null;
}) {
  const task = await prisma.task.create({
    data: {
      ...taskData,
      ownerId: '10000000-0000-4000-8000-000000000001',
      departmentId: 'dept-engineering',
      projectId: 'proj-001',
      recurrenceDays: taskData.recurrenceDays ?? null,
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
  // Full DB reset before EACH test for complete independence
  beforeEach(async () => {
    await resetAndSeedDatabase();
  });

  // Disconnect after all tests
  afterAll(async () => {
    await disconnectPrisma();
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
        isRecurring: false,
      });

      const result = await client.task.updateTitle.mutate({
        taskId: task.id,
        title: 'UPDATED: New Task Title',
      });

      expect(result.title).toBe('UPDATED: New Task Title');
    });

    it('should update task description', async () => {
      const task = await createTaskWithAssignment({
        id: '123e4567-e89b-12d3-a456-426614174001',
        title: 'Test Task',
        description: 'Original description',
        priority: 5,
        dueDate: new Date('2025-12-31'),
        status: 'TO_DO',
        isRecurring: false,
      });

      const result = await client.task.updateDescription.mutate({
        taskId: task.id,
        description: 'UPDATED: This is the new description with more details.',
      });

      expect(result.description).toContain('UPDATED:');
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
        isRecurring: false,
      });

      const result = await client.task.updatePriority.mutate({
        taskId: task.id,
        priority: 8,
      });

      expect(result.priorityBucket).toBe(8);
    });

    it('should reject invalid priority (> 10)', async () => {
      const task = await createTaskWithAssignment({
        id: '123e4567-e89b-12d3-a456-426614174003',
        title: 'Priority Test',
        description: 'Test',
        priority: 5,
        dueDate: new Date('2025-12-31'),
        status: 'TO_DO',
        isRecurring: false,
      });

      await expect(
        client.task.updatePriority.mutate({
          taskId: task.id,
          priority: 15,
        })
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
        isRecurring: false,
      });

      const result = await client.task.updateDeadline.mutate({
        taskId: task.id,
        deadline: new Date('2026-06-30'),
      });

      expect(result.dueDate).toContain('2026');
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
        isRecurring: false,
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
          isRecurring: false,
          recurrenceDays: null,
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

      await expect(
        client.task.updateDeadline.mutate({
          taskId: subtask.id,
          deadline: new Date('2027-01-01'),
          parentDeadline: new Date('2026-06-30'),
        })
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
        isRecurring: false,
      });

      const result = await client.task.updateStatus.mutate({
        taskId: task.id,
        status: 'IN_PROGRESS',
      });

      expect(result.status).toBe('IN_PROGRESS');
    });

    it('should update status to COMPLETED', async () => {
      const task = await createTaskWithAssignment({
        id: '123e4567-e89b-12d3-a456-426614174007',
        title: 'Status Test',
        description: 'Test',
        priority: 5,
        dueDate: new Date('2025-12-31'),
        status: 'TO_DO',
        isRecurring: false,
      });

      const result = await client.task.updateStatus.mutate({
        taskId: task.id,
        status: 'COMPLETED',
      });

      expect(result.status).toBe('COMPLETED');
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
        isRecurring: false,
      });

      const result = await client.task.addTag.mutate({
        taskId: task.id,
        tag: 'urgent',
      });

      expect(result.tags).toContain('urgent');
    });

    it('should add multiple tags', async () => {
      const task = await createTaskWithAssignment({
        id: '123e4567-e89b-12d3-a456-426614174009',
        title: 'Tag Test',
        description: 'Test',
        priority: 5,
        dueDate: new Date('2025-12-31'),
        status: 'TO_DO',
        isRecurring: false,
      });

      await client.task.addTag.mutate({
        taskId: task.id,
        tag: 'urgent',
      });

      const result = await client.task.addTag.mutate({
        taskId: task.id,
        tag: 'backend',
      });

      expect(result.tags).toContain('urgent');
      expect(result.tags).toContain('backend');
    });

    it('should remove tag', async () => {
      const task = await createTaskWithAssignment({
        id: '123e4567-e89b-12d3-a456-426614174010',
        title: 'Tag Test',
        description: 'Test',
        priority: 5,
        dueDate: new Date('2025-12-31'),
        status: 'TO_DO',
        isRecurring: false,
      });

      await client.task.addTag.mutate({
        taskId: task.id,
        tag: 'urgent',
      });

      await client.task.addTag.mutate({
        taskId: task.id,
        tag: 'backend',
      });

      const result = await client.task.removeTag.mutate({
        taskId: task.id,
        tag: 'urgent',
      });

      expect(result.tags).not.toContain('urgent');
      expect(result.tags).toContain('backend');
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
        isRecurring: false,
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

      await client.task.addAssignee.mutate({
        taskId: task.id,
        userId: '10000000-0000-4000-8000-000000000003',
      });

      await client.task.addAssignee.mutate({
        taskId: task.id,
        userId: '10000000-0000-4000-8000-000000000004',
      });

      const result = await client.task.addAssignee.mutate({
        taskId: task.id,
        userId: '10000000-0000-4000-8000-000000000005',
      });

      expect(result.assignments.length).toBe(5);
    });
  });

  // ============================================
  // AC 10: Update Recurring Settings
  // ============================================
  describe('Update Recurring Settings (AC 10)', () => {
    it('should enable recurring (every 7 days)', async () => {
      const task = await createTaskWithAssignment({
        id: '123e4567-e89b-12d3-a456-426614174012',
        title: 'Recurring Test',
        description: 'Test',
        priority: 5,
        dueDate: new Date('2025-12-31'),
        status: 'TO_DO',
        isRecurring: false,
      });

      const result = await client.task.updateRecurring.mutate({
        taskId: task.id,
        enabled: true,
        days: 7,
      });

      expect(result.isRecurring).toBe(true);
      expect(result.recurrenceDays).toBe(7);
    });

    it('should reject invalid recurrence days (0)', async () => {
      const task = await createTaskWithAssignment({
        id: '123e4567-e89b-12d3-a456-426614174013',
        title: 'Recurring Test',
        description: 'Test',
        priority: 5,
        dueDate: new Date('2025-12-31'),
        status: 'TO_DO',
        isRecurring: false,
      });

      await expect(
        client.task.updateRecurring.mutate({
          taskId: task.id,
          enabled: true,
          days: 0,
        })
      ).rejects.toThrow();
    });

    it('should disable recurring', async () => {
      const task = await createTaskWithAssignment({
        id: '123e4567-e89b-12d3-a456-426614174014',
        title: 'Recurring Test',
        description: 'Test',
        priority: 5,
        dueDate: new Date('2025-12-31'),
        status: 'TO_DO',
        isRecurring: true,
        recurrenceDays: 7,
      });

      const result = await client.task.updateRecurring.mutate({
        taskId: task.id,
        enabled: false,
        days: null,
      });

      expect(result.isRecurring).toBe(false);
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
        isRecurring: false,
      });

      const beforeUpdate = new Date();
      await client.task.updateTitle.mutate({
        taskId: task.id,
        title: 'FINAL: Timestamp Test',
      });
      const afterUpdate = new Date();

      const timeDiff = afterUpdate.getTime() - beforeUpdate.getTime();
      expect(timeDiff).toBeLessThan(10000);
    });
  });
});
