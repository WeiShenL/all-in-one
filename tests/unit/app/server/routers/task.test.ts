/**
 * Unit Tests for Task Router
 * Tests tRPC endpoints for task CRUD and query operations
 */

import { taskRouter } from '@/app/server/routers/task';
import { TaskService } from '@/services/task/TaskService';
import { PrismaTaskRepository } from '@/repositories/PrismaTaskRepository';
import { SubtaskService } from '@/app/server/services/SubtaskService';
import { Task, TaskStatus } from '@/domain/task/Task';
import type { PrismaClient } from '@prisma/client';

// Mock dependencies
jest.mock('@/services/task/TaskService');
jest.mock('@/repositories/PrismaTaskRepository');
jest.mock('@/app/server/services/SubtaskService');
jest.mock('@/app/server/services/RealtimeService');
jest.mock('@/app/server/services/DashboardTaskService', () => ({
  DashboardTaskService: jest.fn().mockImplementation(() => ({
    getSubordinateDepartments: jest
      .fn()
      .mockResolvedValue([
        '550e8400-e29b-41d4-a716-446655440005',
        '550e8400-e29b-41d4-a716-446655440006',
      ]),
    getManagerDashboardTasks: jest.fn().mockResolvedValue([]),
    getDepartmentTasksForUser: jest.fn().mockResolvedValue([]),
    getAvailableParentTasks: jest.fn().mockResolvedValue([]),
    getProjectTasksForUser: jest.fn().mockResolvedValue([]),
    getManagerProjectTasks: jest.fn().mockResolvedValue([]),
    getCompanyTasks: jest.fn().mockResolvedValue([]),
  })),
}));
jest.mock('@/app/server/composition/serviceFactory', () => ({
  buildServices: jest.fn(),
}));

const MockTaskService = TaskService as jest.MockedClass<typeof TaskService>;
const MockPrismaTaskRepository = PrismaTaskRepository as jest.MockedClass<
  typeof PrismaTaskRepository
>;
const MockSubtaskService = SubtaskService as jest.MockedClass<
  typeof SubtaskService
>;

