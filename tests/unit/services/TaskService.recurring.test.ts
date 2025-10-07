/**
 * Unit Tests for Recurring Task Functionality
 * Tests automatic generation of next recurring task instance upon completion
 */

import { PrismaClient } from '@prisma/client';
import { TaskService } from '@/app/server/services/TaskService';

// Mock Prisma Client
jest.mock('@prisma/client', () => {
  const mockPrismaClient = {
    task: {
      findUnique: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
    },
    taskAssignment: {
      createMany: jest.fn(),
    },
    taskTag: {
      createMany: jest.fn(),
    },
    userProfile: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    department: {
      findUnique: jest.fn(),
    },
    project: {
      findUnique: jest.fn(),
    },
    tag: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
    },
  };
  return {
    PrismaClient: jest.fn(() => mockPrismaClient),
  };
});

describe('TaskService - Recurring Tasks', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let prisma: any;
  let taskService: TaskService;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma = new PrismaClient();
    taskService = new TaskService(prisma);
  });

  describe('updateStatus - Recurring Task Generation', () => {
    it('should generate next recurring task instance when task is marked as COMPLETED', async () => {
      const taskId = 'task-recurring-001';
      const originalDueDate = new Date('2025-01-07T00:00:00.000Z');
      const recurringInterval = 7; // Weekly

      // Mock the task with recurring interval
      const mockTask = {
        id: taskId,
        title: 'Weekly Report',
        description: 'Submit weekly progress report',
        priority: 5,
        dueDate: originalDueDate,
        status: 'IN_PROGRESS',
        ownerId: 'user-001',
        projectId: 'project-001',
        departmentId: 'dept-001',
        parentTaskId: null,
        recurringInterval,
        isArchived: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        assignments: [{ userId: 'user-001' }, { userId: 'user-002' }],
        tags: [{ tagId: 'tag-urgent' }, { tagId: 'tag-report' }],
      };

      const mockUpdatedTask = { ...mockTask, status: 'COMPLETED' };
      const mockNextTask = {
        ...mockTask,
        id: 'task-recurring-002',
        dueDate: new Date('2025-01-14T00:00:00.000Z'), // +7 days
        status: 'TO_DO',
      };

      // Mock findUnique to return the task (called in updateStatus at line 533)
      prisma.task.findUnique.mockResolvedValueOnce(mockTask);

      // Mock tag.findMany to fetch tag names from tag IDs (new implementation)
      prisma.tag.findMany.mockResolvedValueOnce([
        { id: 'tag-urgent', name: 'urgent' },
        { id: 'tag-report', name: 'report' },
      ]);

      // Mock create's validation checks (happens inside generateNextRecurringTask -> create)
      prisma.userProfile.findUnique.mockResolvedValueOnce({
        id: 'user-001',
        isActive: true,
      });
      prisma.department.findUnique.mockResolvedValueOnce({ id: 'dept-001' });
      prisma.project.findUnique.mockResolvedValueOnce({ id: 'project-001' });
      // Mock findMany for assignees validation
      prisma.userProfile.findMany.mockResolvedValueOnce([
        { id: 'user-001', isActive: true },
        { id: 'user-002', isActive: true },
      ]);
      // Mock tag lookups - create() now receives tag names correctly
      prisma.tag.findUnique.mockResolvedValueOnce({
        id: 'tag-urgent',
        name: 'urgent',
      });
      prisma.tag.findUnique.mockResolvedValueOnce({
        id: 'tag-report',
        name: 'report',
      });

      // Mock create for the new recurring instance
      prisma.task.create.mockResolvedValueOnce(mockNextTask);

      // After create, it calls getById which does another findUnique (line 104)
      prisma.task.findUnique.mockResolvedValueOnce(mockNextTask);

      // After generateNextRecurringTask completes, updateStatus calls update()
      // Mock findUnique for the update method's existence check (line 468)
      prisma.task.findUnique.mockResolvedValueOnce(mockTask);

      // Mock update to return the updated task
      prisma.task.update.mockResolvedValueOnce(mockUpdatedTask);

      // Execute
      await taskService.updateStatus(taskId, 'COMPLETED');

      // Verify task was updated
      expect(prisma.task.update).toHaveBeenCalledWith({
        where: { id: taskId },
        data: { status: 'COMPLETED' },
        include: expect.any(Object),
      });

      // Verify new task instance was created with correct due date
      expect(prisma.task.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            title: 'Weekly Report',
            description: 'Submit weekly progress report',
            priority: 5,
            dueDate: new Date('2025-01-14T00:00:00.000Z'),
            ownerId: 'user-001',
            recurringInterval: 7, // Preserved
            departmentId: 'dept-001',
          }),
        })
      );

      // Verify assignees were created
      expect(prisma.taskAssignment.createMany).toHaveBeenCalledWith({
        data: [
          expect.objectContaining({ userId: 'user-001' }),
          expect.objectContaining({ userId: 'user-002' }),
        ],
      });

      // Verify tags were created with correct tag IDs (bug fixed)
      expect(prisma.taskTag.createMany).toHaveBeenCalledWith({
        data: [
          expect.objectContaining({ tagId: 'tag-urgent' }),
          expect.objectContaining({ tagId: 'tag-report' }),
        ],
      });
    });

    it('should NOT generate next instance when task has no recurring interval', async () => {
      const taskId = 'task-nonrecurring-001';

      const mockTask = {
        id: taskId,
        title: 'One-time Task',
        description: 'Non-recurring task',
        priority: 5,
        dueDate: new Date('2025-01-07T00:00:00.000Z'),
        status: 'IN_PROGRESS',
        ownerId: 'user-001',
        departmentId: 'dept-001',
        recurringInterval: null, // No recurrence
        assignments: [],
        tags: [],
      };

      const mockUpdatedTask = { ...mockTask, status: 'COMPLETED' };

      // Mock findUnique for updateStatus check
      prisma.task.findUnique.mockResolvedValueOnce(mockTask);
      // Mock findUnique for update's existence check
      prisma.task.findUnique.mockResolvedValueOnce(mockTask);
      prisma.task.update.mockResolvedValueOnce(mockUpdatedTask);

      // Execute
      await taskService.updateStatus(taskId, 'COMPLETED');

      // Verify task was updated
      expect(prisma.task.update).toHaveBeenCalled();

      // Verify NO new task was created
      expect(prisma.task.create).not.toHaveBeenCalled();
    });

    it('should NOT generate next instance when task is marked as status other than COMPLETED', async () => {
      const taskId = 'task-recurring-003';

      const mockTask = {
        id: taskId,
        title: 'Weekly Report',
        description: 'Submit weekly progress report',
        priority: 5,
        dueDate: new Date('2025-01-07T00:00:00.000Z'),
        status: 'TO_DO',
        ownerId: 'user-001',
        departmentId: 'dept-001',
        recurringInterval: 7,
        assignments: [],
        tags: [],
      };

      const mockUpdatedTask = { ...mockTask, status: 'IN_PROGRESS' };

      prisma.task.findUnique.mockResolvedValueOnce(mockTask);
      prisma.task.findUnique.mockResolvedValueOnce(mockTask);
      prisma.task.update.mockResolvedValueOnce(mockUpdatedTask);

      // Execute - changing to IN_PROGRESS, not COMPLETED
      await taskService.updateStatus(taskId, 'IN_PROGRESS');

      // Verify task was updated
      expect(prisma.task.update).toHaveBeenCalled();

      // Verify NO new task was created
      expect(prisma.task.create).not.toHaveBeenCalled();
    });

    it('should calculate correct due date for monthly recurring tasks', async () => {
      const taskId = 'task-monthly-001';
      const originalDueDate = new Date('2025-01-15T00:00:00.000Z');
      const recurringInterval = 30; // Monthly

      const mockTask = {
        id: taskId,
        title: 'Monthly Audit',
        description: 'Monthly security audit',
        priority: 8,
        dueDate: originalDueDate,
        status: 'IN_PROGRESS',
        ownerId: 'user-001',
        departmentId: 'dept-001',
        recurringInterval,
        assignments: [],
        tags: [],
      };

      // Mock findUnique for updateStatus
      prisma.task.findUnique.mockResolvedValueOnce(mockTask);

      // Mock create's validation checks
      prisma.userProfile.findUnique.mockResolvedValueOnce({
        id: 'user-001',
        isActive: true,
      });
      prisma.department.findUnique.mockResolvedValueOnce({ id: 'dept-001' });
      // No assignees or tags in this test, so no need for findMany or tag mocks

      const mockNextTask = {
        ...mockTask,
        id: 'task-monthly-002',
        dueDate: new Date('2025-02-14T00:00:00.000Z'),
      };

      prisma.task.create.mockResolvedValueOnce(mockNextTask);

      // After create, it calls getById which does another findUnique
      prisma.task.findUnique.mockResolvedValueOnce(mockNextTask);

      // Mock findUnique for update's existence check
      prisma.task.findUnique.mockResolvedValueOnce(mockTask);
      prisma.task.update.mockResolvedValueOnce({
        ...mockTask,
        status: 'COMPLETED',
      });

      // Execute
      await taskService.updateStatus(taskId, 'COMPLETED');

      // Verify new due date is 30 days later
      expect(prisma.task.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            dueDate: new Date('2025-02-14T00:00:00.000Z'),
            recurringInterval: 30,
          }),
        })
      );
    });

    it('should preserve parent task ID for recurring subtasks', async () => {
      const taskId = 'subtask-recurring-001';
      const parentTaskId = 'parent-task-001';

      const mockSubtask = {
        id: taskId,
        title: 'Weekly Subtask',
        description: 'Recurring subtask',
        priority: 5,
        dueDate: new Date('2025-01-07T00:00:00.000Z'),
        status: 'IN_PROGRESS',
        ownerId: 'user-001',
        departmentId: 'dept-001',
        parentTaskId, // This is a subtask
        recurringInterval: 7,
        assignments: [],
        tags: [],
      };

      // Mock findUnique for updateStatus
      prisma.task.findUnique.mockResolvedValueOnce(mockSubtask);

      // Mock create's validation checks
      prisma.userProfile.findUnique.mockResolvedValueOnce({
        id: 'user-001',
        isActive: true,
      });
      prisma.department.findUnique.mockResolvedValueOnce({ id: 'dept-001' });
      // This subtask has a parentTaskId, so create() will validate the parent exists
      prisma.task.findUnique.mockResolvedValueOnce({
        id: parentTaskId,
        parentTaskId: null,
      });
      // No assignees or tags in this test, so no need for findMany or tag mocks

      const mockNextSubtask = {
        ...mockSubtask,
        id: 'subtask-recurring-002',
      };

      prisma.task.create.mockResolvedValueOnce(mockNextSubtask);

      // After create, it calls getById which does another findUnique
      prisma.task.findUnique.mockResolvedValueOnce(mockNextSubtask);

      // Mock findUnique for update's existence check
      prisma.task.findUnique.mockResolvedValueOnce(mockSubtask);
      prisma.task.update.mockResolvedValueOnce({
        ...mockSubtask,
        status: 'COMPLETED',
      });

      // Execute
      await taskService.updateStatus(taskId, 'COMPLETED');

      // Verify parent task ID is preserved
      expect(prisma.task.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            parentTaskId,
          }),
        })
      );
    });

    it('should handle recurring task generation failure gracefully', async () => {
      const taskId = 'task-recurring-fail-001';

      const mockTask = {
        id: taskId,
        title: 'Weekly Report',
        priority: 5,
        dueDate: new Date('2025-01-07T00:00:00.000Z'),
        status: 'IN_PROGRESS',
        ownerId: 'user-001',
        departmentId: 'dept-001',
        recurringInterval: 7,
        assignments: [],
        tags: [],
      };

      prisma.task.findUnique.mockResolvedValueOnce(mockTask);
      prisma.task.findUnique.mockResolvedValueOnce(mockTask);
      prisma.task.update.mockResolvedValueOnce({
        ...mockTask,
        status: 'COMPLETED',
      });

      // Mock create to fail
      prisma.task.create.mockRejectedValueOnce(new Error('Database error'));

      // Execute - should not throw
      const result = await taskService.updateStatus(taskId, 'COMPLETED');

      // Verify task was still updated despite recurring generation failure
      expect(result).toBeDefined();
      expect(result?.status).toBe('COMPLETED');
    });
  });
});
