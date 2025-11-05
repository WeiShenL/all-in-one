import crypto from 'crypto';

// Mock crypto.randomUUID for Node.js test environment
Object.defineProperty(global, 'crypto', {
  value: {
    randomUUID: () => crypto.randomUUID(),
  },
  writable: true,
});

// Mock Supabase client
const mockUpload = jest.fn();
const mockCreateSignedUrl = jest.fn();
const mockRemove = jest.fn();
const mockFrom = jest.fn().mockReturnValue({
  upload: mockUpload,
  createSignedUrl: mockCreateSignedUrl,
  remove: mockRemove,
});

const mockSupabaseClient = {
  storage: {
    from: mockFrom,
  },
};

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => mockSupabaseClient),
}));

// Set up environment variables before importing
process.env.NEXT_PUBLIC_API_EXTERNAL_URL = 'https://test.supabase.co';
process.env.SERVICE_ROLE_KEY = 'test-service-key';

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
      expect(mockUpload).toHaveBeenCalled();
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
      expect(mockCreateSignedUrl).toHaveBeenCalled();
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

      expect(mockRemove).toHaveBeenCalled();
    });

    it('should handle delete errors', async () => {
      const storagePath = '123e4567-e89b-12d3-a456-426614174000/test.pdf';

      mockRemove.mockResolvedValue({
        data: null,
        error: { message: 'Delete failed' },
      });

      await expect(service.deleteFile(storagePath)).rejects.toThrow(
        'File deletion failed: Delete failed'
      );
    });
  });

  describe('validateFile', () => {
    it('should validate a valid PDF file', () => {
      const result = service.validateFile(
        'document.pdf',
        5 * 1024 * 1024, // 5MB
        'application/pdf'
      );

      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should validate a valid image file', () => {
      const result = service.validateFile(
        'image.png',
        2 * 1024 * 1024, // 2MB
        'image/png'
      );

      expect(result.valid).toBe(true);
    });

    it('should validate a valid Word document', () => {
      const result = service.validateFile(
        'doc.docx',
        8 * 1024 * 1024, // 8MB
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      );

      expect(result.valid).toBe(true);
    });

    it('should validate a valid Excel spreadsheet', () => {
      const result = service.validateFile(
        'sheet.xlsx',
        3 * 1024 * 1024, // 3MB
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );

      expect(result.valid).toBe(true);
    });

    it('should reject file larger than 10MB', () => {
      const result = service.validateFile(
        'large.pdf',
        15 * 1024 * 1024, // 15MB
        'application/pdf'
      );

      expect(result.valid).toBe(false);
      expect(result.error).toContain('File size exceeds 10MB limit');
      expect(result.error).toContain('15.00MB');
    });

    it('should reject file exactly at 10MB + 1 byte', () => {
      const result = service.validateFile(
        'large.pdf',
        10 * 1024 * 1024 + 1, // Just over 10MB
        'application/pdf'
      );

      expect(result.valid).toBe(false);
      expect(result.error).toContain('File size exceeds 10MB limit');
    });

    it('should accept file exactly at 10MB', () => {
      const result = service.validateFile(
        'large.pdf',
        10 * 1024 * 1024, // Exactly 10MB
        'application/pdf'
      );

      expect(result.valid).toBe(true);
    });

    it('should reject unsupported file type', () => {
      const result = service.validateFile(
        'script.exe',
        1 * 1024 * 1024, // 1MB
        'application/x-msdownload'
      );

      expect(result.valid).toBe(false);
      expect(result.error).toContain('File type');
      expect(result.error).toContain('is not allowed');
    });

    it('should reject JavaScript files', () => {
      const result = service.validateFile(
        'code.js',
        100 * 1024, // 100KB
        'application/javascript'
      );

      expect(result.valid).toBe(false);
      expect(result.error).toContain('not allowed');
    });

    it('should accept text files', () => {
      const result = service.validateFile(
        'readme.txt',
        50 * 1024, // 50KB
        'text/plain'
      );

      expect(result.valid).toBe(true);
    });

    it('should accept ZIP files', () => {
      const result = service.validateFile(
        'archive.zip',
        5 * 1024 * 1024, // 5MB
        'application/zip'
      );

      expect(result.valid).toBe(true);
    });

    it('should accept all image types', () => {
      const imageTypes = [
        { name: 'photo.jpg', type: 'image/jpeg' },
        { name: 'photo.png', type: 'image/png' },
        { name: 'photo.gif', type: 'image/gif' },
      ];

      imageTypes.forEach(({ name, type }) => {
        const result = service.validateFile(name, 1 * 1024 * 1024, type);
        expect(result.valid).toBe(true);
      });
    });

    it('should accept legacy Office documents', () => {
      const legacyTypes = [
        { name: 'doc.doc', type: 'application/msword' },
        { name: 'sheet.xls', type: 'application/vnd.ms-excel' },
      ];

      legacyTypes.forEach(({ name, type }) => {
        const result = service.validateFile(name, 1 * 1024 * 1024, type);
        expect(result.valid).toBe(true);
      });
    });
  });

  describe('validateTaskFileLimit', () => {
    it('should allow upload when within 50MB limit', () => {
      const result = service.validateTaskFileLimit(
        20 * 1024 * 1024, // 20MB current
        10 * 1024 * 1024 // 10MB new file
      );

      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should allow upload when exactly at 50MB limit', () => {
      const result = service.validateTaskFileLimit(
        40 * 1024 * 1024, // 40MB current
        10 * 1024 * 1024 // 10MB new file = exactly 50MB total
      );

      expect(result.valid).toBe(true);
    });

    it('should reject upload when exceeding 50MB limit', () => {
      const result = service.validateTaskFileLimit(
        45 * 1024 * 1024, // 45MB current
        10 * 1024 * 1024 // 10MB new file = 55MB total
      );

      expect(result.valid).toBe(false);
      expect(result.error).toContain('Task file limit exceeded');
      expect(result.error).toContain('45.00MB');
      expect(result.error).toContain('10.00MB');
      expect(result.error).toContain('50MB');
    });

    it('should reject upload when just over 50MB limit', () => {
      const result = service.validateTaskFileLimit(
        50 * 1024 * 1024, // 50MB current
        1 // Just 1 byte more
      );

      expect(result.valid).toBe(false);
      expect(result.error).toContain('Task file limit exceeded');
    });

    it('should allow first file upload when task is empty', () => {
      const result = service.validateTaskFileLimit(
        0, // No files yet
        10 * 1024 * 1024 // 10MB file
      );

      expect(result.valid).toBe(true);
    });

    it('should handle multiple small files approaching limit', () => {
      // Scenario: Task has 49MB of files, trying to add 500KB file
      const result = service.validateTaskFileLimit(
        49 * 1024 * 1024,
        500 * 1024
      );

      expect(result.valid).toBe(true);
    });

    it('should reject when multiple small files exceed limit', () => {
      // Scenario: Task has 49.5MB of files, trying to add 1MB file
      const result = service.validateTaskFileLimit(
        49.5 * 1024 * 1024,
        1 * 1024 * 1024
      );

      expect(result.valid).toBe(false);
      expect(result.error).toContain('Task file limit exceeded');
    });

    it('should handle edge case with maximum file sizes', () => {
      // Scenario: Task has 40MB, trying to add max 10MB file
      const result = service.validateTaskFileLimit(
        40 * 1024 * 1024,
        10 * 1024 * 1024
      );

      expect(result.valid).toBe(true);
    });
  });
});
