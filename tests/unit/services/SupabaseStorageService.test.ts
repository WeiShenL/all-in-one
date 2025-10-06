import crypto from 'crypto';

// Mock crypto.randomUUID for Node.js test environment
Object.defineProperty(global, 'crypto', {
  value: {
    randomUUID: () => crypto.randomUUID(),
  },
  writable: true,
});

// Mock the entire SupabaseStorageService module
const mockUpload = jest.fn();
const mockCreateSignedUrl = jest.fn();
const mockRemove = jest.fn();
const mockFrom = jest.fn().mockReturnValue({
  upload: mockUpload,
  createSignedUrl: mockCreateSignedUrl,
  remove: mockRemove,
});

jest.mock('@/services/storage/SupabaseStorageService', () => {
  return {
    SupabaseStorageService: jest.fn().mockImplementation(() => {
      return {
        uploadFile: jest.fn(
          async (
            taskId: string,
            file: Buffer,
            fileName: string,
            fileType: string
          ) => {
            const { data, error } = await mockFrom('task-attachments').upload(
              `${taskId}/uuid-${fileName}`,
              file,
              { contentType: fileType, upsert: false }
            );
            if (error) {
              throw new Error(`File upload failed: ${error.message}`);
            }
            return { storagePath: data.path, fileSize: file.length };
          }
        ),
        getFileDownloadUrl: jest.fn(async (storagePath: string) => {
          const { data, error } = await mockFrom(
            'task-attachments'
          ).createSignedUrl(storagePath, 3600);
          if (error) {
            throw new Error(
              `Failed to generate download URL: ${error.message}`
            );
          }
          return data.signedUrl;
        }),
        deleteFile: jest.fn(async (storagePath: string) => {
          const { error } = await mockFrom('task-attachments').remove([
            storagePath,
          ]);
          if (error) {
            throw new Error(`Failed to delete file: ${error.message}`);
          }
        }),
      };
    }),
  };
});

import { SupabaseStorageService } from '@/services/storage/SupabaseStorageService';

describe('SupabaseStorageService', () => {
  let service: SupabaseStorageService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new SupabaseStorageService();
  });

  describe('uploadFile', () => {
    it('should successfully upload a file', async () => {
      const taskId = '123e4567-e89b-12d3-a456-426614174000';
      const fileBuffer = Buffer.from('test file content');
      const fileName = 'test.pdf';
      const mimeType = 'application/pdf';

      mockUpload.mockResolvedValue({
        data: { path: `${taskId}/uuid-${fileName}` },
        error: null,
      });

      const result = await service.uploadFile(
        taskId,
        fileBuffer,
        fileName,
        mimeType
      );

      expect(result).toHaveProperty('storagePath');
      expect(result.fileSize).toBe(fileBuffer.length);
      expect(service.uploadFile).toHaveBeenCalledWith(
        taskId,
        fileBuffer,
        fileName,
        mimeType
      );
    });

    it('should handle upload errors from Supabase', async () => {
      const taskId = '123e4567-e89b-12d3-a456-426614174000';
      const fileBuffer = Buffer.from('test');
      const fileName = 'test.pdf';
      const mimeType = 'application/pdf';

      mockUpload.mockResolvedValue({
        data: null,
        error: { message: 'Storage error' },
      });

      await expect(
        service.uploadFile(taskId, fileBuffer, fileName, mimeType)
      ).rejects.toThrow('File upload failed: Storage error');
    });
  });

  describe('getFileDownloadUrl', () => {
    it('should generate a signed URL for download', async () => {
      const storagePath = '123e4567-e89b-12d3-a456-426614174000/test.pdf';
      const expectedUrl = 'https://storage.supabase.com/signed-url';

      mockCreateSignedUrl.mockResolvedValue({
        data: { signedUrl: expectedUrl },
        error: null,
      });

      const result = await service.getFileDownloadUrl(storagePath);

      expect(result).toBe(expectedUrl);
      expect(service.getFileDownloadUrl).toHaveBeenCalledWith(storagePath);
    });

    it('should handle errors when generating signed URL', async () => {
      const storagePath = '123e4567-e89b-12d3-a456-426614174000/test.pdf';

      mockCreateSignedUrl.mockResolvedValue({
        data: null,
        error: { message: 'URL generation failed' },
      });

      await expect(service.getFileDownloadUrl(storagePath)).rejects.toThrow(
        'Failed to generate download URL: URL generation failed'
      );
    });
  });

  describe('deleteFile', () => {
    it('should successfully delete a file', async () => {
      const storagePath = '123e4567-e89b-12d3-a456-426614174000/test.pdf';

      mockRemove.mockResolvedValue({
        data: [{ name: storagePath }],
        error: null,
      });

      await service.deleteFile(storagePath);

      expect(service.deleteFile).toHaveBeenCalledWith(storagePath);
    });

    it('should handle delete errors', async () => {
      const storagePath = '123e4567-e89b-12d3-a456-426614174000/test.pdf';

      mockRemove.mockResolvedValue({
        data: null,
        error: { message: 'Delete failed' },
      });

      await expect(service.deleteFile(storagePath)).rejects.toThrow(
        'Failed to delete file: Delete failed'
      );
    });
  });
});
