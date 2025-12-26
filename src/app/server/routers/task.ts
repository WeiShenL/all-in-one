import { router, publicProcedure, protectedProcedure, Context } from '../trpc';
import { TaskService } from '../../../services/task/TaskService';
import { buildServices } from '../composition/serviceFactory';
import { PrismaTaskRepository } from '../../../repositories/PrismaTaskRepository';
import { RealtimeService } from '../services/RealtimeService';
import { z } from 'zod';
import { TaskStatus, Task } from '../../../domain/task/Task';
import { UserContext } from '../../../services/task/TaskService';

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
    isHrAdmin: userProfile.isHrAdmin,
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
    startDate: task.getStartDate()?.toISOString() || null,
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

/**
 * Helper function to fetch task assignment details with departments and calculate permissions
 * Combines user profile fetching into a single query to eliminate N+1 queries
 * Shared between getById and getTaskEditingData
 */
async function getTaskAssignmentDetails(
  ctx: Context,
  task: Task,
  user: UserContext,
  departmentIds: string[]
) {
  const assigneeIds = Array.from(task.getAssignees());

  // Single combined query to fetch all user profile data (fixes N+1 issue)
  const userProfiles = await ctx.prisma.userProfile.findMany({
    where: { id: { in: assigneeIds } },
    select: {
      id: true,
      name: true,
      email: true,
      departmentId: true,
      department: { select: { id: true, name: true } },
    },
  });

  // Build maps for efficient lookup
  const userMap = new Map(userProfiles.map(u => [u.id, u]));
  const assignmentsWithDetails = assigneeIds.map(userId => ({
    userId,
    user: userMap.get(userId) || { id: userId, name: null, email: null },
  }));

  // Get unique department IDs from all assignees for permission check
  const assigneeDepartmentIds = [
    ...new Set(
      userProfiles
        .map(up => up.departmentId)
        .filter((deptId): deptId is string => deptId !== null)
    ),
  ];

  // Import AuthorizationService
  const { AuthorizationService } = await import(
    '../services/AuthorizationService'
  );
  const authService = new AuthorizationService();

  // Calculate canEdit permission with assignee department IDs
  const canEdit = authService.canEditTask(
    {
      departmentId: task.getDepartmentId(),
      assignments: assigneeIds.map(userId => ({ userId })),
    },
    {
      userId: user.userId,
      role: user.role,
      departmentId: user.departmentId,
    },
    departmentIds,
    assigneeDepartmentIds
  );

  // Build involvedDepartments - unique departments from assignees with parent first
  let taskDeptId: string | null = task.getDepartmentId();

  // If task has no department, try to get it from the task's project
  if (!taskDeptId) {
    const taskWithProject = await ctx.prisma.task.findUnique({
      where: { id: task.getId() },
      select: {
        projectId: true,
        project: { select: { departmentId: true } },
      },
    });
    taskDeptId = taskWithProject?.project?.departmentId ?? null;
  }

  const deptMap = new Map<
    string,
    { id: string; name: string; isActive?: boolean }
  >();

  // Check if parent department has any actual assignees
  const hasParentAssignee = userProfiles.some(
    up => up.departmentId === taskDeptId
  );

  // Always include parent department if task has one, mark as inactive if no assignees
  if (taskDeptId) {
    const parentDept = await ctx.prisma.department.findUnique({
      where: { id: taskDeptId },
      select: { id: true, name: true },
    });
    if (parentDept) {
      deptMap.set(taskDeptId, {
        ...parentDept,
        isActive: hasParentAssignee,
      });
    }
  }

  // Add all other unique departments from assignees (all active)
  for (const up of userProfiles) {
    if (up.department && !deptMap.has(up.department.id)) {
      deptMap.set(up.department.id, {
        ...up.department,
        isActive: true,
      });
    }
  }

  const involvedDepartments = Array.from(deptMap.values());

  return {
    assignmentsWithDetails,
    involvedDepartments,
    canEdit,
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
        projectId: z.string().uuid().nullable().optional(),
        tags: z.array(z.string()).optional(),
        recurringInterval: z.number().positive().optional(),
        parentTaskId: z.string().uuid().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { taskService: service } = buildServices(ctx);
      const user = await getUserContext(ctx);

      const result = await service.createTask(
        {
          title: input.title,
          description: input.description,
          priority: input.priority,
          dueDate: input.dueDate,
          assigneeIds: input.assigneeIds,
          projectId: input.projectId || undefined,
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
      const { subtaskService: service } = buildServices(ctx);
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
      const { taskService: service } = buildServices(ctx);
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
      const { taskService: service } = buildServices(ctx);

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
      const { taskService: service } = buildServices(ctx);

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
      const { taskService: service } = buildServices(ctx);

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
      const { taskService: service } = buildServices(ctx);

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
      const { taskService: service } = buildServices(ctx);

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
      const { taskService: service } = buildServices(ctx);

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
      const { taskService: service } = buildServices(ctx);

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
      const { taskService: service } = buildServices(ctx);

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
      const { taskService: service } = buildServices(ctx);

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
      const service = new TaskService(
        repository,
        ctx.prisma,
        new RealtimeService()
      ); // Inject PrismaClient + RealtimeService for notifications

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
   * Assign project to task (SCRUM-31)
   *
   * AC:
   * - Can only be done if task doesn't already have a project
   * - Once assigned, cannot be changed (immutability)
   * - All existing assignees become project collaborators
   * - Sends notifications to all assignees
   */
  assignProject: publicProcedure
    .input(
      z.object({
        taskId: z.string().uuid(),
        projectId: z.string().uuid().nullable(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const user = await getUserContext(ctx);

      // Handle unassign case (projectId = null)
      if (!input.projectId) {
        await ctx.prisma.task.update({
          where: { id: input.taskId },
          data: { projectId: null },
        });
        return { success: true, message: 'Project removed from task' };
      }

      // Assign project via service layer (handles all logic)
      const repository = new PrismaTaskRepository(ctx.prisma);
      const service = new TaskService(
        repository,
        ctx.prisma,
        new RealtimeService()
      );

      const task = await service.assignTaskToProject(
        input.taskId,
        input.projectId,
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

      // Try to initialize RealtimeService, but gracefully handle failures (e.g., in test environments)
      let realtimeService;
      try {
        realtimeService = new RealtimeService();
      } catch {
        // RealtimeService not available (e.g., in test environment)
        realtimeService = undefined;
      }

      const service = new TaskService(repository, ctx.prisma, realtimeService);

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
   * Get task by ID (with canEdit field)
   */
  getById: publicProcedure
    .input(z.object({ taskId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const user = await getUserContext(ctx);
      const { taskService: service, getDashboardTaskService } =
        buildServices(ctx);
      const dashboardTaskService = getDashboardTaskService();

      const task = await service.getTaskById(input.taskId, user);
      if (!task) {
        return null;
      }

      // Get department hierarchy for authorization check
      const departmentIds =
        await dashboardTaskService.getSubordinateDepartments(user.departmentId);

      // Use shared helper to get assignment details (fixes N+1 query)
      const { assignmentsWithDetails, involvedDepartments, canEdit } =
        await getTaskAssignmentDetails(ctx, task, user, departmentIds);

      return {
        ...serializeTask(task),
        assignments: assignmentsWithDetails,
        involvedDepartments,
        canEdit,
      };
    }),

  /**
   * Get all data needed for task editing view
   * Combines task details, files, logs, users, and projects in a single call
   */
  getTaskEditingData: publicProcedure
    .input(z.object({ taskId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const user = await getUserContext(ctx);
      const { taskService: service, getDashboardTaskService } =
        buildServices(ctx);
      const dashboardTaskService = getDashboardTaskService();

      // 1. Get task details
      const task = await service.getTaskById(input.taskId, user);
      if (!task) {
        return null;
      }

      // Get department hierarchy for authorization check
      const departmentIds =
        await dashboardTaskService.getSubordinateDepartments(user.departmentId);

      // Use shared helper to get assignment details (fixes N+1 query and code duplication)
      const { assignmentsWithDetails, involvedDepartments, canEdit } =
        await getTaskAssignmentDetails(ctx, task, user, departmentIds);

      const taskData = {
        ...serializeTask(task),
        assignments: assignmentsWithDetails,
        involvedDepartments,
        canEdit,
      };

      // Fetch all remaining data in parallel for better performance
      const [files, logs, departmentUsers, allUsers, projects, hierarchy] =
        await Promise.all([
          // 2. Get task files
          service.getTaskFiles(input.taskId, user),

          // 3. Get task logs
          service.getTaskLogs(input.taskId, user),

          // 4. Get department users (users in current user's department)
          ctx.prisma.userProfile.findMany({
            where: {
              departmentId: user.departmentId,
              isActive: true,
            },
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
              isHrAdmin: true,
              department: { select: { id: true, name: true } },
            },
          }),

          // 5. Get all active users for assignee dropdown
          ctx.prisma.userProfile.findMany({
            where: { isActive: true },
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
              isHrAdmin: true,
              departmentId: true,
              department: { select: { id: true, name: true } },
            },
          }),

          // 6. Get visible projects for current user (active only)
          (async () => {
            const { projectService, getDashboardTaskService } =
              buildServices(ctx);
            const dashboardTaskService = getDashboardTaskService();
            const visible = await projectService.getVisibleProjectsForUser(
              user,
              {
                getSubordinateDepartments: (id: string) =>
                  dashboardTaskService.getSubordinateDepartments(id),
              },
              { isArchived: false }
            );
            return visible.map(p => ({
              id: p.id,
              name: p.name,
              departmentId: p.departmentId,
            }));
          })(),

          // 7. Get task hierarchy (parent chain and subtasks)
          service.getTaskHierarchy(input.taskId, user),
        ]);

      const filesData = {
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

      // Return all data in a single response
      return {
        task: taskData,
        files: filesData,
        logs,
        departmentUsers,
        allUsers,
        projects,
        hierarchy,
      };
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
      const { taskService: service } = buildServices(ctx);
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
      const { taskService: service } = buildServices(ctx);
      const tasks = await service.getOwnerTasks(
        input.ownerId,
        input.includeArchived
      );
      return tasks.map(serializeTask);
    }),

  /**
   * Get user's assigned tasks (with canEdit field)
   * For Personal Dashboard - all tasks have canEdit=true
   * OPTIMIZED: Uses single query from repository with all related data pre-loaded
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

      // Get raw task data with all relations pre-loaded (single query)
      const rawTasks = await repository.getUserTasks(
        input.userId,
        input.includeArchived
      );

      // Transform raw Prisma data to API response format
      return rawTasks.map((rawTask: any) => {
        // Build assignments with user details (already loaded)
        const assignmentsWithDetails = rawTask.assignments.map(
          (assignment: any) => ({
            userId: assignment.userId,
            user: assignment.user || {
              id: assignment.userId,
              name: null,
              email: null,
            },
          })
        );

        // Build involvedDepartments from assignees (already loaded)
        const taskDeptId = rawTask.departmentId;
        const deptMap = new Map<
          string,
          { id: string; name: string; isActive?: boolean }
        >();

        // Get unique department IDs from assignees
        const assigneeDepartmentIds = new Set<string>();
        assignmentsWithDetails.forEach(
          (assignment: {
            userId: string;
            user: {
              id: string;
              name: string | null;
              email: string | null;
              departmentId?: string;
              department?: { id: string; name: string };
            };
          }) => {
            const user = assignment.user;
            if (user && user.departmentId) {
              assigneeDepartmentIds.add(user.departmentId);
              // Add assignee's department if not already added
              if (user.department && !deptMap.has(user.departmentId)) {
                deptMap.set(user.departmentId, {
                  id: user.department.id,
                  name: user.department.name,
                  isActive: true,
                });
              }
            }
          }
        );

        // Check if parent department has any assignees
        const hasParentAssignee = assigneeDepartmentIds.has(taskDeptId);

        // Always include parent department if task has one, mark as inactive if no assignees
        if (taskDeptId && rawTask.department) {
          deptMap.set(taskDeptId, {
            id: rawTask.department.id,
            name: rawTask.department.name,
            isActive: hasParentAssignee,
          });
        }

        const involvedDepartments = Array.from(deptMap.values());

        // Serialize task data
        return {
          id: rawTask.id,
          title: rawTask.title,
          description: rawTask.description,
          priorityBucket: rawTask.priority,
          dueDate: rawTask.dueDate,
          status: rawTask.status,
          ownerId: rawTask.ownerId,
          departmentId: rawTask.departmentId,
          projectId: rawTask.projectId,
          parentTaskId: rawTask.parentTaskId,
          isRecurring: !!rawTask.recurringInterval,
          recurringInterval: rawTask.recurringInterval,
          isArchived: rawTask.isArchived,
          createdAt: rawTask.createdAt,
          startDate: rawTask.startDate,
          updatedAt: rawTask.updatedAt,
          tags: rawTask.tags.map((t: any) => t.tag.name),
          comments: rawTask.comments,
          owner: rawTask.owner || {
            id: rawTask.ownerId,
            name: null,
            email: null,
          },
          department: rawTask.department || {
            id: rawTask.departmentId,
            name: 'Unknown Department',
          },
          assignments: assignmentsWithDetails,
          project: rawTask.project || null,
          canEdit: true,
          involvedDepartments,
        };
      });
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
    const { getDashboardTaskService } = buildServices(ctx);
    const dashboardTaskService = getDashboardTaskService();
    return await dashboardTaskService.getManagerDashboardTasks(managerId);
  }),

  /**
   * Get department tasks for any user (Staff or Manager)
   * Returns tasks with canEdit field based on user role and assignment
   * For Department Dashboard
   */
  getDepartmentTasksForUser: protectedProcedure
    .input(
      z
        .object({
          limit: z.number().min(1).max(500).optional().default(100),
          offset: z.number().min(0).optional().default(0),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      // ctx.session.user.id is available from authenticated session
      const userId = ctx.session.user.id;
      const { getDashboardTaskService } = buildServices(ctx);
      const dashboardTaskService = getDashboardTaskService();
      return await dashboardTaskService.getDepartmentTasksForUser(
        userId,
        input
      );
    }),

  /**
   * Get available parent tasks for task creation
   * - For MANAGERS: Returns all parent tasks visible in department view
   * - For STAFF: Returns only parent tasks they are assigned to
   */
  getAvailableParentTasks: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id;
    const { getDashboardTaskService } = buildServices(ctx);
    const dashboardTaskService = getDashboardTaskService();
    return await dashboardTaskService.getAvailableParentTasks(userId);
  }),

  /**
   * Get project-scoped tasks for any user (Staff or Manager)
   */
  getProjectTasksForUser: protectedProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const { getDashboardTaskService } = buildServices(ctx);
      const dashboardTaskService = getDashboardTaskService();
      return await dashboardTaskService.getProjectTasksForUser(
        userId,
        input.projectId
      );
    }),

  /**
   * Manager project-scoped tasks (dashboard)
   */
  getManagerProjectTasks: protectedProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const managerId = ctx.session.user.id;
      const { getDashboardTaskService } = buildServices(ctx);
      const dashboardTaskService = getDashboardTaskService();
      return await dashboardTaskService.getManagerProjectTasks(
        managerId,
        input.projectId
      );
    }),

  /**
   * Get company-wide tasks (HR/Admin only)
   * Used by Company Overview Dashboard
   *
   * Returns all tasks across the organization with canEdit field
   * Access control: Only users with isHrAdmin flag can access
   */
  getCompanyTasks: protectedProcedure
    .input(
      z.object({
        departmentId: z.string().uuid().optional(),
        projectId: z.string().uuid().optional(),
        assigneeId: z.string().uuid().optional(),
        status: z
          .enum(['TO_DO', 'IN_PROGRESS', 'COMPLETED', 'BLOCKED'])
          .optional(),
        includeArchived: z.boolean().optional().default(false),
        limit: z.number().min(1).max(500).optional().default(100),
        offset: z.number().min(0).optional().default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      // ctx.session.user.id is available from authenticated session
      const userId = ctx.session.user.id;
      const { getDashboardTaskService } = buildServices(ctx);
      const dashboardTaskService = getDashboardTaskService();
      return await dashboardTaskService.getCompanyTasks(userId, input);
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

  /**
   * Get task logs for a task
   */
  getTaskLogs: publicProcedure
    .input(z.object({ taskId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const user = await getUserContext(ctx);
      const repository = new PrismaTaskRepository(ctx.prisma);
      const service = new TaskService(repository);
      const logs = await service.getTaskLogs(input.taskId, user);
      return logs;
    }),
});
