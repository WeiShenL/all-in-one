import { router, publicProcedure, protectedProcedure, Context } from '../trpc';
import { TaskService } from '../../../services/task/TaskService';
import { SubtaskService } from '../services/SubtaskService';
import { PrismaTaskRepository } from '../../../repositories/PrismaTaskRepository';
import { z } from 'zod';
import { TaskStatus, Task } from '../../../domain/task/Task';
import { UserContext } from '../../../services/task/TaskService';
import { TaskService as DashboardTaskService } from '../services/TaskService';

/**
 * Task Router - UPDATE Operations
 *
 * Exposes all UPDATE endpoints for the Task Management system
 * Authorization is handled in the TaskService layer
 */

// Helper to get authenticated user context from tRPC context
async function getUserContext(ctx: Context): Promise<UserContext> {
  if (!ctx.userId) {
    throw new Error('User not authenticated');
  }

  const userProfile = await ctx.prisma.userProfile.findUnique({
    where: { id: ctx.userId },
  });

  if (!userProfile) {
    throw new Error('User profile not found');
  }

  return {
    userId: ctx.userId,
    role: userProfile.role as 'STAFF' | 'MANAGER' | 'HR_ADMIN',
    departmentId: userProfile.departmentId,
  };
}

// Helper to serialize Task domain object to plain JSON for tRPC. (trpc cannot read OO objects...)
function serializeTask(task: Task) {
  return {
    id: task.getId(),
    title: task.getTitle(),
    description: task.getDescription(),
    priorityBucket: task.getPriorityBucket(),
    dueDate: task.getDueDate().toISOString(),
    status: task.getStatus(),
    ownerId: task.getOwnerId(),
    departmentId: task.getDepartmentId(),
    projectId: task.getProjectId(),
    parentTaskId: task.getParentTaskId(),
    isRecurring: task.isTaskRecurring(),
    recurringInterval: task.getRecurringInterval(),
    isArchived: task.getIsArchived(),
    createdAt: task.getCreatedAt().toISOString(),
    updatedAt: task.getUpdatedAt().toISOString(),
    assignments: Array.from(task.getAssignees()),
    tags: Array.from(task.getTags()),
    comments: task.getComments().map(c => ({
      id: c.id,
      content: c.content,
      authorId: c.authorId,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
    })),
  };
}

// Input validation schemas
const updateTitleSchema = z.object({
  taskId: z.string().uuid(),
  title: z.string().min(1).max(255),
});

const updateDescriptionSchema = z.object({
  taskId: z.string().uuid(),
  description: z.string(),
});

const updatePrioritySchema = z.object({
  taskId: z.string().uuid(),
  priority: z.number().min(1).max(10),
});

const updateDeadlineSchema = z.object({
  taskId: z.string().uuid(),
  deadline: z
    .string()
    .datetime()
    .transform(str => new Date(str)),
});

const updateStatusSchema = z.object({
  taskId: z.string().uuid(),
  status: z.enum(['TO_DO', 'IN_PROGRESS', 'COMPLETED', 'BLOCKED']),
});

const updateRecurringSchema = z.object({
  taskId: z.string().uuid(),
  enabled: z.boolean(),
  recurringInterval: z.number().nullable(),
});

const addTagSchema = z.object({
  taskId: z.string().uuid(),
  tag: z.string().min(1).max(50),
});

const removeTagSchema = z.object({
  taskId: z.string().uuid(),
  tag: z.string(),
});

const addAssigneeSchema = z.object({
  taskId: z.string().uuid(),
  userId: z.string().uuid(),
});

const addCommentSchema = z.object({
  taskId: z.string().uuid(),
  content: z.string().min(1),
});

const updateCommentSchema = z.object({
  taskId: z.string().uuid(),
  commentId: z.string(),
  content: z.string().min(1),
});

