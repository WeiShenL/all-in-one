import { router, publicProcedure } from '../trpc';
import { TaskService } from '../../../services/task/TaskService';
import { PrismaTaskRepository } from '../../../repositories/PrismaTaskRepository';
import { z } from 'zod';

/**
 * Task File Router
 * tRPC endpoints for file upload, download, and delete operations
 */

// Input validation schemas
const uploadFileSchema = z.object({
  taskId: z.string().uuid(),
  fileName: z.string().min(1).max(255),
  fileType: z.string(),
  fileData: z.string(), // Base64 encoded file
  userId: z.string().uuid(), // User ID from frontend
  userRole: z.enum(['STAFF', 'MANAGER', 'HR_ADMIN']),
  departmentId: z.string(),
});

const getFileDownloadUrlSchema = z.object({
  fileId: z.string().uuid(),
  userId: z.string().uuid(),
  userRole: z.enum(['STAFF', 'MANAGER', 'HR_ADMIN']),
  departmentId: z.string(),
});

const deleteFileSchema = z.object({
  fileId: z.string().uuid(),
  userId: z.string().uuid(),
  userRole: z.enum(['STAFF', 'MANAGER', 'HR_ADMIN']),
  departmentId: z.string(),
});

const getTaskFilesSchema = z.object({
  taskId: z.string().uuid(),
  userId: z.string().uuid(),
  userRole: z.enum(['STAFF', 'MANAGER', 'HR_ADMIN']),
  departmentId: z.string(),
});

const getUserTasksSchema = z.object({
  userId: z.string().uuid(),
});

export const taskFileRouter = router({
  /**
   * Get user's assigned tasks
   */
  getUserTasks: publicProcedure
    .input(getUserTasksSchema)
    .query(async ({ ctx, input }) => {
      const tasks = await ctx.prisma.task.findMany({
        where: {
          assignments: {
            some: {
              userId: input.userId,
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

      return {
        tasks: tasks.map(t => ({
          id: t.id,
          title: t.title,
          description: t.description,
          status: t.status,
          priority: t.priority,
          dueDate: t.dueDate,
          owner: t.owner,
          fileCount: t._count.files,
          createdAt: t.createdAt,
        })),
      };
    }),

  /**
   * Upload a file to a task
   */
  uploadFile: publicProcedure
    .input(uploadFileSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const repository = new PrismaTaskRepository(ctx.prisma);
        const service = new TaskService(repository);

        // Use user context from frontend
        const user = {
          userId: input.userId,
          role: input.userRole,
          departmentId: input.departmentId,
        };

        // Decode base64 file data
        const fileBuffer = Buffer.from(input.fileData, 'base64');

        const fileRecord = await service.uploadFileToTask(
          input.taskId,
          fileBuffer,
          input.fileName,
          input.fileType,
          user
        );

        return {
          success: true,
          file: {
            id: fileRecord.id,
            fileName: fileRecord.fileName,
            fileSize: fileRecord.fileSize,
            fileType: fileRecord.fileType,
            uploadedAt: fileRecord.uploadedAt,
          },
        };
      } catch (error) {
        console.error('[uploadFile] Error:', error);
        throw error;
      }
    }),

  /**
   * Get download URL for a file
   */
  getFileDownloadUrl: publicProcedure
    .input(getFileDownloadUrlSchema)
    .query(async ({ ctx, input }) => {
      const repository = new PrismaTaskRepository(ctx.prisma);
      const service = new TaskService(repository);

      const user = {
        userId: input.userId,
        role: input.userRole,
        departmentId: input.departmentId,
      };

      const downloadUrl = await service.getFileDownloadUrl(input.fileId, user);

      return {
        downloadUrl,
        expiresIn: 3600, // 1 hour
      };
    }),

  /**
   * Delete a file
   */
  deleteFile: publicProcedure
    .input(deleteFileSchema)
    .mutation(async ({ ctx, input }) => {
      const repository = new PrismaTaskRepository(ctx.prisma);
      const service = new TaskService(repository);

      const user = {
        userId: input.userId,
        role: input.userRole,
        departmentId: input.departmentId,
      };

      await service.deleteFile(input.fileId, user);

      return { success: true };
    }),

  /**
   * Get all files for a task
   */
  getTaskFiles: publicProcedure
    .input(getTaskFilesSchema)
    .query(async ({ ctx, input }) => {
      const repository = new PrismaTaskRepository(ctx.prisma);
      const service = new TaskService(repository);

      const user = {
        userId: input.userId,
        role: input.userRole,
        departmentId: input.departmentId,
      };

      const files = await service.getTaskFiles(input.taskId, user);

      return {
        files: files.map(f => ({
          id: f.id,
          fileName: f.fileName,
          fileSize: f.fileSize,
          fileType: f.fileType,
          uploadedById: f.uploadedById,
          uploadedAt: f.uploadedAt,
        })),
        totalSize: files.reduce((sum, f) => sum + f.fileSize, 0),
        count: files.length,
      };
    }),
});
