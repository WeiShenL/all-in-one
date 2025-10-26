/**
 * Unit Tests for TaskService - Archive Operations
 *
 * Tests all acceptance criteria for "Manager archive tasks/subtasks":
 * - AC1: Only Managers can archive tasks within their scope
 * - AC2: Archived tasks are excluded from standard list views
 * - AC3: Archiving a parent task also archives its subtasks
 *
 * "Within scope" = Tasks in manager's department or subordinate departments
 */

import {
  TaskService,
  UserContext,
} from '../../../src/services/task/TaskService';
import { ITaskRepository } from '../../../src/repositories/ITaskRepository';

// Mock SupabaseStorageService to prevent real Supabase client creation in CI/CD
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

describe('TaskService - Archive Operations', () => {
  let taskService: TaskService;
  let mockTaskRepository: jest.Mocked<ITaskRepository>;

  // Test user contexts
  const managerContext: UserContext = {
    userId: 'manager-id',
    role: 'MANAGER',
    departmentId: 'dept-sales',
    isHrAdmin: false,
  };

  const staffContext: UserContext = {
    userId: 'staff-id',
    role: 'STAFF',
    departmentId: 'dept-sales',
    isHrAdmin: false,
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Create mock repository
    mockTaskRepository = {
      getTaskByIdFull: jest.fn(),
      archiveTask: jest.fn(),
      unarchiveTask: jest.fn(),
      logTaskAction: jest.fn(),
      getDepartmentWithParent: jest.fn(),
      getSubtasks: jest.fn().mockResolvedValue([]),
      getUserDepartments: jest.fn().mockResolvedValue([]),
      getUserProfile: jest.fn().mockResolvedValue({
        id: 'user-123',
        departmentId: 'dept-sales',
        role: 'STAFF',
        isActive: true,
      }),
    } as any;

    // Create service
    taskService = new TaskService(mockTaskRepository);
  });

  // ============================================
  // AC1: Only Managers Can Archive Tasks
  // ============================================

  describe('AC1: Manager Authorization for Archive', () => {
    /**
     * Test 1: Manager can archive a task in their department
     */
    it('should allow manager to archive task in their department', async () => {
      // Arrange
      const taskData = {
        id: 'task-1',
        title: 'Test Task',
        description: 'Test Description',
        ownerId: 'owner-id',
        departmentId: 'dept-sales', // Same department as manager
        status: 'TO_DO',
        priority: 5,
        dueDate: new Date('2025-12-31'),
        projectId: null,
        parentTaskId: null,
        recurringInterval: null,
        isArchived: false,
        startDate: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        assignments: [],
        tags: [],
        comments: [],
        files: [],
      };

      mockTaskRepository.getTaskByIdFull.mockResolvedValue(taskData as any);
      mockTaskRepository.getSubtasks.mockResolvedValue([]); // No subtasks
      // Manager from dept-sales accessing task in dept-sales -> same department, so return dept-sales with null parent
      mockTaskRepository.getDepartmentWithParent.mockResolvedValueOnce({
        id: 'dept-sales',
        parentId: null,
      });

      // Act
      await taskService.archiveTask('task-1', managerContext);

      // Assert
      expect(mockTaskRepository.archiveTask).toHaveBeenCalledWith('task-1');
      expect(mockTaskRepository.logTaskAction).toHaveBeenCalledWith(
        'task-1',
        'manager-id',
        'ARCHIVED',
        'Task',
        expect.objectContaining({
          changes: { from: false, to: true },
        })
      );
    });

    /**
     * Test 2: Manager can archive a task in a subordinate department
     */
    it('should allow manager to archive task in subordinate department', async () => {
      // Arrange
      const taskData = {
        id: 'task-2',
        title: 'Subordinate Task',
        description: 'Task in subordinate dept',
        ownerId: 'owner-id',
        departmentId: 'dept-sales-child', // Subordinate department
        status: 'TO_DO',
        priority: 5,
        dueDate: new Date('2025-12-31'),
        projectId: null,
        parentTaskId: null,
        recurringInterval: null,
        isArchived: false,
        startDate: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        assignments: [],
        tags: [],
        comments: [],
        files: [],
      };

      mockTaskRepository.getTaskByIdFull.mockResolvedValue(taskData as any);

      // Mock department hierarchy: dept-sales-child's parent is dept-sales
      // Mock hierarchy check: dept-sales-child's parent is dept-sales
      mockTaskRepository.getDepartmentWithParent.mockResolvedValueOnce({
        id: 'dept-sales-child',
        parentId: 'dept-sales', // Manager's department
      });
      mockTaskRepository.getSubtasks.mockResolvedValue([]); // No subtasks

      // Act
      await taskService.archiveTask('task-2', managerContext);

      // Assert
      expect(mockTaskRepository.archiveTask).toHaveBeenCalledWith('task-2');
      expect(mockTaskRepository.logTaskAction).toHaveBeenCalled();
    });

    /**
     * Test 3: Staff cannot archive tasks (should throw error)
     */
    it('should throw error when staff tries to archive a task', async () => {
      // Arrange
      const taskData = {
        id: 'task-3',
        title: 'Test Task',
        description: 'Test Description',
        ownerId: 'owner-id',
        departmentId: 'dept-sales',
        status: 'TO_DO',
        priority: 5,
        dueDate: new Date('2025-12-31'),
        projectId: null,
        parentTaskId: null,
        recurringInterval: null,
        isArchived: false,
        startDate: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        assignments: [],
        tags: [],
        comments: [],
        files: [],
      };

      mockTaskRepository.getTaskByIdFull.mockResolvedValue(taskData as any);
      // Manager from dept-sales accessing task in dept-sales -> same department
      mockTaskRepository.getDepartmentWithParent.mockResolvedValueOnce({
        id: 'dept-sales',
        parentId: null,
      });

      // Act & Assert
      await expect(
        taskService.archiveTask('task-3', staffContext)
      ).rejects.toThrow('Unauthorized: Only managers can archive tasks');
    });

    /**
     * Test 4: Manager cannot archive task in unrelated department
     */
    it('should throw error when manager tries to archive task in unrelated department', async () => {
      // Arrange
      const taskData = {
        id: 'task-4',
        title: 'External Task',
        description: 'Task in unrelated department',
        ownerId: 'owner-id',
        departmentId: 'dept-engineering', // Completely different department
        status: 'TO_DO',
        priority: 5,
        dueDate: new Date('2025-12-31'),
        projectId: null,
        parentTaskId: null,
        recurringInterval: null,
        isArchived: false,
        startDate: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        assignments: [],
        tags: [],
        comments: [],
        files: [],
      };

      // Note: This test will fail at getTaskById level because manager cannot ACCESS
      // tasks in unrelated departments. The authorization check in getTaskById will catch this.
      mockTaskRepository.getTaskByIdFull.mockResolvedValue(taskData as any);

      // Mock department hierarchy: dept-engineering is not under dept-sales
      // First call: check dept-engineering
      mockTaskRepository.getDepartmentWithParent.mockResolvedValueOnce({
        id: 'dept-engineering',
        parentId: 'dept-root', // Different hierarchy
      });
      // Second call: check its parent
      mockTaskRepository.getDepartmentWithParent.mockResolvedValueOnce({
        id: 'dept-root',
        parentId: null, // Root
      });

      // Act & Assert
      // getTaskById will throw an error because manager doesn't have access to unrelated departments
      await expect(
        taskService.archiveTask('task-4', managerContext)
      ).rejects.toThrow(
        'Unauthorized: You must be assigned to this task or it must be in your department hierarchy'
      );
    });
  });

  // ============================================
  // AC2: Archived Tasks Excluded from Views
  // ============================================

  describe('AC2: Archived Tasks Excluded from Views', () => {
    /**
     * This is tested at the repository layer where queries filter by isArchived = false
     * We verify the service passes the correct parameters
     */
    it('should exclude archived tasks by default when fetching user tasks', async () => {
      // Arrange
      mockTaskRepository.getUserTasks = jest.fn().mockResolvedValue([]);

      // Act
      await taskService.getUserTasks('user-123', false);

      // Assert
      expect(mockTaskRepository.getUserTasks).toHaveBeenCalledWith(
        'user-123',
        false // includeArchived = false
      );
    });

    it('should allow including archived tasks when explicitly requested', async () => {
      // Arrange
      mockTaskRepository.getUserTasks = jest.fn().mockResolvedValue([]);

      // Act
      await taskService.getUserTasks('user-123', true);

      // Assert
      expect(mockTaskRepository.getUserTasks).toHaveBeenCalledWith(
        'user-123',
        true // includeArchived = true
      );
    });
  });

  // ============================================
  // AC3: Archiving Parent Archives Subtasks
  // ============================================

  describe('AC3: Cascade Archive to Subtasks', () => {
    /**
     * Test 6: Archiving a parent task archives all its subtasks
     */
    it('should archive all subtasks when parent task is archived', async () => {
      // Arrange
      const parentTaskData = {
        id: 'parent-task',
        title: 'Parent Task',
        description: 'Parent Task Description',
        ownerId: 'owner-id',
        departmentId: 'dept-sales',
        status: 'TO_DO',
        priority: 5,
        dueDate: new Date('2025-12-31'),
        projectId: null,
        parentTaskId: null,
        recurringInterval: null,
        isArchived: false,
        startDate: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        assignments: [],
        tags: [],
        comments: [],
        files: [],
      };

      const subtask1Data = {
        id: 'subtask-1',
        title: 'Subtask 1',
        description: 'First subtask',
        ownerId: 'owner-id',
        departmentId: 'dept-sales',
        status: 'TO_DO',
        priority: 5,
        dueDate: new Date('2025-12-31'),
        projectId: null,
        parentTaskId: 'parent-task',
        recurringInterval: null,
        isArchived: false,
        startDate: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        assignments: [],
        tags: [],
        comments: [],
        files: [],
      };

      const subtask2Data = {
        id: 'subtask-2',
        title: 'Subtask 2',
        description: 'Second subtask',
        ownerId: 'owner-id',
        departmentId: 'dept-sales',
        status: 'TO_DO',
        priority: 5,
        dueDate: new Date('2025-12-31'),
        projectId: null,
        parentTaskId: 'parent-task',
        recurringInterval: null,
        isArchived: false,
        startDate: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        assignments: [],
        tags: [],
        comments: [],
        files: [],
      };

      // Mock parent task fetch
      mockTaskRepository.getTaskByIdFull.mockResolvedValue(
        parentTaskData as any
      );
      // Mock department hierarchy check
      mockTaskRepository.getDepartmentWithParent.mockResolvedValueOnce({
        id: 'dept-sales',
        parentId: null,
      });

      // Mock subtasks fetch
      mockTaskRepository.getSubtasks = jest
        .fn()
        .mockResolvedValue([subtask1Data, subtask2Data]);

      // Act
      await taskService.archiveTask('parent-task', managerContext);

      // Assert
      // Parent task should be archived
      expect(mockTaskRepository.archiveTask).toHaveBeenCalledWith(
        'parent-task'
      );

      // Note: Subtasks are now archived using direct Prisma call (this.prisma.task.update)
      // So we don't check for archiveTask calls for subtasks, but we verify getSubtasks was called
      expect(mockTaskRepository.getSubtasks).toHaveBeenCalledWith(
        'parent-task'
      );

      // Should log action for parent
      expect(mockTaskRepository.logTaskAction).toHaveBeenCalledWith(
        'parent-task',
        'manager-id',
        'ARCHIVED',
        'Task',
        expect.objectContaining({
          changes: { from: false, to: true },
        })
      );

      // Should log action for subtasks
      expect(mockTaskRepository.logTaskAction).toHaveBeenCalledWith(
        'subtask-1',
        'manager-id',
        'ARCHIVED',
        'Task',
        expect.objectContaining({
          changes: { from: false, to: true },
          metadata: expect.objectContaining({
            cascadeFromParent: true,
            parentTaskId: 'parent-task',
          }),
        })
      );
    });

    /**
     * Test 7: Task without subtasks should still be archivable
     */
    it('should archive task without subtasks successfully', async () => {
      // Arrange
      const taskData = {
        id: 'task-no-subtasks',
        title: 'Task Without Subtasks',
        description: 'No subtasks',
        ownerId: 'owner-id',
        departmentId: 'dept-sales',
        status: 'TO_DO',
        priority: 5,
        dueDate: new Date('2025-12-31'),
        projectId: null,
        parentTaskId: null,
        recurringInterval: null,
        isArchived: false,
        startDate: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        assignments: [],
        tags: [],
        comments: [],
        files: [],
      };

      mockTaskRepository.getTaskByIdFull.mockResolvedValue(taskData as any);
      mockTaskRepository.getSubtasks = jest.fn().mockResolvedValue([]);

      // Act
      await taskService.archiveTask('task-no-subtasks', managerContext);

      // Assert
      expect(mockTaskRepository.archiveTask).toHaveBeenCalledWith(
        'task-no-subtasks'
      );
      expect(mockTaskRepository.getSubtasks).toHaveBeenCalledWith(
        'task-no-subtasks'
      );
    });
  });
});
