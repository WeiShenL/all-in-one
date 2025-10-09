/**
 * Unit Tests for TaskService Query Operations
 * Tests getOwnerTasks method - used in TaskCreateForm for parent task selection
 *
 * DDD Layer: SERVICE
 * Tests: Service orchestration for query operations
 */

import { TaskService } from '@/services/task/TaskService';
import { ITaskRepository } from '@/repositories/ITaskRepository';

describe('TaskService - Query Operations', () => {
  let service: TaskService;
  let mockRepository: jest.Mocked<ITaskRepository>;

  const mockTaskData = {
    id: 'task-001',
    title: 'Implement Login Feature',
    description: 'Create login functionality',
    priority: 8,
    dueDate: new Date('2025-12-31'),
    status: 'TO_DO',
    ownerId: 'owner-123',
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
      getOwnerTasks: jest.fn(),
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

  describe('getOwnerTasks', () => {
    /**
     * Frontend usage context:
     * - TaskCreateForm uses this to populate "Parent Task" dropdown
     * - Returns tasks where ownerId matches the requesting user
     * - Frontend filters out subtasks (tasks with parentTaskId) to show only top-level tasks
     */

    it('should retrieve all tasks owned by a user', async () => {
      // Setup: Mock repository to return 3 tasks owned by the same user
      mockRepository.getOwnerTasks.mockResolvedValue([
        mockTaskData,
        {
          ...mockTaskData,
          id: 'task-002',
          title: 'Setup CI/CD Pipeline',
          priority: 6,
        },
        {
          ...mockTaskData,
          id: 'task-003',
          title: 'Write Documentation',
          priority: 4,
        },
      ]);

      // Execute
      const result = await service.getOwnerTasks('owner-123', false);

      // Verify repository was called correctly
      expect(mockRepository.getOwnerTasks).toHaveBeenCalledWith(
        'owner-123',
        false
      );
      expect(mockRepository.getOwnerTasks).toHaveBeenCalledTimes(1);

      // Verify results are properly reconstructed as Task domain objects
      expect(result).toHaveLength(3);
      expect(result[0].getTitle()).toBe('Implement Login Feature');
      expect(result[0].getId()).toBe('task-001');
      expect(result[0].getOwnerId()).toBe('owner-123');
      expect(result[1].getTitle()).toBe('Setup CI/CD Pipeline');
      expect(result[1].getId()).toBe('task-002');
      expect(result[2].getTitle()).toBe('Write Documentation');
      expect(result[2].getId()).toBe('task-003');
    });

    it('should return empty array when user owns no tasks', async () => {
      mockRepository.getOwnerTasks.mockResolvedValue([]);

      const result = await service.getOwnerTasks('owner-999', false);

      expect(mockRepository.getOwnerTasks).toHaveBeenCalledWith(
        'owner-999',
        false
      );
      expect(result).toEqual([]);
      expect(result).toHaveLength(0);
    });

    it('should exclude archived tasks by default (includeArchived=false)', async () => {
      // Return only non-archived tasks
      mockRepository.getOwnerTasks.mockResolvedValue([
        mockTaskData,
        {
          ...mockTaskData,
          id: 'task-002',
          title: 'Active Task',
          isArchived: false,
        },
      ]);

      const result = await service.getOwnerTasks('owner-123', false);

      expect(mockRepository.getOwnerTasks).toHaveBeenCalledWith(
        'owner-123',
        false // Exclude archived
      );
      expect(result).toHaveLength(2);
      expect(result.every(task => !task.getIsArchived())).toBe(true);
    });

    it('should include archived tasks when includeArchived=true', async () => {
      // Return mix of archived and active tasks
      mockRepository.getOwnerTasks.mockResolvedValue([
        mockTaskData,
        {
          ...mockTaskData,
          id: 'task-archived',
          title: 'Archived Task',
          isArchived: true,
        },
        {
          ...mockTaskData,
          id: 'task-active',
          title: 'Active Task',
          isArchived: false,
        },
      ]);

      const result = await service.getOwnerTasks('owner-123', true);

      expect(mockRepository.getOwnerTasks).toHaveBeenCalledWith(
        'owner-123',
        true // Include archived
      );
      expect(result).toHaveLength(3);

      // Verify archived task is included
      const archivedTask = result.find(t => t.getId() === 'task-archived');
      expect(archivedTask).toBeDefined();
      expect(archivedTask!.getIsArchived()).toBe(true);
    });

    it('should return tasks including subtasks (parent task selection happens in frontend)', async () => {
      // Repository returns both parent tasks and subtasks
      mockRepository.getOwnerTasks.mockResolvedValue([
        {
          ...mockTaskData,
          id: 'parent-task-001',
          title: 'Parent Task',
          parentTaskId: null, // Top-level task
        },
        {
          ...mockTaskData,
          id: 'subtask-001',
          title: 'Subtask 1',
          parentTaskId: 'parent-task-001', // This is a subtask
        },
        {
          ...mockTaskData,
          id: 'parent-task-002',
          title: 'Another Parent Task',
          parentTaskId: null, // Top-level task
        },
      ]);

      const result = await service.getOwnerTasks('owner-123', false);

      // Service returns ALL tasks - frontend filters out subtasks
      expect(result).toHaveLength(3);

      // Verify both parent tasks and subtasks are returned
      const parentTasks = result.filter(t => !t.getParentTaskId());
      const subtasks = result.filter(t => t.getParentTaskId());

      expect(parentTasks).toHaveLength(2);
      expect(subtasks).toHaveLength(1);
      expect(subtasks[0].getTitle()).toBe('Subtask 1');
      expect(subtasks[0].getParentTaskId()).toBe('parent-task-001');
    });

    it('should reconstruct task domain objects with all properties', async () => {
      const fullTaskData = {
        id: 'task-full',
        title: 'Full Task',
        description: 'Complete task data',
        priority: 7,
        dueDate: new Date('2025-06-15'),
        status: 'IN_PROGRESS',
        ownerId: 'owner-123',
        departmentId: 'dept-456',
        projectId: 'project-001',
        parentTaskId: null,
        recurringInterval: 7,
        isArchived: false,
        createdAt: new Date('2025-01-10'),
        updatedAt: new Date('2025-01-15'),
        assignments: [{ userId: 'user-1' }, { userId: 'user-2' }],
        tags: [{ tag: { name: 'urgent' } }, { tag: { name: 'backend' } }],
        comments: [
          {
            id: 'comment-1',
            content: 'Test comment',
            userId: 'user-1',
            createdAt: new Date('2025-01-12'),
            updatedAt: new Date('2025-01-12'),
          },
        ],
        files: [
          {
            id: 'file-1',
            fileName: 'doc.pdf',
            fileSize: 1024,
            fileType: 'application/pdf',
            storagePath: 'task-full/doc.pdf',
            uploadedById: 'user-1',
            uploadedAt: new Date('2025-01-11'),
          },
        ],
      };

      mockRepository.getOwnerTasks.mockResolvedValue([fullTaskData]);

      const result = await service.getOwnerTasks('owner-123', false);

      expect(result).toHaveLength(1);
      const task = result[0];

      // Verify all properties are correctly reconstructed
      expect(task.getId()).toBe('task-full');
      expect(task.getTitle()).toBe('Full Task');
      expect(task.getDescription()).toBe('Complete task data');
      expect(task.getPriorityBucket()).toBe(7);
      expect(task.getDueDate()).toEqual(new Date('2025-06-15'));
      expect(task.getStatus()).toBe('IN_PROGRESS');
      expect(task.getOwnerId()).toBe('owner-123');
      expect(task.getDepartmentId()).toBe('dept-456');
      expect(task.getProjectId()).toBe('project-001');
      expect(task.getParentTaskId()).toBeNull();
      expect(task.getRecurringInterval()).toBe(7);
      expect(task.getIsArchived()).toBe(false);

      // Verify collections are properly reconstructed
      expect(task.getAssignees().size).toBe(2);
      expect(task.getTags().size).toBe(2);
      expect(task.getComments()).toHaveLength(1);
      expect(task.getFiles()).toHaveLength(1);
    });

    it('should handle tasks with no optional fields (minimal task data)', async () => {
      const minimalTaskData = {
        id: 'task-minimal',
        title: 'Minimal Task',
        description: 'Basic task',
        priority: 5,
        dueDate: new Date('2025-12-31'),
        status: 'TO_DO',
        ownerId: 'owner-123',
        departmentId: 'dept-456',
        projectId: null,
        parentTaskId: null,
        recurringInterval: null,
        isArchived: false,
        createdAt: new Date('2025-01-01'),
        updatedAt: new Date('2025-01-01'),
        assignments: [],
        tags: [],
        comments: [],
        files: [],
      };

      mockRepository.getOwnerTasks.mockResolvedValue([minimalTaskData]);

      const result = await service.getOwnerTasks('owner-123', false);

      expect(result).toHaveLength(1);
      const task = result[0];

      expect(task.getProjectId()).toBeNull();
      expect(task.getParentTaskId()).toBeNull();
      expect(task.getRecurringInterval()).toBeNull();
      expect(task.getAssignees().size).toBe(0);
      expect(task.getTags().size).toBe(0);
      expect(task.getComments()).toHaveLength(0);
      expect(task.getFiles()).toHaveLength(0);
    });

    it('should return tasks in the order provided by repository', async () => {
      // Repository might return tasks ordered by createdAt DESC or other criteria
      mockRepository.getOwnerTasks.mockResolvedValue([
        { ...mockTaskData, id: 'task-003', title: 'Third Task' },
        { ...mockTaskData, id: 'task-001', title: 'First Task' },
        { ...mockTaskData, id: 'task-002', title: 'Second Task' },
      ]);

      const result = await service.getOwnerTasks('owner-123', false);

      // Service preserves repository ordering
      expect(result[0].getId()).toBe('task-003');
      expect(result[1].getId()).toBe('task-001');
      expect(result[2].getId()).toBe('task-002');
    });

    it('should use default includeArchived=false when not provided', async () => {
      mockRepository.getOwnerTasks.mockResolvedValue([mockTaskData]);

      // Call without second parameter
      await service.getOwnerTasks('owner-123');

      // Should default to false
      expect(mockRepository.getOwnerTasks).toHaveBeenCalledWith(
        'owner-123',
        false
      );
    });

    it('should handle repository returning tasks with different statuses', async () => {
      mockRepository.getOwnerTasks.mockResolvedValue([
        { ...mockTaskData, id: 'task-1', status: 'TO_DO' },
        { ...mockTaskData, id: 'task-2', status: 'IN_PROGRESS' },
        { ...mockTaskData, id: 'task-3', status: 'COMPLETED' },
        { ...mockTaskData, id: 'task-4', status: 'BLOCKED' },
      ]);

      const result = await service.getOwnerTasks('owner-123', false);

      expect(result).toHaveLength(4);
      expect(result[0].getStatus()).toBe('TO_DO');
      expect(result[1].getStatus()).toBe('IN_PROGRESS');
      expect(result[2].getStatus()).toBe('COMPLETED');
      expect(result[3].getStatus()).toBe('BLOCKED');
    });

    it('should handle repository returning recurring tasks', async () => {
      mockRepository.getOwnerTasks.mockResolvedValue([
        {
          ...mockTaskData,
          id: 'task-daily',
          recurringInterval: 1,
        },
        {
          ...mockTaskData,
          id: 'task-weekly',
          recurringInterval: 7,
        },
        {
          ...mockTaskData,
          id: 'task-monthly',
          recurringInterval: 30,
        },
      ]);

      const result = await service.getOwnerTasks('owner-123', false);

      expect(result).toHaveLength(3);
      expect(result[0].getRecurringInterval()).toBe(1);
      expect(result[1].getRecurringInterval()).toBe(7);
      expect(result[2].getRecurringInterval()).toBe(30);
      expect(result[0].isTaskRecurring()).toBe(true);
      expect(result[1].isTaskRecurring()).toBe(true);
      expect(result[2].isTaskRecurring()).toBe(true);
    });
  });
});
