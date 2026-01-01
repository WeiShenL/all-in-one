/**
 * Unit Tests for PrismaTaskRepository
 *
 * Tests for methods with low coverage (<35% currently)
 * Focuses on methods not covered by integration tests
 */

import { PrismaClient } from '@prisma/client';
import { PrismaTaskRepository } from '../../../src/repositories/PrismaTaskRepository';
import { Task, TaskStatus } from '../../../src/domain/task/Task';

// Mock PrismaClient
jest.mock('@prisma/client', () => {
  const mockPrismaClient: any = {
    task: {
      upsert: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    taskFile: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      delete: jest.fn(),
    },
    taskLog: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
    taskAssignment: {
      create: jest.fn(),
      delete: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
    taskTag: {
      create: jest.fn(),
      delete: jest.fn(),
    },
    tag: {
      upsert: jest.fn(),
      findUnique: jest.fn(),
    },
    comment: {
      create: jest.fn(),
      update: jest.fn(),
    },
    project: {
      findUnique: jest.fn(),
    },
    userProfile: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
    department: {
      findUnique: jest.fn(),
    },
    calendarEvent: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
    projectCollaborator: {
      upsert: jest.fn(),
      delete: jest.fn(),
      findUnique: jest.fn(),
    },
    $transaction: jest.fn((callback: (tx: any) => Promise<any>) => {
      // Execute the callback with the mock client itself
      return callback(mockPrismaClient);
    }),
  };
  return {
    PrismaClient: jest.fn(() => mockPrismaClient),
  };
});

describe('PrismaTaskRepository', () => {
  let repository: PrismaTaskRepository;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = new PrismaClient();
    // Ensure $transaction is available and properly mocked
    if (!mockPrisma.$transaction) {
      mockPrisma.$transaction = jest.fn(callback => callback(mockPrisma));
    }
    repository = new PrismaTaskRepository(mockPrisma);
    jest.clearAllMocks();
  });

  // ============================================
  // CORE TASK OPERATIONS
  // ============================================

  describe('save', () => {
    it('should save a task with assignments, tags, and comments', async () => {
      const taskData = {
        id: 'task-1',
        title: 'Test Task',
        description: 'Test Description',
        priorityBucket: 5,
        dueDate: new Date('2025-12-31'),
        status: 'TO_DO' as TaskStatus,
        ownerId: 'user-1',
        departmentId: 'dept-1',
        projectId: 'project-1',
        parentTaskId: null,
        recurringInterval: null,
        isArchived: false,
        createdAt: new Date(),
        startDate: null,
        updatedAt: new Date(),
        assignments: new Set(['user-1', 'user-2']),
        tags: new Set(['urgent', 'backend']),
        comments: [
          {
            id: 'comment-1',
            content: 'Test comment',
            authorId: 'user-1',
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
      };

      const task = new Task(taskData);

      const mockSavedTask = {
        ...taskData,
        assignments: [{ userId: 'user-1' }, { userId: 'user-2' }],
        tags: [{ tag: { name: 'urgent' } }, { tag: { name: 'backend' } }],
        comments: taskData.comments,
        files: [],
      };

      mockPrisma.task.upsert.mockResolvedValue(mockSavedTask);

      const result = await repository.save(task);

      expect(mockPrisma.task.upsert).toHaveBeenCalled();
      expect(result).toBeInstanceOf(Task);
      expect(result.getTitle()).toBe('Test Task');
    });
  });

  describe('findById', () => {
    it('should return task when found', async () => {
      const mockTask = {
        id: 'task-1',
        title: 'Test Task',
        description: 'Test Description',
        priority: 5,
        dueDate: new Date('2025-12-31'),
        status: 'TO_DO',
        ownerId: 'user-1',
        departmentId: 'dept-1',
        projectId: 'project-1',
        parentTaskId: null,
        recurringInterval: null,
        isArchived: false,
        createdAt: new Date(),
        startDate: null,
        updatedAt: new Date(),
        assignments: [],
        tags: [],
        comments: [],
        files: [],
      };

      mockPrisma.task.findUnique.mockResolvedValue(mockTask);

      const result = await repository.findById('task-1');

      expect(mockPrisma.task.findUnique).toHaveBeenCalledWith({
        where: { id: 'task-1' },
        include: expect.any(Object),
      });
      expect(result).toBeInstanceOf(Task);
    });

    it('should return null when task not found', async () => {
      mockPrisma.task.findUnique.mockResolvedValue(null);

      const result = await repository.findById('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('findByDepartment', () => {
    it('should find tasks by department excluding archived', async () => {
      const mockTasks = [
        {
          id: 'task-1',
          title: 'Task 1',
          description: '',
          priority: 5,
          dueDate: new Date(),
          status: 'TO_DO',
          ownerId: 'user-1',
          departmentId: 'dept-1',
          projectId: null,
          parentTaskId: null,
          recurringInterval: null,
          isArchived: false,
          createdAt: new Date(),
          startDate: null,
          updatedAt: new Date(),
          assignments: [],
          tags: [],
          comments: [],
          files: [],
        },
      ];

      mockPrisma.task.findMany.mockResolvedValue(mockTasks);

      const result = await repository.findByDepartment('dept-1', false);

      expect(mockPrisma.task.findMany).toHaveBeenCalledWith({
        where: {
          departmentId: 'dept-1',
          isArchived: false,
        },
        include: expect.any(Object),
      });
      expect(result).toHaveLength(1);
    });

    it('should include archived tasks when requested', async () => {
      mockPrisma.task.findMany.mockResolvedValue([]);

      await repository.findByDepartment('dept-1', true);

      expect(mockPrisma.task.findMany).toHaveBeenCalledWith({
        where: {
          departmentId: 'dept-1',
        },
        include: expect.any(Object),
      });
    });
  });

  describe('findByAssignee', () => {
    it('should find tasks assigned to user', async () => {
      const mockTasks = [
        {
          id: 'task-1',
          title: 'Assigned Task',
          description: '',
          priority: 5,
          dueDate: new Date(),
          status: 'IN_PROGRESS',
          ownerId: 'user-2',
          departmentId: 'dept-1',
          projectId: null,
          parentTaskId: null,
          recurringInterval: null,
          isArchived: false,
          createdAt: new Date(),
          startDate: null,
          updatedAt: new Date(),
          assignments: [{ userId: 'user-1' }],
          tags: [],
          comments: [],
          files: [],
        },
      ];

      mockPrisma.task.findMany.mockResolvedValue(mockTasks);

      const result = await repository.findByAssignee('user-1');

      expect(mockPrisma.task.findMany).toHaveBeenCalledWith({
        where: {
          assignments: {
            some: {
              userId: 'user-1',
            },
          },
          isArchived: false,
        },
        include: expect.any(Object),
      });
      expect(result).toHaveLength(1);
    });
  });

  describe('findSubtasks', () => {
    it('should find subtasks of parent task', async () => {
      const mockSubtasks = [
        {
          id: 'subtask-1',
          title: 'Subtask 1',
          description: '',
          priority: 5,
          dueDate: new Date(),
          status: 'TO_DO',
          ownerId: 'user-1',
          departmentId: 'dept-1',
          projectId: null,
          parentTaskId: 'parent-1',
          recurringInterval: null,
          isArchived: false,
          createdAt: new Date(),
          startDate: null,
          updatedAt: new Date(),
          assignments: [],
          tags: [],
          comments: [],
          files: [],
        },
      ];

      mockPrisma.task.findMany.mockResolvedValue(mockSubtasks);

      const result = await repository.findSubtasks('parent-1');

      expect(mockPrisma.task.findMany).toHaveBeenCalledWith({
        where: { parentTaskId: 'parent-1' },
        include: expect.any(Object),
      });
      expect(result).toHaveLength(1);
    });
  });

  describe('findParentTask', () => {
    it('should return parent task if exists', async () => {
      const mockSubtask = {
        id: 'subtask-1',
        title: 'Subtask',
        description: '',
        priority: 5,
        dueDate: new Date(),
        status: 'TO_DO',
        ownerId: 'user-1',
        departmentId: 'dept-1',
        projectId: null,
        parentTaskId: 'parent-1',
        recurringInterval: null,
        isArchived: false,
        createdAt: new Date(),
        startDate: null,
        updatedAt: new Date(),
        assignments: [],
        tags: [],
        comments: [],
        files: [],
      };

      const mockParent = { ...mockSubtask, id: 'parent-1', parentTaskId: null };

      mockPrisma.task.findUnique
        .mockResolvedValueOnce(mockSubtask)
        .mockResolvedValueOnce(mockParent);

      const result = await repository.findParentTask('subtask-1');

      expect(result).toBeInstanceOf(Task);
      expect(result?.getId()).toBe('parent-1');
    });

    it('should return null if task has no parent', async () => {
      const mockTask = {
        id: 'task-1',
        title: 'Task',
        description: '',
        priority: 5,
        dueDate: new Date(),
        status: 'TO_DO',
        ownerId: 'user-1',
        departmentId: 'dept-1',
        projectId: null,
        parentTaskId: null,
        recurringInterval: null,
        isArchived: false,
        createdAt: new Date(),
        startDate: null,
        updatedAt: new Date(),
        assignments: [],
        tags: [],
        comments: [],
        files: [],
      };

      mockPrisma.task.findUnique.mockResolvedValue(mockTask);

      const result = await repository.findParentTask('task-1');

      expect(result).toBeNull();
    });

    it('should return null if task does not exist', async () => {
      mockPrisma.task.findUnique.mockResolvedValue(null);

      const result = await repository.findParentTask('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('delete', () => {
    it('should delete a task', async () => {
      mockPrisma.task.delete.mockResolvedValue({});

      await repository.delete('task-1');

      expect(mockPrisma.task.delete).toHaveBeenCalledWith({
        where: { id: 'task-1' },
      });
    });
  });

  describe('exists', () => {
    it('should return true if task exists', async () => {
      mockPrisma.task.count.mockResolvedValue(1);

      const result = await repository.exists('task-1');

      expect(result).toBe(true);
      expect(mockPrisma.task.count).toHaveBeenCalledWith({
        where: { id: 'task-1' },
      });
    });

    it('should return false if task does not exist', async () => {
      mockPrisma.task.count.mockResolvedValue(0);

      const result = await repository.exists('non-existent');

      expect(result).toBe(false);
    });
  });

  describe('findByCriteria', () => {
    it('should find tasks by multiple criteria', async () => {
      mockPrisma.task.findMany.mockResolvedValue([]);

      await repository.findByCriteria({
        departmentId: 'dept-1',
        status: 'IN_PROGRESS' as TaskStatus,
        assigneeId: 'user-1',
        creatorId: 'user-2',
        tag: 'urgent',
      });

      expect(mockPrisma.task.findMany).toHaveBeenCalledWith({
        where: {
          departmentId: 'dept-1',
          status: 'IN_PROGRESS',
          assignments: {
            some: { userId: 'user-1' },
          },
          ownerId: 'user-2',
          tags: {
            some: { tag: { name: 'urgent' } },
          },
        },
        include: expect.any(Object),
      });
    });

    it('should handle empty criteria', async () => {
      mockPrisma.task.findMany.mockResolvedValue([]);

      await repository.findByCriteria({});

      expect(mockPrisma.task.findMany).toHaveBeenCalledWith({
        where: {},
        include: expect.any(Object),
      });
    });
  });

  describe('findByProject', () => {
    it('should find tasks by project', async () => {
      mockPrisma.task.findMany.mockResolvedValue([]);

      await repository.findByProject('project-1', false);

      expect(mockPrisma.task.findMany).toHaveBeenCalledWith({
        where: {
          projectId: 'project-1',
          isArchived: false,
        },
        include: expect.any(Object),
      });
    });
  });

  describe('findAll', () => {
    it('should find all tasks excluding archived', async () => {
      mockPrisma.task.findMany.mockResolvedValue([]);

      await repository.findAll(false);

      expect(mockPrisma.task.findMany).toHaveBeenCalledWith({
        where: {
          isArchived: false,
        },
        include: expect.any(Object),
      });
    });

    it('should find all tasks including archived', async () => {
      mockPrisma.task.findMany.mockResolvedValue([]);

      await repository.findAll(true);

      expect(mockPrisma.task.findMany).toHaveBeenCalledWith({
        where: {},
        include: expect.any(Object),
      });
    });
  });

  // ============================================
  // FILE OPERATIONS
  // ============================================

  describe('createTaskFile', () => {
    it('should create a task file', async () => {
      const fileData = {
        taskId: 'task-1',
        fileName: 'test.pdf',
        fileSize: 1024,
        fileType: 'application/pdf',
        storagePath: '/files/test.pdf',
        uploadedById: 'user-1',
      };

      mockPrisma.taskFile.create.mockResolvedValue({
        id: 'file-1',
        ...fileData,
      });

      const result = await repository.createTaskFile(fileData);

      expect(mockPrisma.taskFile.create).toHaveBeenCalledWith({
        data: fileData,
      });
      expect(result.id).toBe('file-1');
    });
  });

  describe('getTaskFiles', () => {
    it('should get files for a task', async () => {
      const mockFiles = [
        {
          id: 'file-1',
          taskId: 'task-1',
          fileName: 'test.pdf',
          fileSize: 1024,
          fileType: 'application/pdf',
          storagePath: '/files/test.pdf',
          uploadedById: 'user-1',
          uploadedAt: new Date(),
        },
      ];

      mockPrisma.taskFile.findMany.mockResolvedValue(mockFiles);

      const result = await repository.getTaskFiles('task-1');

      expect(mockPrisma.taskFile.findMany).toHaveBeenCalledWith({
        where: { taskId: 'task-1' },
        orderBy: { uploadedAt: 'desc' },
      });
      expect(result).toHaveLength(1);
    });
  });

  describe('getTaskFileById', () => {
    it('should get a file by ID', async () => {
      const mockFile = {
        id: 'file-1',
        taskId: 'task-1',
        fileName: 'test.pdf',
        fileSize: 1024,
        fileType: 'application/pdf',
        storagePath: '/files/test.pdf',
        uploadedById: 'user-1',
        uploadedAt: new Date(),
      };

      mockPrisma.taskFile.findUnique.mockResolvedValue(mockFile);

      const result = await repository.getTaskFileById('file-1');

      expect(mockPrisma.taskFile.findUnique).toHaveBeenCalledWith({
        where: { id: 'file-1' },
      });
      expect(result?.id).toBe('file-1');
    });
  });

  describe('deleteTaskFile', () => {
    it('should delete a file', async () => {
      mockPrisma.taskFile.delete.mockResolvedValue({});

      await repository.deleteTaskFile('file-1');

      expect(mockPrisma.taskFile.delete).toHaveBeenCalledWith({
        where: { id: 'file-1' },
      });
    });
  });

  // ============================================
  // TASK OPERATIONS
  // ============================================

  describe('createTask', () => {
    it('should create task with assignments and tags', async () => {
      const taskData = {
        id: 'task-1',
        title: 'New Task',
        description: 'Description',
        priority: 5,
        dueDate: new Date('2025-12-31'),
        ownerId: 'user-1',
        departmentId: 'dept-1',
        projectId: 'project-1',
        assigneeIds: ['user-1', 'user-2'],
        tags: ['urgent', 'backend'],
        recurringInterval: 7,
      };

      mockPrisma.task.create.mockResolvedValue({ id: 'task-1' });

      const result = await repository.createTask(taskData);

      expect(mockPrisma.task.create).toHaveBeenCalled();
      expect(result.id).toBe('task-1');
    });

    it('should create task without tags', async () => {
      const taskData = {
        id: 'task-1',
        title: 'New Task',
        description: 'Description',
        priority: 5,
        dueDate: new Date('2025-12-31'),
        ownerId: 'user-1',
        departmentId: 'dept-1',
        assigneeIds: ['user-1'],
      };

      mockPrisma.task.create.mockResolvedValue({ id: 'task-1' });

      const result = await repository.createTask(taskData);

      expect(result.id).toBe('task-1');
    });
  });

  describe('updateTask', () => {
    it('should update task fields', async () => {
      const updateData = {
        title: 'Updated Title',
        description: 'Updated Description',
        priority: 3,
        status: 'IN_PROGRESS' as TaskStatus,
      };

      mockPrisma.task.update.mockResolvedValue({});

      await repository.updateTask('task-1', updateData);

      expect(mockPrisma.task.update).toHaveBeenCalledWith({
        where: { id: 'task-1' },
        data: updateData,
      });
    });
  });

  describe('archiveTask', () => {
    it('should archive a task', async () => {
      mockPrisma.task.update.mockResolvedValue({});

      await repository.archiveTask('task-1');

      expect(mockPrisma.task.update).toHaveBeenCalledWith({
        where: { id: 'task-1' },
        data: {
          isArchived: true,
          updatedAt: expect.any(Date),
        },
      });
    });
  });

  describe('unarchiveTask', () => {
    it('should unarchive a task', async () => {
      mockPrisma.task.update.mockResolvedValue({});

      await repository.unarchiveTask('task-1');

      expect(mockPrisma.task.update).toHaveBeenCalledWith({
        where: { id: 'task-1' },
        data: {
          isArchived: false,
          updatedAt: expect.any(Date),
        },
      });
    });
  });

  describe('hasSubtasks', () => {
    it('should return true if task has subtasks', async () => {
      mockPrisma.task.count.mockResolvedValue(2);

      const result = await repository.hasSubtasks('task-1');

      expect(result).toBe(true);
      expect(mockPrisma.task.count).toHaveBeenCalledWith({
        where: { parentTaskId: 'task-1' },
      });
    });

    it('should return false if task has no subtasks', async () => {
      mockPrisma.task.count.mockResolvedValue(0);

      const result = await repository.hasSubtasks('task-1');

      expect(result).toBe(false);
    });
  });

  // ============================================
  // TAG OPERATIONS
  // ============================================

  describe('addTaskTag', () => {
    it('should add a tag to task', async () => {
      mockPrisma.tag.upsert.mockResolvedValue({ id: 'tag-1', name: 'urgent' });
      mockPrisma.taskTag.create.mockResolvedValue({});

      await repository.addTaskTag('task-1', 'urgent');

      expect(mockPrisma.tag.upsert).toHaveBeenCalledWith({
        where: { name: 'urgent' },
        create: { name: 'urgent' },
        update: {},
      });
      expect(mockPrisma.taskTag.create).toHaveBeenCalledWith({
        data: {
          taskId: 'task-1',
          tagId: 'tag-1',
        },
      });
    });
  });

  describe('removeTaskTag', () => {
    it('should remove a tag from task using transaction', async () => {
      mockPrisma.tag.findUnique.mockResolvedValue({
        id: 'tag-1',
        name: 'urgent',
      });
      mockPrisma.taskTag.delete.mockResolvedValue({});

      await repository.removeTaskTag('task-1', 'urgent');

      expect(mockPrisma.$transaction).toHaveBeenCalled();
      expect(mockPrisma.tag.findUnique).toHaveBeenCalledWith({
        where: { name: 'urgent' },
      });
      expect(mockPrisma.taskTag.delete).toHaveBeenCalledWith({
        where: {
          taskId_tagId: {
            taskId: 'task-1',
            tagId: 'tag-1',
          },
        },
      });
    });

    it('should handle removing non-existent tag gracefully in transaction', async () => {
      mockPrisma.tag.findUnique.mockResolvedValue(null);

      await repository.removeTaskTag('task-1', 'non-existent');

      expect(mockPrisma.$transaction).toHaveBeenCalled();
      expect(mockPrisma.taskTag.delete).not.toHaveBeenCalled();
    });
  });

  // ============================================
  // ASSIGNMENT OPERATIONS
  // ============================================

  describe('addTaskAssignment', () => {
    it('should add an assignment', async () => {
      mockPrisma.taskAssignment.create.mockResolvedValue({});

      await repository.addTaskAssignment('task-1', 'user-2', 'user-1');

      expect(mockPrisma.taskAssignment.create).toHaveBeenCalledWith({
        data: {
          taskId: 'task-1',
          userId: 'user-2',
          assignedById: 'user-1',
        },
      });
    });
  });

  describe('removeTaskAssignment', () => {
    it('should remove an assignment', async () => {
      mockPrisma.taskAssignment.delete.mockResolvedValue({});

      await repository.removeTaskAssignment('task-1', 'user-2');

      expect(mockPrisma.taskAssignment.delete).toHaveBeenCalledWith({
        where: {
          taskId_userId: {
            taskId: 'task-1',
            userId: 'user-2',
          },
        },
      });
    });
  });

  // ============================================
  // COMMENT OPERATIONS
  // ============================================

  describe('createComment', () => {
    it('should create a comment', async () => {
      mockPrisma.comment.create.mockResolvedValue({});

      await repository.createComment('task-1', 'Great work!', 'user-1');

      expect(mockPrisma.comment.create).toHaveBeenCalledWith({
        data: {
          taskId: 'task-1',
          content: 'Great work!',
          userId: 'user-1',
        },
      });
    });
  });

  describe('updateComment', () => {
    it('should update a comment', async () => {
      mockPrisma.comment.update.mockResolvedValue({});

      await repository.updateComment('comment-1', 'Updated content');

      expect(mockPrisma.comment.update).toHaveBeenCalledWith({
        where: { id: 'comment-1' },
        data: { content: 'Updated content' },
      });
    });
  });

  // ============================================
  // VALIDATION OPERATIONS
  // ============================================

  describe('validateProjectExists', () => {
    it('should return true if project exists', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({ id: 'project-1' });

      const result = await repository.validateProjectExists('project-1');

      expect(result).toBe(true);
    });

    it('should return false if project does not exist', async () => {
      mockPrisma.project.findUnique.mockResolvedValue(null);

      const result = await repository.validateProjectExists('non-existent');

      expect(result).toBe(false);
    });
  });

  describe('getParentTaskDepth', () => {
    it('should return parent task depth info', async () => {
      const mockTask = {
        id: 'task-1',
        parentTaskId: 'parent-1',
      };

      mockPrisma.task.findUnique.mockResolvedValue(mockTask);

      const result = await repository.getParentTaskDepth('task-1');

      expect(result).toEqual({
        id: 'task-1',
        parentTaskId: 'parent-1',
      });
    });

    it('should return null if task not found', async () => {
      mockPrisma.task.findUnique.mockResolvedValue(null);

      const result = await repository.getParentTaskDepth('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('validateAssignees', () => {
    it('should return true for all existing and active users', async () => {
      const mockUsers = [
        { id: 'user-1', isActive: true },
        { id: 'user-2', isActive: true },
      ];

      mockPrisma.userProfile.findMany.mockResolvedValue(mockUsers);

      const result = await repository.validateAssignees(['user-1', 'user-2']);

      expect(result).toEqual({
        allExist: true,
        allActive: true,
      });
    });

    it('should return false if some users do not exist', async () => {
      mockPrisma.userProfile.findMany.mockResolvedValue([
        { id: 'user-1', isActive: true },
      ]);

      const result = await repository.validateAssignees(['user-1', 'user-2']);

      expect(result).toEqual({
        allExist: false,
        allActive: true,
      });
    });

    it('should return false if some users are inactive', async () => {
      const mockUsers = [
        { id: 'user-1', isActive: true },
        { id: 'user-2', isActive: false },
      ];

      mockPrisma.userProfile.findMany.mockResolvedValue(mockUsers);

      const result = await repository.validateAssignees(['user-1', 'user-2']);

      expect(result).toEqual({
        allExist: true,
        allActive: false,
      });
    });
  });

  // ============================================
  // LOGGING OPERATIONS
  // ============================================

  describe('logTaskAction', () => {
    it('should log a task action', async () => {
      mockPrisma.taskLog.create.mockResolvedValue({});

      await repository.logTaskAction('task-1', 'user-1', 'UPDATE', 'status', {
        changes: { from: 'TO_DO', to: 'IN_PROGRESS' },
        metadata: { reason: 'Started work' },
      });

      expect(mockPrisma.taskLog.create).toHaveBeenCalledWith({
        data: {
          taskId: 'task-1',
          userId: 'user-1',
          action: 'UPDATE',
          field: 'status',
          changes: { from: 'TO_DO', to: 'IN_PROGRESS' },
          metadata: { reason: 'Started work' },
        },
      });
    });

    it('should log action without data', async () => {
      mockPrisma.taskLog.create.mockResolvedValue({});

      await repository.logTaskAction('task-1', 'user-1', 'VIEW', 'task');

      expect(mockPrisma.taskLog.create).toHaveBeenCalledWith({
        data: {
          taskId: 'task-1',
          userId: 'user-1',
          action: 'VIEW',
          field: 'task',
          changes: null,
          metadata: {},
        },
      });
    });
  });

  describe('getTaskLogs', () => {
    it('should get task logs', async () => {
      const mockLogs = [
        {
          id: 'log-1',
          taskId: 'task-1',
          userId: 'user-1',
          action: 'UPDATE',
          field: 'status',
          changes: {},
          metadata: {},
          timestamp: new Date(),
          user: {
            id: 'user-1',
            name: 'John Doe',
            email: 'john@test.com',
          },
        },
      ];

      mockPrisma.taskLog.findMany.mockResolvedValue(mockLogs);

      const result = await repository.getTaskLogs('task-1');

      expect(mockPrisma.taskLog.findMany).toHaveBeenCalledWith({
        where: { taskId: 'task-1' },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        orderBy: {
          timestamp: 'desc',
        },
      });
      expect(result).toHaveLength(1);
      expect(result[0].user.name).toBe('John Doe');
    });

    it('should handle user with null name', async () => {
      const mockLogs = [
        {
          id: 'log-1',
          taskId: 'task-1',
          userId: 'user-1',
          action: 'UPDATE',
          field: 'status',
          changes: {},
          metadata: {},
          timestamp: new Date(),
          user: {
            id: 'user-1',
            name: null,
            email: 'john@test.com',
          },
        },
      ];

      mockPrisma.taskLog.findMany.mockResolvedValue(mockLogs);

      const result = await repository.getTaskLogs('task-1');

      expect(result[0].user.name).toBe('Unknown User');
    });
  });

  // ============================================
  // CALENDAR OPERATIONS
  // ============================================

  describe('createCalendarEvent', () => {
    it('should create a calendar event', async () => {
      const eventData = {
        taskId: 'task-1',
        userId: 'user-1',
        title: 'Meeting',
        eventDate: new Date('2025-12-15'),
      };

      const mockEvent = {
        id: 'event-1',
        ...eventData,
        task: { id: 'task-1', title: 'Task' },
        user: { id: 'user-1', name: 'John', email: 'john@test.com' },
      };

      mockPrisma.calendarEvent.create.mockResolvedValue(mockEvent);

      const result = await repository.createCalendarEvent(eventData);

      expect(mockPrisma.calendarEvent.create).toHaveBeenCalledWith({
        data: eventData,
        include: expect.any(Object),
      });
      expect(result.id).toBe('event-1');
    });
  });

  describe('getCalendarEvents', () => {
    it('should get calendar events for a task', async () => {
      const mockEvents = [
        {
          id: 'event-1',
          taskId: 'task-1',
          userId: 'user-1',
          title: 'Meeting',
          eventDate: new Date(),
          user: { id: 'user-1', name: 'John', email: 'john@test.com' },
        },
      ];

      mockPrisma.calendarEvent.findMany.mockResolvedValue(mockEvents);

      const result = await repository.getCalendarEvents('task-1');

      expect(mockPrisma.calendarEvent.findMany).toHaveBeenCalledWith({
        where: { taskId: 'task-1' },
        include: expect.any(Object),
        orderBy: { eventDate: 'asc' },
      });
      expect(result).toHaveLength(1);
    });
  });

  // ============================================
  // DEPARTMENT OPERATIONS
  // ============================================

  describe('getDepartmentWithParent', () => {
    it('should get department with parent info', async () => {
      const mockDept = {
        id: 'dept-1',
        parentId: 'parent-dept',
      };

      mockPrisma.department.findUnique.mockResolvedValue(mockDept);

      const result = await repository.getDepartmentWithParent('dept-1');

      expect(result).toEqual({
        id: 'dept-1',
        parentId: 'parent-dept',
      });
    });

    it('should return null if department not found', async () => {
      mockPrisma.department.findUnique.mockResolvedValue(null);

      const result = await repository.getDepartmentWithParent('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('getUserDepartments', () => {
    it('should get user departments', async () => {
      const mockUsers = [
        { id: 'user-1', departmentId: 'dept-1' },
        { id: 'user-2', departmentId: 'dept-2' },
      ];

      mockPrisma.userProfile.findMany.mockResolvedValue(mockUsers);

      const result = await repository.getUserDepartments(['user-1', 'user-2']);

      expect(result).toEqual([
        { userId: 'user-1', departmentId: 'dept-1' },
        { userId: 'user-2', departmentId: 'dept-2' },
      ]);
    });
  });

  // ============================================
  // HELPER OPERATIONS
  // ============================================

  describe('getTaskById', () => {
    it('should get task with minimal fields for authorization', async () => {
      const mockTask = {
        id: 'task-1',
        ownerId: 'user-1',
        assignments: [{ userId: 'user-2' }, { userId: 'user-3' }],
      };

      mockPrisma.task.findUnique.mockResolvedValue(mockTask);

      const result = await repository.getTaskById('task-1');

      expect(result).toEqual(mockTask);
      expect(mockPrisma.task.findUnique).toHaveBeenCalledWith({
        where: { id: 'task-1' },
        select: {
          id: true,
          ownerId: true,
          assignments: {
            select: {
              userId: true,
            },
          },
        },
      });
    });
  });

  describe('getUserTasks', () => {
    it('should get all tasks assigned to user', async () => {
      const mockAssignments = [
        {
          task: {
            id: 'task-1',
            title: 'Task 1',
            assignments: [],
            project: null,
            tags: [],
            comments: [],
            files: [],
          },
        },
      ];

      mockPrisma.taskAssignment.findMany.mockResolvedValue(mockAssignments);

      const result = await repository.getUserTasks('user-1', false);

      expect(result).toHaveLength(1);
      expect(mockPrisma.taskAssignment.findMany).toHaveBeenCalledWith({
        where: {
          userId: 'user-1',
          task: {
            isArchived: false,
          },
        },
        include: expect.any(Object),
        orderBy: expect.any(Object),
      });
    });
  });

  describe('getDepartmentTasks', () => {
    it('should get all tasks in department', async () => {
      mockPrisma.task.findMany.mockResolvedValue([]);

      await repository.getDepartmentTasks('dept-1', false);

      expect(mockPrisma.task.findMany).toHaveBeenCalledWith({
        where: {
          departmentId: 'dept-1',
          isArchived: false,
        },
        include: expect.any(Object),
        orderBy: { dueDate: 'asc' },
      });
    });
  });

  describe('getSubtasks', () => {
    it('should get subtasks with full details', async () => {
      mockPrisma.task.findMany.mockResolvedValue([]);

      await repository.getSubtasks('parent-1');

      expect(mockPrisma.task.findMany).toHaveBeenCalledWith({
        where: {
          parentTaskId: 'parent-1',
          isArchived: false,
        },
        include: expect.any(Object),
        orderBy: { createdAt: 'asc' },
      });
    });
  });

  describe('getOwnerTasks', () => {
    it('should get tasks owned by user', async () => {
      mockPrisma.task.findMany.mockResolvedValue([]);

      await repository.getOwnerTasks('user-1', false);

      // getOwnerTasks calls getAllTasks internally
      expect(mockPrisma.task.findMany).toHaveBeenCalled();
    });
  });

  describe('getProjectTasks', () => {
    it('should get tasks in project', async () => {
      mockPrisma.task.findMany.mockResolvedValue([]);

      await repository.getProjectTasks('project-1', false);

      // getProjectTasks calls getAllTasks internally
      expect(mockPrisma.task.findMany).toHaveBeenCalled();
    });
  });

  describe('deleteTask', () => {
    it('should delete a task (hard delete)', async () => {
      mockPrisma.task.delete.mockResolvedValue({});

      await repository.deleteTask('task-1');

      expect(mockPrisma.task.delete).toHaveBeenCalledWith({
        where: { id: 'task-1' },
      });
    });
  });
});
