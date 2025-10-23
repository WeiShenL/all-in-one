/**
 * Unit Tests for TaskService - Manager Operations (SCRUM-15)
 *
 * Tests all acceptance criteria for manager task management:
 * - AC1 & AC2: Manager can assign ANY staff to accessible tasks
 * - AC3: Manager can remove assignees from accessible tasks
 * - AC4 & AC5: Manager can comment/edit accessible tasks
 * - AC6: Task owner never changes
 *
 * "Accessible tasks" = Tasks they're assigned to OR tasks where any assignee
 * is in manager's department/sub-departments
 */

import {
  TaskService,
  UserContext,
} from '../../../src/services/task/TaskService';
import { ITaskRepository } from '../../../src/repositories/ITaskRepository';
import { Task, TaskStatus } from '../../../src/domain/task/Task';

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

// Mock Prisma client type
type MockPrismaClient = {
  userProfile: {
    findUnique: jest.Mock;
  };
};

describe('TaskService - Manager Operations (SCRUM-15)', () => {
  let taskService: TaskService;
  let mockTaskRepository: jest.Mocked<ITaskRepository>;
  let mockPrisma: MockPrismaClient;

  // Test user contexts
  const managerContext: UserContext = {
    userId: 'manager-id',
    role: 'MANAGER',
    departmentId: 'dept-sales',
  };

  const staffContext: UserContext = {
    userId: 'staff-id',
    role: 'STAFF',
    departmentId: 'dept-sales',
  };

  const _hrContext: UserContext = {
    userId: 'hr-id',
    role: 'HR_ADMIN',
    departmentId: 'dept-hr',
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Create mock repository
    mockTaskRepository = {
      getTaskByIdFull: jest.fn(),
      validateAssignees: jest.fn(),
      addTaskAssignment: jest.fn(),
      removeTaskAssignment: jest.fn(),
      logTaskAction: jest.fn(),
      createComment: jest.fn(),
      updateTask: jest.fn(),
      getUserDepartments: jest.fn(),
      getUserProfile: jest.fn().mockResolvedValue({
        id: 'user-123',
        departmentId: 'dept-sales',
        role: 'STAFF',
        isActive: true,
      }),
      isUserProjectCollaborator: jest.fn().mockResolvedValue(false),
      createProjectCollaborator: jest.fn(),
      removeProjectCollaboratorIfNoTasks: jest.fn(),
    } as any;

    // Create mock Prisma
    mockPrisma = {
      userProfile: {
        findUnique: jest.fn(),
      },
    };

    // Create service
    taskService = new TaskService(mockTaskRepository);
    (taskService as any).prisma = mockPrisma;
  });

  // ============================================
  // AC1 & AC2: Manager Can Assign ANY Staff to Accessible Tasks
  // ============================================

  describe('AC1 & AC2: Manager Assign Staff', () => {
    /**
     * Manager can assign staff from ANY department (even outside their hierarchy)
     * to tasks they have access to
     */
    it('should allow manager to assign staff from ANY department to accessible task', async () => {
      // Arrange: Manager has access to task (they're assigned)
      const taskData = {
        id: 'task-1',
        ownerId: 'other-user',
        departmentId: 'dept-sales',
        assignments: [{ userId: managerContext.userId }], // Manager is assigned
        status: 'TO_DO',
        priority: 5,
        dueDate: new Date(),
        title: 'Test Task',
        description: 'Test',
        projectId: null,
        parentTaskId: null,
        recurringInterval: null,
        isArchived: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        tags: [],
        comments: [],
        files: [],
      };

      mockTaskRepository.getTaskByIdFull.mockResolvedValue(taskData as any);

      // Staff from completely different department (Engineering)
      const staffToAssign = {
        id: 'staff-engineering',
        departmentId: 'dept-engineering', // Different hierarchy!
        role: 'STAFF',
        isActive: true,
      };

      mockTaskRepository.validateAssignees.mockResolvedValue({
        allExist: true,
        allActive: true,
      });

      // No need to mock hierarchy checks - manager can assign anyone!

      // Act
      const result = await taskService.addAssigneeToTask(
        'task-1',
        staffToAssign.id,
        managerContext
      );

      // Assert
      expect(result).toBeDefined();
      expect(mockTaskRepository.addTaskAssignment).toHaveBeenCalledWith(
        'task-1',
        staffToAssign.id,
        managerContext.userId
      );
    });

    /**
     * EDGE CASE: Manager NOT assigned to task, but task has assignee from subordinate department
     * Manager should still be able to add assignees to this task
     */
    it('should allow manager to assign to task where they are NOT assigned but assignee is in their subordinate department', async () => {
      // Arrange:
      // - Task in Engineering dept (not manager's dept)
      // - Manager is NOT assigned to the task
      // - But task has an assignee from Sales-Region1 (manager's subordinate dept)
      const taskData = {
        id: 'task-1',
        ownerId: 'engineering-user',
        departmentId: 'dept-engineering', // Different from manager's dept
        assignments: [
          { userId: 'staff-sales-region1' }, // Staff in manager's subordinate dept
        ],
        status: 'TO_DO',
        priority: 5,
        dueDate: new Date(),
        title: 'Test Task',
        description: 'Test',
        projectId: null,
        parentTaskId: null,
        recurringInterval: null,
        isArchived: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        tags: [],
        comments: [],
        files: [],
      };

      mockTaskRepository.getTaskByIdFull.mockResolvedValue(taskData as any);

      // Mock: Return department info for assignees
      mockTaskRepository.getUserDepartments.mockResolvedValue([
        { userId: 'staff-sales-region1', departmentId: 'dept-sales-region1' },
      ]);

      // Mock: Check if staff-sales-region1 is in manager's hierarchy
      // Manager (dept-sales) -> Sales-Region1 (subordinate)
      jest
        .spyOn(taskService as any, 'canManagerAccessDepartment')
        .mockImplementation(async (managerDept, targetDept) => {
          // Mock the hierarchy check for the assignee's department
          if (
            managerDept === 'dept-sales' &&
            targetDept === 'dept-sales-region1'
          ) {
            return true; // Sales-Region1 is subordinate to Sales
          }
          return false;
        });

      // Staff to add can be from ANY department
      const staffToAssign = {
        id: 'staff-hr',
        departmentId: 'dept-hr', // Completely different department!
        role: 'STAFF',
        isActive: true,
      };

      mockTaskRepository.validateAssignees.mockResolvedValue({
        allExist: true,
        allActive: true,
      });

      // Act: Manager adds HR staff to task (manager not assigned, but has access via hierarchy)
      const result = await taskService.addAssigneeToTask(
        'task-1',
        staffToAssign.id,
        managerContext
      );

      // Assert
      expect(result).toBeDefined();
      expect(mockTaskRepository.addTaskAssignment).toHaveBeenCalledWith(
        'task-1',
        staffToAssign.id,
        managerContext.userId
      );

      // Verify hierarchy check was performed on the task's assignee
      expect(taskService['canManagerAccessDepartment']).toHaveBeenCalled();
    });

    /**
     * Manager can access tasks where assignees are in their own department (same level)
     */
    it('should allow manager to assign to task where assignee is in their own department', async () => {
      // Arrange: Task has assignee from manager's department
      const taskData = {
        id: 'task-1',
        ownerId: 'other-user',
        departmentId: 'dept-engineering', // Task in different dept
        assignments: [
          { userId: 'staff-in-sales' }, // But assignee is in manager's dept
        ],
        status: 'TO_DO',
        priority: 5,
        dueDate: new Date(),
        title: 'Test Task',
        description: 'Test',
        projectId: null,
        parentTaskId: null,
        recurringInterval: null,
        isArchived: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        tags: [],
        comments: [],
        files: [],
      };

      mockTaskRepository.getTaskByIdFull.mockResolvedValue(taskData as any);

      // Mock: Return department info for assignees
      mockTaskRepository.getUserDepartments.mockResolvedValue([
        { userId: 'staff-in-sales', departmentId: 'dept-sales' },
      ]);

      // Mock hierarchy check: staff-in-sales is in manager's department
      jest
        .spyOn(taskService as any, 'canManagerAccessDepartment')
        .mockResolvedValue(true);

      mockTaskRepository.validateAssignees.mockResolvedValue({
        allExist: true,
        allActive: true,
      });

      // Act
      const result = await taskService.addAssigneeToTask(
        'task-1',
        'new-staff-id',
        managerContext
      );

      // Assert
      expect(result).toBeDefined();
      expect(mockTaskRepository.addTaskAssignment).toHaveBeenCalled();
    });

    /**
     * Manager CANNOT assign to tasks they don't have access to
     */
    it('should reject manager assigning to inaccessible task', async () => {
      // Arrange: Task where manager is not assigned AND no assignees in their dept
      mockTaskRepository.getTaskByIdFull.mockResolvedValue({
        id: 'task-1',
        ownerId: 'other-user',
        departmentId: 'dept-engineering',
        assignments: [{ userId: 'someone-else' }],
        status: 'TO_DO',
        priority: 5,
        dueDate: new Date(),
        title: 'Test Task',
        description: 'Test',
        projectId: null,
        parentTaskId: null,
        recurringInterval: null,
        isArchived: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        tags: [],
        comments: [],
        files: [],
      } as any);

      // Mock: Return department info for assignees (from a dept manager doesn't manage)
      mockTaskRepository.getUserDepartments.mockResolvedValue([
        { userId: 'someone-else', departmentId: 'dept-engineering' },
      ]);

      // Mock: Manager doesn't have access
      jest
        .spyOn(taskService as any, 'canManagerAccessDepartment')
        .mockResolvedValue(false);

      // Act & Assert: getTaskById should throw unauthorized error
      await expect(
        taskService.addAssigneeToTask('task-1', 'new-staff', managerContext)
      ).rejects.toThrow('Unauthorized');

      // Assignment should NOT be persisted
      expect(mockTaskRepository.addTaskAssignment).not.toHaveBeenCalled();
    });

    /**
     * Staff can also assign (no special manager restriction)
     */
    it('should allow staff to assign to tasks they are assigned to', async () => {
      // Arrange
      mockTaskRepository.getTaskByIdFull.mockResolvedValue({
        id: 'task-1',
        ownerId: staffContext.userId,
        departmentId: 'dept-sales',
        assignments: [{ userId: staffContext.userId }],
        status: 'TO_DO',
        priority: 5,
        dueDate: new Date(),
        title: 'Test Task',
        description: 'Test',
        projectId: null,
        parentTaskId: null,
        recurringInterval: null,
        isArchived: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        tags: [],
        comments: [],
        files: [],
      } as any);

      mockTaskRepository.validateAssignees.mockResolvedValue({
        allExist: true,
        allActive: true,
      });

      // Act
      const result = await taskService.addAssigneeToTask(
        'task-1',
        'new-staff',
        staffContext
      );

      // Assert
      expect(result).toBeDefined();
      expect(mockTaskRepository.addTaskAssignment).toHaveBeenCalled();
    });
  });

  // ============================================
  // AC3: Manager Can Remove Assignees
  // ============================================

  describe('AC3: Manager Remove Assignee', () => {
    /**
     * Manager can remove assignees from accessible tasks
     */
    it('should allow manager to remove assignee from accessible task', async () => {
      // Arrange: Create mock task
      const mockTask = {
        getId: () => 'task-1',
        getOwnerId: () => 'owner-id',
        getDepartmentId: () => 'dept-sales',
        getAssignees: () => new Set(['manager-id', 'staff-id']), // 2 assignees
        getProjectId: () => null,
        removeAssignee: jest.fn(), // Mock domain method
      } as unknown as Task;

      // Mock getTaskById to return task (manager has access)
      jest.spyOn(taskService as any, 'getTaskById').mockResolvedValue(mockTask);

      // Act
      await taskService.removeAssigneeFromTask(
        'task-1',
        'staff-id',
        managerContext
      );

      // Assert
      expect(mockTask.removeAssignee).toHaveBeenCalledWith(
        'staff-id',
        'manager-id',
        'MANAGER'
      );
      expect(mockTaskRepository.removeTaskAssignment).toHaveBeenCalledWith(
        'task-1',
        'staff-id'
      );
      expect(mockTaskRepository.logTaskAction).toHaveBeenCalled();
    });

    /**
     * Manager CANNOT remove last assignee (business rule TM016)
     */
    it('should reject removing last assignee from task', async () => {
      // Arrange: Task with only 1 assignee
      const mockTask = {
        getId: () => 'task-1',
        getAssignees: () => new Set(['only-assignee']),
        removeAssignee: jest.fn().mockImplementation(() => {
          throw new Error('Task must have at least 1 assignee (TM016)');
        }),
      } as unknown as Task;

      jest.spyOn(taskService as any, 'getTaskById').mockResolvedValue(mockTask);

      // Act & Assert
      await expect(
        taskService.removeAssigneeFromTask(
          'task-1',
          'only-assignee',
          managerContext
        )
      ).rejects.toThrow('Task must have at least 1 assignee');

      // Database should NOT be updated
      expect(mockTaskRepository.removeTaskAssignment).not.toHaveBeenCalled();
    });

    /**
     * Manager cannot remove assignee from inaccessible task
     */
    it('should reject manager removing assignee from inaccessible task', async () => {
      // Arrange: getTaskById throws unauthorized
      jest
        .spyOn(taskService as any, 'getTaskById')
        .mockRejectedValue(new Error('Unauthorized'));

      // Act & Assert
      await expect(
        taskService.removeAssigneeFromTask('task-1', 'staff-id', managerContext)
      ).rejects.toThrow('Unauthorized');

      expect(mockTaskRepository.removeTaskAssignment).not.toHaveBeenCalled();
    });
  });

  // ============================================
  // AC4 & AC5: Manager Can Comment and Edit Accessible Tasks
  // ============================================

  describe('AC4: Manager Comment on Tasks', () => {
    /**
     * Manager can comment on accessible tasks
     */
    it('should allow manager to comment on accessible task', async () => {
      // Arrange
      const mockTask = {
        getId: () => 'task-1',
        addComment: jest.fn().mockReturnValue({
          id: 'comment-1',
          content: 'Great work!',
          authorId: managerContext.userId,
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
      } as unknown as Task;

      jest.spyOn(taskService as any, 'getTaskById').mockResolvedValue(mockTask);

      // Act
      await taskService.addCommentToTask(
        'task-1',
        'Great work!',
        managerContext
      );

      // Assert
      expect(mockTask.addComment).toHaveBeenCalledWith(
        'Great work!',
        managerContext.userId
      );
      expect(mockTaskRepository.createComment).toHaveBeenCalled();
    });

    /**
     * Manager cannot comment on inaccessible task
     */
    it('should reject manager commenting on inaccessible task', async () => {
      // Arrange
      jest
        .spyOn(taskService as any, 'getTaskById')
        .mockRejectedValue(new Error('Unauthorized'));

      // Act & Assert
      await expect(
        taskService.addCommentToTask('task-1', 'Comment', managerContext)
      ).rejects.toThrow('Unauthorized');
    });
  });

  describe('AC5: Manager Edit Tasks', () => {
    /**
     * Manager can edit task title
     */
    it('should allow manager to edit task title', async () => {
      // Arrange
      const mockTask = {
        getId: () => 'task-1',
        getOwnerId: () => 'owner-id',
        getTitle: () => 'Original Title',
        updateTitle: jest.fn(),
      } as unknown as Task;

      jest.spyOn(taskService as any, 'getTaskById').mockResolvedValue(mockTask);

      // Act
      await taskService.updateTaskTitle('task-1', 'New Title', managerContext);

      // Assert
      expect(mockTask.updateTitle).toHaveBeenCalledWith('New Title');
      expect(mockTaskRepository.updateTask).toHaveBeenCalled();
    });

    /**
     * Manager can edit task description
     */
    it('should allow manager to edit task description', async () => {
      // Arrange
      const mockTask = {
        getId: () => 'task-1',
        getDescription: () => 'Original Description',
        updateDescription: jest.fn(),
      } as unknown as Task;

      jest.spyOn(taskService as any, 'getTaskById').mockResolvedValue(mockTask);

      // Act
      await taskService.updateTaskDescription(
        'task-1',
        'New Description',
        managerContext
      );

      // Assert
      expect(mockTask.updateDescription).toHaveBeenCalledWith(
        'New Description'
      );
    });

    /**
     * Manager can edit task priority
     */
    it('should allow manager to edit task priority', async () => {
      // Arrange
      const mockTask = {
        getId: () => 'task-1',
        getPriority: () => ({ getLevel: () => 5 }),
        updatePriority: jest.fn(),
      } as unknown as Task;

      jest.spyOn(taskService as any, 'getTaskById').mockResolvedValue(mockTask);

      // Act
      await taskService.updateTaskPriority('task-1', 8, managerContext);

      // Assert
      expect(mockTask.updatePriority).toHaveBeenCalledWith(8);
    });

    /**
     * Manager can edit task status
     */
    it('should allow manager to edit task status', async () => {
      // Arrange
      const mockTask = {
        getId: () => 'task-1',
        getStatus: () => TaskStatus.TO_DO,
        getStartDate: () => null,
        updateStatus: jest.fn(),
      } as unknown as Task;

      jest.spyOn(taskService as any, 'getTaskById').mockResolvedValue(mockTask);

      // Act
      await taskService.updateTaskStatus(
        'task-1',
        TaskStatus.IN_PROGRESS,
        managerContext
      );

      // Assert
      expect(mockTask.updateStatus).toHaveBeenCalledWith(
        TaskStatus.IN_PROGRESS
      );
    });

    /**
     * Manager cannot edit inaccessible task
     */
    it('should reject manager editing inaccessible task', async () => {
      // Arrange
      jest
        .spyOn(taskService as any, 'getTaskById')
        .mockRejectedValue(new Error('Unauthorized'));

      // Act & Assert
      await expect(
        taskService.updateTaskTitle('task-1', 'New Title', managerContext)
      ).rejects.toThrow('Unauthorized');

      expect(mockTaskRepository.updateTask).not.toHaveBeenCalled();
    });
  });

  // ============================================
  // AC6: Task Owner Never Changes
  // ============================================

  describe('AC6: Owner Immutability', () => {
    /**
     * Owner remains unchanged when adding assignee
     */
    it('should preserve task owner when adding assignee', async () => {
      // Arrange
      const originalOwnerId = 'original-owner';
      const taskData = {
        id: 'task-1',
        ownerId: originalOwnerId,
        departmentId: 'dept-sales',
        assignments: [{ userId: managerContext.userId }],
        status: 'TO_DO',
        priority: 5,
        dueDate: new Date(),
        title: 'Test Task',
        description: 'Test',
        projectId: null,
        parentTaskId: null,
        recurringInterval: null,
        isArchived: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        tags: [],
        comments: [],
        files: [],
      } as any;

      mockTaskRepository.getTaskByIdFull.mockResolvedValue(taskData);
      mockTaskRepository.validateAssignees.mockResolvedValue({
        allExist: true,
        allActive: true,
      });

      // Act
      await taskService.addAssigneeToTask(
        'task-1',
        'new-assignee',
        managerContext
      );

      // Assert: Owner should not change
      // The domain model ensures ownerId is readonly
      expect(taskData.ownerId).toBe(originalOwnerId);
    });

    /**
     * Owner remains unchanged when removing assignee
     */
    it('should preserve task owner when removing assignee', async () => {
      // Arrange
      const originalOwnerId = 'original-owner';
      const mockTask = {
        getId: () => 'task-1',
        getOwnerId: () => originalOwnerId,
        getAssignees: () => new Set(['manager-id', 'staff-id']),
        getProjectId: () => null,
        removeAssignee: jest.fn(),
      } as unknown as Task;

      jest.spyOn(taskService as any, 'getTaskById').mockResolvedValue(mockTask);

      // Act
      await taskService.removeAssigneeFromTask(
        'task-1',
        'staff-id',
        managerContext
      );

      // Assert: Owner unchanged
      expect(mockTask.getOwnerId()).toBe(originalOwnerId);
    });

    /**
     * Owner remains unchanged even if owner is removed from assignees
     *
     * SCRUM-15 AC6: Owner field is immutable
     * Edge case: Manager can remove owner from assignees, but ownerId field stays intact
     * This test ensures that removeAssignee allows removing the owner from assignees
     * while the owner field in the database remains unchanged
     */
    it('should allow manager to remove owner from assignees while preserving owner field', async () => {
      // Arrange
      const originalOwnerId = 'task-owner';
      const mockTask = {
        getId: () => 'task-1',
        getOwnerId: () => originalOwnerId,
        getAssignees: () => new Set(['task-owner', 'another-assignee']),
        getProjectId: () => null,
        removeAssignee: jest.fn(), // Should NOT throw error even when removing owner
      } as unknown as Task;

      jest.spyOn(taskService as any, 'getTaskById').mockResolvedValue(mockTask);

      // Act: Manager removes the owner from assignees
      // This should succeed - no error should be thrown
      await taskService.removeAssigneeFromTask(
        'task-1',
        originalOwnerId,
        managerContext
      );

      // Assert: Owner field still intact (immutable)
      expect(mockTask.getOwnerId()).toBe(originalOwnerId);

      // Assert: removeAssignee was called (owner removed from assignees)
      expect(mockTask.removeAssignee).toHaveBeenCalledWith(
        originalOwnerId,
        'manager-id',
        'MANAGER'
      );

      // Assert: removeTaskAssignment was called to persist removal
      expect(mockTaskRepository.removeTaskAssignment).toHaveBeenCalledWith(
        'task-1',
        originalOwnerId
      );
    });

    /**
     * Owner remains unchanged through multiple operations
     */
    it('should preserve owner through multiple assignment changes', async () => {
      // Arrange
      const originalOwnerId = 'original-owner';
      const taskData = {
        id: 'task-1',
        ownerId: originalOwnerId,
        departmentId: 'dept-sales',
        assignments: [{ userId: managerContext.userId }, { userId: 'staff-1' }],
        status: 'TO_DO',
        priority: 5,
        dueDate: new Date(),
        title: 'Test Task',
        description: 'Test',
        projectId: null,
        parentTaskId: null,
        recurringInterval: null,
        isArchived: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        tags: [],
        comments: [],
        files: [],
      } as any;

      mockTaskRepository.getTaskByIdFull.mockResolvedValue(taskData);
      mockTaskRepository.validateAssignees.mockResolvedValue({
        allExist: true,
        allActive: true,
      });

      const mockTask = {
        getId: () => 'task-1',
        getOwnerId: () => originalOwnerId,
        getAssignees: () => new Set(['manager-id', 'staff-1', 'staff-2']),
        getProjectId: () => null,
        removeAssignee: jest.fn(),
      } as unknown as Task;

      // Act: Multiple operations
      await taskService.addAssigneeToTask('task-1', 'staff-2', managerContext);

      jest.spyOn(taskService as any, 'getTaskById').mockResolvedValue(mockTask);
      await taskService.removeAssigneeFromTask(
        'task-1',
        'staff-1',
        managerContext
      );

      // Assert: Owner still original
      expect(taskData.ownerId).toBe(originalOwnerId);
      expect(mockTask.getOwnerId()).toBe(originalOwnerId);
    });
  });
});