export const taskRouter = router({
  // ============================================
  // CREATE OPERATIONS
  // ============================================

  /**
   * Create a new task
   *
   * AC:
   * - Create tasks within projects or standalone
   * - Mandatory: title, description, priority (1-10), deadline, assignee
   * - Up to 5 assignees
   * - Auto-associate with department
   * - Default "To Do" status
   * - Optional tags/files
   * - Optional recurring with interval
   */
  create: publicProcedure
    .input(
      z.object({
        title: z.string().min(1, 'Title is required'),
        description: z.string().min(1, 'Description is required'),
        priority: z.number().min(1).max(10),
        dueDate: z.coerce.date(),
        assigneeIds: z.array(z.string().uuid()).min(1).max(5),
        projectId: z.string().uuid().optional(),
        tags: z.array(z.string()).optional(),
        recurringInterval: z.number().positive().optional(),
        parentTaskId: z.string().uuid().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const repository = new PrismaTaskRepository(ctx.prisma);
      const service = new TaskService(repository);
      const user = await getUserContext(ctx);

      const result = await service.createTask(
        {
          title: input.title,
          description: input.description,
          priority: input.priority,
          dueDate: input.dueDate,
          assigneeIds: input.assigneeIds,
          projectId: input.projectId,
          parentTaskId: input.parentTaskId,
          tags: input.tags,
          recurringInterval: input.recurringInterval,
        },
        user
      );

      return result;
    }),

  /**
   * Create a subtask under a parent task
   *
   * AC (SCRUM-65):
   * - Staff can create subtasks under tasks they are assigned to
   * - 2 levels maximum: Task → Subtask (no sub-subtasks)
   * - Mandatory fields: title, description, priority (1-10), deadline, assignee(s)
   * - Subtasks cannot be recurring
   * - Subtasks inherit department and project from parent
   * - Subtask deadline must be <= parent deadline
   */
  createSubtask: publicProcedure
    .input(
      z.object({
        title: z.string().min(1, 'Title is required'),
        description: z.string().min(1, 'Description is required'),
        priority: z.number().min(1).max(10),
        dueDate: z.coerce.date(),
        assigneeIds: z.array(z.string().uuid()).min(1).max(5),
        parentTaskId: z.string().uuid(),
        tags: z.array(z.string()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const repository = new PrismaTaskRepository(ctx.prisma);
      const service = new SubtaskService(repository);
      const user = await getUserContext(ctx);

      const result = await service.createSubtask(
        {
          title: input.title,
          description: input.description,
          priority: input.priority,
          dueDate: input.dueDate,
          assigneeIds: input.assigneeIds,
          parentTaskId: input.parentTaskId,
          tags: input.tags,
        },
        user
      );

      return result;
    }),

  // ============================================
  // UPDATE OPERATIONS
  // ============================================

  /**
   * Update task title
   */
  updateTitle: publicProcedure
    .input(updateTitleSchema)
    .mutation(async ({ ctx, input }) => {
      const repository = new PrismaTaskRepository(ctx.prisma);
      const service = new TaskService(repository);
      const user = await getUserContext(ctx);

      const task = await service.updateTaskTitle(
        input.taskId,
        input.title,
        user
      );
      return serializeTask(task);
    }),

  /**
   * Update task description
   */
  updateDescription: publicProcedure
    .input(updateDescriptionSchema)
    .mutation(async ({ ctx, input }) => {
      const repository = new PrismaTaskRepository(ctx.prisma);
      const service = new TaskService(repository);

      const user = await getUserContext(ctx);

      const task = await service.updateTaskDescription(
        input.taskId,
        input.description,
        user
      );
      return serializeTask(task);
    }),

  /**
   * Update task priority
   */
  updatePriority: publicProcedure
    .input(updatePrioritySchema)
    .mutation(async ({ ctx, input }) => {
      const repository = new PrismaTaskRepository(ctx.prisma);
      const service = new TaskService(repository);

      const user = await getUserContext(ctx);

      const task = await service.updateTaskPriority(
        input.taskId,
        input.priority,
        user
      );
      return serializeTask(task);
    }),

  /**
   * Update task deadline
   */
  updateDeadline: publicProcedure
    .input(updateDeadlineSchema)
    .mutation(async ({ ctx, input }) => {
      const repository = new PrismaTaskRepository(ctx.prisma);
      const service = new TaskService(repository);

      const user = await getUserContext(ctx);

      const task = await service.updateTaskDeadline(
        input.taskId,
        input.deadline,
        user
      );
      return serializeTask(task);
    }),

  /**
   * Update task status
   */
  updateStatus: publicProcedure
    .input(updateStatusSchema)
    .mutation(async ({ ctx, input }) => {
      const repository = new PrismaTaskRepository(ctx.prisma);
      const service = new TaskService(repository);

      const user = await getUserContext(ctx);

      const task = await service.updateTaskStatus(
        input.taskId,
        input.status as TaskStatus,
        user
      );
      return serializeTask(task);
    }),

  /**
   * Update task recurring settings
   */
  updateRecurring: publicProcedure
    .input(updateRecurringSchema)
    .mutation(async ({ ctx, input }) => {
      const repository = new PrismaTaskRepository(ctx.prisma);
      const service = new TaskService(repository);

      const user = await getUserContext(ctx);

      const task = await service.updateTaskRecurring(
        input.taskId,
        input.enabled,
        input.recurringInterval,
        user
      );
      return serializeTask(task);
    }),

  /**
   * Add tag to task
   */
  addTag: publicProcedure
    .input(addTagSchema)
    .mutation(async ({ ctx, input }) => {
      const repository = new PrismaTaskRepository(ctx.prisma);
      const service = new TaskService(repository);

      const user = await getUserContext(ctx);

      const task = await service.addTagToTask(input.taskId, input.tag, user);
      return serializeTask(task);
    }),

  /**
   * Remove tag from task
   */
  removeTag: publicProcedure
    .input(removeTagSchema)
    .mutation(async ({ ctx, input }) => {
      const repository = new PrismaTaskRepository(ctx.prisma);
      const service = new TaskService(repository);

      const user = await getUserContext(ctx);

      const task = await service.removeTagFromTask(
        input.taskId,
        input.tag,
        user
      );
      return serializeTask(task);
    }),

  /**
   * Add assignee to task
   */
  addAssignee: publicProcedure
    .input(addAssigneeSchema)
    .mutation(async ({ ctx, input }) => {
      const repository = new PrismaTaskRepository(ctx.prisma);
      const service = new TaskService(repository);

      const user = await getUserContext(ctx);

      const task = await service.addAssigneeToTask(
        input.taskId,
        input.userId,
        user
      );
      return serializeTask(task);
    }),

  /**
   * Remove assignee from task
   *
   * TODO: Make this role-based auth for MANAGER/HR_ADMIN only in future.
   * Currently violates TM015 for STAFF users: "Assigned Staff member can add
   * assignees, max 5 only. (but NOT remove them - TM015)"
   *
   * Related: SCRUM-14 Task Update User Story AC7
   */
  removeAssignee: publicProcedure
    .input(
      z.object({
        taskId: z.string().uuid(),
        userId: z.string().uuid(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const repository = new PrismaTaskRepository(ctx.prisma);
      const service = new TaskService(repository);

      const user = await getUserContext(ctx);

      const task = await service.removeAssigneeFromTask(
        input.taskId,
        input.userId,
        user
      );
      return serializeTask(task);
    }),

  /**
   * Add comment to task
   */
  addComment: publicProcedure
    .input(addCommentSchema)
    .mutation(async ({ ctx, input }) => {
      const repository = new PrismaTaskRepository(ctx.prisma);
      const service = new TaskService(repository);

      const user = await getUserContext(ctx);

      const task = await service.addCommentToTask(
        input.taskId,
        input.content,
        user
      );
      return serializeTask(task);
    }),

  /**
   * Update comment
   */
  updateComment: publicProcedure
    .input(updateCommentSchema)
    .mutation(async ({ ctx, input }) => {
      const repository = new PrismaTaskRepository(ctx.prisma);
      const service = new TaskService(repository);

      const user = await getUserContext(ctx);

      const task = await service.updateComment(
        input.taskId,
        input.commentId,
        input.content,
        user
      );
      return serializeTask(task);
    }),

  /**
   * Archive task (soft delete)
   */
  archive: publicProcedure
    .input(z.object({ taskId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const repository = new PrismaTaskRepository(ctx.prisma);
      const service = new TaskService(repository);

      const user = await getUserContext(ctx);

      const task = await service.archiveTask(input.taskId, user);
      return serializeTask(task);
    }),

  /**
   * Unarchive task
   */
  unarchive: publicProcedure
    .input(z.object({ taskId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const repository = new PrismaTaskRepository(ctx.prisma);
      const service = new TaskService(repository);

      const user = await getUserContext(ctx);

      const task = await service.unarchiveTask(input.taskId, user);
      return serializeTask(task);
    }),

  /**
   * Delete task (hard delete)
   * Cannot delete tasks with subtasks - must archive instead
   */
  delete: publicProcedure
    .input(z.object({ taskId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const repository = new PrismaTaskRepository(ctx.prisma);
      const service = new TaskService(repository);

      const user = await getUserContext(ctx);

      await service.deleteTask(input.taskId, user);
      return { success: true };
    }),

  // ============================================
  // QUERY OPERATIONS (for testing/viewing)
  // ============================================

  /**
   * Get task by ID
   */
  getById: publicProcedure
    .input(z.object({ taskId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const user = await getUserContext(ctx);
      const repository = new PrismaTaskRepository(ctx.prisma);
      const service = new TaskService(repository);
      const task = await service.getTaskById(input.taskId, user);
      return task ? serializeTask(task) : null;
    }),

  /**
   * Get all tasks with optional filters
   */
  getAll: publicProcedure
    .input(
      z.object({
        ownerId: z.string().uuid().optional(),
        projectId: z.string().uuid().optional(),
        departmentId: z.string().uuid().optional(),
        status: z
          .enum(['TO_DO', 'IN_PROGRESS', 'COMPLETED', 'BLOCKED'])
          .optional(),
        isArchived: z.boolean().optional(),
        parentTaskId: z.string().uuid().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const user = await getUserContext(ctx);
      const repository = new PrismaTaskRepository(ctx.prisma);
      const service = new TaskService(repository);
      const tasks = await service.getAllTasks(input, user);
      return tasks.map(serializeTask);
    }),

  /**
   * Get tasks by project
   */
  getByProject: publicProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        includeArchived: z.boolean().optional().default(false),
      })
    )
    .query(async ({ ctx, input }) => {
      const user = await getUserContext(ctx);
      const repository = new PrismaTaskRepository(ctx.prisma);
      const service = new TaskService(repository);
      const tasks = await service.getProjectTasks(
        input.projectId,
        user,
        input.includeArchived
      );
      return tasks.map(serializeTask);
    }),

  /**
   * Get subtasks of a parent task
   */
  getSubtasks: publicProcedure
    .input(z.object({ parentTaskId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const user = await getUserContext(ctx);
      const repository = new PrismaTaskRepository(ctx.prisma);
      const service = new TaskService(repository);
      const tasks = await service.getSubtasks(input.parentTaskId, user);
      return tasks.map(serializeTask);
    }),

  /**
   * Get tasks owned/created by a user
   */
  getByOwner: publicProcedure
    .input(
      z.object({
        ownerId: z.string().uuid(),
        includeArchived: z.boolean().optional().default(false),
      })
    )
    .query(async ({ ctx, input }) => {
      const repository = new PrismaTaskRepository(ctx.prisma);
      const service = new TaskService(repository);
      const tasks = await service.getOwnerTasks(
        input.ownerId,
        input.includeArchived
      );
      return tasks.map(serializeTask);
    }),

  /**
   * Get user's assigned tasks
   */
  getUserTasks: publicProcedure
    .input(
      z.object({
        userId: z.string().uuid(),
        includeArchived: z.boolean().optional().default(false),
      })
    )
    .query(async ({ ctx, input }) => {
      const repository = new PrismaTaskRepository(ctx.prisma);
      const service = new TaskService(repository);

      const tasks = await service.getUserTasks(
        input.userId,
        input.includeArchived
      );
      return tasks.map(serializeTask);
    }),

  /**
   * Get department tasks
   */
  getDepartmentTasks: publicProcedure
    .input(
      z.object({
        departmentId: z.string().uuid(),
        includeArchived: z.boolean().optional().default(false),
      })
    )
    .query(async ({ ctx, input }) => {
      const repository = new PrismaTaskRepository(ctx.prisma);
      const service = new TaskService(repository);

      const user = {
        userId: ctx.userId || 'test-user',
        role: 'MANAGER' as const, // Need manager role to view all department tasks
        departmentId: input.departmentId,
      };

      const tasks = await service.getDepartmentTasks(
        input.departmentId,
        user,
        input.includeArchived
      );
      return tasks.map(serializeTask);
    }),

  // ============================================
  // FILE OPERATIONS
  // ============================================

  /**
   * Upload a file to a task
   */
  uploadFile: publicProcedure
    .input(
      z.object({
        taskId: z.string().uuid(),
        fileName: z.string().min(1).max(255),
        fileType: z.string(),
        fileData: z.string(), // Base64 encoded file
        userId: z.string().uuid(),
        userRole: z.enum(['STAFF', 'MANAGER', 'HR_ADMIN']),
        departmentId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const repository = new PrismaTaskRepository(ctx.prisma);
      const service = new TaskService(repository);

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
    }),

  /**
   * Get download URL for a file
   */
  getFileDownloadUrl: publicProcedure
    .input(
      z.object({
        fileId: z.string().uuid(),
        userId: z.string().uuid(),
        userRole: z.enum(['STAFF', 'MANAGER', 'HR_ADMIN']),
        departmentId: z.string(),
      })
    )
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
    .input(
      z.object({
        fileId: z.string().uuid(),
        userId: z.string().uuid(),
        userRole: z.enum(['STAFF', 'MANAGER', 'HR_ADMIN']),
        departmentId: z.string(),
      })
    )
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
    .input(
      z.object({
        taskId: z.string().uuid(),
        userId: z.string().uuid(),
        userRole: z.enum(['STAFF', 'MANAGER', 'HR_ADMIN']),
        departmentId: z.string(),
      })
    )
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

  /**
   * Get task hierarchy (parent chain + subtask tree)
   */
  getHierarchy: publicProcedure
    .input(z.object({ taskId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const user = await getUserContext(ctx);
      const repository = new PrismaTaskRepository(ctx.prisma);
      const service = new TaskService(repository);
      const hierarchy = await service.getTaskHierarchy(input.taskId, user);
      return hierarchy;
    }),

  /**
   * Get manager dashboard tasks
   * Returns tasks from manager's department and all subordinate departments with metrics
   */
  getDashboardTasks: protectedProcedure.query(async ({ ctx }) => {
    // ctx.session.user.id is now available and trustworthy from the authenticated session
    const managerId = ctx.session.user.id;
    const taskService = new DashboardTaskService(ctx.prisma);
    return await taskService.getManagerDashboardTasks(managerId);
  }),

  // ============================================
  // CALENDAR EVENT OPERATIONS
  // ============================================

  /**
   * Create a calendar event for a task
   */
  createCalendarEvent: publicProcedure
    .input(
      z.object({
        taskId: z.string().uuid(),
        eventUserId: z.string().uuid(),
        title: z.string().min(1),
        eventDate: z.coerce.date(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const user = await getUserContext(ctx);
      const repository = new PrismaTaskRepository(ctx.prisma);
      const service = new TaskService(repository);
      const calendarEvent = await service.createCalendarEvent(
        input.taskId,
        input.eventUserId,
        input.title,
        input.eventDate,
        user
      );
      return calendarEvent;
    }),

  /**
   * Get calendar events for a task
   */
  getCalendarEvents: publicProcedure
    .input(z.object({ taskId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const user = await getUserContext(ctx);
      const repository = new PrismaTaskRepository(ctx.prisma);
      const service = new TaskService(repository);
      const events = await service.getCalendarEvents(input.taskId, user);
      return events;
    }),
});
