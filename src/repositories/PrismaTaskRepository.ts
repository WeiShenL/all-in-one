import { PrismaClient } from '@prisma/client';
import { ITaskRepository } from './ITaskRepository';

/**
 * Prisma implementation of ITaskRepository
 * Handles database operations for task files
 */
export class PrismaTaskRepository implements ITaskRepository {
  constructor(private prisma: PrismaClient) {}

  /**
   * Create a new task file record
   */
  async createTaskFile(data: {
    taskId: string;
    fileName: string;
    fileSize: number;
    fileType: string;
    storagePath: string;
    uploadedById: string;
  }) {
    return await this.prisma.taskFile.create({
      data: {
        taskId: data.taskId,
        fileName: data.fileName,
        fileSize: data.fileSize,
        fileType: data.fileType,
        storagePath: data.storagePath,
        uploadedById: data.uploadedById,
      },
    });
  }

  /**
   * Get all files for a task
   */
  async getTaskFiles(taskId: string) {
    return await this.prisma.taskFile.findMany({
      where: { taskId },
      orderBy: { uploadedAt: 'desc' },
    });
  }

  /**
   * Get a specific file by ID
   */
  async getTaskFileById(fileId: string) {
    return await this.prisma.taskFile.findUnique({
      where: { id: fileId },
    });
  }

  /**
   * Delete a file record
   */
  async deleteTaskFile(fileId: string) {
    await this.prisma.taskFile.delete({
      where: { id: fileId },
    });
  }

  /**
   * Get task by ID with assignments
   * Needed for authorization checks
   */
  async getTaskById(taskId: string): Promise<{
    id: string;
    assignments: Array<{ userId: string }>;
    ownerId: string;
  } | null> {
    return await this.prisma.task.findUnique({
      where: { id: taskId },
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
  }

  /**
   * Log a task action
   */
  async logTaskAction(
    taskId: string,
    userId: string,
    action: string,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    await this.prisma.taskLog.create({
      data: {
        taskId,
        userId,
        action: action as
          | 'CREATED'
          | 'UPDATED'
          | 'STATUS_CHANGED'
          | 'COMMENT_ADDED'
          | 'FILE_UPLOADED',
        metadata: metadata || {},
      },
    });
  }
}
