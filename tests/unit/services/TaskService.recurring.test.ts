/**
 * Unit Tests for Recurring Task Functionality
 * Tests automatic generation of next recurring task instance upon completion
 *
 * DDD Layer: SERVICE
 * Tests: Service orchestration for recurring task generation
 */

import { TaskService, UserContext } from '@/services/task/TaskService';
import { ITaskRepository } from '@/repositories/ITaskRepository';
import { TaskStatus } from '@/domain/task/Task';

describe('TaskService - Recurring Tasks', () => {
  let service: TaskService;
  let mockRepository: jest.Mocked<ITaskRepository>;
  let testUser: UserContext;

  beforeEach(() => {
    // Mock ITaskRepository
    mockRepository = {
      createTask: jest.fn(),
      validateProjectExists: jest.fn(),
      validateAssignees: jest.fn(),
      getParentTaskDepth: jest.fn(),
      logTaskAction: jest.fn(),
      getTaskByIdFull: jest.fn(),
      getUserTasks: jest.fn(),
      getDepartmentTasks: jest.fn(),
      updateTask: jest.fn(),
      addTaskTag: jest.fn(),
      removeTaskTag: jest.fn(),
      addTaskAssignment: jest.fn(),
      createComment: jest.fn(),
      updateComment: jest.fn(),
      uploadFile: jest.fn(),
      getFileMetadata: jest.fn(),
      deleteFile: jest.fn(),
      getTaskFiles: jest.fn(),
      checkFileSizeLimit: jest.fn(),
    } as any;

    service = new TaskService(mockRepository);

    testUser = {
      userId: 'user-001', // Must match owner or assignee in mock tasks
      role: 'STAFF',
      departmentId: 'dept-001', // Must match department in mock tasks
    };

    jest.clearAllMocks();
  });

  describe('updateTaskStatus - Recurring Task Generation', () => {
    it('should generate next recurring task instance when task is marked as COMPLETED', async () => {
      const taskId = 'task-recurring-001';
      const originalDueDate = new Date('2025-01-07T00:00:00.000Z');
      const recurringInterval = 7; // Weekly

      // Mock repository to return recurring task data
      const mockTaskData = {
        id: taskId,
        title: 'Weekly Report',
        description: 'Submit weekly progress report',
        priority: 5,
        dueDate: originalDueDate,
        status: 'IN_PROGRESS' as const,
        ownerId: 'user-001',
        projectId: 'project-001',
        departmentId: 'dept-001',
        parentTaskId: null,
        recurringInterval,
        isArchived: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        assignments: [
          { userId: 'user-001', taskId: taskId },
          { userId: 'user-002', taskId: taskId },
        ],
        tags: [{ tag: { name: 'urgent' } }, { tag: { name: 'report' } }],
        comments: [],
        files: [],
      };

      mockRepository.getTaskByIdFull.mockResolvedValue(mockTaskData);

      // Mock validation for creating next instance
      mockRepository.validateProjectExists.mockResolvedValue(true);
      mockRepository.validateAssignees.mockResolvedValue({
        allExist: true,
        allActive: true,
      });

      // Mock creation of next instance
      mockRepository.createTask.mockResolvedValue({ id: 'task-recurring-002' });

      // Execute
      await service.updateTaskStatus(taskId, TaskStatus.COMPLETED, testUser);

      // Verify task status was updated
      expect(mockRepository.updateTask).toHaveBeenCalledWith(
        taskId,
        expect.objectContaining({
          status: TaskStatus.COMPLETED,
        })
      );

      // Verify next recurring instance was created
      expect(mockRepository.createTask).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Weekly Report',
          description: 'Submit weekly progress report',
          priority: 5,
          dueDate: new Date('2025-01-14T00:00:00.000Z'), // +7 days
          ownerId: 'user-001',
          departmentId: 'dept-001',
          projectId: 'project-001',
          recurringInterval: 7, // Preserved
          assigneeIds: ['user-001', 'user-002'], // Preserved
          tags: ['urgent', 'report'], // Preserved
        })
      );

      // Verify action was logged
      expect(mockRepository.logTaskAction).toHaveBeenCalledWith(
        taskId,
        testUser.userId,
        'STATUS_CHANGED',
        { newStatus: TaskStatus.COMPLETED }
      );
      expect(mockRepository.logTaskAction).toHaveBeenCalledWith(
        taskId,
        testUser.userId,
        'RECURRING_TASK_GENERATED',
        expect.objectContaining({
          nextTaskId: expect.any(String),
          nextDueDate: expect.any(String),
          sourceTaskId: expect.any(String),
        })
      );
    });

    it('should NOT generate next instance when task has no recurring interval', async () => {
      const taskId = 'task-nonrecurring-001';

      const mockTaskData = {
        id: taskId,
        title: 'One-time Task',
        description: 'Non-recurring task',
        priority: 5,
        dueDate: new Date('2025-01-07T00:00:00.000Z'),
        status: 'IN_PROGRESS' as const,
        ownerId: 'user-001',
        departmentId: 'dept-001',
        projectId: null,
        parentTaskId: null,
        recurringInterval: null, // No recurrence
        isArchived: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        assignments: [],
        tags: [],
        comments: [],
        files: [],
      };

      mockRepository.getTaskByIdFull.mockResolvedValue(mockTaskData);

      // Execute
      await service.updateTaskStatus(taskId, TaskStatus.COMPLETED, testUser);

      // Verify task was updated
      expect(mockRepository.updateTask).toHaveBeenCalled();

      // Verify NO new task was created
      expect(mockRepository.createTask).not.toHaveBeenCalled();
    });

    it('should NOT generate next instance when task is marked as status other than COMPLETED', async () => {
      const taskId = 'task-recurring-003';

      const mockTaskData = {
        id: taskId,
        title: 'Weekly Report',
        description: 'Submit weekly progress report',
        priority: 5,
        dueDate: new Date('2025-01-07T00:00:00.000Z'),
        status: 'TO_DO' as const,
        ownerId: 'user-001',
        departmentId: 'dept-001',
        projectId: null,
        parentTaskId: null,
        recurringInterval: 7,
        isArchived: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        assignments: [],
        tags: [],
        comments: [],
        files: [],
      };

      mockRepository.getTaskByIdFull.mockResolvedValue(mockTaskData);

      // Execute - changing to IN_PROGRESS, not COMPLETED
      await service.updateTaskStatus(taskId, TaskStatus.IN_PROGRESS, testUser);

      // Verify task was updated
      expect(mockRepository.updateTask).toHaveBeenCalled();

      // Verify NO new task was created
      expect(mockRepository.createTask).not.toHaveBeenCalled();
    });

    it('should calculate correct due date for monthly recurring tasks', async () => {
      const taskId = 'task-monthly-001';
      const originalDueDate = new Date('2025-01-15T00:00:00.000Z');
      const recurringInterval = 30; // Monthly

      const mockTaskData = {
        id: taskId,
        title: 'Monthly Audit',
        description: 'Monthly security audit',
        priority: 8,
        dueDate: originalDueDate,
        status: 'IN_PROGRESS' as const,
        ownerId: 'user-001',
        departmentId: 'dept-001',
        projectId: null,
        parentTaskId: null,
        recurringInterval,
        isArchived: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        assignments: [{ userId: 'user-001', taskId: taskId }],
        tags: [],
        comments: [],
        files: [],
      };

      mockRepository.getTaskByIdFull.mockResolvedValue(mockTaskData);
      mockRepository.validateAssignees.mockResolvedValue({
        allExist: true,
        allActive: true,
      });
      mockRepository.createTask.mockResolvedValue({ id: 'task-monthly-002' });

      // Execute
      await service.updateTaskStatus(taskId, TaskStatus.COMPLETED, testUser);

      // Verify new due date is 30 days later
      expect(mockRepository.createTask).toHaveBeenCalledWith(
        expect.objectContaining({
          dueDate: new Date('2025-02-14T00:00:00.000Z'), // +30 days
          recurringInterval: 30,
          assigneeIds: ['user-001'],
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
        status: 'IN_PROGRESS' as const,
        ownerId: 'user-001',
        departmentId: 'dept-001',
        projectId: null,
        parentTaskId, // This is a subtask
        recurringInterval: 7,
        isArchived: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        assignments: [{ userId: 'user-001', taskId: taskId }],
        tags: [],
        comments: [],
        files: [],
      };

      mockRepository.getTaskByIdFull.mockResolvedValue(mockSubtask);
      mockRepository.getParentTaskDepth.mockResolvedValue({
        id: parentTaskId,
        parentTaskId: null,
      });
      mockRepository.validateAssignees.mockResolvedValue({
        allExist: true,
        allActive: true,
      });
      mockRepository.createTask.mockResolvedValue({
        id: 'subtask-recurring-002',
      });

      // Execute
      await service.updateTaskStatus(taskId, TaskStatus.COMPLETED, testUser);

      // Verify parent task ID is preserved
      expect(mockRepository.createTask).toHaveBeenCalledWith(
        expect.objectContaining({
          parentTaskId,
          assigneeIds: ['user-001'],
        })
      );
    });

    it('should preserve project ID for recurring project tasks', async () => {
      const taskId = 'task-project-recurring-001';
      const projectId = 'project-001';

      const mockTask = {
        id: taskId,
        title: 'Weekly Sprint Review',
        description: 'Review sprint progress',
        priority: 7,
        dueDate: new Date('2025-01-07T00:00:00.000Z'),
        status: 'IN_PROGRESS' as const,
        ownerId: 'user-001',
        departmentId: 'dept-001',
        projectId, // Task belongs to project
        parentTaskId: null,
        recurringInterval: 7,
        isArchived: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        assignments: [{ userId: 'user-001', taskId: taskId }],
        tags: [],
        comments: [],
        files: [],
      };

      mockRepository.getTaskByIdFull.mockResolvedValue(mockTask);
      mockRepository.validateProjectExists.mockResolvedValue(true);
      mockRepository.validateAssignees.mockResolvedValue({
        allExist: true,
        allActive: true,
      });
      mockRepository.createTask.mockResolvedValue({
        id: 'task-project-recurring-002',
      });

      // Execute
      await service.updateTaskStatus(taskId, TaskStatus.COMPLETED, testUser);

      // Verify project ID is preserved
      expect(mockRepository.createTask).toHaveBeenCalledWith(
        expect.objectContaining({
          projectId,
          assigneeIds: ['user-001'],
        })
      );
    });

    it('should preserve all assignees in recurring task', async () => {
      const taskId = 'task-recurring-team-001';

      const mockTask = {
        id: taskId,
        title: 'Team Standup',
        description: 'Daily standup meeting',
        priority: 5,
        dueDate: new Date('2025-01-07T00:00:00.000Z'),
        status: 'IN_PROGRESS' as const,
        ownerId: 'user-001',
        departmentId: 'dept-001',
        projectId: null,
        parentTaskId: null,
        recurringInterval: 1, // Daily
        isArchived: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        assignments: [
          { userId: 'user-001', taskId: taskId },
          { userId: 'user-002', taskId: taskId },
          { userId: 'user-003', taskId: taskId },
          { userId: 'user-004', taskId: taskId },
          { userId: 'user-005', taskId: taskId },
        ],
        tags: [],
        comments: [],
        files: [],
      };

      mockRepository.getTaskByIdFull.mockResolvedValue(mockTask);
      mockRepository.validateAssignees.mockResolvedValue({
        allExist: true,
        allActive: true,
      });
      mockRepository.createTask.mockResolvedValue({
        id: 'task-recurring-team-002',
      });

      // Execute
      await service.updateTaskStatus(taskId, TaskStatus.COMPLETED, testUser);

      // Verify all 5 assignees are preserved
      expect(mockRepository.createTask).toHaveBeenCalledWith(
        expect.objectContaining({
          assigneeIds: [
            'user-001',
            'user-002',
            'user-003',
            'user-004',
            'user-005',
          ],
        })
      );
    });

    it('should preserve all tags in recurring task', async () => {
      const taskId = 'task-recurring-tags-001';

      const mockTask = {
        id: taskId,
        title: 'Tagged Task',
        description: 'Task with multiple tags',
        priority: 5,
        dueDate: new Date('2025-01-07T00:00:00.000Z'),
        status: 'IN_PROGRESS' as const,
        ownerId: 'user-001',
        departmentId: 'dept-001',
        projectId: null,
        parentTaskId: null,
        recurringInterval: 7,
        isArchived: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        assignments: [{ userId: 'user-001', taskId: taskId }],
        tags: [
          { tag: { name: 'urgent' } },
          { tag: { name: 'backend' } },
          { tag: { name: 'api' } },
        ],
        comments: [],
        files: [],
      };

      mockRepository.getTaskByIdFull.mockResolvedValue(mockTask);
      mockRepository.validateAssignees.mockResolvedValue({
        allExist: true,
        allActive: true,
      });
      mockRepository.createTask.mockResolvedValue({
        id: 'task-recurring-tags-002',
      });

      // Execute
      await service.updateTaskStatus(taskId, TaskStatus.COMPLETED, testUser);

      // Verify all tags are preserved
      expect(mockRepository.createTask).toHaveBeenCalledWith(
        expect.objectContaining({
          tags: ['urgent', 'backend', 'api'],
          assigneeIds: ['user-001'],
        })
      );
    });

    it('should handle recurring task with minimum interval (1 day)', async () => {
      const taskId = 'task-daily-001';

      const mockTask = {
        id: taskId,
        title: 'Daily Task',
        description: 'Runs every day',
        priority: 5,
        dueDate: new Date('2025-01-07T00:00:00.000Z'),
        status: 'IN_PROGRESS' as const,
        ownerId: 'user-001',
        departmentId: 'dept-001',
        projectId: null,
        parentTaskId: null,
        recurringInterval: 1, // Daily
        isArchived: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        assignments: [{ userId: 'user-001', taskId: taskId }],
        tags: [],
        comments: [],
        files: [],
      };

      mockRepository.getTaskByIdFull.mockResolvedValue(mockTask);
      mockRepository.validateAssignees.mockResolvedValue({
        allExist: true,
        allActive: true,
      });
      mockRepository.createTask.mockResolvedValue({ id: 'task-daily-002' });

      // Execute
      await service.updateTaskStatus(taskId, TaskStatus.COMPLETED, testUser);

      // Verify next due date is 1 day later
      expect(mockRepository.createTask).toHaveBeenCalledWith(
        expect.objectContaining({
          dueDate: new Date('2025-01-08T00:00:00.000Z'), // +1 day
          recurringInterval: 1,
          assigneeIds: ['user-001'],
        })
      );
    });

    it('should handle recurring task with large interval (yearly)', async () => {
      const taskId = 'task-yearly-001';

      const mockTask = {
        id: taskId,
        title: 'Annual Review',
        description: 'Yearly review',
        priority: 8,
        dueDate: new Date('2025-01-07T00:00:00.000Z'),
        status: 'IN_PROGRESS' as const,
        ownerId: 'user-001',
        departmentId: 'dept-001',
        projectId: null,
        parentTaskId: null,
        recurringInterval: 365, // Yearly
        isArchived: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        assignments: [{ userId: 'user-001', taskId: taskId }],
        tags: [],
        comments: [],
        files: [],
      };

      mockRepository.getTaskByIdFull.mockResolvedValue(mockTask);
      mockRepository.validateAssignees.mockResolvedValue({
        allExist: true,
        allActive: true,
      });
      mockRepository.createTask.mockResolvedValue({ id: 'task-yearly-002' });

      // Execute
      await service.updateTaskStatus(taskId, TaskStatus.COMPLETED, testUser);

      // Verify next due date is 365 days later
      expect(mockRepository.createTask).toHaveBeenCalledWith(
        expect.objectContaining({
          dueDate: new Date('2026-01-07T00:00:00.000Z'), // +365 days
          recurringInterval: 365,
          assigneeIds: ['user-001'],
        })
      );
    });
  });
});
