// Mock dependencies BEFORE imports to prevent Supabase client initialization
jest.mock('@/services/storage/SupabaseStorageService');

import { TaskService } from '@/services/task/TaskService';
import { ITaskRepository } from '@/repositories/ITaskRepository';
import { SupabaseStorageService } from '@/services/storage/SupabaseStorageService';

describe('TaskService - File Operations', () => {
  let service: TaskService;
  let mockRepository: jest.Mocked<ITaskRepository>;
  let mockStorageService: jest.Mocked<SupabaseStorageService>;

  const mockUser = {
    userId: 'user-123',
    role: 'STAFF' as const,
    departmentId: 'dept-1',
  };

  const mockTask = {
    id: 'task-123',
    title: 'Test Task',
    ownerId: 'owner-123',
    assignments: [
      { userId: 'user-123', taskId: 'task-123' },
      { userId: 'user-456', taskId: 'task-123' },
    ],
  };

  const mockFile = {
    id: 'file-123',
    taskId: 'task-123',
    fileName: 'test.pdf',
    fileSize: 1024 * 1024, // 1MB
    fileType: 'application/pdf',
    storagePath: 'task-123/test.pdf',
    uploadedById: 'user-123',
    uploadedAt: new Date(),
  };

  beforeEach(() => {
    // Create mock repository
    mockRepository = {
      getTaskById: jest.fn(),
      getTaskFileById: jest.fn(),
      getTaskFiles: jest.fn(),
      createTaskFile: jest.fn(),
      deleteTaskFile: jest.fn(),
      logTaskAction: jest.fn(),
    } as any;

    // Create mock storage service
    mockStorageService =
      new SupabaseStorageService() as jest.Mocked<SupabaseStorageService>;
    mockStorageService.uploadFile = jest.fn();
    mockStorageService.getFileDownloadUrl = jest.fn();
    mockStorageService.deleteFile = jest.fn();
    mockStorageService.validateFile = jest.fn();
    mockStorageService.validateTaskFileLimit = jest.fn();

    // Inject mocks into service
    service = new TaskService(mockRepository);
    (service as any).storageService = mockStorageService;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('uploadFileToTask', () => {
    const fileBuffer = Buffer.from('test file content');
    const fileName = 'document.pdf';
    const mimeType = 'application/pdf';

    it('should successfully upload a file when user is assigned to task', async () => {
      mockRepository.getTaskById.mockResolvedValue(mockTask as any);
      mockRepository.getTaskFiles.mockResolvedValue([]);
      mockStorageService.validateFile.mockReturnValue({ valid: true });
      mockStorageService.validateTaskFileLimit.mockReturnValue({ valid: true });
      mockStorageService.uploadFile.mockResolvedValue({
        storagePath: 'task-123/uuid-document.pdf',
        fileSize: fileBuffer.length,
      });
      mockRepository.createTaskFile.mockResolvedValue(mockFile as any);
      mockRepository.logTaskAction.mockResolvedValue(undefined);

      const result = await service.uploadFileToTask(
        'task-123',
        fileBuffer,
        fileName,
        mimeType,
        mockUser
      );

      expect(mockRepository.getTaskById).toHaveBeenCalledWith('task-123');
      expect(mockStorageService.validateFile).toHaveBeenCalled();
      expect(mockStorageService.validateTaskFileLimit).toHaveBeenCalled();
      expect(mockStorageService.uploadFile).toHaveBeenCalledWith(
        'task-123',
        fileBuffer,
        fileName,
        mimeType
      );
      expect(mockRepository.createTaskFile).toHaveBeenCalled();
      expect(mockRepository.logTaskAction).toHaveBeenCalledWith(
        'task-123',
        mockUser.userId,
        'FILE_UPLOADED',
        expect.objectContaining({ fileName })
      );
      expect(result).toEqual(mockFile);
    });

    it('should reject upload when task not found', async () => {
      mockRepository.getTaskById.mockResolvedValue(null);

      await expect(
        service.uploadFileToTask(
          'task-999',
          fileBuffer,
          fileName,
          mimeType,
          mockUser
        )
      ).rejects.toThrow('Task not found');

      expect(mockStorageService.uploadFile).not.toHaveBeenCalled();
    });

    it('should allow task owner to upload files even if not assigned', async () => {
      const taskOwner = {
        userId: 'owner-123',
        role: 'MANAGER' as const,
        departmentId: 'dept-1',
      };

      mockRepository.getTaskById.mockResolvedValue(mockTask as any);
      mockRepository.getTaskFiles.mockResolvedValue([]);
      mockStorageService.validateFile.mockReturnValue({ valid: true });
      mockStorageService.validateTaskFileLimit.mockReturnValue({ valid: true });
      mockStorageService.uploadFile.mockResolvedValue({
        storagePath: 'task-123/uuid-document.pdf',
        fileSize: fileBuffer.length,
      });
      mockRepository.createTaskFile.mockResolvedValue(mockFile as any);
      mockRepository.logTaskAction.mockResolvedValue(undefined);

      const result = await service.uploadFileToTask(
        'task-123',
        fileBuffer,
        fileName,
        mimeType,
        taskOwner
      );

      expect(mockRepository.getTaskById).toHaveBeenCalledWith('task-123');
      expect(result).toEqual(mockFile);
    });

    it('should reject upload when user not assigned to task and not owner', async () => {
      const unauthorizedUser = {
        userId: 'user-999',
        role: 'STAFF' as const,
        departmentId: 'dept-1',
      };

      mockRepository.getTaskById.mockResolvedValue(mockTask as any);

      await expect(
        service.uploadFileToTask(
          'task-123',
          fileBuffer,
          fileName,
          mimeType,
          unauthorizedUser
        )
      ).rejects.toThrow(
        'Unauthorized: You must be the task owner or assigned to this task to upload files'
      );

      expect(mockStorageService.uploadFile).not.toHaveBeenCalled();
    });

    it('should reject upload when task storage limit exceeded', async () => {
      mockRepository.getTaskById.mockResolvedValue(mockTask as any);
      mockRepository.getTaskFiles.mockResolvedValue([]);
      mockStorageService.validateFile.mockReturnValue({ valid: true });
      mockStorageService.validateTaskFileLimit.mockReturnValue({
        valid: false,
        error: 'Task storage limit exceeded. Maximum 50MB per task.',
      });

      await expect(
        service.uploadFileToTask(
          'task-123',
          fileBuffer,
          fileName,
          mimeType,
          mockUser
        )
      ).rejects.toThrow('Task storage limit exceeded');

      expect(mockStorageService.uploadFile).not.toHaveBeenCalled();
    });

    it('should handle storage upload failures', async () => {
      mockRepository.getTaskById.mockResolvedValue(mockTask as any);
      mockRepository.getTaskFiles.mockResolvedValue([]);
      mockStorageService.validateFile.mockReturnValue({ valid: true });
      mockStorageService.validateTaskFileLimit.mockReturnValue({ valid: true });
      mockStorageService.uploadFile.mockRejectedValue(
        new Error('Storage service error')
      );

      await expect(
        service.uploadFileToTask(
          'task-123',
          fileBuffer,
          fileName,
          mimeType,
          mockUser
        )
      ).rejects.toThrow('Storage service error');

      expect(mockRepository.createTaskFile).not.toHaveBeenCalled();
    });
  });

  describe('getFileDownloadUrl', () => {
    it('should return download URL when user is assigned to task', async () => {
      const expectedUrl = 'https://storage.supabase.com/signed-url';

      mockRepository.getTaskFileById.mockResolvedValue(mockFile as any);
      mockRepository.getTaskById.mockResolvedValue(mockTask as any);
      mockStorageService.getFileDownloadUrl.mockResolvedValue(expectedUrl);

      const result = await service.getFileDownloadUrl('file-123', mockUser);

      expect(mockRepository.getTaskFileById).toHaveBeenCalledWith('file-123');
      expect(mockRepository.getTaskById).toHaveBeenCalledWith('task-123');
      expect(mockStorageService.getFileDownloadUrl).toHaveBeenCalledWith(
        mockFile.storagePath
      );
      expect(result).toBe(expectedUrl);
    });

    it('should reject download when file not found', async () => {
      mockRepository.getTaskFileById.mockResolvedValue(null);

      await expect(
        service.getFileDownloadUrl('file-999', mockUser)
      ).rejects.toThrow('File not found');

      expect(mockStorageService.getFileDownloadUrl).not.toHaveBeenCalled();
    });

    it('should reject download when user not assigned to task and not owner', async () => {
      const unauthorizedUser = {
        userId: 'user-999',
        role: 'STAFF' as const,
        departmentId: 'dept-1',
      };

      mockRepository.getTaskFileById.mockResolvedValue(mockFile as any);
      mockRepository.getTaskById.mockResolvedValue(mockTask as any);

      await expect(
        service.getFileDownloadUrl('file-123', unauthorizedUser)
      ).rejects.toThrow(
        'Unauthorized: You must be the task owner or assigned to this task to download files'
      );

      expect(mockStorageService.getFileDownloadUrl).not.toHaveBeenCalled();
    });

    it('should reject download when task not found', async () => {
      mockRepository.getTaskFileById.mockResolvedValue(mockFile as any);
      mockRepository.getTaskById.mockResolvedValue(null);

      await expect(
        service.getFileDownloadUrl('file-123', mockUser)
      ).rejects.toThrow('Task not found');

      expect(mockStorageService.getFileDownloadUrl).not.toHaveBeenCalled();
    });
  });

  describe('deleteFile', () => {
    it('should allow uploader to delete their own file', async () => {
      mockRepository.getTaskFileById.mockResolvedValue(mockFile as any);
      mockRepository.getTaskById.mockResolvedValue(mockTask as any);
      mockStorageService.deleteFile.mockResolvedValue(undefined);
      mockRepository.deleteTaskFile.mockResolvedValue(undefined);
      mockRepository.logTaskAction.mockResolvedValue(undefined);

      await service.deleteFile('file-123', mockUser);

      expect(mockStorageService.deleteFile).toHaveBeenCalledWith(
        mockFile.storagePath
      );
      expect(mockRepository.deleteTaskFile).toHaveBeenCalledWith('file-123');
      expect(mockRepository.logTaskAction).toHaveBeenCalledWith(
        'task-123',
        mockUser.userId,
        'FILE_UPLOADED',
        expect.objectContaining({ action: 'deleted' })
      );
    });

    it('should allow task owner to delete any file', async () => {
      const taskOwner = {
        userId: 'owner-123',
        role: 'MANAGER' as const,
        departmentId: 'dept-1',
      };

      mockRepository.getTaskFileById.mockResolvedValue(mockFile as any);
      mockRepository.getTaskById.mockResolvedValue(mockTask as any);
      mockStorageService.deleteFile.mockResolvedValue(undefined);
      mockRepository.deleteTaskFile.mockResolvedValue(undefined);
      mockRepository.logTaskAction.mockResolvedValue(undefined);

      await service.deleteFile('file-123', taskOwner);

      expect(mockStorageService.deleteFile).toHaveBeenCalledWith(
        mockFile.storagePath
      );
      expect(mockRepository.deleteTaskFile).toHaveBeenCalledWith('file-123');
    });

    it('should reject delete when user is not uploader or task owner', async () => {
      const unauthorizedUser = {
        userId: 'user-999',
        role: 'STAFF' as const,
        departmentId: 'dept-1',
      };

      mockRepository.getTaskFileById.mockResolvedValue(mockFile as any);
      mockRepository.getTaskById.mockResolvedValue(mockTask as any);

      await expect(
        service.deleteFile('file-123', unauthorizedUser)
      ).rejects.toThrow(
        'Unauthorized: Only the uploader or task owner can delete files'
      );

      expect(mockStorageService.deleteFile).not.toHaveBeenCalled();
    });

    it('should reject delete when file not found', async () => {
      mockRepository.getTaskFileById.mockResolvedValue(null);

      await expect(service.deleteFile('file-999', mockUser)).rejects.toThrow(
        'File not found'
      );

      expect(mockStorageService.deleteFile).not.toHaveBeenCalled();
    });

    it('should handle storage deletion failures', async () => {
      mockRepository.getTaskFileById.mockResolvedValue(mockFile as any);
      mockRepository.getTaskById.mockResolvedValue(mockTask as any);
      mockStorageService.deleteFile.mockRejectedValue(
        new Error('Storage deletion failed')
      );

      await expect(service.deleteFile('file-123', mockUser)).rejects.toThrow(
        'Storage deletion failed'
      );

      expect(mockRepository.deleteTaskFile).not.toHaveBeenCalled();
    });
  });

  describe('getTaskFiles', () => {
    const mockFiles = [
      mockFile,
      { ...mockFile, id: 'file-456', fileName: 'test2.pdf' },
    ];

    it('should return all files when user is assigned to task', async () => {
      mockRepository.getTaskById.mockResolvedValue(mockTask as any);
      mockRepository.getTaskFiles.mockResolvedValue(mockFiles as any);

      const result = await service.getTaskFiles('task-123', mockUser);

      expect(mockRepository.getTaskById).toHaveBeenCalledWith('task-123');
      expect(mockRepository.getTaskFiles).toHaveBeenCalledWith('task-123');
      expect(result).toEqual(mockFiles);
    });

    it('should reject when task not found', async () => {
      mockRepository.getTaskById.mockResolvedValue(null);

      await expect(service.getTaskFiles('task-999', mockUser)).rejects.toThrow(
        'Task not found'
      );

      expect(mockRepository.getTaskFiles).not.toHaveBeenCalled();
    });

    it('should allow task owner to view files even if not assigned', async () => {
      const taskOwner = {
        userId: 'owner-123',
        role: 'MANAGER' as const,
        departmentId: 'dept-1',
      };

      mockRepository.getTaskById.mockResolvedValue(mockTask as any);
      mockRepository.getTaskFiles.mockResolvedValue(mockFiles as any);

      const result = await service.getTaskFiles('task-123', taskOwner);

      expect(mockRepository.getTaskById).toHaveBeenCalledWith('task-123');
      expect(mockRepository.getTaskFiles).toHaveBeenCalledWith('task-123');
      expect(result).toEqual(mockFiles);
    });

    it('should reject when user not assigned to task and not owner', async () => {
      const unauthorizedUser = {
        userId: 'user-999',
        role: 'STAFF' as const,
        departmentId: 'dept-1',
      };

      mockRepository.getTaskById.mockResolvedValue(mockTask as any);

      await expect(
        service.getTaskFiles('task-123', unauthorizedUser)
      ).rejects.toThrow(
        'Unauthorized: You must be the task owner or assigned to this task to view files'
      );

      expect(mockRepository.getTaskFiles).not.toHaveBeenCalled();
    });

    it('should return empty array when task has no files', async () => {
      mockRepository.getTaskById.mockResolvedValue(mockTask as any);
      mockRepository.getTaskFiles.mockResolvedValue([]);

      const result = await service.getTaskFiles('task-123', mockUser);

      expect(result).toEqual([]);
    });
  });
});
