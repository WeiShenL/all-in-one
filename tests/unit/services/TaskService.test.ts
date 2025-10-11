import { TaskService, UserContext } from '@/services/task/TaskService';
import { ITaskRepository } from '@/repositories/ITaskRepository';
import { TaskStatus } from '@/domain/task/Task';

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

/**
 * TaskService Test Suite - READ and UPDATE Operations
 * Tests service orchestration with DDD architecture
 * Mocks ITaskRepository interface (not Prisma directly)
 */

describe('TaskService - READ and UPDATE Operations', () => {
  let service: TaskService;
  let mockRepository: jest.Mocked<ITaskRepository>;

  const testUser: UserContext = {
    userId: 'user-123',
    role: 'STAFF',
    departmentId: 'dept-456',
  };

  const mockTaskData = {
    id: 'task-001',
    title: 'Implement Login Feature',
    description: 'Create login functionality',
    priority: 8,
    dueDate: new Date('2025-12-31'),
    status: 'TO_DO',
    ownerId: 'user-123',
    departmentId: 'dept-456',
    projectId: 'project-789',
    parentTaskId: null,
    recurringInterval: null,
    isArchived: false,
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
    assignments: [{ userId: 'user-123' }],
    tags: [{ tag: { name: 'backend' } }],
    comments: [],
    files: [],
  };

  beforeEach(() => {
    mockRepository = {
      createTask: jest.fn(),
      createTaskFile: jest.fn(),
      getTaskFiles: jest.fn(),
      getTaskFileById: jest.fn(),
      deleteTaskFile: jest.fn(),
      getTaskById: jest.fn(),
      getTaskByIdFull: jest.fn(),
      logTaskAction: jest.fn(),
      validateProjectExists: jest.fn(),
      getParentTaskDepth: jest.fn(),
      validateAssignees: jest.fn(),
      getUserTasks: jest.fn(),
      getDepartmentTasks: jest.fn(),
      updateTask: jest.fn(),
      addTaskTag: jest.fn(),
      removeTaskTag: jest.fn(),
      addTaskAssignment: jest.fn(),
      createComment: jest.fn(),
      updateComment: jest.fn(),
    } as any;

    service = new TaskService(mockRepository);
    jest.clearAllMocks();
  });

  // ============================================
  // READ OPERATIONS
  // ============================================

  describe('READ Operations', () => {
    describe('getTaskById', () => {
      it('should retrieve task by ID for authorized user (assignee)', async () => {
        mockRepository.getTaskByIdFull.mockResolvedValue(mockTaskData);

        const result = await service.getTaskById('task-001', testUser);

        expect(mockRepository.getTaskByIdFull).toHaveBeenCalledWith('task-001');
        expect(result).toBeDefined();
        expect(result?.getTitle()).toBe('Implement Login Feature');
        expect(result?.getPriorityBucket()).toBe(8);
      });

      it('should retrieve task by ID for authorized user (owner)', async () => {
        const taskData = { ...mockTaskData, ownerId: 'user-123' };
        mockRepository.getTaskByIdFull.mockResolvedValue(taskData);

        const result = await service.getTaskById('task-001', testUser);

        expect(result).toBeDefined();
        expect(result?.getTitle()).toBe('Implement Login Feature');
      });

      it('should throw error for unauthorized user (not assignee or owner)', async () => {
        const taskData = {
          ...mockTaskData,
          ownerId: 'other-user',
          assignments: [{ userId: 'other-user' }],
        };
        mockRepository.getTaskByIdFull.mockResolvedValue(taskData);

        const unauthorizedUser = { ...testUser, userId: 'user-999' };
        await expect(
          service.getTaskById('task-001', unauthorizedUser)
        ).rejects.toThrow(
          'Unauthorized: You must be the task owner, assigned to this task, or a manager of the department'
        );
      });

      it('should return null when task not found', async () => {
        mockRepository.getTaskByIdFull.mockResolvedValue(null);

        const result = await service.getTaskById('nonexistent', testUser);

        expect(result).toBeNull();
      });
    });

    describe('getUserTasks', () => {
      it('should retrieve all tasks assigned to user', async () => {
        mockRepository.getUserTasks.mockResolvedValue([
          mockTaskData,
          {
            ...mockTaskData,
            id: 'task-002',
            title: 'Another Task',
          },
        ]);

        const result = await service.getUserTasks('user-123', false);

        expect(mockRepository.getUserTasks).toHaveBeenCalledWith(
          'user-123',
          false
        );
        expect(result).toHaveLength(2);
        expect(result[0].getTitle()).toBe('Implement Login Feature');
        expect(result[1].getTitle()).toBe('Another Task');
      });

      it('should retrieve tasks including archived when requested', async () => {
        const archivedTask = { ...mockTaskData, isArchived: true };
        mockRepository.getUserTasks.mockResolvedValue([archivedTask]);

        const result = await service.getUserTasks('user-123', true);

        expect(mockRepository.getUserTasks).toHaveBeenCalledWith(
          'user-123',
          true
        );
        expect(result).toHaveLength(1);
      });
    });

    describe('getDepartmentTasks', () => {
      it('should retrieve all tasks in department for MANAGER', async () => {
        const managerUser: UserContext = {
          ...testUser,
          role: 'MANAGER',
        };

        mockRepository.getDepartmentTasks.mockResolvedValue([
          mockTaskData,
          {
            ...mockTaskData,
            id: 'task-002',
            title: 'Department Task',
          },
        ]);

        const result = await service.getDepartmentTasks(
          'dept-456',
          managerUser,
          false
        );

        expect(mockRepository.getDepartmentTasks).toHaveBeenCalledWith(
          'dept-456',
          false
        );
        expect(result).toHaveLength(2);
      });

      it('should throw error for STAFF role', async () => {
        await expect(
          service.getDepartmentTasks('dept-456', testUser, false)
        ).rejects.toThrow(
          'Unauthorized: Only managers and HR admins can view all department tasks'
        );
      });
    });
  });

  // ============================================
  // UPDATE OPERATIONS
  // ============================================

  describe('UPDATE Operations', () => {
    describe('updateTaskTitle', () => {
      it('should update task title for authorized user', async () => {
        mockRepository.getTaskByIdFull.mockResolvedValue(mockTaskData);
        mockRepository.updateTask.mockResolvedValue(undefined);

        await service.updateTaskTitle('task-001', 'New Title', testUser);

        expect(mockRepository.updateTask).toHaveBeenCalledWith('task-001', {
          title: 'New Title',
          updatedAt: expect.any(Date),
        });
        expect(mockRepository.logTaskAction).toHaveBeenCalledWith(
          'task-001',
          'user-123',
          'UPDATED',
          { field: 'title', newValue: 'New Title' }
        );
      });

      it('should throw error when title is empty', async () => {
        mockRepository.getTaskByIdFull.mockResolvedValue(mockTaskData);

        await expect(
          service.updateTaskTitle('task-001', '', testUser)
        ).rejects.toThrow('Task title must be between 1 and 255 characters');
      });

      it('should throw error for unauthorized user', async () => {
        const taskData = {
          ...mockTaskData,
          ownerId: 'other-user',
          assignments: [{ userId: 'other-user' }],
        };
        mockRepository.getTaskByIdFull.mockResolvedValue(taskData);

        const unauthorizedUser = { ...testUser, userId: 'user-999' };
        await expect(
          service.updateTaskTitle('task-001', 'New Title', unauthorizedUser)
        ).rejects.toThrow(
          'Unauthorized: You must be the task owner, assigned to this task, or a manager of the department'
        );
      });
    });

    describe('updateTaskDescription', () => {
      it('should update task description for authorized user', async () => {
        mockRepository.getTaskByIdFull.mockResolvedValue(mockTaskData);
        mockRepository.updateTask.mockResolvedValue(undefined);

        await service.updateTaskDescription(
          'task-001',
          'New description',
          testUser
        );

        expect(mockRepository.updateTask).toHaveBeenCalledWith('task-001', {
          description: 'New description',
          updatedAt: expect.any(Date),
        });
      });

      it('should allow empty description', async () => {
        mockRepository.getTaskByIdFull.mockResolvedValue(mockTaskData);
        mockRepository.updateTask.mockResolvedValue(undefined);

        await service.updateTaskDescription('task-001', '', testUser);

        expect(mockRepository.updateTask).toHaveBeenCalledWith('task-001', {
          description: '',
          updatedAt: expect.any(Date),
        });
      });
    });

    describe('updateTaskPriority', () => {
      it('should update task priority for authorized user', async () => {
        mockRepository.getTaskByIdFull.mockResolvedValue(mockTaskData);
        mockRepository.updateTask.mockResolvedValue(undefined);

        await service.updateTaskPriority('task-001', 5, testUser);

        expect(mockRepository.updateTask).toHaveBeenCalledWith('task-001', {
          priority: 5,
          updatedAt: expect.any(Date),
        });
        expect(mockRepository.logTaskAction).toHaveBeenCalledWith(
          'task-001',
          'user-123',
          'UPDATED',
          { field: 'priority', newValue: 5 }
        );
      });

      it('should throw error for invalid priority (below 1)', async () => {
        mockRepository.getTaskByIdFull.mockResolvedValue(mockTaskData);

        await expect(
          service.updateTaskPriority('task-001', 0, testUser)
        ).rejects.toThrow('Priority must be between 1 and 10');
      });

      it('should throw error for invalid priority (above 10)', async () => {
        mockRepository.getTaskByIdFull.mockResolvedValue(mockTaskData);

        await expect(
          service.updateTaskPriority('task-001', 11, testUser)
        ).rejects.toThrow('Priority must be between 1 and 10');
      });
    });

    describe('updateTaskDeadline', () => {
      it('should update task deadline for authorized user', async () => {
        mockRepository.getTaskByIdFull.mockResolvedValue(mockTaskData);
        mockRepository.updateTask.mockResolvedValue(undefined);

        const newDeadline = new Date('2026-01-15');
        await service.updateTaskDeadline('task-001', newDeadline, testUser);

        expect(mockRepository.updateTask).toHaveBeenCalledWith('task-001', {
          dueDate: newDeadline,
          updatedAt: expect.any(Date),
        });
      });

      it('should enforce DST014: subtask deadline cannot exceed parent deadline', async () => {
        const parentDueDate = new Date('2025-12-31');
        const subtaskData = {
          ...mockTaskData,
          parentTaskId: 'parent-001',
          dueDate: new Date('2025-12-15'),
        };

        // First call returns subtask, second call returns parent
        mockRepository.getTaskByIdFull
          .mockResolvedValueOnce(subtaskData)
          .mockResolvedValueOnce({
            ...mockTaskData,
            id: 'parent-001',
            dueDate: parentDueDate,
            parentTaskId: null,
          } as any);

        // Attempt to set subtask deadline after parent deadline
        const invalidDeadline = new Date('2026-01-15');
        await expect(
          service.updateTaskDeadline('task-001', invalidDeadline, testUser)
        ).rejects.toThrow(
          'Subtask deadline cannot be after parent task deadline'
        );
      });
    });

    describe('updateTaskStatus', () => {
      it('should update task status for authorized user', async () => {
        mockRepository.getTaskByIdFull.mockResolvedValue(mockTaskData);
        mockRepository.updateTask.mockResolvedValue(undefined);

        await service.updateTaskStatus(
          'task-001',
          TaskStatus.IN_PROGRESS,
          testUser
        );

        expect(mockRepository.updateTask).toHaveBeenCalledWith('task-001', {
          status: 'IN_PROGRESS',
          updatedAt: expect.any(Date),
        });
        expect(mockRepository.logTaskAction).toHaveBeenCalledWith(
          'task-001',
          'user-123',
          'STATUS_CHANGED',
          { newStatus: 'IN_PROGRESS' }
        );
      });

      // Note: Recurring task generation on COMPLETED status is tested separately
      // in TaskService.recurring.test.ts - that feature will be implemented later
    });

    describe('updateTaskRecurring', () => {
      it('should enable recurring with valid interval', async () => {
        mockRepository.getTaskByIdFull.mockResolvedValue(mockTaskData);
        mockRepository.updateTask.mockResolvedValue(undefined);

        await service.updateTaskRecurring('task-001', true, 14, testUser);

        expect(mockRepository.updateTask).toHaveBeenCalledWith('task-001', {
          recurringInterval: 14,
          updatedAt: expect.any(Date),
        });
      });

      it('should disable recurring when enabled is false', async () => {
        mockRepository.getTaskByIdFull.mockResolvedValue(mockTaskData);
        mockRepository.updateTask.mockResolvedValue(undefined);

        await service.updateTaskRecurring('task-001', false, null, testUser);

        expect(mockRepository.updateTask).toHaveBeenCalledWith('task-001', {
          recurringInterval: null,
          updatedAt: expect.any(Date),
        });
      });

      it('should throw error when enabled but days is null', async () => {
        mockRepository.getTaskByIdFull.mockResolvedValue(mockTaskData);

        await expect(
          service.updateTaskRecurring('task-001', true, null, testUser)
        ).rejects.toThrow(
          'Recurrence days must be greater than 0 when recurring is enabled'
        );
      });

      it('should throw error when enabled but days is negative', async () => {
        mockRepository.getTaskByIdFull.mockResolvedValue(mockTaskData);

        await expect(
          service.updateTaskRecurring('task-001', true, -5, testUser)
        ).rejects.toThrow(
          'Recurrence days must be greater than 0 when recurring is enabled'
        );
      });
    });
  });

  // ============================================
  // TAG OPERATIONS
  // ============================================

  describe('TAG Operations', () => {
    describe('addTagToTask', () => {
      it('should add tag to task for authorized user', async () => {
        mockRepository.getTaskByIdFull.mockResolvedValue(mockTaskData);
        mockRepository.addTaskTag.mockResolvedValue(undefined);

        await service.addTagToTask('task-001', 'urgent', testUser);

        expect(mockRepository.addTaskTag).toHaveBeenCalledWith(
          'task-001',
          'urgent'
        );
        expect(mockRepository.logTaskAction).toHaveBeenCalledWith(
          'task-001',
          'user-123',
          'UPDATED',
          { action: 'addTag', tag: 'urgent' }
        );
      });

      it('should throw error for unauthorized user', async () => {
        const taskData = {
          ...mockTaskData,
          ownerId: 'other-user',
          assignments: [{ userId: 'other-user' }],
        };
        mockRepository.getTaskByIdFull.mockResolvedValue(taskData);

        const unauthorizedUser = { ...testUser, userId: 'user-999' };
        await expect(
          service.addTagToTask('task-001', 'urgent', unauthorizedUser)
        ).rejects.toThrow(
          'Unauthorized: You must be the task owner, assigned to this task, or a manager of the department'
        );
      });
    });

    describe('removeTagFromTask', () => {
      it('should remove tag from task for authorized user', async () => {
        mockRepository.getTaskByIdFull.mockResolvedValue(mockTaskData);
        mockRepository.removeTaskTag.mockResolvedValue(undefined);

        await service.removeTagFromTask('task-001', 'backend', testUser);

        expect(mockRepository.removeTaskTag).toHaveBeenCalledWith(
          'task-001',
          'backend'
        );
        expect(mockRepository.logTaskAction).toHaveBeenCalledWith(
          'task-001',
          'user-123',
          'UPDATED',
          { action: 'removeTag', tag: 'backend' }
        );
      });
    });
  });

  // ============================================
  // ASSIGNMENT OPERATIONS
  // ============================================

  describe('ASSIGNMENT Operations', () => {
    describe('addAssigneeToTask', () => {
      it('should add assignee to task for authorized user', async () => {
        const taskWithLessThan5Assignees = {
          ...mockTaskData,
          assignments: [
            { userId: 'user-123' }, // testUser must be assigned
            { userId: 'user-2' },
            { userId: 'user-3' },
          ],
        };
        mockRepository.getTaskByIdFull.mockResolvedValue(
          taskWithLessThan5Assignees
        );
        mockRepository.validateAssignees.mockResolvedValue({
          allExist: true,
          allActive: true,
        });
        mockRepository.addTaskAssignment.mockResolvedValue(undefined);

        await service.addAssigneeToTask('task-001', 'user-new', testUser);

        expect(mockRepository.addTaskAssignment).toHaveBeenCalledWith(
          'task-001',
          'user-new',
          'user-123'
        );
      });

      it('should throw error when max assignees reached (TM023)', async () => {
        const taskWith5Assignees = {
          ...mockTaskData,
          assignments: [
            { userId: 'user-123' }, // testUser must be assigned
            { userId: 'user-2' },
            { userId: 'user-3' },
            { userId: 'user-4' },
            { userId: 'user-5' },
          ],
        };
        mockRepository.getTaskByIdFull.mockResolvedValue(taskWith5Assignees);
        mockRepository.validateAssignees.mockResolvedValue({
          allExist: true,
          allActive: true,
        });

        await expect(
          service.addAssigneeToTask('task-001', 'user-6', testUser)
        ).rejects.toThrow('Maximum of 5 assignees allowed per task');
      });

      it('should throw error when assignee does not exist', async () => {
        mockRepository.getTaskByIdFull.mockResolvedValue(mockTaskData);
        mockRepository.validateAssignees.mockResolvedValue({
          allExist: false,
          allActive: false,
        });

        await expect(
          service.addAssigneeToTask('task-001', 'nonexistent', testUser)
        ).rejects.toThrow('Assignee not found');
      });

      it('should throw error when assignee is inactive', async () => {
        mockRepository.getTaskByIdFull.mockResolvedValue(mockTaskData);
        mockRepository.validateAssignees.mockResolvedValue({
          allExist: true,
          allActive: false,
        });

        await expect(
          service.addAssigneeToTask('task-001', 'inactive-user', testUser)
        ).rejects.toThrow('Assignee is inactive');
      });
    });
  });

  // ============================================
  // COMMENT OPERATIONS
  // ============================================

  describe('COMMENT Operations', () => {
    describe('addCommentToTask', () => {
      it('should add comment to task for authorized user', async () => {
        mockRepository.getTaskByIdFull.mockResolvedValue(mockTaskData);
        mockRepository.createComment.mockResolvedValue(undefined);

        await service.addCommentToTask(
          'task-001',
          'This is a comment',
          testUser
        );

        expect(mockRepository.createComment).toHaveBeenCalledWith(
          'task-001',
          'This is a comment',
          'user-123'
        );
      });

      it('should throw error for unauthorized user (not assigned)', async () => {
        const taskData = {
          ...mockTaskData,
          ownerId: 'other-user',
          assignments: [{ userId: 'other-user' }],
        };
        mockRepository.getTaskByIdFull.mockResolvedValue(taskData);

        const unauthorizedUser = { ...testUser, userId: 'user-999' };
        await expect(
          service.addCommentToTask(
            'task-001',
            'This is a comment',
            unauthorizedUser
          )
        ).rejects.toThrow(
          'Unauthorized: You must be the task owner, assigned to this task, or a manager of the department'
        );
      });
    });

    describe('updateComment', () => {
      it('should update comment content for comment author', async () => {
        const taskDataWithComment = {
          ...mockTaskData,
          comments: [
            {
              id: 'comment-001',
              content: 'Original comment',
              userId: 'user-123',
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          ],
        };
        mockRepository.getTaskByIdFull.mockResolvedValue(taskDataWithComment);
        mockRepository.updateComment.mockResolvedValue(undefined);

        await service.updateComment(
          'task-001',
          'comment-001',
          'Updated comment content',
          testUser
        );

        expect(mockRepository.updateComment).toHaveBeenCalledWith(
          'comment-001',
          'Updated comment content'
        );
      });

      it('should throw error when updating comment by non-author', async () => {
        const taskDataWithComment = {
          ...mockTaskData,
          comments: [
            {
              id: 'comment-001',
              content: 'Original comment',
              userId: 'other-user',
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          ],
        };
        mockRepository.getTaskByIdFull.mockResolvedValue(taskDataWithComment);

        await expect(
          service.updateComment(
            'task-001',
            'comment-001',
            'Updated comment',
            testUser
          )
        ).rejects.toThrow('User is not authorized to perform this action');
      });
    });
  });
});