describe('Task Router', () => {
  let mockPrisma: jest.Mocked<PrismaClient>;
  let mockTaskService: jest.Mocked<TaskService>;
  let mockSubtaskService: jest.Mocked<SubtaskService>;
  let mockTask: jest.Mocked<Task>;
  let mockBuildServices: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock Prisma client
    mockPrisma = {
      userProfile: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
      },
      task: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      department: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
      },
      project: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
      },
    } as any;

    // Create mock Task domain object
    mockTask = {
      getId: jest.fn().mockReturnValue('550e8400-e29b-41d4-a716-446655440000'),
      getTitle: jest.fn().mockReturnValue('Test Task'),
      getDescription: jest.fn().mockReturnValue('Test Description'),
      getPriorityBucket: jest.fn().mockReturnValue(5),
      getDueDate: jest.fn().mockReturnValue(new Date('2025-12-31')),
      getStatus: jest.fn().mockReturnValue(TaskStatus.TO_DO),
      getOwnerId: jest
        .fn()
        .mockReturnValue('550e8400-e29b-41d4-a716-446655440004'),
      getDepartmentId: jest
        .fn()
        .mockReturnValue('550e8400-e29b-41d4-a716-446655440005'),
      getProjectId: jest.fn().mockReturnValue(null),
      getParentTaskId: jest.fn().mockReturnValue(null),
      isTaskRecurring: jest.fn().mockReturnValue(false),
      getRecurringInterval: jest.fn().mockReturnValue(null),
      getIsArchived: jest.fn().mockReturnValue(false),
      getCreatedAt: jest.fn().mockReturnValue(new Date('2025-01-01')),
      getStartDate: jest.fn().mockReturnValue(null),
      getUpdatedAt: jest.fn().mockReturnValue(new Date('2025-01-01')),
      getAssignees: jest
        .fn()
        .mockReturnValue(
          new Set([
            '550e8400-e29b-41d4-a716-446655440002',
            '550e8400-e29b-41d4-a716-446655440003',
          ])
        ),
      getTags: jest.fn().mockReturnValue(new Set(['tag1', 'tag2'])),
      getComments: jest.fn().mockReturnValue([
        {
          id: '550e8400-e29b-41d4-a716-44665544000e',
          content: 'Test comment',
          authorId: '550e8400-e29b-41d4-a716-446655440002',
          createdAt: new Date('2025-01-02'),
          updatedAt: new Date('2025-01-02'),
        },
      ]),
    } as any;

    // Mock service instances
    mockTaskService = {
      createTask: jest
        .fn()
        .mockResolvedValue({ id: '550e8400-e29b-41d4-a716-446655440000' }),
      updateTaskTitle: jest.fn().mockResolvedValue(mockTask),
      updateTaskDescription: jest.fn().mockResolvedValue(mockTask),
      updateTaskPriority: jest.fn().mockResolvedValue(mockTask),
      updateTaskDeadline: jest.fn().mockResolvedValue(mockTask),
      updateTaskStatus: jest.fn().mockResolvedValue(mockTask),
      updateTaskRecurring: jest.fn().mockResolvedValue(mockTask),
      addTagToTask: jest.fn().mockResolvedValue(mockTask),
      removeTagFromTask: jest.fn().mockResolvedValue(mockTask),
      addAssigneeToTask: jest.fn().mockResolvedValue(mockTask),
      removeAssigneeFromTask: jest.fn().mockResolvedValue(mockTask),
      addCommentToTask: jest.fn().mockResolvedValue(mockTask),
      updateComment: jest.fn().mockResolvedValue(mockTask),
      assignTaskToProject: jest.fn().mockResolvedValue(mockTask),
      archiveTask: jest.fn().mockResolvedValue(mockTask),
      unarchiveTask: jest.fn().mockResolvedValue(mockTask),
      deleteTask: jest.fn().mockResolvedValue(undefined),
      getTaskById: jest.fn().mockResolvedValue(mockTask),
      getAllTasks: jest.fn().mockResolvedValue([mockTask]),
      getProjectTasks: jest.fn().mockResolvedValue([mockTask]),
      getSubtasks: jest.fn().mockResolvedValue([mockTask]),
      getOwnerTasks: jest.fn().mockResolvedValue([mockTask]),
      getUserTasks: jest.fn().mockResolvedValue([mockTask]),
      getDepartmentTasks: jest.fn().mockResolvedValue([mockTask]),
      uploadFileToTask: jest.fn().mockResolvedValue({
        id: '550e8400-e29b-41d4-a716-44665544000b',
        fileName: 'test.pdf',
        fileSize: 1024,
        fileType: 'application/pdf',
        uploadedAt: new Date(),
        uploadedById: '550e8400-e29b-41d4-a716-446655440002',
        filePath: 'path/to/file',
      }),
      getFileDownloadUrl: jest
        .fn()
        .mockResolvedValue('https://example.com/file'),
      deleteFile: jest.fn().mockResolvedValue(undefined),
      getTaskFiles: jest.fn().mockResolvedValue([]),
      getTaskHierarchy: jest.fn().mockResolvedValue({
        parentChain: [],
        subtasks: [],
      }),
      createCalendarEvent: jest.fn().mockResolvedValue({
        id: '550e8400-e29b-41d4-a716-44665544000d',
        taskId: '550e8400-e29b-41d4-a716-446655440000',
        userId: '550e8400-e29b-41d4-a716-446655440002',
        title: 'Event',
        eventDate: new Date(),
      }),
      getCalendarEvents: jest.fn().mockResolvedValue([]),
      getTaskLogs: jest.fn().mockResolvedValue([]),
    } as any;

    mockSubtaskService = {
      createSubtask: jest
        .fn()
        .mockResolvedValue({ id: '550e8400-e29b-41d4-a716-44665544000a' }),
    } as any;

    // Mock buildServices
    mockBuildServices = jest.fn().mockReturnValue({
      taskService: mockTaskService,
      subtaskService: mockSubtaskService,
      getDashboardTaskService: jest.fn().mockReturnValue({
        getSubordinateDepartments: jest
          .fn()
          .mockResolvedValue([
            '550e8400-e29b-41d4-a716-446655440005',
            '550e8400-e29b-41d4-a716-446655440006',
          ]),
        getManagerDashboardTasks: jest.fn().mockResolvedValue([]),
        getDepartmentTasksForUser: jest.fn().mockResolvedValue([]),
        getAvailableParentTasks: jest.fn().mockResolvedValue([]),
        getProjectTasksForUser: jest.fn().mockResolvedValue([]),
        getManagerProjectTasks: jest.fn().mockResolvedValue([]),
        getCompanyTasks: jest.fn().mockResolvedValue([]),
      }),
      projectService: {
        getVisibleProjectsForUser: jest.fn().mockResolvedValue([]),
      },
    });

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const serviceFactory = require('@/app/server/composition/serviceFactory');
    serviceFactory.buildServices = mockBuildServices;

    MockPrismaTaskRepository.mockImplementation(
      () =>
        ({
          getUserTasks: jest.fn().mockResolvedValue([
            {
              id: '550e8400-e29b-41d4-a716-446655440000',
              title: 'Test Task',
              description: 'Test Description',
              priorityBucket: 5,
              dueDate: new Date('2025-12-31'),
              status: 'TO_DO',
              ownerId: '550e8400-e29b-41d4-a716-446655440004',
              departmentId: '550e8400-e29b-41d4-a716-446655440005',
              projectId: null,
              parentTaskId: null,
              isTaskRecurring: false,
              recurringInterval: null,
              isArchived: false,
              createdAt: new Date('2025-01-01'),
              startDate: null,
              updatedAt: new Date('2025-01-01'),
              assignments: [
                {
                  userId: '550e8400-e29b-41d4-a716-446655440002',
                  user: {
                    id: '550e8400-e29b-41d4-a716-446655440002',
                    name: 'Test User',
                    email: 'test@example.com',
                    departmentId: '550e8400-e29b-41d4-a716-446655440005',
                  },
                },
              ],
              owner: {
                id: '550e8400-e29b-41d4-a716-446655440004',
                name: 'Owner User',
                email: 'owner@example.com',
                departmentId: '550e8400-e29b-41d4-a716-446655440005',
              },
              department: {
                id: '550e8400-e29b-41d4-a716-446655440005',
                name: 'Test Department',
              },
              project: null,
              tags: [],
              comments: [],
            },
          ]),
        }) as any
    );
    MockTaskService.mockImplementation(() => mockTaskService);
    MockSubtaskService.mockImplementation(() => mockSubtaskService);
  });

  // ============================================
  // HELPER FUNCTIONS
  // ============================================

  describe('getUserContext helper', () => {
    it('should throw error when user is not authenticated', async () => {
      const caller = taskRouter.createCaller({
        prisma: mockPrisma,
        userId: undefined,
      });

      await expect(
        caller.updateTitle({
          taskId: '550e8400-e29b-41d4-a716-446655440000',
          title: 'New Title',
        })
      ).rejects.toThrow('User not authenticated');
    });

    it('should throw error when user profile not found', async () => {
      (mockPrisma.userProfile.findUnique as jest.Mock).mockResolvedValue(null);

      const caller = taskRouter.createCaller({
        prisma: mockPrisma,
        userId: '550e8400-e29b-41d4-a716-446655440001',
      });

      await expect(
        caller.updateTitle({
          taskId: '550e8400-e29b-41d4-a716-446655440000',
          title: 'New Title',
        })
      ).rejects.toThrow('User profile not found');
    });

    it('should return valid user context when authenticated', async () => {
      (mockPrisma.userProfile.findUnique as jest.Mock).mockResolvedValue({
        id: '550e8400-e29b-41d4-a716-446655440001',
        departmentId: '550e8400-e29b-41d4-a716-446655440005',
        role: 'STAFF',
        isHrAdmin: false,
      });

      const caller = taskRouter.createCaller({
        prisma: mockPrisma,
        userId: '550e8400-e29b-41d4-a716-446655440001',
      });

      await caller.updateTitle({
        taskId: '550e8400-e29b-41d4-a716-446655440000',
        title: 'New Title',
      });

      expect(mockPrisma.userProfile.findUnique).toHaveBeenCalledWith({
        where: { id: '550e8400-e29b-41d4-a716-446655440001' },
      });
    });
  });

  describe('serializeTask helper', () => {
    beforeEach(() => {
      (mockPrisma.userProfile.findUnique as jest.Mock).mockResolvedValue({
        id: '550e8400-e29b-41d4-a716-446655440001',
        departmentId: '550e8400-e29b-41d4-a716-446655440005',
        role: 'STAFF',
        isHrAdmin: false,
      });
    });

    it('should serialize task with all properties', async () => {
      const caller = taskRouter.createCaller({
        prisma: mockPrisma,
        userId: '550e8400-e29b-41d4-a716-446655440001',
      });

      const result = await caller.updateTitle({
        taskId: '550e8400-e29b-41d4-a716-446655440000',
        title: 'New Title',
      });

      expect(result).toMatchObject({
        id: '550e8400-e29b-41d4-a716-446655440000',
        title: 'Test Task',
        description: 'Test Description',
        priorityBucket: 5,
        status: TaskStatus.TO_DO,
        ownerId: '550e8400-e29b-41d4-a716-446655440004',
        departmentId: '550e8400-e29b-41d4-a716-446655440005',
        isArchived: false,
      });
      expect(result.dueDate).toBeDefined();
      expect(result.createdAt).toBeDefined();
      expect(result.updatedAt).toBeDefined();
    });

    it('should serialize task assignments as array', async () => {
      const caller = taskRouter.createCaller({
        prisma: mockPrisma,
        userId: '550e8400-e29b-41d4-a716-446655440001',
      });

      const result = await caller.updateTitle({
        taskId: '550e8400-e29b-41d4-a716-446655440000',
        title: 'New Title',
      });

      expect(Array.isArray(result.assignments)).toBe(true);
      expect(result.assignments).toContain(
        '550e8400-e29b-41d4-a716-446655440002'
      );
      expect(result.assignments).toContain(
        '550e8400-e29b-41d4-a716-446655440003'
      );
    });

    it('should serialize task tags as array', async () => {
      const caller = taskRouter.createCaller({
        prisma: mockPrisma,
        userId: '550e8400-e29b-41d4-a716-446655440001',
      });

      const result = await caller.updateTitle({
        taskId: '550e8400-e29b-41d4-a716-446655440000',
        title: 'New Title',
      });

      expect(Array.isArray(result.tags)).toBe(true);
      expect(result.tags).toContain('tag1');
      expect(result.tags).toContain('tag2');
    });

    it('should serialize task comments with correct format', async () => {
      const caller = taskRouter.createCaller({
        prisma: mockPrisma,
        userId: '550e8400-e29b-41d4-a716-446655440001',
      });

      const result = await caller.updateTitle({
        taskId: '550e8400-e29b-41d4-a716-446655440000',
        title: 'New Title',
      });

      expect(Array.isArray(result.comments)).toBe(true);
      expect(result.comments[0]).toMatchObject({
        id: '550e8400-e29b-41d4-a716-44665544000e',
        content: 'Test comment',
        authorId: '550e8400-e29b-41d4-a716-446655440002',
      });
      expect(typeof result.comments[0].createdAt).toBe('string');
      expect(typeof result.comments[0].updatedAt).toBe('string');
    });

    it('should handle null optional fields', async () => {
      mockTask.getProjectId.mockReturnValue(null);
      mockTask.getParentTaskId.mockReturnValue(null);
      mockTask.getStartDate.mockReturnValue(null);

      const caller = taskRouter.createCaller({
        prisma: mockPrisma,
        userId: '550e8400-e29b-41d4-a716-446655440001',
      });

      const result = await caller.updateTitle({
        taskId: '550e8400-e29b-41d4-a716-446655440000',
        title: 'New Title',
      });

      expect(result.projectId).toBeNull();
      expect(result.parentTaskId).toBeNull();
      expect(result.startDate).toBeNull();
    });
  });

  // ============================================
  // CREATE OPERATIONS
  // ============================================

  describe('create mutation', () => {
    beforeEach(() => {
      (mockPrisma.userProfile.findUnique as jest.Mock).mockResolvedValue({
        id: '550e8400-e29b-41d4-a716-446655440001',
        departmentId: '550e8400-e29b-41d4-a716-446655440005',
        role: 'STAFF',
        isHrAdmin: false,
      });
    });

    it('should create task with required fields', async () => {
      const caller = taskRouter.createCaller({
        prisma: mockPrisma,
        userId: '550e8400-e29b-41d4-a716-446655440001',
      });

      const result = await caller.create({
        title: 'New Task',
        description: 'Task description',
        priority: 5,
        dueDate: new Date('2025-12-31'),
        assigneeIds: [
          '550e8400-e29b-41d4-a716-446655440002',
          '550e8400-e29b-41d4-a716-446655440003',
        ],
      });

      expect(result.id).toBe('550e8400-e29b-41d4-a716-446655440000');
      expect(mockTaskService.createTask).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'New Task',
          description: 'Task description',
          priority: 5,
          assigneeIds: [
            '550e8400-e29b-41d4-a716-446655440002',
            '550e8400-e29b-41d4-a716-446655440003',
          ],
        }),
        expect.objectContaining({
          userId: '550e8400-e29b-41d4-a716-446655440001',
          role: 'STAFF',
          departmentId: '550e8400-e29b-41d4-a716-446655440005',
        })
      );
    });

    it('should create task with optional fields', async () => {
      const caller = taskRouter.createCaller({
        prisma: mockPrisma,
        userId: '550e8400-e29b-41d4-a716-446655440001',
      });

      await caller.create({
        title: 'New Task',
        description: 'Task description',
        priority: 8,
        dueDate: new Date('2025-12-31'),
        assigneeIds: ['550e8400-e29b-41d4-a716-446655440002'],
        projectId: '550e8400-e29b-41d4-a716-446655440007',
        tags: ['urgent', 'frontend'],
        recurringInterval: 7,
      });

      expect(mockTaskService.createTask).toHaveBeenCalledWith(
        expect.objectContaining({
          projectId: '550e8400-e29b-41d4-a716-446655440007',
          tags: ['urgent', 'frontend'],
          recurringInterval: 7,
        }),
        expect.any(Object)
      );
    });

    it('should create task with parent task', async () => {
      const caller = taskRouter.createCaller({
        prisma: mockPrisma,
        userId: '550e8400-e29b-41d4-a716-446655440001',
      });

      await caller.create({
        title: 'Subtask',
        description: 'Subtask description',
        priority: 3,
        dueDate: new Date('2025-11-30'),
        assigneeIds: ['550e8400-e29b-41d4-a716-446655440002'],
        parentTaskId: '550e8400-e29b-41d4-a716-446655440009',
      });

      expect(mockTaskService.createTask).toHaveBeenCalledWith(
        expect.objectContaining({
          parentTaskId: '550e8400-e29b-41d4-a716-446655440009',
        }),
        expect.any(Object)
      );
    });

    it('should validate title is required', async () => {
      const caller = taskRouter.createCaller({
        prisma: mockPrisma,
        userId: '550e8400-e29b-41d4-a716-446655440001',
      });

      await expect(
        caller.create({
          title: '',
          description: 'Description',
          priority: 5,
          dueDate: new Date('2025-12-31'),
          assigneeIds: ['550e8400-e29b-41d4-a716-446655440002'],
        })
      ).rejects.toThrow();
    });

    it('should validate description is required', async () => {
      const caller = taskRouter.createCaller({
        prisma: mockPrisma,
        userId: '550e8400-e29b-41d4-a716-446655440001',
      });

      await expect(
        caller.create({
          title: 'Title',
          description: '',
          priority: 5,
          dueDate: new Date('2025-12-31'),
          assigneeIds: ['550e8400-e29b-41d4-a716-446655440002'],
        })
      ).rejects.toThrow();
    });

    it('should validate priority range (1-10)', async () => {
      const caller = taskRouter.createCaller({
        prisma: mockPrisma,
        userId: '550e8400-e29b-41d4-a716-446655440001',
      });

      await expect(
        caller.create({
          title: 'Title',
          description: 'Description',
          priority: 0,
          dueDate: new Date('2025-12-31'),
          assigneeIds: ['550e8400-e29b-41d4-a716-446655440002'],
        })
      ).rejects.toThrow();

      await expect(
        caller.create({
          title: 'Title',
          description: 'Description',
          priority: 11,
          dueDate: new Date('2025-12-31'),
          assigneeIds: ['550e8400-e29b-41d4-a716-446655440002'],
        })
      ).rejects.toThrow();
    });

    it('should validate assignee count (1-5)', async () => {
      const caller = taskRouter.createCaller({
        prisma: mockPrisma,
        userId: '550e8400-e29b-41d4-a716-446655440001',
      });

      // Empty assignees
      await expect(
        caller.create({
          title: 'Title',
          description: 'Description',
          priority: 5,
          dueDate: new Date('2025-12-31'),
          assigneeIds: [],
        })
      ).rejects.toThrow();

      // Too many assignees (>5)
      await expect(
        caller.create({
          title: 'Title',
          description: 'Description',
          priority: 5,
          dueDate: new Date('2025-12-31'),
          assigneeIds: [
            '550e8400-e29b-41d4-a716-446655440013',
            '550e8400-e29b-41d4-a716-446655440014',
            '550e8400-e29b-41d4-a716-446655440015',
            '550e8400-e29b-41d4-a716-446655440016',
            '550e8400-e29b-41d4-a716-446655440017',
            '550e8400-e29b-41d4-a716-446655440018',
          ],
        })
      ).rejects.toThrow();
    });
  });

  describe('createSubtask mutation', () => {
    beforeEach(() => {
      (mockPrisma.userProfile.findUnique as jest.Mock).mockResolvedValue({
        id: '550e8400-e29b-41d4-a716-446655440001',
        departmentId: '550e8400-e29b-41d4-a716-446655440005',
        role: 'STAFF',
        isHrAdmin: false,
      });
    });

    it('should create subtask with required fields', async () => {
      const caller = taskRouter.createCaller({
        prisma: mockPrisma,
        userId: '550e8400-e29b-41d4-a716-446655440001',
      });

      const result = await caller.createSubtask({
        title: 'Subtask',
        description: 'Subtask description',
        priority: 6,
        dueDate: new Date('2025-11-30'),
        assigneeIds: ['550e8400-e29b-41d4-a716-446655440002'],
        parentTaskId: '550e8400-e29b-41d4-a716-446655440008',
      });

      expect(result.id).toBe('550e8400-e29b-41d4-a716-44665544000a');
      expect(mockSubtaskService.createSubtask).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Subtask',
          description: 'Subtask description',
          priority: 6,
          parentTaskId: '550e8400-e29b-41d4-a716-446655440008',
        }),
        expect.objectContaining({
          userId: '550e8400-e29b-41d4-a716-446655440001',
          role: 'STAFF',
        })
      );
    });

    it('should create subtask with tags', async () => {
      const caller = taskRouter.createCaller({
        prisma: mockPrisma,
        userId: '550e8400-e29b-41d4-a716-446655440001',
      });

      await caller.createSubtask({
        title: 'Subtask',
        description: 'Description',
        priority: 4,
        dueDate: new Date('2025-11-30'),
        assigneeIds: ['550e8400-e29b-41d4-a716-446655440002'],
        parentTaskId: '550e8400-e29b-41d4-a716-446655440008',
        tags: ['bug', 'critical'],
      });

      expect(mockSubtaskService.createSubtask).toHaveBeenCalledWith(
        expect.objectContaining({
          tags: ['bug', 'critical'],
        }),
        expect.any(Object)
      );
    });

    it('should validate parent task ID is required', async () => {
      const caller = taskRouter.createCaller({
        prisma: mockPrisma,
        userId: '550e8400-e29b-41d4-a716-446655440001',
      });

      await expect(
        caller.createSubtask({
          title: 'Subtask',
          description: 'Description',
          priority: 5,
          dueDate: new Date('2025-11-30'),
          assigneeIds: ['550e8400-e29b-41d4-a716-446655440002'],
          parentTaskId: '',
        } as any)
      ).rejects.toThrow();
    });
  });

  // ============================================
  // UPDATE OPERATIONS
  // ============================================

  describe('removeAssignee mutation', () => {
    beforeEach(() => {
      (mockPrisma.userProfile.findUnique as jest.Mock).mockResolvedValue({
        id: '550e8400-e29b-41d4-a716-446655440001',
        departmentId: '550e8400-e29b-41d4-a716-446655440005',
        role: 'MANAGER',
        isHrAdmin: false,
      });
    });

    it('should remove assignee from task', async () => {
      const caller = taskRouter.createCaller({
        prisma: mockPrisma,
        userId: '550e8400-e29b-41d4-a716-446655440001',
      });

      const result = await caller.removeAssignee({
        taskId: '550e8400-e29b-41d4-a716-446655440000',
        userId: '550e8400-e29b-41d4-a716-446655440003',
      });

      expect(result.id).toBe('550e8400-e29b-41d4-a716-446655440000');
      expect(mockTaskService.removeAssigneeFromTask).toHaveBeenCalledWith(
        '550e8400-e29b-41d4-a716-446655440000',
        '550e8400-e29b-41d4-a716-446655440003',
        expect.objectContaining({
          userId: '550e8400-e29b-41d4-a716-446655440001',
          role: 'MANAGER',
        })
      );
    });
  });

  describe('assignProject mutation', () => {
    beforeEach(() => {
      (mockPrisma.userProfile.findUnique as jest.Mock).mockResolvedValue({
        id: '550e8400-e29b-41d4-a716-446655440001',
        departmentId: '550e8400-e29b-41d4-a716-446655440005',
        role: 'MANAGER',
        isHrAdmin: false,
      });
    });

    it('should assign project to task', async () => {
      const caller = taskRouter.createCaller({
        prisma: mockPrisma,
        userId: '550e8400-e29b-41d4-a716-446655440001',
      });

      const result = await caller.assignProject({
        taskId: '550e8400-e29b-41d4-a716-446655440000',
        projectId: '550e8400-e29b-41d4-a716-446655440007',
      });

      // Result is a task when projectId is provided
      if ('id' in result) {
        expect(result.id).toBe('550e8400-e29b-41d4-a716-446655440000');
      }
      expect(mockTaskService.assignTaskToProject).toHaveBeenCalledWith(
        '550e8400-e29b-41d4-a716-446655440000',
        '550e8400-e29b-41d4-a716-446655440007',
        expect.objectContaining({
          userId: '550e8400-e29b-41d4-a716-446655440001',
          role: 'MANAGER',
        })
      );
    });

    it('should handle unassign project (projectId = null)', async () => {
      const caller = taskRouter.createCaller({
        prisma: mockPrisma,
        userId: '550e8400-e29b-41d4-a716-446655440001',
      });

      const result = await caller.assignProject({
        taskId: '550e8400-e29b-41d4-a716-446655440000',
        projectId: null,
      });

      // Result is a success message when projectId is null
      if ('success' in result) {
        expect(result.success).toBe(true);
        expect(result.message).toBe('Project removed from task');
      }
      expect(mockPrisma.task.update).toHaveBeenCalledWith({
        where: { id: '550e8400-e29b-41d4-a716-446655440000' },
        data: { projectId: null },
      });
    });
  });

  // ============================================
  // ARCHIVE/DELETE OPERATIONS
  // ============================================

  describe('archive mutation', () => {
    beforeEach(() => {
      (mockPrisma.userProfile.findUnique as jest.Mock).mockResolvedValue({
        id: '550e8400-e29b-41d4-a716-446655440001',
        departmentId: '550e8400-e29b-41d4-a716-446655440005',
        role: 'MANAGER',
        isHrAdmin: false,
      });
    });

    it('should archive task successfully', async () => {
      const caller = taskRouter.createCaller({
        prisma: mockPrisma,
        userId: '550e8400-e29b-41d4-a716-446655440001',
      });

      const result = await caller.archive({
        taskId: '550e8400-e29b-41d4-a716-446655440000',
      });

      expect(result.id).toBe('550e8400-e29b-41d4-a716-446655440000');
      expect(mockTaskService.archiveTask).toHaveBeenCalledWith(
        '550e8400-e29b-41d4-a716-446655440000',
        expect.objectContaining({
          userId: '550e8400-e29b-41d4-a716-446655440001',
          role: 'MANAGER',
        })
      );
    });
  });

  describe('unarchive mutation', () => {
    beforeEach(() => {
      (mockPrisma.userProfile.findUnique as jest.Mock).mockResolvedValue({
        id: '550e8400-e29b-41d4-a716-446655440001',
        departmentId: '550e8400-e29b-41d4-a716-446655440005',
        role: 'MANAGER',
        isHrAdmin: false,
      });
    });

    it('should unarchive task successfully', async () => {
      const caller = taskRouter.createCaller({
        prisma: mockPrisma,
        userId: '550e8400-e29b-41d4-a716-446655440001',
      });

      const result = await caller.unarchive({
        taskId: '550e8400-e29b-41d4-a716-446655440000',
      });

      expect(result.id).toBe('550e8400-e29b-41d4-a716-446655440000');
      expect(mockTaskService.unarchiveTask).toHaveBeenCalledWith(
        '550e8400-e29b-41d4-a716-446655440000',
        expect.objectContaining({
          userId: '550e8400-e29b-41d4-a716-446655440001',
          role: 'MANAGER',
        })
      );
    });
  });

  describe('delete mutation', () => {
    beforeEach(() => {
      (mockPrisma.userProfile.findUnique as jest.Mock).mockResolvedValue({
        id: '550e8400-e29b-41d4-a716-446655440001',
        departmentId: '550e8400-e29b-41d4-a716-446655440005',
        role: 'HR_ADMIN',
        isHrAdmin: true,
      });
    });

    it('should delete task successfully', async () => {
      const caller = taskRouter.createCaller({
        prisma: mockPrisma,
        userId: '550e8400-e29b-41d4-a716-446655440001',
      });

      const result = await caller.delete({
        taskId: '550e8400-e29b-41d4-a716-446655440000',
      });

      expect(result.success).toBe(true);
      expect(mockTaskService.deleteTask).toHaveBeenCalledWith(
        '550e8400-e29b-41d4-a716-446655440000',
        expect.objectContaining({
          userId: '550e8400-e29b-41d4-a716-446655440001',
          role: 'HR_ADMIN',
        })
      );
    });
  });

  // ============================================
  // QUERY OPERATIONS
  // ============================================

  describe('getById query', () => {
    beforeEach(() => {
      (mockPrisma.userProfile.findUnique as jest.Mock).mockResolvedValue({
        id: '550e8400-e29b-41d4-a716-446655440001',
        departmentId: '550e8400-e29b-41d4-a716-446655440005',
        role: 'STAFF',
        isHrAdmin: false,
      });

      (mockPrisma.userProfile.findMany as jest.Mock).mockResolvedValue([
        {
          id: '550e8400-e29b-41d4-a716-446655440002',
          name: 'User One',
          email: 'user1@example.com',
          departmentId: '550e8400-e29b-41d4-a716-446655440005',
          department: {
            id: '550e8400-e29b-41d4-a716-446655440005',
            name: 'Engineering',
          },
        },
        {
          id: '550e8400-e29b-41d4-a716-446655440003',
          name: 'User Two',
          email: 'user2@example.com',
          departmentId: '550e8400-e29b-41d4-a716-446655440006',
          department: {
            id: '550e8400-e29b-41d4-a716-446655440006',
            name: 'Design',
          },
        },
      ]);

      (mockPrisma.department.findUnique as jest.Mock).mockResolvedValue({
        id: '550e8400-e29b-41d4-a716-446655440005',
        name: 'Engineering',
      });

      (mockPrisma.task.findUnique as jest.Mock).mockResolvedValue(null);

      // Mock AuthorizationService
      jest.mock('@/app/server/services/AuthorizationService', () => ({
        AuthorizationService: jest.fn().mockImplementation(() => ({
          canEditTask: jest.fn().mockReturnValue(true),
        })),
      }));
    });

    it('should return task with all details', async () => {
      const caller = taskRouter.createCaller({
        prisma: mockPrisma,
        userId: '550e8400-e29b-41d4-a716-446655440001',
      });

      const result = await caller.getById({
        taskId: '550e8400-e29b-41d4-a716-446655440000',
      });

      expect(result).toBeDefined();
      expect(result?.id).toBe('550e8400-e29b-41d4-a716-446655440000');
      expect(result?.canEdit).toBe(true);
      expect(mockTaskService.getTaskById).toHaveBeenCalledWith(
        '550e8400-e29b-41d4-a716-446655440000',
        expect.objectContaining({
          userId: '550e8400-e29b-41d4-a716-446655440001',
        })
      );
    });

    it('should return null for non-existent task', async () => {
      mockTaskService.getTaskById.mockResolvedValue(null);

      const caller = taskRouter.createCaller({
        prisma: mockPrisma,
        userId: '550e8400-e29b-41d4-a716-446655440001',
      });

      const result = await caller.getById({
        taskId: '550e8400-e29b-41d4-a716-446655440012',
      });

      expect(result).toBeNull();
    });

    it('should include involvedDepartments', async () => {
      const caller = taskRouter.createCaller({
        prisma: mockPrisma,
        userId: '550e8400-e29b-41d4-a716-446655440001',
      });

      const result = await caller.getById({
        taskId: '550e8400-e29b-41d4-a716-446655440000',
      });

      expect(result?.involvedDepartments).toBeDefined();
      expect(Array.isArray(result?.involvedDepartments)).toBe(true);
    });

    it('should include assignee details', async () => {
      const caller = taskRouter.createCaller({
        prisma: mockPrisma,
        userId: '550e8400-e29b-41d4-a716-446655440001',
      });

      const result = await caller.getById({
        taskId: '550e8400-e29b-41d4-a716-446655440000',
      });

      expect(result?.assignments).toBeDefined();
      expect(Array.isArray(result?.assignments)).toBe(true);
    });
  });

  describe('getTaskEditingData query', () => {
    beforeEach(() => {
      (mockPrisma.userProfile.findUnique as jest.Mock).mockResolvedValue({
        id: '550e8400-e29b-41d4-a716-446655440001',
        departmentId: '550e8400-e29b-41d4-a716-446655440005',
        role: 'STAFF',
        isHrAdmin: false,
      });

      (mockPrisma.userProfile.findMany as jest.Mock).mockResolvedValue([
        {
          id: '550e8400-e29b-41d4-a716-446655440002',
          name: 'User One',
          email: 'user1@example.com',
          role: 'STAFF',
          isHrAdmin: false,
          departmentId: '550e8400-e29b-41d4-a716-446655440005',
          department: {
            id: '550e8400-e29b-41d4-a716-446655440005',
            name: 'Engineering',
          },
        },
      ]);

      (mockPrisma.department.findUnique as jest.Mock).mockResolvedValue({
        id: '550e8400-e29b-41d4-a716-446655440005',
        name: 'Engineering',
      });

      (mockPrisma.task.findUnique as jest.Mock).mockResolvedValue(null);

      mockTaskService.getTaskFiles.mockResolvedValue([
        {
          id: '550e8400-e29b-41d4-a716-44665544000b',
          fileName: 'doc.pdf',
          fileSize: 1024,
          fileType: 'application/pdf',
          uploadedById: '550e8400-e29b-41d4-a716-446655440002',
          uploadedAt: new Date(),
        },
      ] as any);

      mockTaskService.getTaskLogs.mockResolvedValue([
        {
          id: '550e8400-e29b-41d4-a716-44665544000f',
          action: 'CREATED',
          userId: '550e8400-e29b-41d4-a716-446655440002',
          createdAt: new Date(),
        },
      ] as any);
    });

    it('should return complete editing data', async () => {
      const caller = taskRouter.createCaller({
        prisma: mockPrisma,
        userId: '550e8400-e29b-41d4-a716-446655440001',
      });

      const result = await caller.getTaskEditingData({
        taskId: '550e8400-e29b-41d4-a716-446655440000',
      });

      expect(result).toBeDefined();
      expect(result?.task).toBeDefined();
      expect(result?.files).toBeDefined();
      expect(result?.logs).toBeDefined();
      expect(result?.departmentUsers).toBeDefined();
      expect(result?.allUsers).toBeDefined();
      expect(result?.projects).toBeDefined();
      expect(result?.hierarchy).toBeDefined();
    });

    it('should return null for non-existent task', async () => {
      mockTaskService.getTaskById.mockResolvedValue(null);

      const caller = taskRouter.createCaller({
        prisma: mockPrisma,
        userId: '550e8400-e29b-41d4-a716-446655440001',
      });

      const result = await caller.getTaskEditingData({
        taskId: '550e8400-e29b-41d4-a716-446655440012',
      });

      expect(result).toBeNull();
    });

    it('should include files metadata', async () => {
      const caller = taskRouter.createCaller({
        prisma: mockPrisma,
        userId: '550e8400-e29b-41d4-a716-446655440001',
      });

      const result = await caller.getTaskEditingData({
        taskId: '550e8400-e29b-41d4-a716-446655440000',
      });

      expect(result?.files.files).toHaveLength(1);
      expect(result?.files.totalSize).toBe(1024);
      expect(result?.files.count).toBe(1);
    });
  });

  describe('getAll query', () => {
    beforeEach(() => {
      (mockPrisma.userProfile.findUnique as jest.Mock).mockResolvedValue({
        id: '550e8400-e29b-41d4-a716-446655440001',
        departmentId: '550e8400-e29b-41d4-a716-446655440005',
        role: 'STAFF',
        isHrAdmin: false,
      });
    });

    it('should get all tasks without filters', async () => {
      const caller = taskRouter.createCaller({
        prisma: mockPrisma,
        userId: '550e8400-e29b-41d4-a716-446655440001',
      });

      const result = await caller.getAll({});

      expect(Array.isArray(result)).toBe(true);
      expect(mockTaskService.getAllTasks).toHaveBeenCalledWith(
        {},
        expect.objectContaining({
          userId: '550e8400-e29b-41d4-a716-446655440001',
        })
      );
    });

    it('should filter by project ID', async () => {
      const caller = taskRouter.createCaller({
        prisma: mockPrisma,
        userId: '550e8400-e29b-41d4-a716-446655440001',
      });

      await caller.getAll({
        projectId: '550e8400-e29b-41d4-a716-446655440007',
      });

      expect(mockTaskService.getAllTasks).toHaveBeenCalledWith(
        expect.objectContaining({
          projectId: '550e8400-e29b-41d4-a716-446655440007',
        }),
        expect.any(Object)
      );
    });

    it('should filter by status', async () => {
      const caller = taskRouter.createCaller({
        prisma: mockPrisma,
        userId: '550e8400-e29b-41d4-a716-446655440001',
      });

      await caller.getAll({ status: 'IN_PROGRESS' });

      expect(mockTaskService.getAllTasks).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'IN_PROGRESS',
        }),
        expect.any(Object)
      );
    });

    it('should filter by archived status', async () => {
      const caller = taskRouter.createCaller({
        prisma: mockPrisma,
        userId: '550e8400-e29b-41d4-a716-446655440001',
      });

      await caller.getAll({ isArchived: true });

      expect(mockTaskService.getAllTasks).toHaveBeenCalledWith(
        expect.objectContaining({
          isArchived: true,
        }),
        expect.any(Object)
      );
    });
  });

  describe('getByProject query', () => {
    beforeEach(() => {
      (mockPrisma.userProfile.findUnique as jest.Mock).mockResolvedValue({
        id: '550e8400-e29b-41d4-a716-446655440001',
        departmentId: '550e8400-e29b-41d4-a716-446655440005',
        role: 'STAFF',
        isHrAdmin: false,
      });
    });

    it('should get tasks by project', async () => {
      const caller = taskRouter.createCaller({
        prisma: mockPrisma,
        userId: '550e8400-e29b-41d4-a716-446655440001',
      });

      const result = await caller.getByProject({
        projectId: '550e8400-e29b-41d4-a716-446655440007',
      });

      expect(Array.isArray(result)).toBe(true);
      expect(mockTaskService.getProjectTasks).toHaveBeenCalledWith(
        '550e8400-e29b-41d4-a716-446655440007',
        expect.objectContaining({
          userId: '550e8400-e29b-41d4-a716-446655440001',
        }),
        false
      );
    });

    it('should include archived tasks when requested', async () => {
      const caller = taskRouter.createCaller({
        prisma: mockPrisma,
        userId: '550e8400-e29b-41d4-a716-446655440001',
      });

      await caller.getByProject({
        projectId: '550e8400-e29b-41d4-a716-446655440007',
        includeArchived: true,
      });

      expect(mockTaskService.getProjectTasks).toHaveBeenCalledWith(
        '550e8400-e29b-41d4-a716-446655440007',
        expect.any(Object),
        true
      );
    });
  });

  describe('getSubtasks query', () => {
    beforeEach(() => {
      (mockPrisma.userProfile.findUnique as jest.Mock).mockResolvedValue({
        id: '550e8400-e29b-41d4-a716-446655440001',
        departmentId: '550e8400-e29b-41d4-a716-446655440005',
        role: 'STAFF',
        isHrAdmin: false,
      });
    });

    it('should get subtasks of parent task', async () => {
      const caller = taskRouter.createCaller({
        prisma: mockPrisma,
        userId: '550e8400-e29b-41d4-a716-446655440001',
      });

      const result = await caller.getSubtasks({
        parentTaskId: '550e8400-e29b-41d4-a716-446655440008',
      });

      expect(Array.isArray(result)).toBe(true);
      expect(mockTaskService.getSubtasks).toHaveBeenCalledWith(
        '550e8400-e29b-41d4-a716-446655440008',
        expect.objectContaining({
          userId: '550e8400-e29b-41d4-a716-446655440001',
        })
      );
    });
  });

  describe('getByOwner query', () => {
    beforeEach(() => {
      (mockPrisma.userProfile.findUnique as jest.Mock).mockResolvedValue({
        id: '550e8400-e29b-41d4-a716-446655440001',
        departmentId: '550e8400-e29b-41d4-a716-446655440005',
        role: 'STAFF',
        isHrAdmin: false,
      });
    });

    it('should get tasks by owner', async () => {
      const caller = taskRouter.createCaller({
        prisma: mockPrisma,
        userId: '550e8400-e29b-41d4-a716-446655440001',
      });

      const result = await caller.getByOwner({
        ownerId: '550e8400-e29b-41d4-a716-446655440004',
      });

      expect(Array.isArray(result)).toBe(true);
      expect(mockTaskService.getOwnerTasks).toHaveBeenCalledWith(
        '550e8400-e29b-41d4-a716-446655440004',
        false
      );
    });

    it('should include archived tasks when requested', async () => {
      const caller = taskRouter.createCaller({
        prisma: mockPrisma,
        userId: '550e8400-e29b-41d4-a716-446655440001',
      });

      await caller.getByOwner({
        ownerId: '550e8400-e29b-41d4-a716-446655440004',
        includeArchived: true,
      });

      expect(mockTaskService.getOwnerTasks).toHaveBeenCalledWith(
        '550e8400-e29b-41d4-a716-446655440004',
        true
      );
    });
  });

  describe('getUserTasks query', () => {
    beforeEach(() => {
      (mockPrisma.userProfile.findUnique as jest.Mock).mockResolvedValue({
        id: '550e8400-e29b-41d4-a716-446655440001',
        departmentId: '550e8400-e29b-41d4-a716-446655440005',
        role: 'STAFF',
        isHrAdmin: false,
      });

      (mockPrisma.userProfile.findMany as jest.Mock).mockResolvedValue([
        {
          id: '550e8400-e29b-41d4-a716-446655440002',
          name: 'User One',
          email: 'user1@example.com',
          departmentId: '550e8400-e29b-41d4-a716-446655440005',
        },
        {
          id: '550e8400-e29b-41d4-a716-446655440004',
          name: 'Owner',
          email: 'owner@example.com',
          departmentId: '550e8400-e29b-41d4-a716-446655440005',
        },
      ]);

      (mockPrisma.department.findMany as jest.Mock).mockResolvedValue([
        { id: '550e8400-e29b-41d4-a716-446655440005', name: 'Engineering' },
      ]);

      (mockPrisma.project.findMany as jest.Mock).mockResolvedValue([]);
    });

    it('should get user assigned tasks', async () => {
      const caller = taskRouter.createCaller({
        prisma: mockPrisma,
        userId: '550e8400-e29b-41d4-a716-446655440001',
      });

      const result = await caller.getUserTasks({
        userId: '550e8400-e29b-41d4-a716-446655440002',
      });

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
      // Now uses repository directly instead of service
      expect(result[0]).toHaveProperty('id');
      expect(result[0]).toHaveProperty('title');
    });

    it('should return tasks with canEdit=true for personal tasks', async () => {
      const caller = taskRouter.createCaller({
        prisma: mockPrisma,
        userId: '550e8400-e29b-41d4-a716-446655440001',
      });

      const result = await caller.getUserTasks({
        userId: '550e8400-e29b-41d4-a716-446655440002',
      });

      expect(result[0].canEdit).toBe(true);
    });

    it('should include user and department details', async () => {
      const caller = taskRouter.createCaller({
        prisma: mockPrisma,
        userId: '550e8400-e29b-41d4-a716-446655440001',
      });

      const result = await caller.getUserTasks({
        userId: '550e8400-e29b-41d4-a716-446655440002',
      });

      expect(result[0].owner).toBeDefined();
      expect(result[0].department).toBeDefined();
      expect(result[0].assignments).toBeDefined();
    });

    it('should include involvedDepartments', async () => {
      const caller = taskRouter.createCaller({
        prisma: mockPrisma,
        userId: '550e8400-e29b-41d4-a716-446655440001',
      });

      const result = await caller.getUserTasks({
        userId: '550e8400-e29b-41d4-a716-446655440002',
      });

      expect(result[0].involvedDepartments).toBeDefined();
      expect(Array.isArray(result[0].involvedDepartments)).toBe(true);
    });
  });

  describe('getDepartmentTasks query', () => {
    it('should get department tasks', async () => {
      const caller = taskRouter.createCaller({
        prisma: mockPrisma,
        userId: '550e8400-e29b-41d4-a716-446655440001',
      });

      const result = await caller.getDepartmentTasks({
        departmentId: '550e8400-e29b-41d4-a716-446655440005',
      });

      expect(Array.isArray(result)).toBe(true);
      expect(mockTaskService.getDepartmentTasks).toHaveBeenCalledWith(
        '550e8400-e29b-41d4-a716-446655440005',
        expect.objectContaining({
          role: 'MANAGER',
        }),
        false
      );
    });

    it('should include archived tasks when requested', async () => {
      const caller = taskRouter.createCaller({
        prisma: mockPrisma,
        userId: '550e8400-e29b-41d4-a716-446655440001',
      });

      await caller.getDepartmentTasks({
        departmentId: '550e8400-e29b-41d4-a716-446655440005',
        includeArchived: true,
      });

      expect(mockTaskService.getDepartmentTasks).toHaveBeenCalledWith(
        '550e8400-e29b-41d4-a716-446655440005',
        expect.any(Object),
        true
      );
    });
  });

  // ============================================
  // FILE OPERATIONS
  // ============================================

  describe('uploadFile mutation', () => {
    beforeEach(() => {
      (mockPrisma.userProfile.findUnique as jest.Mock).mockResolvedValue({
        id: '550e8400-e29b-41d4-a716-446655440001',
        departmentId: '550e8400-e29b-41d4-a716-446655440005',
        role: 'STAFF',
        isHrAdmin: false,
      });
    });

    it('should upload file successfully', async () => {
      const caller = taskRouter.createCaller({
        prisma: mockPrisma,
        userId: '550e8400-e29b-41d4-a716-446655440001',
      });

      const result = await caller.uploadFile({
        taskId: '550e8400-e29b-41d4-a716-446655440000',
        fileName: 'document.pdf',
        fileType: 'application/pdf',
        fileData: Buffer.from('test data').toString('base64'),
        userId: '550e8400-e29b-41d4-a716-446655440001',
        userRole: 'STAFF',
        departmentId: '550e8400-e29b-41d4-a716-446655440005',
      });

      expect(result.success).toBe(true);
      expect(result.file).toBeDefined();
      expect(mockTaskService.uploadFileToTask).toHaveBeenCalled();
    });
  });

  describe('getFileDownloadUrl query', () => {
    beforeEach(() => {
      (mockPrisma.userProfile.findUnique as jest.Mock).mockResolvedValue({
        id: '550e8400-e29b-41d4-a716-446655440001',
        departmentId: '550e8400-e29b-41d4-a716-446655440005',
        role: 'STAFF',
        isHrAdmin: false,
      });
    });

    it('should get download URL with expiry', async () => {
      const caller = taskRouter.createCaller({
        prisma: mockPrisma,
        userId: '550e8400-e29b-41d4-a716-446655440001',
      });

      const result = await caller.getFileDownloadUrl({
        fileId: '550e8400-e29b-41d4-a716-44665544000b',
        userId: '550e8400-e29b-41d4-a716-446655440001',
        userRole: 'STAFF',
        departmentId: '550e8400-e29b-41d4-a716-446655440005',
      });

      expect(result.downloadUrl).toBe('https://example.com/file');
      expect(result.expiresIn).toBe(3600);
    });
  });

  describe('deleteFile mutation', () => {
    beforeEach(() => {
      (mockPrisma.userProfile.findUnique as jest.Mock).mockResolvedValue({
        id: '550e8400-e29b-41d4-a716-446655440001',
        departmentId: '550e8400-e29b-41d4-a716-446655440005',
        role: 'STAFF',
        isHrAdmin: false,
      });
    });

    it('should delete file successfully', async () => {
      const caller = taskRouter.createCaller({
        prisma: mockPrisma,
        userId: '550e8400-e29b-41d4-a716-446655440001',
      });

      const result = await caller.deleteFile({
        fileId: '550e8400-e29b-41d4-a716-44665544000b',
        userId: '550e8400-e29b-41d4-a716-446655440001',
        userRole: 'STAFF',
        departmentId: '550e8400-e29b-41d4-a716-446655440005',
      });

      expect(result.success).toBe(true);
      expect(mockTaskService.deleteFile).toHaveBeenCalled();
    });
  });

  describe('getTaskFiles query', () => {
    beforeEach(() => {
      (mockPrisma.userProfile.findUnique as jest.Mock).mockResolvedValue({
        id: '550e8400-e29b-41d4-a716-446655440001',
        departmentId: '550e8400-e29b-41d4-a716-446655440005',
        role: 'STAFF',
        isHrAdmin: false,
      });

      mockTaskService.getTaskFiles.mockResolvedValue([
        {
          id: '550e8400-e29b-41d4-a716-44665544000b',
          fileName: 'doc1.pdf',
          fileSize: 1024,
          fileType: 'application/pdf',
          uploadedById: '550e8400-e29b-41d4-a716-446655440002',
          uploadedAt: new Date(),
        },
        {
          id: '550e8400-e29b-41d4-a716-44665544000c',
          fileName: 'doc2.pdf',
          fileSize: 2048,
          fileType: 'application/pdf',
          uploadedById: '550e8400-e29b-41d4-a716-446655440002',
          uploadedAt: new Date(),
        },
      ] as any);
    });

    it('should get all files with metadata', async () => {
      const caller = taskRouter.createCaller({
        prisma: mockPrisma,
        userId: '550e8400-e29b-41d4-a716-446655440001',
      });

      const result = await caller.getTaskFiles({
        taskId: '550e8400-e29b-41d4-a716-446655440000',
        userId: '550e8400-e29b-41d4-a716-446655440001',
        userRole: 'STAFF',
        departmentId: '550e8400-e29b-41d4-a716-446655440005',
      });

      expect(result.files).toHaveLength(2);
      expect(result.totalSize).toBe(3072);
      expect(result.count).toBe(2);
    });
  });

  describe('getHierarchy query', () => {
    beforeEach(() => {
      (mockPrisma.userProfile.findUnique as jest.Mock).mockResolvedValue({
        id: '550e8400-e29b-41d4-a716-446655440001',
        departmentId: '550e8400-e29b-41d4-a716-446655440005',
        role: 'STAFF',
        isHrAdmin: false,
      });
    });

    it('should get task hierarchy', async () => {
      const caller = taskRouter.createCaller({
        prisma: mockPrisma,
        userId: '550e8400-e29b-41d4-a716-446655440001',
      });

      const result = await caller.getHierarchy({
        taskId: '550e8400-e29b-41d4-a716-446655440000',
      });

      expect(result).toBeDefined();
      expect(mockTaskService.getTaskHierarchy).toHaveBeenCalledWith(
        '550e8400-e29b-41d4-a716-446655440000',
        expect.objectContaining({
          userId: '550e8400-e29b-41d4-a716-446655440001',
        })
      );
    });
  });

  // ============================================
  // DASHBOARD OPERATIONS
  // ============================================

  describe('getDashboardTasks query', () => {
    it('should get manager dashboard tasks', async () => {
      const caller = taskRouter.createCaller({
        prisma: mockPrisma,
        userId: '550e8400-e29b-41d4-a716-446655440010',
        session: {
          user: { id: '550e8400-e29b-41d4-a716-446655440010' },
        } as any,
      });

      const result = await caller.getDashboardTasks();

      expect(result).toBeDefined();
    });
  });

  describe('getDepartmentTasksForUser query', () => {
    it('should get department tasks for user', async () => {
      const caller = taskRouter.createCaller({
        prisma: mockPrisma,
        userId: '550e8400-e29b-41d4-a716-446655440001',
        session: {
          user: { id: '550e8400-e29b-41d4-a716-446655440001' },
        } as any,
      });

      const result = await caller.getDepartmentTasksForUser();

      expect(result).toBeDefined();
    });
  });

  describe('getAvailableParentTasks query', () => {
    it('should get available parent tasks', async () => {
      const caller = taskRouter.createCaller({
        prisma: mockPrisma,
        userId: '550e8400-e29b-41d4-a716-446655440001',
        session: {
          user: { id: '550e8400-e29b-41d4-a716-446655440001' },
        } as any,
      });

      const result = await caller.getAvailableParentTasks();

      expect(result).toBeDefined();
    });
  });

  describe('getProjectTasksForUser query', () => {
    it('should get project tasks for user', async () => {
      const caller = taskRouter.createCaller({
        prisma: mockPrisma,
        userId: '550e8400-e29b-41d4-a716-446655440001',
        session: {
          user: { id: '550e8400-e29b-41d4-a716-446655440001' },
        } as any,
      });

      const result = await caller.getProjectTasksForUser({
        projectId: '550e8400-e29b-41d4-a716-446655440007',
      });

      expect(result).toBeDefined();
    });
  });

  describe('getManagerProjectTasks query', () => {
    it('should get manager project tasks', async () => {
      const caller = taskRouter.createCaller({
        prisma: mockPrisma,
        userId: '550e8400-e29b-41d4-a716-446655440010',
        session: {
          user: { id: '550e8400-e29b-41d4-a716-446655440010' },
        } as any,
      });

      const result = await caller.getManagerProjectTasks({
        projectId: '550e8400-e29b-41d4-a716-446655440007',
      });

      expect(result).toBeDefined();
    });
  });

  describe('getCompanyTasks query', () => {
    it('should get company-wide tasks', async () => {
      const caller = taskRouter.createCaller({
        prisma: mockPrisma,
        userId: '550e8400-e29b-41d4-a716-446655440011',
        session: {
          user: { id: '550e8400-e29b-41d4-a716-446655440011' },
        } as any,
      });

      const result = await caller.getCompanyTasks({});

      expect(result).toBeDefined();
    });

    it('should filter by department', async () => {
      const caller = taskRouter.createCaller({
        prisma: mockPrisma,
        userId: '550e8400-e29b-41d4-a716-446655440011',
        session: {
          user: { id: '550e8400-e29b-41d4-a716-446655440011' },
        } as any,
      });

      await caller.getCompanyTasks({
        departmentId: '550e8400-e29b-41d4-a716-446655440005',
      });

      expect(mockBuildServices).toHaveBeenCalled();
    });

    it('should filter by status', async () => {
      const caller = taskRouter.createCaller({
        prisma: mockPrisma,
        userId: '550e8400-e29b-41d4-a716-446655440011',
        session: {
          user: { id: '550e8400-e29b-41d4-a716-446655440011' },
        } as any,
      });

      await caller.getCompanyTasks({
        status: 'IN_PROGRESS',
      });

      expect(mockBuildServices).toHaveBeenCalled();
    });
  });

  // ============================================
  // CALENDAR OPERATIONS
  // ============================================

  describe('createCalendarEvent mutation', () => {
    beforeEach(() => {
      (mockPrisma.userProfile.findUnique as jest.Mock).mockResolvedValue({
        id: '550e8400-e29b-41d4-a716-446655440001',
        departmentId: '550e8400-e29b-41d4-a716-446655440005',
        role: 'STAFF',
        isHrAdmin: false,
      });
    });

    it('should create calendar event', async () => {
      const caller = taskRouter.createCaller({
        prisma: mockPrisma,
        userId: '550e8400-e29b-41d4-a716-446655440001',
      });

      const result = await caller.createCalendarEvent({
        taskId: '550e8400-e29b-41d4-a716-446655440000',
        eventUserId: '550e8400-e29b-41d4-a716-446655440002',
        title: 'Meeting',
        eventDate: new Date('2025-12-15'),
      });

      expect(result).toBeDefined();
      expect(mockTaskService.createCalendarEvent).toHaveBeenCalledWith(
        '550e8400-e29b-41d4-a716-446655440000',
        '550e8400-e29b-41d4-a716-446655440002',
        'Meeting',
        expect.any(Date),
        expect.objectContaining({
          userId: '550e8400-e29b-41d4-a716-446655440001',
        })
      );
    });
  });

  describe('getCalendarEvents query', () => {
    beforeEach(() => {
      (mockPrisma.userProfile.findUnique as jest.Mock).mockResolvedValue({
        id: '550e8400-e29b-41d4-a716-446655440001',
        departmentId: '550e8400-e29b-41d4-a716-446655440005',
        role: 'STAFF',
        isHrAdmin: false,
      });
    });

    it('should get calendar events for task', async () => {
      const caller = taskRouter.createCaller({
        prisma: mockPrisma,
        userId: '550e8400-e29b-41d4-a716-446655440001',
      });

      const result = await caller.getCalendarEvents({
        taskId: '550e8400-e29b-41d4-a716-446655440000',
      });

      expect(result).toBeDefined();
      expect(mockTaskService.getCalendarEvents).toHaveBeenCalledWith(
        '550e8400-e29b-41d4-a716-446655440000',
        expect.objectContaining({
          userId: '550e8400-e29b-41d4-a716-446655440001',
        })
      );
    });
  });

  describe('getTaskLogs query', () => {
    beforeEach(() => {
      (mockPrisma.userProfile.findUnique as jest.Mock).mockResolvedValue({
        id: '550e8400-e29b-41d4-a716-446655440001',
        departmentId: '550e8400-e29b-41d4-a716-446655440005',
        role: 'STAFF',
        isHrAdmin: false,
      });
    });

    it('should get task logs', async () => {
      const caller = taskRouter.createCaller({
        prisma: mockPrisma,
        userId: '550e8400-e29b-41d4-a716-446655440001',
      });

      const result = await caller.getTaskLogs({
        taskId: '550e8400-e29b-41d4-a716-446655440000',
      });

      expect(result).toBeDefined();
      expect(mockTaskService.getTaskLogs).toHaveBeenCalledWith(
        '550e8400-e29b-41d4-a716-446655440000',
        expect.objectContaining({
          userId: '550e8400-e29b-41d4-a716-446655440001',
        })
      );
    });
  });
});
