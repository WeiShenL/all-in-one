/**
 * TDD Tests for Task.addFile() and Task.removeFile()
 *
 * AC: Assigned Staff member can add/delete file attachments (up to 50MB total - TM044)
 * Constraints: Images, PDFs, docs, spreadsheets only (TM005)
 */

import { FileData } from '../../../../src/domain/task/Task';
import {
  UnauthorizedError,
  FileSizeLimitExceededError,
  InvalidFileTypeError,
} from '../../../../src/domain/task/errors/TaskErrors';
import { createTestTask } from '../../../helpers/taskTestHelpers';

const createMockFile = (overrides: Partial<FileData> = {}): FileData => {
  return {
    id: `file-${Date.now()}`,
    fileName: 'document.pdf',
    fileSize: 1024 * 1024, // 1MB
    fileType: 'application/pdf',
    storagePath: '/uploads/file.pdf',
    uploadedById: 'user-1',
    uploadedAt: new Date(),
    ...overrides,
  };
};

describe('Task - Files', () => {
  describe('addFile() - Authorization', () => {
    it('should allow assigned user to add file', async () => {
      const task = createTestTask({
        assignments: new Set(['user-1']),
      });

      const file = createMockFile();
      await task.addFile(file, 'user-1');

      const files = task.getFiles();
      expect(files.length).toBe(1);
      expect(files[0].fileName).toBe('document.pdf');
    });

    it('should throw UnauthorizedError when user is not assigned', async () => {
      const task = createTestTask({
        assignments: new Set(['user-1']),
      });

      const file = createMockFile();
      await expect(task.addFile(file, 'user-999')).rejects.toThrow(
        UnauthorizedError
      );
    });
  });

  describe('addFile() - File Type Validation (TM005)', () => {
    it('should accept PDF files', async () => {
      const task = createTestTask({
        assignments: new Set(['user-1']),
      });

      const file = createMockFile({ fileType: 'application/pdf' });
      await task.addFile(file, 'user-1');

      expect(task.getFiles().length).toBe(1);
    });

    it('should accept image files (PNG, JPG, JPEG)', async () => {
      const task = createTestTask({
        assignments: new Set(['user-1']),
      });

      await task.addFile(
        createMockFile({ fileType: 'image/png', fileName: 'image.png' }),
        'user-1'
      );
      await task.addFile(
        createMockFile({ fileType: 'image/jpeg', fileName: 'photo.jpg' }),
        'user-1'
      );

      expect(task.getFiles().length).toBe(2);
    });

    it('should accept Word documents', async () => {
      const task = createTestTask({
        assignments: new Set(['user-1']),
      });

      const file = createMockFile({
        fileType:
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        fileName: 'report.docx',
      });
      await task.addFile(file, 'user-1');

      expect(task.getFiles().length).toBe(1);
    });

    it('should accept Excel spreadsheets', async () => {
      const task = createTestTask({
        assignments: new Set(['user-1']),
      });

      const file = createMockFile({
        fileType:
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        fileName: 'data.xlsx',
      });
      await task.addFile(file, 'user-1');

      expect(task.getFiles().length).toBe(1);
    });

    it('should throw InvalidFileTypeError for executable files', async () => {
      const task = createTestTask({
        assignments: new Set(['user-1']),
      });

      const file = createMockFile({
        fileType: 'application/x-msdownload',
        fileName: 'virus.exe',
      });

      await expect(task.addFile(file, 'user-1')).rejects.toThrow(
        InvalidFileTypeError
      );
    });

    it('should throw InvalidFileTypeError for video files', async () => {
      const task = createTestTask({
        assignments: new Set(['user-1']),
      });

      const file = createMockFile({
        fileType: 'video/mp4',
        fileName: 'video.mp4',
      });

      await expect(task.addFile(file, 'user-1')).rejects.toThrow(
        InvalidFileTypeError
      );
    });
  });

  describe('addFile() - Size Limit (TM044)', () => {
    it('should accept files under 50MB total', async () => {
      const task = createTestTask({
        assignments: new Set(['user-1']),
      });

      const file1 = createMockFile({
        fileSize: 20 * 1024 * 1024,
        fileName: 'file1.pdf',
      }); // 20MB
      const file2 = createMockFile({
        fileSize: 25 * 1024 * 1024,
        fileName: 'file2.pdf',
      }); // 25MB

      await task.addFile(file1, 'user-1');
      await task.addFile(file2, 'user-1'); // Total 45MB - should succeed

      expect(task.getFiles().length).toBe(2);
    });

    it('should throw FileSizeLimitExceededError when exceeding 50MB', async () => {
      const task = createTestTask({
        assignments: new Set(['user-1']),
      });

      const file1 = createMockFile({
        fileSize: 30 * 1024 * 1024,
        fileName: 'file1.pdf',
      }); // 30MB
      const file2 = createMockFile({
        fileSize: 25 * 1024 * 1024,
        fileName: 'file2.pdf',
      }); // 25MB

      await task.addFile(file1, 'user-1');

      // Adding 25MB when already at 30MB = 55MB total
      await expect(task.addFile(file2, 'user-1')).rejects.toThrow(
        FileSizeLimitExceededError
      );
    });

    it('should accept exactly 50MB total (boundary)', async () => {
      const task = createTestTask({
        assignments: new Set(['user-1']),
      });

      const file = createMockFile({
        fileSize: 50 * 1024 * 1024,
        fileName: 'large.pdf',
      }); // Exactly 50MB

      await task.addFile(file, 'user-1');

      expect(task.getFiles().length).toBe(1);
    });
  });

  describe('addFile() - State Updates', () => {
    it('should update task timestamp when file is added', async () => {
      const task = createTestTask({
        assignments: new Set(['user-1']),
      });

      const oldTimestamp = task.getUpdatedAt();

      const file = createMockFile();
      await task.addFile(file, 'user-1');

      const newTimestamp = task.getUpdatedAt();
      expect(newTimestamp.getTime()).toBeGreaterThanOrEqual(
        oldTimestamp.getTime()
      );
    });
  });

  describe('removeFile() - Authorization', () => {
    it('should allow assigned user to remove file', async () => {
      const task = createTestTask({
        assignments: new Set(['user-1']),
      });

      const file = createMockFile({ id: 'file-123' });
      await task.addFile(file, 'user-1');

      task.removeFile('file-123', 'user-1');

      expect(task.getFiles().length).toBe(0);
    });

    it('should throw UnauthorizedError when user is not assigned', async () => {
      const task = createTestTask({
        assignments: new Set(['user-1']),
      });

      const file = createMockFile({ id: 'file-123' });
      await task.addFile(file, 'user-1');

      expect(() => task.removeFile('file-123', 'user-999')).toThrow(
        UnauthorizedError
      );
    });
  });

  describe('removeFile() - Removing Files', () => {
    it('should remove an existing file', async () => {
      const task = createTestTask({
        assignments: new Set(['user-1']),
      });

      const file1 = createMockFile({ id: 'file-1', fileName: 'doc1.pdf' });
      const file2 = createMockFile({ id: 'file-2', fileName: 'doc2.pdf' });

      await task.addFile(file1, 'user-1');
      await task.addFile(file2, 'user-1');

      task.removeFile('file-1', 'user-1');

      const files = task.getFiles();
      expect(files.length).toBe(1);
      expect(files[0].fileName).toBe('doc2.pdf');
    });

    it('should handle removing non-existent file gracefully', async () => {
      const task = createTestTask({
        assignments: new Set(['user-1']),
      });

      const file = createMockFile({ id: 'file-1' });
      await task.addFile(file, 'user-1');

      task.removeFile('nonexistent-id', 'user-1'); // Should not throw

      expect(task.getFiles().length).toBe(1); // Still has original file
    });

    it('should update task timestamp when file is removed', async () => {
      const task = createTestTask({
        assignments: new Set(['user-1']),
      });

      const file = createMockFile({ id: 'file-123' });
      await task.addFile(file, 'user-1');

      const oldTimestamp = task.getUpdatedAt();

      task.removeFile('file-123', 'user-1');

      const newTimestamp = task.getUpdatedAt();
      expect(newTimestamp.getTime()).toBeGreaterThanOrEqual(
        oldTimestamp.getTime()
      );
    });
  });

  describe('Edge Cases', () => {
    it('should work when task has multiple assignees', async () => {
      const task = createTestTask({
        assignments: new Set(['user-1', 'user-2', 'user-3']),
      });

      const file = createMockFile();
      await task.addFile(file, 'user-2');

      expect(task.getFiles().length).toBe(1);
    });

    it('should preserve other task properties when managing files', async () => {
      const task = createTestTask({
        assignments: new Set(['user-1']),
        title: 'Important Task',
        priorityBucket: 10,
      });

      const file = createMockFile();
      await task.addFile(file, 'user-1');

      expect(task.getTitle()).toBe('Important Task');
      expect(task.getPriorityBucket()).toBe(10);
    });
  });
});
