/**
 * Unit Tests for TaskFile Router
 * Tests tRPC endpoints for file upload, download, and delete operations
 */

import { taskFileRouter } from '@/app/server/routers/taskFile';
import { TaskService } from '@/services/task/TaskService';
import { PrismaTaskRepository } from '@/repositories/PrismaTaskRepository';
import type { PrismaClient } from '@prisma/client';

// Mock dependencies
jest.mock('@/services/task/TaskService');
jest.mock('@/repositories/PrismaTaskRepository');

describe('TaskFile Router', () => {
  let mockPrisma: jest.Mocked<PrismaClient>;
  let mockTaskServiceInstance: jest.Mocked<TaskService>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock Prisma client
    mockPrisma = {
      userProfile: {
        findUnique: jest.fn(),
      },
      task: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
      },
      taskFile: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        delete: jest.fn(),
      },
    } as any;

    // Create mock instance with all methods
    mockTaskServiceInstance = {
      uploadFileToTask: jest.fn().mockResolvedValue({
        id: '770e8400-e29b-41d4-a716-446655440001',
        taskId: '660e8400-e29b-41d4-a716-446655440001',
        fileName: 'test.pdf',
        fileSize: 1024,
        fileType: 'application/pdf',
        uploadedAt: new Date(),
        uploadedById: '550e8400-e29b-41d4-a716-446655440001',
        filePath: 'path/to/file',
      }),
      getFileDownloadUrl: jest
        .fn()
        .mockResolvedValue('https://example.com/file'),
      deleteFile: jest.fn().mockResolvedValue(undefined),
      getTaskFiles: jest.fn().mockResolvedValue([]),
      createTask: jest.fn(),
      updateTaskTitle: jest.fn(),
      updateTaskDescription: jest.fn(),
      updateTaskPriority: jest.fn(),
      updateTaskDeadline: jest.fn(),
      updateTaskStatus: jest.fn(),
      enableRecurring: jest.fn(),
      disableRecurring: jest.fn(),
      addTag: jest.fn(),
      removeTag: jest.fn(),
      addAssignee: jest.fn(),
      removeAssignee: jest.fn(),
      addComment: jest.fn(),
      updateComment: jest.fn(),
      deleteComment: jest.fn(),
      getTaskById: jest.fn(),
      getSubordinateDepartments: jest.fn(),
    } as any;

    // Mock TaskService constructor to return our mock instance
    (TaskService as jest.Mock).mockImplementation(
      () => mockTaskServiceInstance
    );

    // Mock PrismaTaskRepository constructor
    (PrismaTaskRepository as jest.Mock).mockImplementation(() => ({}) as any);
  });

  describe('getUserContext helper', () => {
    it('should throw error when user is not authenticated', async () => {
      const caller = taskFileRouter.createCaller({
        prisma: mockPrisma,
        userId: undefined,
      });

      await expect(
        caller.getTaskFiles({
          taskId: '660e8400-e29b-41d4-a716-446655440001',
          userId: '550e8400-e29b-41d4-a716-446655440001',
          userRole: 'STAFF',
          departmentId: '880e8400-e29b-41d4-a716-446655440001',
        })
      ).rejects.toThrow('User not authenticated');
    });

    it('should throw error when user profile not found', async () => {
      (mockPrisma.userProfile.findUnique as jest.Mock).mockResolvedValue(null);

      const caller = taskFileRouter.createCaller({
        prisma: mockPrisma,
        userId: '550e8400-e29b-41d4-a716-446655440001',
      });

      await expect(
        caller.getTaskFiles({
          taskId: '660e8400-e29b-41d4-a716-446655440001',
          userId: '550e8400-e29b-41d4-a716-446655440001',
          userRole: 'STAFF',
          departmentId: '880e8400-e29b-41d4-a716-446655440001',
        })
      ).rejects.toThrow('User profile not found');
    });

    it('should create user context when authenticated', async () => {
      (mockPrisma.userProfile.findUnique as jest.Mock).mockResolvedValue({
        id: '550e8400-e29b-41d4-a716-446655440001',
        departmentId: '880e8400-e29b-41d4-a716-446655440001',
        role: 'STAFF',
        isHrAdmin: false,
      });

      mockTaskServiceInstance.getTaskFiles.mockResolvedValue([
        {
          id: '770e8400-e29b-41d4-a716-446655440001',
          taskId: '660e8400-e29b-41d4-a716-446655440001',
          fileName: 'test.pdf',
          fileSize: 1024,
          fileType: 'application/pdf',
          uploadedAt: new Date(),
          uploadedById: '550e8400-e29b-41d4-a716-446655440001',
          filePath: 'path/to/file',
        },
      ] as any);

      const caller = taskFileRouter.createCaller({
        prisma: mockPrisma,
        userId: '550e8400-e29b-41d4-a716-446655440001',
      });

      await caller.getTaskFiles({
        taskId: '660e8400-e29b-41d4-a716-446655440001',
        userId: '550e8400-e29b-41d4-a716-446655440001',
        userRole: 'STAFF',
        departmentId: '880e8400-e29b-41d4-a716-446655440001',
      });

      expect(mockPrisma.userProfile.findUnique).toHaveBeenCalledWith({
        where: { id: '550e8400-e29b-41d4-a716-446655440001' },
      });
    });
  });

  describe('getUserTasks', () => {
    it('should get tasks assigned to user', async () => {
      const mockTasks = [
        {
          id: '660e8400-e29b-41d4-a716-446655440001',
          title: 'Task 1',
          description: 'Description 1',
          status: 'TODO',
          priority: 'MEDIUM',
          dueDate: new Date('2025-12-31'),
          createdAt: new Date('2025-01-01'),
          owner: {
            id: '550e8400-e29b-41d4-a716-446655440001',
            name: 'John Doe',
            email: 'john@example.com',
          },
          _count: {
            files: 2,
          },
        },
        {
          id: '660e8400-e29b-41d4-a716-446655440002',
          title: 'Task 2',
          description: 'Description 2',
          status: 'IN_PROGRESS',
          priority: 'HIGH',
          dueDate: new Date('2025-11-30'),
          createdAt: new Date('2025-01-02'),
          owner: {
            id: '550e8400-e29b-41d4-a716-446655440001',
            name: 'John Doe',
            email: 'john@example.com',
          },
          _count: {
            files: 1,
          },
        },
      ];

      (mockPrisma.task.findMany as jest.Mock).mockResolvedValue(mockTasks);

      const caller = taskFileRouter.createCaller({
        prisma: mockPrisma,
        userId: undefined,
      });

      const result = await caller.getUserTasks({
        userId: '550e8400-e29b-41d4-a716-446655440001',
      });

      expect(result.tasks).toHaveLength(2);
      expect(result.tasks[0]).toMatchObject({
        id: '660e8400-e29b-41d4-a716-446655440001',
        title: 'Task 1',
        fileCount: 2,
      });
      expect(mockPrisma.task.findMany).toHaveBeenCalledWith({
        where: {
          assignments: {
            some: {
              userId: '550e8400-e29b-41d4-a716-446655440001',
            },
          },
        },
        include: {
          owner: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          _count: {
            select: {
              files: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });
    });

    it('should return empty array when user has no tasks', async () => {
      (mockPrisma.task.findMany as jest.Mock).mockResolvedValue([]);

      const caller = taskFileRouter.createCaller({
        prisma: mockPrisma,
        userId: undefined,
      });

      const result = await caller.getUserTasks({
        userId: '550e8400-e29b-41d4-a716-446655440002',
      });

      expect(result.tasks).toEqual([]);
    });

    it('should only select specific task fields', async () => {
      (mockPrisma.task.findMany as jest.Mock).mockResolvedValue([]);

      const caller = taskFileRouter.createCaller({
        prisma: mockPrisma,
        userId: undefined,
      });

      await caller.getUserTasks({
        userId: '550e8400-e29b-41d4-a716-446655440001',
      });

      expect(mockPrisma.task.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          include: {
            owner: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
            _count: {
              select: {
                files: true,
              },
            },
          },
        })
      );
    });
  });

  describe('uploadFile', () => {
    beforeEach(() => {
      (mockPrisma.userProfile.findUnique as jest.Mock).mockResolvedValue({
        id: '550e8400-e29b-41d4-a716-446655440001',
        departmentId: '880e8400-e29b-41d4-a716-446655440001',
        role: 'STAFF',
        isHrAdmin: false,
      });
    });

    it('should upload file successfully', async () => {
      const mockFile = {
        id: '770e8400-e29b-41d4-a716-446655440001',
        taskId: '660e8400-e29b-41d4-a716-446655440001',
        fileName: 'document.pdf',
        fileType: 'application/pdf',
        fileSize: 2048,
        uploadedAt: new Date(),
        uploadedById: '550e8400-e29b-41d4-a716-446655440001',
        filePath: 'path/to/file',
      };

      mockTaskServiceInstance.uploadFileToTask.mockResolvedValue(
        mockFile as any
      );

      const caller = taskFileRouter.createCaller({
        prisma: mockPrisma,
        userId: '550e8400-e29b-41d4-a716-446655440001',
      });

      const result = await caller.uploadFile({
        taskId: '660e8400-e29b-41d4-a716-446655440001',
        fileName: 'document.pdf',
        fileType: 'application/pdf',
        fileData: 'base64encodeddata',
        userId: '550e8400-e29b-41d4-a716-446655440001',
        userRole: 'STAFF',
        departmentId: '880e8400-e29b-41d4-a716-446655440001',
      });

      expect(result.success).toBe(true);
      expect(result.file).toMatchObject({
        id: '770e8400-e29b-41d4-a716-446655440001',
        fileName: 'document.pdf',
        fileType: 'application/pdf',
        fileSize: 2048,
      });
      expect(mockTaskServiceInstance.uploadFileToTask).toHaveBeenCalledWith(
        '660e8400-e29b-41d4-a716-446655440001',
        expect.any(Buffer),
        'document.pdf',
        'application/pdf',
        expect.objectContaining({
          userId: '550e8400-e29b-41d4-a716-446655440001',
          role: 'STAFF',
          departmentId: '880e8400-e29b-41d4-a716-446655440001',
        })
      );
    });

    it('should validate required fields', async () => {
      const caller = taskFileRouter.createCaller({
        prisma: mockPrisma,
        userId: '550e8400-e29b-41d4-a716-446655440001',
      });

      await expect(
        caller.uploadFile({
          taskId: '660e8400-e29b-41d4-a716-446655440001',
          fileName: '',
          fileType: 'application/pdf',
          fileData: 'data',
          userId: '550e8400-e29b-41d4-a716-446655440001',
          userRole: 'STAFF',
          departmentId: '880e8400-e29b-41d4-a716-446655440001',
        })
      ).rejects.toThrow();
    });

    it('should validate fileName max length', async () => {
      const caller = taskFileRouter.createCaller({
        prisma: mockPrisma,
        userId: '550e8400-e29b-41d4-a716-446655440001',
      });

      const longName = 'a'.repeat(256);

      await expect(
        caller.uploadFile({
          taskId: '660e8400-e29b-41d4-a716-446655440001',
          fileName: longName,
          fileType: 'application/pdf',
          fileData: 'data',
          userId: '550e8400-e29b-41d4-a716-446655440001',
          userRole: 'STAFF',
          departmentId: '880e8400-e29b-41d4-a716-446655440001',
        })
      ).rejects.toThrow();
    });

    it('should handle different user roles', async () => {
      const roles = ['STAFF', 'MANAGER', 'HR_ADMIN'] as const;

      for (const role of roles) {
        (mockPrisma.userProfile.findUnique as jest.Mock).mockResolvedValue({
          id: '550e8400-e29b-41d4-a716-446655440001',
          departmentId: '880e8400-e29b-41d4-a716-446655440001',
          role,
          isHrAdmin: role === 'HR_ADMIN',
        });

        const caller = taskFileRouter.createCaller({
          prisma: mockPrisma,
          userId: '550e8400-e29b-41d4-a716-446655440001',
        });

        await caller.uploadFile({
          taskId: '660e8400-e29b-41d4-a716-446655440001',
          fileName: 'test.pdf',
          fileType: 'application/pdf',
          fileData: 'data',
          userId: '550e8400-e29b-41d4-a716-446655440001',
          userRole: role,
          departmentId: '880e8400-e29b-41d4-a716-446655440001',
        });

        expect(mockTaskServiceInstance.uploadFileToTask).toHaveBeenCalledWith(
          expect.any(String),
          expect.any(Buffer),
          expect.any(String),
          expect.any(String),
          expect.objectContaining({ role })
        );
      }
    });
  });

  describe('getFileDownloadUrl', () => {
    beforeEach(() => {
      (mockPrisma.userProfile.findUnique as jest.Mock).mockResolvedValue({
        id: '550e8400-e29b-41d4-a716-446655440001',
        departmentId: '880e8400-e29b-41d4-a716-446655440001',
        role: 'STAFF',
        isHrAdmin: false,
      });
    });

    it('should get download URL successfully', async () => {
      const mockUrl = 'https://storage.example.com/file-1';

      mockTaskServiceInstance.getFileDownloadUrl.mockResolvedValue(mockUrl);

      const caller = taskFileRouter.createCaller({
        prisma: mockPrisma,
        userId: '550e8400-e29b-41d4-a716-446655440001',
      });

      const result = await caller.getFileDownloadUrl({
        fileId: '770e8400-e29b-41d4-a716-446655440001',
        userId: '550e8400-e29b-41d4-a716-446655440001',
        userRole: 'STAFF',
        departmentId: '880e8400-e29b-41d4-a716-446655440001',
      });

      expect(result.downloadUrl).toBe(mockUrl);
      expect(result.expiresIn).toBe(3600);
      expect(mockTaskServiceInstance.getFileDownloadUrl).toHaveBeenCalledWith(
        '770e8400-e29b-41d4-a716-446655440001',
        expect.objectContaining({
          userId: '550e8400-e29b-41d4-a716-446655440001',
          role: 'STAFF',
          departmentId: '880e8400-e29b-41d4-a716-446655440001',
        })
      );
    });

    it('should validate fileId is UUID', async () => {
      const caller = taskFileRouter.createCaller({
        prisma: mockPrisma,
        userId: '550e8400-e29b-41d4-a716-446655440001',
      });

      await expect(
        caller.getFileDownloadUrl({
          fileId: 'invalid-uuid',
          userId: '550e8400-e29b-41d4-a716-446655440001',
          userRole: 'STAFF',
          departmentId: '880e8400-e29b-41d4-a716-446655440001',
        })
      ).rejects.toThrow();
    });
  });

  describe('deleteFile', () => {
    beforeEach(() => {
      (mockPrisma.userProfile.findUnique as jest.Mock).mockResolvedValue({
        id: '550e8400-e29b-41d4-a716-446655440001',
        departmentId: '880e8400-e29b-41d4-a716-446655440001',
        role: 'MANAGER',
        isHrAdmin: false,
      });
    });

    it('should delete file successfully', async () => {
      mockTaskServiceInstance.deleteFile.mockResolvedValue(undefined);

      const caller = taskFileRouter.createCaller({
        prisma: mockPrisma,
        userId: '550e8400-e29b-41d4-a716-446655440001',
      });

      const result = await caller.deleteFile({
        fileId: '770e8400-e29b-41d4-a716-446655440001',
        userId: '550e8400-e29b-41d4-a716-446655440001',
        userRole: 'MANAGER',
        departmentId: '880e8400-e29b-41d4-a716-446655440001',
      });

      expect(result.success).toBe(true);
      expect(mockTaskServiceInstance.deleteFile).toHaveBeenCalledWith(
        '770e8400-e29b-41d4-a716-446655440001',
        expect.objectContaining({
          userId: '550e8400-e29b-41d4-a716-446655440001',
          role: 'MANAGER',
          departmentId: '880e8400-e29b-41d4-a716-446655440001',
        })
      );
    });

    it('should validate fileId is UUID', async () => {
      const caller = taskFileRouter.createCaller({
        prisma: mockPrisma,
        userId: '550e8400-e29b-41d4-a716-446655440001',
      });

      await expect(
        caller.deleteFile({
          fileId: 'not-a-uuid',
          userId: '550e8400-e29b-41d4-a716-446655440001',
          userRole: 'MANAGER',
          departmentId: '880e8400-e29b-41d4-a716-446655440001',
        })
      ).rejects.toThrow();
    });

    it('should handle authorization errors', async () => {
      mockTaskServiceInstance.deleteFile.mockRejectedValue(
        new Error('Unauthorized to delete file')
      );

      const caller = taskFileRouter.createCaller({
        prisma: mockPrisma,
        userId: '550e8400-e29b-41d4-a716-446655440001',
      });

      await expect(
        caller.deleteFile({
          fileId: '990e8400-e29b-41d4-a716-446655440099',
          userId: '550e8400-e29b-41d4-a716-446655440001',
          userRole: 'STAFF',
          departmentId: '880e8400-e29b-41d4-a716-446655440001',
        })
      ).rejects.toThrow('Unauthorized to delete file');
    });
  });

  describe('getTaskFiles', () => {
    beforeEach(() => {
      (mockPrisma.userProfile.findUnique as jest.Mock).mockResolvedValue({
        id: '550e8400-e29b-41d4-a716-446655440001',
        departmentId: '880e8400-e29b-41d4-a716-446655440001',
        role: 'STAFF',
        isHrAdmin: false,
      });
    });

    it('should get all files for a task', async () => {
      const mockFiles = [
        {
          id: '770e8400-e29b-41d4-a716-446655440001',
          taskId: '660e8400-e29b-41d4-a716-446655440001',
          fileName: 'document1.pdf',
          fileType: 'application/pdf',
          fileSize: 1024,
          uploadedById: '550e8400-e29b-41d4-a716-446655440001',
          uploadedAt: new Date(),
        },
        {
          id: '770e8400-e29b-41d4-a716-446655440002',
          taskId: '660e8400-e29b-41d4-a716-446655440001',
          fileName: 'image.png',
          fileType: 'image/png',
          fileSize: 2048,
          uploadedById: '550e8400-e29b-41d4-a716-446655440002',
          uploadedAt: new Date(),
        },
      ];

      mockTaskServiceInstance.getTaskFiles.mockResolvedValue(mockFiles as any);

      const caller = taskFileRouter.createCaller({
        prisma: mockPrisma,
        userId: '550e8400-e29b-41d4-a716-446655440001',
      });

      const result = await caller.getTaskFiles({
        taskId: '660e8400-e29b-41d4-a716-446655440001',
        userId: '550e8400-e29b-41d4-a716-446655440001',
        userRole: 'STAFF',
        departmentId: '880e8400-e29b-41d4-a716-446655440001',
      });

      expect(result.files).toHaveLength(2);
      expect(result.count).toBe(2);
      expect(result.totalSize).toBe(3072);
      expect(result.files[0]).toMatchObject({
        id: '770e8400-e29b-41d4-a716-446655440001',
        fileName: 'document1.pdf',
        fileType: 'application/pdf',
        fileSize: 1024,
      });
      expect(mockTaskServiceInstance.getTaskFiles).toHaveBeenCalledWith(
        '660e8400-e29b-41d4-a716-446655440001',
        expect.objectContaining({
          userId: '550e8400-e29b-41d4-a716-446655440001',
          role: 'STAFF',
          departmentId: '880e8400-e29b-41d4-a716-446655440001',
        })
      );
    });

    it('should return empty array when task has no files', async () => {
      mockTaskServiceInstance.getTaskFiles.mockResolvedValue([]);

      const caller = taskFileRouter.createCaller({
        prisma: mockPrisma,
        userId: '550e8400-e29b-41d4-a716-446655440001',
      });

      const result = await caller.getTaskFiles({
        taskId: '660e8400-e29b-41d4-a716-446655440002',
        userId: '550e8400-e29b-41d4-a716-446655440001',
        userRole: 'STAFF',
        departmentId: '880e8400-e29b-41d4-a716-446655440001',
      });

      expect(result.files).toEqual([]);
      expect(result.count).toBe(0);
      expect(result.totalSize).toBe(0);
    });

    it('should validate taskId is UUID', async () => {
      const caller = taskFileRouter.createCaller({
        prisma: mockPrisma,
        userId: '550e8400-e29b-41d4-a716-446655440001',
      });

      await expect(
        caller.getTaskFiles({
          taskId: 'invalid-task-id',
          userId: '550e8400-e29b-41d4-a716-446655440001',
          userRole: 'STAFF',
          departmentId: '880e8400-e29b-41d4-a716-446655440001',
        })
      ).rejects.toThrow();
    });
  });

  describe('Input Validation', () => {
    beforeEach(() => {
      (mockPrisma.userProfile.findUnique as jest.Mock).mockResolvedValue({
        id: '550e8400-e29b-41d4-a716-446655440001',
        departmentId: '880e8400-e29b-41d4-a716-446655440001',
        role: 'STAFF',
        isHrAdmin: false,
      });
    });

    it('should validate UUID format for taskId', async () => {
      const caller = taskFileRouter.createCaller({
        prisma: mockPrisma,
        userId: '550e8400-e29b-41d4-a716-446655440001',
      });

      await expect(
        caller.uploadFile({
          taskId: 'not-a-uuid',
          fileName: 'test.pdf',
          fileType: 'application/pdf',
          fileData: 'data',
          userId: '550e8400-e29b-41d4-a716-446655440001',
          userRole: 'STAFF',
          departmentId: '880e8400-e29b-41d4-a716-446655440001',
        })
      ).rejects.toThrow();
    });

    it('should validate UUID format for userId', async () => {
      const caller = taskFileRouter.createCaller({
        prisma: mockPrisma,
        userId: '550e8400-e29b-41d4-a716-446655440001',
      });

      await expect(
        caller.uploadFile({
          taskId: '990e8400-e29b-41d4-a716-446655440099',
          fileName: 'test.pdf',
          fileType: 'application/pdf',
          fileData: 'data',
          userId: 'not-uuid',
          userRole: 'STAFF',
          departmentId: '880e8400-e29b-41d4-a716-446655440001',
        })
      ).rejects.toThrow();
    });

    it('should validate userRole enum', async () => {
      const caller = taskFileRouter.createCaller({
        prisma: mockPrisma,
        userId: '550e8400-e29b-41d4-a716-446655440001',
      });

      await expect(
        caller.uploadFile({
          taskId: '990e8400-e29b-41d4-a716-446655440099',
          fileName: 'test.pdf',
          fileType: 'application/pdf',
          fileData: 'data',
          userId: '990e8400-e29b-41d4-a716-446655440099',
          userRole: 'INVALID_ROLE' as any,
          departmentId: '880e8400-e29b-41d4-a716-446655440001',
        })
      ).rejects.toThrow();
    });
  });
});
