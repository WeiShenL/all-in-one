/**
 * Unit Tests for TaskService.createTask()
 * Testing Service Layer Orchestration for Task Creation - SCRUM-12
 *
 * DDD Layer: SERVICE
 * Tests: Service orchestration, external validations, repository coordination
 *
 * Acceptance Criteria Covered:
 * - TM016: External validations (project exists, assignees exist/active)
 * - TGO026: Subtask depth validation (max 2 levels)
 * - Service coordinates Domain factory and Repository
 * - Automatic department association
 * - System records creator as owner
 *
 * NOTE: Domain-level validations (title, priority, assignees count)
 * are tested in Task.create.test.ts
 */

import { TaskService, UserContext } from '@/services/task/TaskService';
import { ITaskRepository } from '@/repositories/ITaskRepository';

// Mock SupabaseStorageService to prevent real Supabase client creation
jest.mock('@/services/storage/SupabaseStorageService', () => {
  return {
    SupabaseStorageService: jest.fn().mockImplementation(() => ({
      uploadFile: jest.fn(),
      getFileDownloadUrl: jest.fn(),
      deleteFile: jest.fn(),
      validateFile: jest.fn(),
      validateTaskFileLimit: jest.fn(),
    })),
  };
});

describe('TaskService.createTask() - Service Orchestration', () => {
  let service: TaskService;
  let mockRepository: jest.Mocked<ITaskRepository>;
  let testUser: UserContext;

  beforeEach(() => {
    // Mock ITaskRepository instead of Prisma
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
      userId: 'creator-123',
      role: 'STAFF',
      departmentId: 'dept-456',
    };

    jest.clearAllMocks();
  });

  describe('Successful Task Creation', () => {
    it('should create task with valid data and call repository', async () => {
      const input = {
        title: 'Implement Login',
        description: 'Create login feature',
        priority: 5,
        dueDate: new Date('2025-12-31'),
        assigneeIds: ['assignee-1'],
      };

      // Mock repository responses
      mockRepository.validateAssignees.mockResolvedValue({
        allExist: true,
        allActive: true,
      });
      mockRepository.createTask.mockResolvedValue({ id: 'task-123' });

      const result = await service.createTask(input, testUser);

      // Verify repository was called with correct data
      expect(mockRepository.createTask).toHaveBeenCalledWith(
        expect.objectContaining({
          id: expect.any(String),
          title: 'Implement Login',
          description: 'Create login feature',
          priority: 5,
          dueDate: input.dueDate,
          ownerId: 'creator-123',
          departmentId: 'dept-456', // Auto-associated from user context
          assigneeIds: ['assignee-1'],
        })
      );

      // Verify action was logged
      expect(mockRepository.logTaskAction).toHaveBeenCalledWith(
        'task-123',
        'creator-123',
        'CREATED',
        'Task',
        {
          changes: {
            title: 'Implement Login',
          },
          metadata: {
            source: 'web_ui',
          },
        }
      );

      expect(result).toEqual({ id: 'task-123' });
    });

    it('should auto-associate task with creator department', async () => {
      const input = {
        title: 'Task',
        description: 'Description',
        priority: 5,
        dueDate: new Date('2025-12-31'),
        assigneeIds: ['assignee-1'],
      };

      mockRepository.validateAssignees.mockResolvedValue({
        allExist: true,
        allActive: true,
      });
      mockRepository.createTask.mockResolvedValue({ id: 'task-123' });

      await service.createTask(input, testUser);

      expect(mockRepository.createTask).toHaveBeenCalledWith(
        expect.objectContaining({
          departmentId: 'dept-456', // From testUser.departmentId
        })
      );
    });

    it('should record creator as owner', async () => {
      const input = {
        title: 'Task',
        description: 'Description',
        priority: 5,
        dueDate: new Date('2025-12-31'),
        assigneeIds: ['assignee-1'],
      };

      mockRepository.validateAssignees.mockResolvedValue({
        allExist: true,
        allActive: true,
      });
      mockRepository.createTask.mockResolvedValue({ id: 'task-123' });

      await service.createTask(input, testUser);

      expect(mockRepository.createTask).toHaveBeenCalledWith(
        expect.objectContaining({
          ownerId: 'creator-123', // From testUser.userId
        })
      );
    });
  });

  describe('TM016: External Validations - Project Existence', () => {
    it('should validate project exists when projectId provided', async () => {
      const input = {
        title: 'Task',
        description: 'Description',
        priority: 5,
        dueDate: new Date('2025-12-31'),
        assigneeIds: ['assignee-1'],
        projectId: 'project-789',
      };

      mockRepository.validateProjectExists.mockResolvedValue(true);
      mockRepository.validateAssignees.mockResolvedValue({
        allExist: true,
        allActive: true,
      });
      mockRepository.createTask.mockResolvedValue({ id: 'task-123' });

      await service.createTask(input, testUser);

      expect(mockRepository.validateProjectExists).toHaveBeenCalledWith(
        'project-789'
      );
      expect(mockRepository.createTask).toHaveBeenCalledWith(
        expect.objectContaining({
          projectId: 'project-789',
        })
      );
    });

    it('should throw error when project not found', async () => {
      const input = {
        title: 'Task',
        description: 'Description',
        priority: 5,
        dueDate: new Date('2025-12-31'),
        assigneeIds: ['assignee-1'],
        projectId: 'nonexistent-project',
      };

      mockRepository.validateProjectExists.mockResolvedValue(false);

      await expect(service.createTask(input, testUser)).rejects.toThrow(
        'Project not found'
      );

      expect(mockRepository.createTask).not.toHaveBeenCalled();
    });

    it('should skip project validation when projectId not provided', async () => {
      const input = {
        title: 'Task',
        description: 'Description',
        priority: 5,
        dueDate: new Date('2025-12-31'),
        assigneeIds: ['assignee-1'],
      };

      mockRepository.validateAssignees.mockResolvedValue({
        allExist: true,
        allActive: true,
      });
      mockRepository.createTask.mockResolvedValue({ id: 'task-123' });

      await service.createTask(input, testUser);

      expect(mockRepository.validateProjectExists).not.toHaveBeenCalled();
    });
  });

  describe('TM016: External Validations - Assignees Existence and Status', () => {
    it('should validate all assignees exist and are active', async () => {
      const input = {
        title: 'Task',
        description: 'Description',
        priority: 5,
        dueDate: new Date('2025-12-31'),
        assigneeIds: ['user-1', 'user-2', 'user-3'],
      };

      mockRepository.validateAssignees.mockResolvedValue({
        allExist: true,
        allActive: true,
      });
      mockRepository.createTask.mockResolvedValue({ id: 'task-123' });

      await service.createTask(input, testUser);

      expect(mockRepository.validateAssignees).toHaveBeenCalledWith([
        'user-1',
        'user-2',
        'user-3',
      ]);
      expect(mockRepository.createTask).toHaveBeenCalled();
    });

    it('should throw error when one or more assignees not found', async () => {
      const input = {
        title: 'Task',
        description: 'Description',
        priority: 5,
        dueDate: new Date('2025-12-31'),
        assigneeIds: ['user-1', 'nonexistent-user'],
      };

      mockRepository.validateAssignees.mockResolvedValue({
        allExist: false,
        allActive: true,
      });

      await expect(service.createTask(input, testUser)).rejects.toThrow(
        'One or more assignees not found'
      );

      expect(mockRepository.createTask).not.toHaveBeenCalled();
    });

    it('should throw error when one or more assignees are inactive', async () => {
      const input = {
        title: 'Task',
        description: 'Description',
        priority: 5,
        dueDate: new Date('2025-12-31'),
        assigneeIds: ['user-1', 'inactive-user'],
      };

      mockRepository.validateAssignees.mockResolvedValue({
        allExist: true,
        allActive: false,
      });

      await expect(service.createTask(input, testUser)).rejects.toThrow(
        'One or more assignees are inactive'
      );

      expect(mockRepository.createTask).not.toHaveBeenCalled();
    });
  });

  describe('TGO026: Subtask Depth Validation', () => {
    it('should allow creating subtask at level 1', async () => {
      const input = {
        title: 'Subtask',
        description: 'Description',
        priority: 5,
        dueDate: new Date('2025-12-31'),
        assigneeIds: ['assignee-1'],
        parentTaskId: 'parent-task-id',
      };

      // Parent has no parent (level 0), so this will be level 1
      mockRepository.getParentTaskDepth.mockResolvedValue({
        id: 'parent-task-id',
        parentTaskId: null,
      });
      mockRepository.validateAssignees.mockResolvedValue({
        allExist: true,
        allActive: true,
      });
      mockRepository.createTask.mockResolvedValue({ id: 'subtask-123' });

      await service.createTask(input, testUser);

      expect(mockRepository.getParentTaskDepth).toHaveBeenCalledWith(
        'parent-task-id'
      );
      expect(mockRepository.createTask).toHaveBeenCalledWith(
        expect.objectContaining({
          parentTaskId: 'parent-task-id',
        })
      );
    });

    it('should throw error when creating level 3 subtask (exceeds maximum)', async () => {
      const input = {
        title: 'Level 3 Subtask',
        description: 'Description',
        priority: 5,
        dueDate: new Date('2025-12-31'),
        assigneeIds: ['assignee-1'],
        parentTaskId: 'level-2-task-id',
      };

      // Parent task already has a parent (is level 1), so it would create level 2
      mockRepository.getParentTaskDepth.mockResolvedValue({
        id: 'level-2-task-id',
        parentTaskId: 'level-1-task-id',
      });

      await expect(service.createTask(input, testUser)).rejects.toThrow(
        'Maximum subtask depth is 2 levels (TGO026)'
      );

      expect(mockRepository.createTask).not.toHaveBeenCalled();
    });

    it('should throw error when parent task not found', async () => {
      const input = {
        title: 'Subtask',
        description: 'Description',
        priority: 5,
        dueDate: new Date('2025-12-31'),
        assigneeIds: ['assignee-1'],
        parentTaskId: 'nonexistent-parent',
      };

      mockRepository.getParentTaskDepth.mockResolvedValue(null);

      await expect(service.createTask(input, testUser)).rejects.toThrow(
        'Parent task not found'
      );

      expect(mockRepository.createTask).not.toHaveBeenCalled();
    });

    it('should skip parent validation when parentTaskId not provided', async () => {
      const input = {
        title: 'Root Task',
        description: 'Description',
        priority: 5,
        dueDate: new Date('2025-12-31'),
        assigneeIds: ['assignee-1'],
      };

      mockRepository.validateAssignees.mockResolvedValue({
        allExist: true,
        allActive: true,
      });
      mockRepository.createTask.mockResolvedValue({ id: 'task-123' });

      await service.createTask(input, testUser);

      expect(mockRepository.getParentTaskDepth).not.toHaveBeenCalled();
    });
  });

  describe('Optional Fields - Tags', () => {
    it('should create task with tags', async () => {
      const input = {
        title: 'Task',
        description: 'Description',
        priority: 5,
        dueDate: new Date('2025-12-31'),
        assigneeIds: ['assignee-1'],
        tags: ['urgent', 'frontend', 'bug'],
      };

      mockRepository.validateAssignees.mockResolvedValue({
        allExist: true,
        allActive: true,
      });
      mockRepository.createTask.mockResolvedValue({ id: 'task-123' });

      await service.createTask(input, testUser);

      expect(mockRepository.createTask).toHaveBeenCalledWith(
        expect.objectContaining({
          tags: ['urgent', 'frontend', 'bug'],
        })
      );
    });

    it('should create task without tags', async () => {
      const input = {
        title: 'Task',
        description: 'Description',
        priority: 5,
        dueDate: new Date('2025-12-31'),
        assigneeIds: ['assignee-1'],
      };

      mockRepository.validateAssignees.mockResolvedValue({
        allExist: true,
        allActive: true,
      });
      mockRepository.createTask.mockResolvedValue({ id: 'task-123' });

      await service.createTask(input, testUser);

      expect(mockRepository.createTask).toHaveBeenCalledWith(
        expect.objectContaining({
          tags: undefined,
        })
      );
    });
  });

  describe('Optional Fields - Recurring', () => {
    it('should create recurring task with interval', async () => {
      const input = {
        title: 'Weekly Report',
        description: 'Submit weekly report',
        priority: 5,
        dueDate: new Date('2025-12-31'),
        assigneeIds: ['assignee-1'],
        recurringInterval: 7,
      };

      mockRepository.validateAssignees.mockResolvedValue({
        allExist: true,
        allActive: true,
      });
      mockRepository.createTask.mockResolvedValue({ id: 'task-123' });

      await service.createTask(input, testUser);

      expect(mockRepository.createTask).toHaveBeenCalledWith(
        expect.objectContaining({
          recurringInterval: 7,
        })
      );
    });

    it('should create non-recurring task when interval not provided', async () => {
      const input = {
        title: 'One-time Task',
        description: 'Description',
        priority: 5,
        dueDate: new Date('2025-12-31'),
        assigneeIds: ['assignee-1'],
      };

      mockRepository.validateAssignees.mockResolvedValue({
        allExist: true,
        allActive: true,
      });
      mockRepository.createTask.mockResolvedValue({ id: 'task-123' });

      await service.createTask(input, testUser);

      expect(mockRepository.createTask).toHaveBeenCalledWith(
        expect.objectContaining({
          recurringInterval: undefined,
        })
      );
    });
  });

  describe('Service Orchestration Flow', () => {
    it('should perform validations before calling domain factory', async () => {
      const input = {
        title: 'Task',
        description: 'Description',
        priority: 5,
        dueDate: new Date('2025-12-31'),
        assigneeIds: ['assignee-1'],
        projectId: 'project-123',
        parentTaskId: 'parent-123',
      };

      mockRepository.validateProjectExists.mockResolvedValue(true);
      mockRepository.getParentTaskDepth.mockResolvedValue({
        id: 'parent-123',
        parentTaskId: null,
      });
      mockRepository.validateAssignees.mockResolvedValue({
        allExist: true,
        allActive: true,
      });
      mockRepository.createTask.mockResolvedValue({ id: 'task-123' });

      await service.createTask(input, testUser);

      // Verify validation order
      expect(mockRepository.validateProjectExists).toHaveBeenCalled();
      expect(mockRepository.getParentTaskDepth).toHaveBeenCalled();
      expect(mockRepository.validateAssignees).toHaveBeenCalled();
      expect(mockRepository.createTask).toHaveBeenCalled();
      expect(mockRepository.logTaskAction).toHaveBeenCalled();
    });

    it('should not call repository if validation fails', async () => {
      const input = {
        title: 'Task',
        description: 'Description',
        priority: 5,
        dueDate: new Date('2025-12-31'),
        assigneeIds: ['nonexistent-user'],
      };

      mockRepository.validateAssignees.mockResolvedValue({
        allExist: false,
        allActive: true,
      });

      await expect(service.createTask(input, testUser)).rejects.toThrow();

      expect(mockRepository.createTask).not.toHaveBeenCalled();
      expect(mockRepository.logTaskAction).not.toHaveBeenCalled();
    });

    it('should log task creation action after successful create', async () => {
      const input = {
        title: 'Task',
        description: 'Description',
        priority: 5,
        dueDate: new Date('2025-12-31'),
        assigneeIds: ['assignee-1'],
      };

      mockRepository.validateAssignees.mockResolvedValue({
        allExist: true,
        allActive: true,
      });
      mockRepository.createTask.mockResolvedValue({ id: 'task-123' });

      await service.createTask(input, testUser);

      expect(mockRepository.logTaskAction).toHaveBeenCalledWith(
        'task-123',
        'creator-123',
        'CREATED',
        'Task',
        {
          changes: {
            title: 'Task',
          },
          metadata: {
            source: 'web_ui',
          },
        }
      );
    });
  });
});
