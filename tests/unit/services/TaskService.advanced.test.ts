/**
 * Unit Tests for TaskService - Advanced Operations (Priority 1)
 *
 * Coverage targets:
 * - Advanced query operations: getTaskLogs, getAllTasks, getProjectTasks, getSubtasks
 * - Task management: assignTaskToProject, deleteTask, getTaskHierarchy
 * - Calendar events: createCalendarEvent, getCalendarEvents
 * - Complex authorization paths (assignee hierarchy access)
 *
 * DDD Layer: SERVICE
 * Tests: Service orchestration, authorization, error handling
 */

import { TaskService, UserContext } from '@/services/task/TaskService';
import { ITaskRepository } from '@/repositories/ITaskRepository';
import { PrismaClient } from '@prisma/client';

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

describe('TaskService - Advanced Operations (Priority 1)', () => {
  let service: TaskService;
  let mockRepository: jest.Mocked<ITaskRepository>;
  let mockPrisma: jest.Mocked<PrismaClient>;

  const testUser: UserContext = {
    userId: 'user-123',
    role: 'STAFF',
    departmentId: 'dept-456',
  };

  const managerUser: UserContext = {
    userId: 'manager-123',
    role: 'MANAGER',
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
    projectId: null,
    parentTaskId: null,
    recurringInterval: null,
    isArchived: false,
    startDate: null,
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
      getDepartmentWithParent: jest.fn(),
      getUserDepartments: jest.fn(),
      getUserProfile: jest.fn(),
      isUserProjectCollaborator: jest.fn(),
      createProjectCollaborator: jest.fn(),
      removeProjectCollaboratorIfNoTasks: jest.fn(),
      removeTaskAssignment: jest.fn(),
      getAllTasks: jest.fn(),
      getProjectTasks: jest.fn(),
      getSubtasks: jest.fn(),
      getOwnerTasks: jest.fn(),
      archiveTask: jest.fn(),
      unarchiveTask: jest.fn(),
      deleteTask: jest.fn(),
      hasSubtasks: jest.fn(),
      getTaskHierarchy: jest.fn(),
      createCalendarEvent: jest.fn(),
      getCalendarEvents: jest.fn(),
      getTaskLogs: jest.fn(),
    } as any;

    // Mock Prisma for assignTaskToProject tests
    mockPrisma = {
      project: {
        findUnique: jest.fn(),
      },
    } as any;

    service = new TaskService(mockRepository, mockPrisma);
    jest.clearAllMocks();
  });

  // ============================================
  // ADVANCED QUERY OPERATIONS
  // ============================================

  describe('getTaskById - Complex Authorization Paths', () => {
    it('should allow access when user is in assignee department hierarchy', async () => {
      const taskData = {
        ...mockTaskData,
        ownerId: 'other-user',
        departmentId: 'dept-other',
        assignments: [{ userId: 'assignee-123' }],
      };

      mockRepository.getTaskByIdFull.mockResolvedValue(taskData);

      // Mock: task dept is not accessible
      mockRepository.getDepartmentWithParent.mockResolvedValue({
        id: 'dept-other',
        parentId: null,
      });

      // Mock: assignee is in user's department hierarchy
      mockRepository.getUserDepartments.mockResolvedValue([
        { userId: 'assignee-123', departmentId: 'dept-subordinate' },
      ]);

      // Mock: user can access assignee's department
      mockRepository.getDepartmentWithParent
        .mockResolvedValueOnce({ id: 'dept-other', parentId: null })
        .mockResolvedValueOnce({
          id: 'dept-subordinate',
          parentId: 'dept-456',
        });

      const result = await service.getTaskById('task-001', managerUser);

      expect(result).toBeDefined();
      expect(result?.getTitle()).toBe('Implement Login Feature');
      expect(mockRepository.getUserDepartments).toHaveBeenCalledWith([
        'assignee-123',
      ]);
    });

    it('should throw error when not assigned and no hierarchy access', async () => {
      const taskData = {
        ...mockTaskData,
        ownerId: 'other-user',
        departmentId: 'dept-other',
        assignments: [{ userId: 'other-assignee' }],
      };

      mockRepository.getTaskByIdFull.mockResolvedValue(taskData);
      mockRepository.getDepartmentWithParent.mockResolvedValue({
        id: 'dept-other',
        parentId: null,
      });
      mockRepository.getUserDepartments.mockResolvedValue([
        { userId: 'other-assignee', departmentId: 'dept-other' },
      ]);

      await expect(service.getTaskById('task-001', testUser)).rejects.toThrow(
        'Unauthorized: You must be assigned to this task or it must be in your department hierarchy'
      );
    });
  });

  describe('getAllTasks', () => {
    it('should return tasks filtered by ownerId', async () => {
      const filters = { ownerId: 'owner-123' };
      mockRepository.getAllTasks.mockResolvedValue([mockTaskData]);

      const result = await service.getAllTasks(filters, testUser);

      expect(mockRepository.getAllTasks).toHaveBeenCalledWith(filters);
      expect(result).toHaveLength(1);
      expect(result[0].getOwnerId()).toBe('user-123');
    });

    it('should return tasks filtered by projectId', async () => {
      const filters = { projectId: 'project-123' };
      const taskWithProject = { ...mockTaskData, projectId: 'project-123' };
      mockRepository.getAllTasks.mockResolvedValue([taskWithProject]);

      const result = await service.getAllTasks(filters, testUser);

      expect(mockRepository.getAllTasks).toHaveBeenCalledWith(filters);
      expect(result).toHaveLength(1);
      expect(result[0].getProjectId()).toBe('project-123');
    });

    it('should return tasks filtered by departmentId', async () => {
      const filters = { departmentId: 'dept-456' };
      mockRepository.getAllTasks.mockResolvedValue([mockTaskData]);

      const result = await service.getAllTasks(filters, testUser);

      expect(mockRepository.getAllTasks).toHaveBeenCalledWith(filters);
      expect(result[0].getDepartmentId()).toBe('dept-456');
    });

    it('should return tasks filtered by status', async () => {
      const filters = { status: 'IN_PROGRESS' };
      const taskInProgress = { ...mockTaskData, status: 'IN_PROGRESS' };
      mockRepository.getAllTasks.mockResolvedValue([taskInProgress]);

      const result = await service.getAllTasks(filters, testUser);

      expect(mockRepository.getAllTasks).toHaveBeenCalledWith(filters);
      expect(result[0].getStatus()).toBe('IN_PROGRESS');
    });

    it('should return tasks filtered with multiple criteria', async () => {
      const filters = {
        departmentId: 'dept-456',
        status: 'TO_DO',
        isArchived: false,
      };
      mockRepository.getAllTasks.mockResolvedValue([mockTaskData]);

      const result = await service.getAllTasks(filters, testUser);

      expect(mockRepository.getAllTasks).toHaveBeenCalledWith(filters);
      expect(result).toHaveLength(1);
    });

    it('should return empty array when no tasks match filters', async () => {
      const filters = { ownerId: 'non-existent' };
      mockRepository.getAllTasks.mockResolvedValue([]);

      const result = await service.getAllTasks(filters, testUser);

      expect(result).toEqual([]);
      expect(result).toHaveLength(0);
    });
  });

  describe('getProjectTasks', () => {
    it('should throw error when project does not exist', async () => {
      mockRepository.validateProjectExists.mockResolvedValue(false);

      await expect(
        service.getProjectTasks('non-existent-project', testUser)
      ).rejects.toThrow('Project not found');

      expect(mockRepository.validateProjectExists).toHaveBeenCalledWith(
        'non-existent-project'
      );
    });

    it('should return all project tasks excluding archived by default', async () => {
      mockRepository.validateProjectExists.mockResolvedValue(true);
      mockRepository.getProjectTasks.mockResolvedValue([mockTaskData]);

      const result = await service.getProjectTasks('project-123', testUser);

      expect(mockRepository.validateProjectExists).toHaveBeenCalledWith(
        'project-123'
      );
      expect(mockRepository.getProjectTasks).toHaveBeenCalledWith(
        'project-123',
        false
      );
      expect(result).toHaveLength(1);
    });

    it('should include archived tasks when requested', async () => {
      mockRepository.validateProjectExists.mockResolvedValue(true);
      const archivedTask = { ...mockTaskData, isArchived: true };
      mockRepository.getProjectTasks.mockResolvedValue([
        mockTaskData,
        archivedTask,
      ]);

      const result = await service.getProjectTasks(
        'project-123',
        testUser,
        true
      );

      expect(mockRepository.getProjectTasks).toHaveBeenCalledWith(
        'project-123',
        true
      );
      expect(result).toHaveLength(2);
    });

    it('should return empty array when project has no tasks', async () => {
      mockRepository.validateProjectExists.mockResolvedValue(true);
      mockRepository.getProjectTasks.mockResolvedValue([]);

      const result = await service.getProjectTasks('project-123', testUser);

      expect(result).toEqual([]);
    });
  });

  describe('getSubtasks', () => {
    it('should throw error when user has no access to parent task', async () => {
      const parentTask = {
        ...mockTaskData,
        ownerId: 'other-user',
        departmentId: 'dept-other',
        assignments: [{ userId: 'other-user' }],
      };

      mockRepository.getTaskByIdFull.mockResolvedValue(parentTask);
      mockRepository.getDepartmentWithParent.mockResolvedValue({
        id: 'dept-other',
        parentId: null,
      });
      mockRepository.getUserDepartments.mockResolvedValue([]);

      await expect(
        service.getSubtasks('parent-task-001', testUser)
      ).rejects.toThrow(
        'Unauthorized: You must be assigned to this task or it must be in your department hierarchy'
      );
    });

    it('should return all subtasks for valid parent', async () => {
      mockRepository.getTaskByIdFull.mockResolvedValue(mockTaskData);

      const subtask1 = {
        ...mockTaskData,
        id: 'subtask-001',
        parentTaskId: 'task-001',
        title: 'Subtask 1',
      };
      const subtask2 = {
        ...mockTaskData,
        id: 'subtask-002',
        parentTaskId: 'task-001',
        title: 'Subtask 2',
      };

      mockRepository.getSubtasks.mockResolvedValue([subtask1, subtask2]);

      const result = await service.getSubtasks('task-001', testUser);

      expect(mockRepository.getSubtasks).toHaveBeenCalledWith('task-001');
      expect(result).toHaveLength(2);
      expect(result[0].getParentTaskId()).toBe('task-001');
      expect(result[1].getParentTaskId()).toBe('task-001');
    });

    it('should return empty array when parent has no subtasks', async () => {
      mockRepository.getTaskByIdFull.mockResolvedValue(mockTaskData);
      mockRepository.getSubtasks.mockResolvedValue([]);

      const result = await service.getSubtasks('task-001', testUser);

      expect(result).toEqual([]);
    });
  });

  describe('getDepartmentTasks - Authorization', () => {
    it('should throw error when STAFF without HR admin tries to access', async () => {
      await expect(
        service.getDepartmentTasks('dept-456', testUser)
      ).rejects.toThrow(
        'Unauthorized: Only managers and HR admins can view all department tasks'
      );
    });

    it('should throw error when user tries to access different department', async () => {
      await expect(
        service.getDepartmentTasks('dept-other', managerUser)
      ).rejects.toThrow(
        'Unauthorized: You can only view tasks from your own department'
      );
    });

    it('should allow MANAGER to access their own department', async () => {
      mockRepository.getDepartmentTasks.mockResolvedValue([mockTaskData]);

      const result = await service.getDepartmentTasks('dept-456', managerUser);

      expect(mockRepository.getDepartmentTasks).toHaveBeenCalledWith(
        'dept-456',
        false
      );
      expect(result).toHaveLength(1);
    });

    it('should allow HR admin to access department', async () => {
      const hrAdminUser: UserContext = {
        ...testUser,
        isHrAdmin: true,
      };

      mockRepository.getDepartmentTasks.mockResolvedValue([mockTaskData]);

      const result = await service.getDepartmentTasks('dept-456', hrAdminUser);

      expect(mockRepository.getDepartmentTasks).toHaveBeenCalledWith(
        'dept-456',
        false
      );
      expect(result).toHaveLength(1);
    });
  });

  describe('getTaskLogs', () => {
    it('should throw error when taskId is empty string', async () => {
      await expect(service.getTaskLogs('', testUser)).rejects.toThrow(
        'Task ID is required'
      );
    });

    it('should throw error when taskId is only whitespace', async () => {
      await expect(service.getTaskLogs('   ', testUser)).rejects.toThrow(
        'Task ID is required'
      );
    });

    it('should throw error when task not found', async () => {
      mockRepository.getTaskByIdFull.mockResolvedValue(null);

      await expect(
        service.getTaskLogs('non-existent', testUser)
      ).rejects.toThrow('Task not found');
    });

    it('should return task logs when user has access', async () => {
      mockRepository.getTaskByIdFull.mockResolvedValue(mockTaskData);
      const mockLogs = [
        {
          id: 'log-001',
          taskId: 'task-001',
          userId: 'user-123',
          action: 'CREATED',
          field: 'Task',
          changes: { title: 'Implement Login' },
          metadata: { source: 'web_ui' },
          timestamp: new Date(),
          user: {
            id: 'user-123',
            name: 'Test User',
            email: 'test@example.com',
          },
        },
      ];

      mockRepository.getTaskLogs.mockResolvedValue(mockLogs);

      const result = await service.getTaskLogs('task-001', testUser);

      expect(mockRepository.getTaskLogs).toHaveBeenCalledWith('task-001');
      expect(result).toEqual(mockLogs);
      expect(result).toHaveLength(1);
      expect(result[0].action).toBe('CREATED');
    });

    it('should return empty array when task has no logs', async () => {
      mockRepository.getTaskByIdFull.mockResolvedValue(mockTaskData);
      mockRepository.getTaskLogs.mockResolvedValue([]);

      const result = await service.getTaskLogs('task-001', testUser);

      expect(result).toEqual([]);
    });
  });

  // ============================================
  // TASK MANAGEMENT OPERATIONS
  // ============================================

  describe('assignTaskToProject', () => {
    beforeEach(() => {
      mockRepository.getUserProfile.mockResolvedValue({
        id: 'user-123',
        departmentId: 'dept-456',
        role: 'STAFF',
        isActive: true,
      });
      mockRepository.isUserProjectCollaborator.mockResolvedValue(false);
    });

    it('should throw error when task not found', async () => {
      mockRepository.getTaskByIdFull.mockResolvedValue(null);

      await expect(
        service.assignTaskToProject('non-existent', 'project-123', testUser)
      ).rejects.toThrow('Task not found');
    });

    it('should throw error when task already has a project', async () => {
      const taskWithProject = {
        ...mockTaskData,
        projectId: 'existing-project',
      };
      mockRepository.getTaskByIdFull.mockResolvedValue(taskWithProject);

      await expect(
        service.assignTaskToProject('task-001', 'project-123', testUser)
      ).rejects.toThrow('Task already has a project and cannot be reassigned');
    });

    it('should throw error when project does not exist', async () => {
      mockRepository.getTaskByIdFull.mockResolvedValue(mockTaskData);
      mockRepository.validateProjectExists.mockResolvedValue(false);

      await expect(
        service.assignTaskToProject(
          'task-001',
          'non-existent-project',
          testUser
        )
      ).rejects.toThrow('Project not found');
    });

    it('should assign task to project and create collaborators', async () => {
      const taskWithAssignees = {
        ...mockTaskData,
        assignments: [{ userId: 'user-123' }, { userId: 'user-456' }],
      };

      mockRepository.getTaskByIdFull
        .mockResolvedValueOnce(taskWithAssignees)
        .mockResolvedValueOnce({
          ...taskWithAssignees,
          projectId: 'project-123',
        });

      mockRepository.validateProjectExists.mockResolvedValue(true);
      mockRepository.getUserProfile.mockResolvedValue({
        id: 'user-123',
        departmentId: 'dept-456',
        role: 'STAFF',
        isActive: true,
      });

      (mockPrisma.project.findUnique as jest.Mock).mockResolvedValue({
        id: 'project-123',
        name: 'Test Project',
      });

      const result = await service.assignTaskToProject(
        'task-001',
        'project-123',
        testUser
      );

      expect(mockRepository.updateTask).toHaveBeenCalledWith('task-001', {
        projectId: 'project-123',
        updatedAt: expect.any(Date),
      });
      expect(mockRepository.createProjectCollaborator).toHaveBeenCalledTimes(2);
      expect(mockRepository.logTaskAction).toHaveBeenCalledWith(
        'task-001',
        'user-123',
        'UPDATED',
        'Project',
        expect.objectContaining({
          changes: {
            from: null,
            to: 'project-123',
          },
        })
      );
      expect(result.getProjectId()).toBe('project-123');
    });

    it('should handle task with no assignees', async () => {
      const taskNoAssignees = { ...mockTaskData, assignments: [] };
      mockRepository.getTaskByIdFull
        .mockResolvedValueOnce(taskNoAssignees)
        .mockResolvedValueOnce({
          ...taskNoAssignees,
          projectId: 'project-123',
        });

      mockRepository.validateProjectExists.mockResolvedValue(true);
      (mockPrisma.project.findUnique as jest.Mock).mockResolvedValue({
        id: 'project-123',
        name: 'Test Project',
      });

      const result = await service.assignTaskToProject(
        'task-001',
        'project-123',
        testUser
      );

      expect(mockRepository.createProjectCollaborator).not.toHaveBeenCalled();
      expect(result.getProjectId()).toBe('project-123');
    });

    it('should skip collaborator creation if already exists', async () => {
      mockRepository.getTaskByIdFull
        .mockResolvedValueOnce(mockTaskData)
        .mockResolvedValueOnce({ ...mockTaskData, projectId: 'project-123' });

      mockRepository.validateProjectExists.mockResolvedValue(true);
      mockRepository.isUserProjectCollaborator.mockResolvedValue(true);
      (mockPrisma.project.findUnique as jest.Mock).mockResolvedValue({
        id: 'project-123',
        name: 'Test Project',
      });

      await service.assignTaskToProject('task-001', 'project-123', testUser);

      expect(mockRepository.createProjectCollaborator).not.toHaveBeenCalled();
    });

    it('should use default project name when prisma not available', async () => {
      const serviceWithoutPrisma = new TaskService(mockRepository);

      mockRepository.getTaskByIdFull
        .mockResolvedValueOnce(mockTaskData)
        .mockResolvedValueOnce({ ...mockTaskData, projectId: 'project-123' });

      mockRepository.validateProjectExists.mockResolvedValue(true);

      await serviceWithoutPrisma.assignTaskToProject(
        'task-001',
        'project-123',
        testUser
      );

      expect(mockRepository.logTaskAction).toHaveBeenCalledWith(
        'task-001',
        'user-123',
        'UPDATED',
        'Project',
        expect.objectContaining({
          metadata: expect.objectContaining({
            projectName: 'Unknown Project',
          }),
        })
      );
    });
  });

  describe('deleteTask', () => {
    it('should throw error when task not found', async () => {
      mockRepository.getTaskByIdFull.mockResolvedValue(null);

      await expect(
        service.deleteTask('non-existent', testUser)
      ).rejects.toThrow('Task not found');
    });

    it('should throw error when task has subtasks', async () => {
      mockRepository.getTaskByIdFull.mockResolvedValue(mockTaskData);
      mockRepository.hasSubtasks.mockResolvedValue(true);

      await expect(service.deleteTask('task-001', testUser)).rejects.toThrow(
        'Cannot delete task with subtasks. Archive it instead.'
      );
    });

    it('should delete task and log action', async () => {
      mockRepository.getTaskByIdFull.mockResolvedValue(mockTaskData);
      mockRepository.hasSubtasks.mockResolvedValue(false);

      await service.deleteTask('task-001', testUser);

      expect(mockRepository.logTaskAction).toHaveBeenCalledWith(
        'task-001',
        'user-123',
        'DELETED',
        'Task',
        expect.objectContaining({
          changes: {
            removed: 'Implement Login Feature',
          },
        })
      );
      expect(mockRepository.deleteTask).toHaveBeenCalledWith('task-001');
    });

    it('should log action before deleting task', async () => {
      mockRepository.getTaskByIdFull.mockResolvedValue(mockTaskData);
      mockRepository.hasSubtasks.mockResolvedValue(false);

      const callOrder: string[] = [];
      mockRepository.logTaskAction.mockImplementation(async () => {
        callOrder.push('log');
      });
      mockRepository.deleteTask.mockImplementation(async () => {
        callOrder.push('delete');
      });

      await service.deleteTask('task-001', testUser);

      expect(callOrder).toEqual(['log', 'delete']);
    });
  });

  describe('getTaskHierarchy', () => {
    it('should throw error when task not found', async () => {
      mockRepository.getTaskByIdFull.mockResolvedValue(null);

      await expect(
        service.getTaskHierarchy('non-existent', testUser)
      ).rejects.toThrow('Task not found or access denied');
    });

    it('should throw error when user has no access to task', async () => {
      const taskData = {
        ...mockTaskData,
        ownerId: 'other-user',
        departmentId: 'dept-other',
        assignments: [{ userId: 'other-user' }],
      };

      mockRepository.getTaskByIdFull.mockResolvedValue(taskData);
      mockRepository.getDepartmentWithParent.mockResolvedValue({
        id: 'dept-other',
        parentId: null,
      });
      mockRepository.getUserDepartments.mockResolvedValue([]);

      await expect(
        service.getTaskHierarchy('task-001', testUser)
      ).rejects.toThrow(
        'Unauthorized: You must be assigned to this task or it must be in your department hierarchy'
      );
    });

    it('should return parent chain, current task, and subtask tree', async () => {
      mockRepository.getTaskByIdFull.mockResolvedValue(mockTaskData);

      const hierarchyData = {
        parentChain: [
          {
            id: 'parent-001',
            title: 'Parent Task',
            status: 'IN_PROGRESS',
            parentTaskId: null,
          },
        ],
        currentTask: mockTaskData,
        subtaskTree: [
          {
            id: 'subtask-001',
            title: 'Subtask 1',
            status: 'TO_DO',
            parentTaskId: 'task-001',
          },
        ],
      };

      mockRepository.getTaskHierarchy.mockResolvedValue(hierarchyData);

      const result = await service.getTaskHierarchy('task-001', testUser);

      expect(mockRepository.getTaskHierarchy).toHaveBeenCalledWith('task-001');
      expect(result).toEqual(hierarchyData);
      expect(result.parentChain).toHaveLength(1);
      expect(result.subtaskTree).toHaveLength(1);
    });

    it('should return empty parent chain for root tasks', async () => {
      mockRepository.getTaskByIdFull.mockResolvedValue(mockTaskData);
      mockRepository.getTaskHierarchy.mockResolvedValue({
        parentChain: [],
        currentTask: mockTaskData,
        subtaskTree: [],
      });

      const result = await service.getTaskHierarchy('task-001', testUser);

      expect(result.parentChain).toEqual([]);
    });

    it('should return empty subtask tree for leaf tasks', async () => {
      mockRepository.getTaskByIdFull.mockResolvedValue(mockTaskData);
      mockRepository.getTaskHierarchy.mockResolvedValue({
        parentChain: [],
        currentTask: mockTaskData,
        subtaskTree: [],
      });

      const result = await service.getTaskHierarchy('task-001', testUser);

      expect(result.subtaskTree).toEqual([]);
    });
  });

  // ============================================
  // CALENDAR EVENT OPERATIONS
  // ============================================

  describe('createCalendarEvent', () => {
    it('should throw error when task not found', async () => {
      mockRepository.getTaskByIdFull.mockResolvedValue(null);

      await expect(
        service.createCalendarEvent(
          'non-existent',
          'user-123',
          'Event Title',
          new Date('2025-12-31'),
          testUser
        )
      ).rejects.toThrow('Task not found or access denied');
    });

    it('should throw error when user has no access to task', async () => {
      const taskData = {
        ...mockTaskData,
        ownerId: 'other-user',
        departmentId: 'dept-other',
        assignments: [{ userId: 'other-user' }],
      };

      mockRepository.getTaskByIdFull.mockResolvedValue(taskData);
      mockRepository.getDepartmentWithParent.mockResolvedValue({
        id: 'dept-other',
        parentId: null,
      });
      mockRepository.getUserDepartments.mockResolvedValue([]);

      await expect(
        service.createCalendarEvent(
          'task-001',
          'user-123',
          'Event Title',
          new Date('2025-12-31'),
          testUser
        )
      ).rejects.toThrow(
        'Unauthorized: You must be assigned to this task or it must be in your department hierarchy'
      );
    });

    it('should throw error when event user does not exist', async () => {
      mockRepository.getTaskByIdFull.mockResolvedValue(mockTaskData);
      mockRepository.validateAssignees.mockResolvedValue({
        allExist: false,
        allActive: true,
      });

      await expect(
        service.createCalendarEvent(
          'task-001',
          'non-existent-user',
          'Event Title',
          new Date('2025-12-31'),
          testUser
        )
      ).rejects.toThrow('Event user not found');
    });

    it('should throw error when event user is inactive', async () => {
      mockRepository.getTaskByIdFull.mockResolvedValue(mockTaskData);
      mockRepository.validateAssignees.mockResolvedValue({
        allExist: true,
        allActive: false,
      });

      await expect(
        service.createCalendarEvent(
          'task-001',
          'inactive-user',
          'Event Title',
          new Date('2025-12-31'),
          testUser
        )
      ).rejects.toThrow('Event user is inactive');
    });

    it('should create calendar event and log action', async () => {
      mockRepository.getTaskByIdFull.mockResolvedValue(mockTaskData);
      mockRepository.validateAssignees.mockResolvedValue({
        allExist: true,
        allActive: true,
      });

      const eventDate = new Date('2025-12-31T10:00:00Z');
      const mockEvent = {
        id: 'event-001',
        taskId: 'task-001',
        userId: 'user-123',
        title: 'Event Title',
        eventDate,
      };

      mockRepository.createCalendarEvent.mockResolvedValue(mockEvent);

      const result = await service.createCalendarEvent(
        'task-001',
        'user-123',
        'Event Title',
        eventDate,
        testUser
      );

      expect(mockRepository.createCalendarEvent).toHaveBeenCalledWith({
        taskId: 'task-001',
        userId: 'user-123',
        title: 'Event Title',
        eventDate,
      });

      expect(mockRepository.logTaskAction).toHaveBeenCalledWith(
        'task-001',
        'user-123',
        'UPDATED',
        'Calendar Event',
        expect.objectContaining({
          action: 'createCalendarEvent',
          eventId: 'event-001',
          eventUserId: 'user-123',
          eventDate: eventDate.toISOString(),
        })
      );

      expect(result).toEqual(mockEvent);
    });

    it('should accept different event users than requesting user', async () => {
      mockRepository.getTaskByIdFull.mockResolvedValue(mockTaskData);
      mockRepository.validateAssignees.mockResolvedValue({
        allExist: true,
        allActive: true,
      });

      const mockEvent = {
        id: 'event-001',
        taskId: 'task-001',
        userId: 'user-456',
        title: 'Event for User 456',
        eventDate: new Date('2025-12-31'),
      };

      mockRepository.createCalendarEvent.mockResolvedValue(mockEvent);

      const result = await service.createCalendarEvent(
        'task-001',
        'user-456',
        'Event for User 456',
        new Date('2025-12-31'),
        testUser
      );

      expect(result.userId).toBe('user-456');
    });

    it('should handle future event dates', async () => {
      mockRepository.getTaskByIdFull.mockResolvedValue(mockTaskData);
      mockRepository.validateAssignees.mockResolvedValue({
        allExist: true,
        allActive: true,
      });

      const futureDate = new Date('2030-12-31');
      const mockEvent = {
        id: 'event-001',
        taskId: 'task-001',
        userId: 'user-123',
        title: 'Future Event',
        eventDate: futureDate,
      };

      mockRepository.createCalendarEvent.mockResolvedValue(mockEvent);

      const result = await service.createCalendarEvent(
        'task-001',
        'user-123',
        'Future Event',
        futureDate,
        testUser
      );

      expect(result.eventDate).toEqual(futureDate);
    });

    it('should handle past event dates', async () => {
      mockRepository.getTaskByIdFull.mockResolvedValue(mockTaskData);
      mockRepository.validateAssignees.mockResolvedValue({
        allExist: true,
        allActive: true,
      });

      const pastDate = new Date('2020-01-01');
      const mockEvent = {
        id: 'event-001',
        taskId: 'task-001',
        userId: 'user-123',
        title: 'Past Event',
        eventDate: pastDate,
      };

      mockRepository.createCalendarEvent.mockResolvedValue(mockEvent);

      const result = await service.createCalendarEvent(
        'task-001',
        'user-123',
        'Past Event',
        pastDate,
        testUser
      );

      expect(result.eventDate).toEqual(pastDate);
    });
  });

  describe('getCalendarEvents', () => {
    it('should throw error when task not found', async () => {
      mockRepository.getTaskByIdFull.mockResolvedValue(null);

      await expect(
        service.getCalendarEvents('non-existent', testUser)
      ).rejects.toThrow('Task not found or access denied');
    });

    it('should throw error when user has no access to task', async () => {
      const taskData = {
        ...mockTaskData,
        ownerId: 'other-user',
        departmentId: 'dept-other',
        assignments: [{ userId: 'other-user' }],
      };

      mockRepository.getTaskByIdFull.mockResolvedValue(taskData);
      mockRepository.getDepartmentWithParent.mockResolvedValue({
        id: 'dept-other',
        parentId: null,
      });
      mockRepository.getUserDepartments.mockResolvedValue([]);

      await expect(
        service.getCalendarEvents('task-001', testUser)
      ).rejects.toThrow(
        'Unauthorized: You must be assigned to this task or it must be in your department hierarchy'
      );
    });

    it('should return all calendar events for task', async () => {
      mockRepository.getTaskByIdFull.mockResolvedValue(mockTaskData);

      const mockEvents = [
        {
          id: 'event-001',
          taskId: 'task-001',
          userId: 'user-123',
          title: 'Event 1',
          eventDate: new Date('2025-12-31'),
        },
        {
          id: 'event-002',
          taskId: 'task-001',
          userId: 'user-123',
          title: 'Event 2',
          eventDate: new Date('2026-01-15'),
        },
      ];

      mockRepository.getCalendarEvents.mockResolvedValue(mockEvents);

      const result = await service.getCalendarEvents('task-001', testUser);

      expect(mockRepository.getCalendarEvents).toHaveBeenCalledWith('task-001');
      expect(result).toEqual(mockEvents);
      expect(result).toHaveLength(2);
    });

    it('should return empty array when task has no events', async () => {
      mockRepository.getTaskByIdFull.mockResolvedValue(mockTaskData);
      mockRepository.getCalendarEvents.mockResolvedValue([]);

      const result = await service.getCalendarEvents('task-001', testUser);

      expect(result).toEqual([]);
      expect(result).toHaveLength(0);
    });
  });
});
