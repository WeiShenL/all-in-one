/**
 * TaskService - Application Service Layer
 *
 * Handles:
 * - Authorization logic (manager permissions)
 * - Orchestration between domain and infrastructure
 * - Transaction management
 * - Cross-aggregate operations
 * - Task update notifications
 */

import { Task, TaskStatus } from '../../domain/task/Task';
import { ITaskRepository } from '../../repositories/ITaskRepository';
import { SupabaseStorageService } from '../storage/SupabaseStorageService';
import { PrismaClient, NotificationType } from '@prisma/client';
import { NotificationService } from '../../app/server/services/NotificationService';
import { EmailService } from '../../app/server/services/EmailService';
import { RealtimeService } from '../../app/server/services/RealtimeService';

export interface CreateTaskDTO {
  title: string;
  description: string;
  priorityBucket: number;
  dueDate: Date;
  ownerId: string;
  departmentId: string;
  projectId: string | null;
  parentTaskId?: string | null;
  isRecurring?: boolean;
  recurringInterval?: number | null;
  assignments?: string[];
  tags?: string[];
}

export interface UpdateTaskDTO {
  title?: string;
  description?: string;
  priorityBucket?: number;
  dueDate?: Date;
  status?: TaskStatus;
  isRecurring?: boolean;
  recurringInterval?: number | null;
}

export interface UserContext {
  userId: string;
  role: 'STAFF' | 'MANAGER' | 'HR_ADMIN';
  departmentId: string;
  isHrAdmin?: boolean;
}

/**
 * Task Service
 * Business logic for task operations (create, update) and file operations
 */

export class TaskService {
  private storageService = new SupabaseStorageService();
  private notificationService?: NotificationService;
  private realtimeService?: RealtimeService;

  constructor(
    protected readonly taskRepository: ITaskRepository,
    private readonly prisma?: PrismaClient,
    realtimeService?: RealtimeService
  ) {
    // Initialize NotificationService for task update notifications
    // Only if prisma is provided (for endpoints that send notifications)
    if (this.prisma) {
      try {
        const emailService = new EmailService();
        this.notificationService = new NotificationService(
          this.prisma,
          emailService
        );
      } catch {
        // If email service fails to initialize, continue without it
        // This allows tests and CI environments without proper email config to work
        console.warn(
          'EmailService initialization failed, continuing without email notifications'
        );
      }
    }
    this.realtimeService = realtimeService;
  }

  // ============================================
  // CREATE OPERATIONS
  // ============================================

  /**
   * Create a new task
   *
   * Acceptance Criteria:
   * - Create tasks within projects or standalone
   * - Mandatory fields: title, description, priority, deadline, assignee (TM016)
   * - Up to 5 assignees (TM023)
   * - Auto-associate with department
   * - Default "To Do" status
   * - Optional tags/files
   * - Optional recurring with interval
   * - Subtask depth max 2 levels (TGO026)
   *
   * @param data - Task creation data
   * @param creator - User creating the task
   * @returns Created task ID
   */
  async createTask(
    data: {
      title: string;
      description: string;
      priority: number;
      dueDate: Date;
      assigneeIds: string[];
      projectId?: string;
      parentTaskId?: string;
      tags?: string[];
      recurringInterval?: number;
    },
    creator: UserContext
  ): Promise<{ id: string }> {
    // Validate project if provided
    if (data.projectId) {
      const projectExists = await this.taskRepository.validateProjectExists(
        data.projectId
      );
      if (!projectExists) {
        throw new Error('Project not found');
      }
    }

    // Validate parent task if provided (for subtasks) - TGO026
    if (data.parentTaskId) {
      const parentTask = await this.taskRepository.getParentTaskDepth(
        data.parentTaskId
      );
      if (!parentTask) {
        throw new Error('Parent task not found');
      }
      // Check subtask depth limit (2 levels max)
      if (parentTask.parentTaskId) {
        throw new Error('Maximum subtask depth is 2 levels (TGO026)');
      }
    }

    // Validate all assignees exist and are active
    if (data.assigneeIds && data.assigneeIds.length > 0) {
      const validAssignees = await this.taskRepository.validateAssignees(
        data.assigneeIds
      );
      if (!validAssignees.allExist) {
        throw new Error('One or more assignees not found');
      }
      if (!validAssignees.allActive) {
        throw new Error('One or more assignees are inactive');
      }
    }

    // Use Task domain factory to create and validate
    const task = Task.create({
      title: data.title,
      description: data.description,
      priorityBucket: data.priority,
      dueDate: data.dueDate,
      status: TaskStatus.TO_DO, // Default status for new tasks
      ownerId: creator.userId,
      departmentId: creator.departmentId,
      projectId: data.projectId || null,
      parentTaskId: data.parentTaskId || null,
      recurringInterval: data.recurringInterval || null,
      isArchived: false, // New tasks are never archived
      startDate: null, // Will be set when status changes to IN_PROGRESS
      assignments: new Set(data.assigneeIds),
      tags: new Set(data.tags || []),
    });

    // Persist via repository
    const result = await this.taskRepository.createTask({
      id: task.getId(),
      title: task.getTitle(),
      description: task.getDescription(),
      priority: task.getPriority().getLevel(),
      dueDate: task.getDueDate(),
      ownerId: creator.userId,
      departmentId: creator.departmentId,
      projectId: data.projectId,
      parentTaskId: data.parentTaskId,
      assigneeIds: data.assigneeIds,
      tags: data.tags,
      recurringInterval: data.recurringInterval,
    });

    // Auto-create ProjectCollaborator for each assignee if task belongs to a project
    if (data.projectId && data.assigneeIds && data.assigneeIds.length > 0) {
      for (const assigneeId of data.assigneeIds) {
        const userProfile =
          await this.taskRepository.getUserProfile(assigneeId);
        if (userProfile) {
          // Check if already a collaborator to avoid duplicates
          const isCollaborator =
            await this.taskRepository.isUserProjectCollaborator(
              data.projectId,
              assigneeId
            );
          if (!isCollaborator) {
            await this.taskRepository.createProjectCollaborator(
              data.projectId,
              assigneeId,
              userProfile.departmentId
            );

            // Send project collaboration notification
            await this.sendProjectCollaborationNotification(
              data.projectId,
              assigneeId,
              result.id
            );
          }
        }
      }
    }

    // Log task creation
    await this.taskRepository.logTaskAction(
      result.id,
      creator.userId,
      'CREATED',
      'Task',
      {
        changes: {
          title: data.title,
        },
        metadata: {
          source: 'web_ui',
        },
      }
    );

    // Send task assignment notifications to all assignees (excluding creator)
    if (data.assigneeIds && data.assigneeIds.length > 0) {
      for (const assigneeId of data.assigneeIds) {
        // Skip sending notification to the creator
        if (assigneeId !== creator.userId) {
          await this.sendTaskUpdateNotifications(
            result.id,
            'ASSIGNEE_ADDED',
            creator.userId,
            { addedUserId: assigneeId }
          );
        }
      }
    }

    return result;
  }

  // ============================================
  // UPDATE OPERATIONS
  // ============================================

  // ============================================
  // QUERY OPERATIONS
  // ============================================

  /**
   * Get task by ID - reconstructs full Task domain object
   *
   * @param taskId - Task ID
   * @param user - User context for authorization
   * @returns Task domain object or null
   */
  async getTaskById(taskId: string, user: UserContext): Promise<Task | null> {
    const taskData = await this.taskRepository.getTaskByIdFull(taskId);

    if (!taskData) {
      return null;
    }

    // Check authorization: user can view if assigned OR in department hierarchy OR has isHrAdmin flag
    // View permission: assigned OR in department hierarchy (for both STAFF and MANAGER) OR isHrAdmin
    // Edit permission: handled separately by canEdit field
    const isAssigned = taskData.assignments.some(a => a.userId === user.userId);

    // STAFF with isHrAdmin flag can view all company tasks (but edit permission is still restricted)
    const hasHrAdminViewAccess =
      user.role === 'STAFF' && user.isHrAdmin === true;

    // Check if task is in user's department hierarchy
    let isInDepartmentHierarchy = false;
    const canAccess = await this.canManagerAccessDepartment(
      user.departmentId,
      taskData.departmentId
    );

    if (canAccess) {
      isInDepartmentHierarchy = true;
    } else if (taskData.assignments.length > 0) {
      // If not accessible via task's department, check if any assignees are in user's hierarchy
      const assigneeIds = taskData.assignments.map(a => a.userId);
      const assignees =
        await this.taskRepository.getUserDepartments(assigneeIds);

      // Check if any assignee's department is in user's hierarchy
      for (const assignee of assignees) {
        if (assignee.departmentId) {
          const canAccessAssignee = await this.canManagerAccessDepartment(
            user.departmentId,
            assignee.departmentId
          );
          if (canAccessAssignee) {
            isInDepartmentHierarchy = true;
            break;
          }
        }
      }
    }

    if (!isAssigned && !isInDepartmentHierarchy && !hasHrAdminViewAccess) {
      throw new Error(
        'Unauthorized: You must be assigned to this task or it must be in your department hierarchy'
      );
    }

    // Reconstruct Task domain object from Prisma data
    return new Task({
      id: taskData.id,
      title: taskData.title,
      description: taskData.description,
      priorityBucket: taskData.priority,
      dueDate: taskData.dueDate,
      status: taskData.status as any, // TaskStatus enum
      ownerId: taskData.ownerId,
      departmentId: taskData.departmentId,
      projectId: taskData.projectId,
      parentTaskId: taskData.parentTaskId,
      recurringInterval: taskData.recurringInterval,
      isArchived: taskData.isArchived,
      createdAt: taskData.createdAt,
      startDate: taskData.startDate || null, // When work first began
      updatedAt: taskData.updatedAt,
      assignments: new Set(taskData.assignments.map(a => a.userId)),
      tags: new Set(taskData.tags.map(t => t.tag.name)),
      comments: taskData.comments.map(c => ({
        id: c.id,
        content: c.content,
        authorId: c.userId,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
      })),
      files: taskData.files.map(f => ({
        id: f.id,
        fileName: f.fileName,
        fileSize: f.fileSize,
        fileType: f.fileType,
        storagePath: f.storagePath,
        uploadedById: f.uploadedById,
        uploadedAt: f.uploadedAt,
      })),
    });
  }

  /**
   * Get all tasks assigned to a user
   *
   * @param userId - User ID
   * @param includeArchived - Include archived tasks
   * @returns Array of Task domain objects
   */
  async getUserTasks(
    userId: string,
    includeArchived: boolean = false
  ): Promise<Task[]> {
    const tasks = await this.taskRepository.getUserTasks(
      userId,
      includeArchived
    );
    return tasks.map(taskData => this.reconstructTaskFromData(taskData));
  }

  /**
   * Get all tasks in a department
   *
   * @param departmentId - Department ID
   * @param user - User context for authorization
   * @param includeArchived - Include archived tasks
   * @returns Array of Task domain objects
   */
  async getDepartmentTasks(
    departmentId: string,
    user: UserContext,
    includeArchived: boolean = false
  ): Promise<Task[]> {
    // Only managers and HR admins can view all department tasks
    if (user.role !== 'MANAGER' && !user.isHrAdmin) {
      throw new Error(
        'Unauthorized: Only managers and HR admins can view all department tasks'
      );
    }

    // Verify user belongs to this department
    if (user.departmentId !== departmentId) {
      throw new Error(
        'Unauthorized: You can only view tasks from your own department'
      );
    }

    const tasks = await this.taskRepository.getDepartmentTasks(
      departmentId,
      includeArchived
    );
    return tasks.map(taskData => this.reconstructTaskFromData(taskData));
  }

  /**
   * Helper to reconstruct Task domain object from Prisma data
   */
  private reconstructTaskFromData(taskData: any): Task {
    return new Task({
      id: taskData.id,
      title: taskData.title,
      description: taskData.description,
      priorityBucket: taskData.priority,
      dueDate: taskData.dueDate,
      status: taskData.status as any,
      ownerId: taskData.ownerId,
      departmentId: taskData.departmentId,
      projectId: taskData.projectId,
      parentTaskId: taskData.parentTaskId,
      recurringInterval: taskData.recurringInterval,
      isArchived: taskData.isArchived,
      createdAt: taskData.createdAt,
      startDate: taskData.startDate || null, // When work first began
      updatedAt: taskData.updatedAt,
      assignments: new Set(
        taskData.assignments?.map((a: any) => a.userId) || []
      ),
      tags: new Set(taskData.tags?.map((t: any) => t.tag.name) || []),
      comments:
        taskData.comments?.map((c: any) => ({
          id: c.id,
          content: c.content,
          authorId: c.userId,
          createdAt: c.createdAt,
          updatedAt: c.updatedAt,
        })) || [],
      files:
        taskData.files?.map((f: any) => ({
          id: f.id,
          fileName: f.fileName,
          fileSize: f.fileSize,
          fileType: f.fileType,
          storagePath: f.storagePath,
          uploadedById: f.uploadedById,
          uploadedAt: f.uploadedAt,
        })) || [],
    });
  }

  // ============================================
  // UPDATE OPERATIONS
  // ============================================

  /**
   * Update task title
   * Authorization: Only assigned users can update (Update User Story AC)
   *
   * @param taskId - Task ID
   * @param newTitle - New title
   * @param user - User context for authorization
   * @returns Updated task
   */
  async updateTaskTitle(
    taskId: string,
    newTitle: string,
    user: UserContext
  ): Promise<Task> {
    const task = await this.getTaskById(taskId, user);
    if (!task) {
      throw new Error('Task not found');
    }

    // Capture old value before updating
    const oldTitle = task.getTitle();

    // Update via domain method (validates title)
    task.updateTitle(newTitle);

    // Persist changes
    await this.taskRepository.updateTask(taskId, {
      title: task.getTitle(),
      updatedAt: new Date(),
    });

    // Log action with from/to values and source
    await this.taskRepository.logTaskAction(
      taskId,
      user.userId,
      'UPDATED',
      'Title',
      {
        changes: {
          from: oldTitle,
          to: newTitle,
        },
        metadata: {
          source: 'web_ui',
        },
      }
    );

    return task;
  }

  /**
   * Update task description
   * Authorization: Only assigned users can update
   */
  async updateTaskDescription(
    taskId: string,
    newDescription: string,
    user: UserContext
  ): Promise<Task> {
    const task = await this.getTaskById(taskId, user);
    if (!task) {
      throw new Error('Task not found');
    }

    // Capture old value before updating
    const oldDescription = task.getDescription();

    task.updateDescription(newDescription);

    await this.taskRepository.updateTask(taskId, {
      description: task.getDescription(),
      updatedAt: new Date(),
    });

    await this.taskRepository.logTaskAction(
      taskId,
      user.userId,
      'UPDATED',
      'Description',
      {
        changes: {
          from: oldDescription,
          to: newDescription,
        },
        metadata: {
          source: 'web_ui',
        },
      }
    );

    return task;
  }

  /**
   * Update task priority (1-10 scale)
   * Authorization: Only assigned users can update
   */
  async updateTaskPriority(
    taskId: string,
    newPriority: number,
    user: UserContext
  ): Promise<Task> {
    const task = await this.getTaskById(taskId, user);
    if (!task) {
      throw new Error('Task not found');
    }

    // Capture old value before updating
    const oldPriority = task.getPriority().getLevel();

    task.updatePriority(newPriority);

    await this.taskRepository.updateTask(taskId, {
      priority: task.getPriority().getLevel(),
      updatedAt: new Date(),
    });

    await this.taskRepository.logTaskAction(
      taskId,
      user.userId,
      'UPDATED',
      'Priority',
      {
        changes: {
          from: oldPriority,
          to: newPriority,
        },
        metadata: {
          source: 'web_ui',
        },
      }
    );

    return task;
  }

  /**
   * Update task deadline
   * Authorization: Only assigned users can update
   * Validation: Subtask deadline <= parent deadline (DST014)
   */
  async updateTaskDeadline(
    taskId: string,
    newDeadline: Date,
    user: UserContext
  ): Promise<Task> {
    const task = await this.getTaskById(taskId, user);
    if (!task) {
      throw new Error('Task not found');
    }

    // Capture old value before updating
    const oldDeadline = task.getDueDate();

    // DST014: If subtask, fetch parent deadline for validation
    let parentDeadline: Date | undefined;
    if (task.isSubtask()) {
      const parentTaskId = task.getParentTaskId();
      if (parentTaskId) {
        const parentTaskData =
          await this.taskRepository.getTaskByIdFull(parentTaskId);
        if (parentTaskData) {
          parentDeadline = parentTaskData.dueDate;
        }
      }
    }

    // Domain method validates subtask deadline <= parent deadline
    task.updateDeadline(newDeadline, parentDeadline);

    await this.taskRepository.updateTask(taskId, {
      dueDate: task.getDueDate(),
      updatedAt: new Date(),
    });

    await this.taskRepository.logTaskAction(
      taskId,
      user.userId,
      'UPDATED',
      'Due Date',
      {
        changes: {
          from: oldDeadline.toISOString(),
          to: newDeadline.toISOString(),
        },
        metadata: {
          source: 'web_ui',
        },
      }
    );

    return task;
  }

  /**
   * Update task status
   * Authorization: Only assigned users can update
   * Automatically generates next recurring task instance when a recurring task is completed
   */
  async updateTaskStatus(
    taskId: string,
    newStatus: string,
    user: UserContext
  ): Promise<Task> {
    const task = await this.getTaskById(taskId, user);
    if (!task) {
      throw new Error('Task not found');
    }

    // console.log('📝 [STATUS UPDATE] Task:', taskId);
    // console.log('📝 [STATUS UPDATE] Current status:', task.getStatus(), '→', newStatus);
    // console.log('📝 [STATUS UPDATE] Is recurring:', task.isTaskRecurring());
    // console.log('📝 [STATUS UPDATE] Recurring interval:', task.getRecurringInterval());
    // console.log('📝 [STATUS UPDATE] Current due date:', task.getDueDate().toISOString());

    // Capture old values before updating
    const oldStatus = task.getStatus();
    const oldStartDate = task.getStartDate();

    task.updateStatus(newStatus as any);

    await this.taskRepository.updateTask(taskId, {
      status: task.getStatus(),
      startDate: task.getStartDate(),
      updatedAt: new Date(),
    });

    await this.taskRepository.logTaskAction(
      taskId,
      user.userId,
      'UPDATED',
      'Status',
      {
        changes: {
          from: oldStatus,
          to: newStatus,
        },
        metadata: {
          source: 'web_ui',
        },
      }
    );

    // Log startDate change if it was set for first time
    if (!oldStartDate && task.getStartDate()) {
      await this.taskRepository.logTaskAction(
        taskId,
        user.userId,
        'UPDATED',
        'startDate',
        {
          changes: {
            from: null,
            to: task.getStartDate()?.toISOString(),
          },
          metadata: {
            source: 'automatic',
            reason: 'First transition to IN_PROGRESS',
          },
        }
      );
    }

    // Generate next recurring instance if status is COMPLETED and task is recurring
    if (newStatus === TaskStatus.COMPLETED && task.isTaskRecurring()) {
      await this.generateNextRecurringInstance(task, user);
    }

    return task;
  }

  /**
   * Generate the next instance of a recurring task
   * Called automatically when a recurring task is marked as COMPLETED
   * @private
   */
  private async generateNextRecurringInstance(
    completedTask: Task,
    user: UserContext
  ): Promise<void> {
    const recurringInterval = completedTask.getRecurringInterval();
    // console.log('🔄 [RECURRING] Starting generation for task:', completedTask.getId());
    // console.log('🔄 [RECURRING] Recurring interval:', recurringInterval);

    if (!recurringInterval) {
      // console.log('🔄 [RECURRING] No recurring interval, skipping');
      return;
    }

    // Calculate next due date AND createdAt by adding recurring interval (in days)
    // Use UTC methods to avoid timezone issues (SGT = UTC+8)
    const currentDueDate = completedTask.getDueDate();
    const currentCreatedAt = completedTask.getCreatedAt();

    // console.log('🔄 [RECURRING] Current createdAt:', currentCreatedAt.toISOString());
    // console.log('🔄 [RECURRING] Current due date:', currentDueDate.toISOString());

    // Shift BOTH createdAt and dueDate by the interval
    const nextCreatedAt = new Date(currentCreatedAt);
    nextCreatedAt.setUTCDate(nextCreatedAt.getUTCDate() + recurringInterval);

    const nextDueDate = new Date(currentDueDate);
    nextDueDate.setUTCDate(nextDueDate.getUTCDate() + recurringInterval);

    // console.log('🔄 [RECURRING] Next createdAt:', nextCreatedAt.toISOString());
    // console.log('🔄 [RECURRING] Next due date:', nextDueDate.toISOString());
    // console.log('🔄 [RECURRING] Days added:', recurringInterval);

    // Validate assignees still exist and are active
    const assigneeIds = Array.from(completedTask.getAssignees());
    const validAssignees =
      await this.taskRepository.validateAssignees(assigneeIds);
    if (!validAssignees.allExist || !validAssignees.allActive) {
      throw new Error(
        'Cannot generate recurring task: one or more assignees are invalid'
      );
    }

    // Create next instance using Domain factory
    const nextTask = Task.create({
      title: completedTask.getTitle(),
      description: completedTask.getDescription(),
      priorityBucket: completedTask.getPriorityBucket(),
      dueDate: nextDueDate,
      status: TaskStatus.TO_DO,
      ownerId: completedTask.getOwnerId(),
      departmentId: completedTask.getDepartmentId(),
      projectId: completedTask.getProjectId(),
      parentTaskId: completedTask.getParentTaskId(),
      recurringInterval: recurringInterval,
      isArchived: false,
      startDate: null, // Will be set when status changes to IN_PROGRESS
      assignments: completedTask.getAssignees(),
      tags: completedTask.getTags(),
    });

    // Persist next instance
    // console.log('🔄 [RECURRING] Creating next task:');
    // console.log('🔄 [RECURRING]   createdAt:', nextCreatedAt.toISOString());
    // console.log('🔄 [RECURRING]   dueDate:', nextTask.getDueDate().toISOString());
    // console.log('🔄 [RECURRING]   New task ID:', nextTask.getId());

    await this.taskRepository.createTask({
      id: nextTask.getId(),
      title: nextTask.getTitle(),
      description: nextTask.getDescription(),
      priority: nextTask.getPriorityBucket(),
      dueDate: nextTask.getDueDate(),
      createdAt: nextCreatedAt, // ✅ Set createdAt to maintain recurring schedule
      ownerId: nextTask.getOwnerId(),
      departmentId: nextTask.getDepartmentId(),
      projectId: nextTask.getProjectId() ?? undefined,
      parentTaskId: nextTask.getParentTaskId() ?? undefined,
      assigneeIds: assigneeIds,
      tags: Array.from(nextTask.getTags()),
      recurringInterval: nextTask.getRecurringInterval() ?? undefined,
    });

    // console.log('🔄 [RECURRING] ✅ Next task created successfully');

    // Log the recurring task generation
    await this.taskRepository.logTaskAction(
      completedTask.getId(),
      user.userId,
      'RECURRING_TASK_GENERATED',
      'recurring',
      {
        changes: {
          from: null,
          to: nextTask.getId(),
        },
        metadata: {
          source: 'web_ui',
          nextTaskId: nextTask.getId(),
          nextDueDate: nextDueDate.toISOString(),
          sourceTaskId: completedTask.getId(),
        },
      }
    );
  }

  /**
   * Update recurring settings
   * Authorization: Only assigned users can update
   */
  async updateTaskRecurring(
    taskId: string,
    enabled: boolean,
    recurringInterval: number | null,
    user: UserContext
  ): Promise<Task> {
    const task = await this.getTaskById(taskId, user);
    if (!task) {
      throw new Error('Task not found');
    }

    // Capture old values before updating
    const oldEnabled = task.isTaskRecurring();
    const oldInterval = task.getRecurringInterval();

    task.updateRecurring(enabled, recurringInterval);

    await this.taskRepository.updateTask(taskId, {
      recurringInterval: task.getRecurringInterval(),
      updatedAt: new Date(),
    });

    await this.taskRepository.logTaskAction(
      taskId,
      user.userId,
      'UPDATED',
      'Recurring Settings',
      {
        changes: {
          from: {
            enabled: oldEnabled,
            interval: oldInterval,
          },
          to: {
            enabled,
            interval: recurringInterval,
          },
        },
        metadata: {
          source: 'web_ui',
        },
      }
    );

    return task;
  }

  /**
   * Add tag to task
   * Authorization: Only assigned users can update
   */
  async addTagToTask(
    taskId: string,
    tag: string,
    user: UserContext
  ): Promise<Task> {
    const task = await this.getTaskById(taskId, user);
    if (!task) {
      throw new Error('Task not found');
    }

    task.addTag(tag);

    // Persist tag (connectOrCreate in Prisma)
    await this.taskRepository.addTaskTag(taskId, tag);

    await this.taskRepository.logTaskAction(
      taskId,
      user.userId,
      'CREATED',
      'Tag',
      {
        changes: {
          added: tag,
        },
        metadata: {
          source: 'web_ui',
          action: 'addTag',
          tag,
        },
      }
    );

    return task;
  }

  /**
   * Remove tag from task
   * Authorization: Only assigned users can update
   */
  async removeTagFromTask(
    taskId: string,
    tag: string,
    user: UserContext
  ): Promise<Task> {
    const task = await this.getTaskById(taskId, user);
    if (!task) {
      throw new Error('Task not found');
    }

    task.removeTag(tag);

    await this.taskRepository.removeTaskTag(taskId, tag);

    await this.taskRepository.logTaskAction(
      taskId,
      user.userId,
      'DELETED',
      'Tag',
      {
        changes: {
          removed: tag,
        },
        metadata: {
          source: 'web_ui',
          action: 'removeTag',
          tag,
        },
      }
    );

    return task;
  }

  /**
   * Add assignee to task (max 5 - TM023)
   * Authorization: Only assigned users can update (Update User Story AC)
   *
   * NEW (SCRUM-XX): Automatically creates ProjectCollaborator entry when:
   * - Task belongs to a project (projectId is not null)
   * - User is not already a collaborator on that project
   */
  async addAssigneeToTask(
    taskId: string,
    newUserId: string,
    user: UserContext
  ): Promise<Task> {
    const task = await this.getTaskById(taskId, user);
    if (!task) {
      throw new Error('Task not found');
    }

    // Validate new assignee exists and is active
    const validAssignees = await this.taskRepository.validateAssignees([
      newUserId,
    ]);
    if (!validAssignees.allExist) {
      throw new Error('Assignee not found');
    }
    if (!validAssignees.allActive) {
      throw new Error('Assignee is inactive');
    }

    // Get user profile to retrieve departmentId for ProjectCollaborator
    const userProfile = await this.taskRepository.getUserProfile(newUserId);
    if (!userProfile) {
      throw new Error('Assignee user profile not found');
    }

    // Add assignee to domain model
    task.addAssignee(newUserId, user.userId, user.role);

    // Persist assignment
    await this.taskRepository.addTaskAssignment(taskId, newUserId, user.userId);

    // Auto-create ProjectCollaborator if task belongs to a project
    const projectId = task.getProjectId();
    if (projectId) {
      // Only create if user is not already a collaborator
      const isCollaborator =
        await this.taskRepository.isUserProjectCollaborator(
          projectId,
          newUserId
        );
      if (!isCollaborator) {
        await this.taskRepository.createProjectCollaborator(
          projectId,
          newUserId,
          userProfile.departmentId
        );

        // Send project collaboration notification
        await this.sendProjectCollaborationNotification(
          projectId,
          newUserId,
          taskId
        );
      }
    }

    await this.taskRepository.logTaskAction(
      taskId,
      user.userId,
      'UPDATED',
      'Asignees',
      {
        changes: {
          added: newUserId,
        },
        metadata: {
          source: 'web_ui',
          action: 'addAssignee',
          newUserId,
        },
      }
    );

    // Send notifications to assigned users
    await this.sendTaskUpdateNotifications(
      taskId,
      'ASSIGNEE_ADDED',
      user.userId,
      { addedUserId: newUserId }
    );

    return task;
  }

  /**
   * Add comment to task
   * Authorization: Only assigned users can comment (Update User Story AC - TM021)
   */
  async addCommentToTask(
    taskId: string,
    content: string,
    user: UserContext
  ): Promise<Task> {
    const task = await this.getTaskById(taskId, user);
    if (!task) {
      throw new Error('Task not found');
    }

    const comment = task.addComment(content, user.userId);

    // Persist comment
    await this.taskRepository.createComment(taskId, content, user.userId);

    await this.taskRepository.logTaskAction(
      taskId,
      user.userId,
      'CREATED',
      'Comment',
      {
        changes: {
          said: content,
        },
        metadata: {
          source: 'web_ui',
          commentId: comment.id,
        },
      }
    );

    // Send notifications to assigned users
    await this.sendTaskUpdateNotifications(
      taskId,
      'COMMENT_ADDED',
      user.userId,
      { commentContent: content }
    );

    // Re-fetch to get persisted comment with ID
    const updatedTask = await this.getTaskById(taskId, user);
    if (!updatedTask) {
      throw new Error('Task not found after comment creation');
    }
    return updatedTask;
  }

  /**
   * Update comment (only own comments - TM021)
   * Authorization: Only comment author can update their own comments
   */
  async updateComment(
    taskId: string,
    commentId: string,
    newContent: string,
    user: UserContext
  ): Promise<Task> {
    const task = await this.getTaskById(taskId, user);
    if (!task) {
      throw new Error('Task not found');
    }

    // Get old content before updating
    const comment = task.getComments().find(c => c.id === commentId);
    const oldContent = comment?.content || '';

    task.updateComment(commentId, newContent, user.userId);

    // Persist comment update
    await this.taskRepository.updateComment(commentId, newContent);

    await this.taskRepository.logTaskAction(
      taskId,
      user.userId,
      'UPDATED',
      'Comment',
      {
        changes: {
          from: oldContent,
          to: newContent,
        },
        metadata: {
          source: 'web_ui',
          action: 'updateComment',
          commentId,
        },
      }
    );

    // Send notifications to assigned users
    await this.sendTaskUpdateNotifications(
      taskId,
      'COMMENT_UPDATED',
      user.userId,
      { commentContent: newContent }
    );

    return task;
  }

  // ============================================
  // FILE OPERATIONS
  // ============================================

  /**
   * Upload a file to a task
   *
   * Authorization: Task owner can always upload, otherwise must be assigned or be a manager with access
   * Validation:
   * - Individual file max 10MB (TM005)
   * - Task total max 50MB (TM044)
   * - Allowed file types only
   *
   * @param taskId - Task ID
   * @param file - File buffer
   * @param fileName - Original filename
   * @param fileType - MIME type
   * @param user - User context for authorization
   * @returns Created file record
   */
  async uploadFileToTask(
    taskId: string,
    file: Buffer,
    fileName: string,
    fileType: string,
    user: UserContext
  ) {
    // 1. Get task with department info for authorization check
    const taskData = await this.taskRepository.getTaskByIdFull(taskId);
    if (!taskData) {
      throw new Error('Task not found');
    }

    const isOwner = taskData.ownerId === user.userId;
    const isAssigned = taskData.assignments.some(
      assignment => assignment.userId === user.userId
    );

    // Check if user is a manager who can access this task
    let isManagerWithAccess = false;
    if (user.role === 'MANAGER' && !isOwner && !isAssigned) {
      isManagerWithAccess = await this.canManagerAccessDepartment(
        user.departmentId,
        taskData.departmentId
      );
    }

    if (!isOwner && !isAssigned && !isManagerWithAccess) {
      throw new Error(
        'Unauthorized: You must be the task owner, assigned to this task, or a manager of the department to upload files'
      );
    }

    // 2. Validate individual file (size and type)
    const fileValidation = this.storageService.validateFile(
      fileName,
      file.length,
      fileType
    );
    if (!fileValidation.valid) {
      throw new Error(fileValidation.error);
    }

    // 3. Check task-level 50MB limit
    const existingFiles = await this.taskRepository.getTaskFiles(taskId);
    const currentTotalSize = existingFiles.reduce(
      (sum, f) => sum + f.fileSize,
      0
    );

    const taskLimitValidation = this.storageService.validateTaskFileLimit(
      currentTotalSize,
      file.length
    );
    if (!taskLimitValidation.valid) {
      throw new Error(taskLimitValidation.error);
    }

    // 4. Upload to Supabase Storage
    const { storagePath, fileSize } = await this.storageService.uploadFile(
      taskId,
      file,
      fileName,
      fileType
    );

    // 5. Save metadata to database
    const fileRecord = await this.taskRepository.createTaskFile({
      taskId,
      fileName,
      fileSize,
      fileType,
      storagePath,
      uploadedById: user.userId,
    });

    // 6. Log action
    await this.taskRepository.logTaskAction(
      taskId,
      user.userId,
      'CREATED',
      'File',
      {
        changes: {
          added: fileName,
        },
        metadata: {
          source: 'web_ui',
          fileName,
          fileSize,
          fileId: fileRecord.id,
        },
      }
    );

    return fileRecord;
  }

  /**
   * Get download URL for a file
   *
   * Authorization: Task owner can always download, otherwise must be assigned or be a manager with access
   *
   * @param fileId - File ID
   * @param user - User context for authorization
   * @returns Signed download URL (expires in 1 hour)
   */
  async getFileDownloadUrl(fileId: string, user: UserContext): Promise<string> {
    // 1. Get file metadata
    const fileRecord = await this.taskRepository.getTaskFileById(fileId);
    if (!fileRecord) {
      throw new Error('File not found');
    }

    // 2. Get task with department info for authorization check
    const taskData = await this.taskRepository.getTaskByIdFull(
      fileRecord.taskId
    );
    if (!taskData) {
      throw new Error('Task not found');
    }

    const isOwner = taskData.ownerId === user.userId;
    const isAssigned = taskData.assignments.some(
      assignment => assignment.userId === user.userId
    );

    // Check if user is a manager who can access this task
    let isManagerWithAccess = false;
    if (user.role === 'MANAGER' && !isOwner && !isAssigned) {
      isManagerWithAccess = await this.canManagerAccessDepartment(
        user.departmentId,
        taskData.departmentId
      );
    }

    if (!isOwner && !isAssigned && !isManagerWithAccess) {
      throw new Error(
        'Unauthorized: You must be the task owner, assigned to this task, or a manager of the department to download files'
      );
    }

    // 3. Generate signed URL (valid for 1 hour)
    return await this.storageService.getFileDownloadUrl(fileRecord.storagePath);
  }

  /**
   * Delete a file attachment
   *
   * Authorization: Only the uploader or task owner can delete
   *
   * @param fileId - File ID
   * @param user - User context for authorization
   */
  async deleteFile(fileId: string, user: UserContext): Promise<void> {
    // 1. Get file metadata
    const fileRecord = await this.taskRepository.getTaskFileById(fileId);
    if (!fileRecord) {
      throw new Error('File not found');
    }

    // 2. Get task details
    const task = await this.taskRepository.getTaskById(fileRecord.taskId);
    if (!task) {
      throw new Error('Task not found');
    }

    // 3. Authorization: Only uploader or task owner can delete
    const canDelete =
      fileRecord.uploadedById === user.userId || task.ownerId === user.userId;

    if (!canDelete) {
      throw new Error(
        'Unauthorized: Only the uploader or task owner can delete files'
      );
    }

    // 4. Delete from Supabase Storage
    await this.storageService.deleteFile(fileRecord.storagePath);

    // 5. Delete from database
    await this.taskRepository.deleteTaskFile(fileId);

    // 6. Log action
    await this.taskRepository.logTaskAction(
      fileRecord.taskId,
      user.userId,
      'DELETED', // Using FILE_UPLOADED enum, add metadata to indicate deletion
      'File',
      {
        changes: {
          from: fileRecord.fileName,
          to: null,
        },
        metadata: {
          source: 'web_ui',
          fileName: fileRecord.fileName,
          action: 'deleted',
          fileId: fileId,
        },
      }
    );
  }

  /**
   * Get all files for a task
   *
   * Authorization: Task owner can always view files, otherwise must be assigned, or must be a manager with access
   *
   * @param taskId - Task ID
   * @param user - User context for authorization
   * @returns Array of file records
   */
  async getTaskFiles(taskId: string, user: UserContext) {
    // 1. Get task with department info for authorization check
    const taskData = await this.taskRepository.getTaskByIdFull(taskId);
    if (!taskData) {
      throw new Error('Task not found');
    }

    const isOwner = taskData.ownerId === user.userId;
    const isAssigned = taskData.assignments.some(
      assignment => assignment.userId === user.userId
    );

    // STAFF with isHrAdmin flag can view all company task files (view-only access)
    const hasHrAdminViewAccess =
      user.role === 'STAFF' && user.isHrAdmin === true;

    // Check if user is a manager who can access this task
    let isManagerWithAccess = false;
    if (user.role === 'MANAGER' && !isOwner && !isAssigned) {
      // Check if task is in manager's own department or a subordinate department
      isManagerWithAccess = await this.canManagerAccessDepartment(
        user.departmentId,
        taskData.departmentId
      );
    }

    if (
      !isOwner &&
      !isAssigned &&
      !isManagerWithAccess &&
      !hasHrAdminViewAccess
    ) {
      throw new Error(
        'Unauthorized: You must be the task owner, assigned to this task, or a manager of the department to view files'
      );
    }

    // 2. Get files
    return await this.taskRepository.getTaskFiles(taskId);
  }

  // ============================================
  // QUERY OPERATIONS (NEW)
  // ============================================

  /**
   * Get all tasks with optional filters
   * @param filters - Filter criteria
   * @param user - User context for authorization
   * @returns Array of Task domain objects
   */
  async getAllTasks(
    filters: {
      ownerId?: string;
      projectId?: string;
      departmentId?: string;
      status?: string;
      isArchived?: boolean;
      parentTaskId?: string;
    },
    _user: UserContext
  ): Promise<Task[]> {
    // TODO: Add authorization checks based on _user role/department
    const tasks = await this.taskRepository.getAllTasks(filters);
    return tasks.map(taskData => this.reconstructTaskFromData(taskData));
  }

  /**
   * Get all tasks in a project
   * @param projectId - Project ID
   * @param user - User context for authorization
   * @param includeArchived - Include archived tasks
   * @returns Array of Task domain objects
   */
  async getProjectTasks(
    projectId: string,
    user: UserContext,
    includeArchived: boolean = false
  ): Promise<Task[]> {
    // Validate project exists
    const projectExists =
      await this.taskRepository.validateProjectExists(projectId);
    if (!projectExists) {
      throw new Error('Project not found');
    }

    const tasks = await this.taskRepository.getProjectTasks(
      projectId,
      includeArchived
    );
    return tasks.map(taskData => this.reconstructTaskFromData(taskData));
  }

  /**
   * Get all subtasks of a parent task
   * @param parentTaskId - Parent task ID
   * @param user - User context for authorization
   * @returns Array of Task domain objects
   */
  async getSubtasks(parentTaskId: string, user: UserContext): Promise<Task[]> {
    // Verify parent task exists and user has access
    const parentTask = await this.getTaskById(parentTaskId, user);
    if (!parentTask) {
      throw new Error('Parent task not found');
    }

    const subtasks = await this.taskRepository.getSubtasks(parentTaskId);
    return subtasks.map(taskData => this.reconstructTaskFromData(taskData));
  }

  /**
   * Get all tasks owned by a user
   * @param ownerId - Owner user ID
   * @param includeArchived - Include archived tasks
   * @returns Array of Task domain objects
   */
  async getOwnerTasks(
    ownerId: string,
    includeArchived: boolean = false
  ): Promise<Task[]> {
    const tasks = await this.taskRepository.getOwnerTasks(
      ownerId,
      includeArchived
    );
    return tasks.map(taskData => this.reconstructTaskFromData(taskData));
  }

  // ============================================
  // ASSIGNMENT OPERATIONS (NEW)
  // ============================================

  /**
   * Remove assignee from task
   * Authorization: Only assigned users can update
   * Business rule: Must maintain at least 1 assignee (TM016)
   *
   * NEW (SCRUM-XX): Automatically removes ProjectCollaborator entry when:
   * - Task belongs to a project (projectId is not null)
   * - User has no other active task assignments in that project
   *
   * TODO: Make this role-based auth for MANAGER/HR_ADMIN only in future.
   * Currently violates TM015 for STAFF users: "Assigned Staff member can add
   * assignees, max 5 only. (but NOT remove them - TM015)"
   */
  async removeAssigneeFromTask(
    taskId: string,
    userId: string,
    user: UserContext
  ): Promise<Task> {
    const task = await this.getTaskById(taskId, user);
    if (!task) {
      throw new Error('Task not found');
    }

    // Use domain to validate and remove (checks min 1 assignee rule and manager role)
    task.removeAssignee(userId, user.userId, user.role);

    // Persist removal
    await this.taskRepository.removeTaskAssignment(taskId, userId);

    // Auto-remove ProjectCollaborator if user has no other tasks in project
    await this.removeProjectCollaboratorIfNeeded(task.getProjectId(), userId);

    // Log action
    await this.taskRepository.logTaskAction(
      taskId,
      user.userId,
      'UPDATED',
      'Assignees',
      {
        changes: {
          removed: userId,
        },
        metadata: {
          source: 'web_ui',
          action: 'removeAssignee',
          removedUserId: userId,
        },
      }
    );

    // Send notifications to assigned users
    await this.sendTaskUpdateNotifications(
      taskId,
      'ASSIGNEE_REMOVED',
      user.userId,
      { removedUserId: userId }
    );

    return task;
  }

  // ============================================
  // ARCHIVE/DELETE OPERATIONS (NEW)
  // ============================================

  /**
   * Helper: Remove project collaborator for a user if they have no active tasks
   * Reusable across removeAssignee and archiveTask operations
   */
  private async removeProjectCollaboratorIfNeeded(
    projectId: string | null,
    userId: string
  ): Promise<void> {
    if (projectId) {
      await this.taskRepository.removeProjectCollaboratorIfNoTasks(
        projectId,
        userId
      );
    }
  }

  /**
   * Archive a task (soft delete)
   * Authorization: Only managers can archive tasks (AC1)
   *
   * Acceptance Criteria:
   * - AC1: Only managers can archive tasks within their department hierarchy
   * - AC2: Archived tasks are no longer visible in UI (handled by repository filters)
   * - AC3: Archiving a parent task automatically archives all subtasks
   */
  async archiveTask(taskId: string, user: UserContext): Promise<Task> {
    // AC1: Only managers can archive tasks
    if (user.role !== 'MANAGER') {
      throw new Error('Unauthorized: Only managers can archive tasks');
    }

    const task = await this.getTaskById(taskId, user);
    if (!task) {
      throw new Error('Task not found');
    }

    // Use domain method
    task.archive();

    // Persist parent task
    await this.taskRepository.archiveTask(taskId);

    // Log action for parent
    await this.taskRepository.logTaskAction(
      taskId,
      user.userId,
      'ARCHIVED',
      'Task',
      {
        changes: {
          from: false,
          to: true,
        },
        metadata: {
          source: 'web_ui',
          taskTitle: task.getTitle(),
        },
      }
    );

    // AC3: Cascade - Archive all subtasks when parent is archived
    // The subtasks are archived silently (no authorization check) because the parent was already authorized
    const subtasks = await this.taskRepository.getSubtasks(taskId);
    for (const subtask of subtasks) {
      // Use repository method to maintain abstraction layer
      await this.taskRepository.archiveTask(subtask.id);

      // Log action for each subtask
      await this.taskRepository.logTaskAction(
        subtask.id,
        user.userId,
        'ARCHIVED',
        'Task',
        {
          changes: {
            from: false,
            to: true,
          },
          metadata: {
            source: 'web_ui',
            taskTitle: subtask.title,
            cascadeFromParent: true,
            parentTaskId: taskId,
          },
        }
      );
    }

    // Remove ProjectCollaborator entries for users who no longer have active tasks in project
    // When a task is archived, users may no longer have any active (non-archived) tasks in the project
    const projectId = task.getProjectId();
    if (projectId) {
      // Get all unique assignees from parent task and subtasks
      const allAssigneeIds = new Set<string>();

      // Add parent task assignees (Task domain uses Set<string> for assignments)
      task.getAssignees().forEach(userId => {
        allAssigneeIds.add(userId);
      });

      // Add subtask assignees (Repository returns Prisma objects with assignments array)
      for (const subtask of subtasks) {
        if (subtask.assignments && Array.isArray(subtask.assignments)) {
          subtask.assignments.forEach((assignment: { userId: string }) => {
            allAssigneeIds.add(assignment.userId);
          });
        }
      }

      // Check each assignee and remove from project collaborators if no active tasks remain
      for (const assigneeId of allAssigneeIds) {
        await this.removeProjectCollaboratorIfNeeded(projectId, assigneeId);
      }
    }

    return task;
  }

  /**
   * Unarchive a task
   * Authorization: Only assigned users can unarchive
   */
  async unarchiveTask(taskId: string, user: UserContext): Promise<Task> {
    const task = await this.getTaskById(taskId, user);
    if (!task) {
      throw new Error('Task not found');
    }

    // Use domain method
    task.unarchive();

    // Persist
    await this.taskRepository.unarchiveTask(taskId);

    // Log action
    await this.taskRepository.logTaskAction(
      taskId,
      user.userId,
      'UNARCHIVED',
      'Task',
      {
        changes: {
          from: true,
          to: false,
        },
        metadata: {
          source: 'web_ui',
          action: 'unarchived',
          taskTitle: task.getTitle(),
        },
      }
    );

    return task;
  }

  /**
   * Delete a task (hard delete)
   * Authorization: Only assigned users can delete
   * Business rule: Cannot delete task with subtasks (must archive instead)
   */
  async deleteTask(taskId: string, user: UserContext): Promise<void> {
    const task = await this.getTaskById(taskId, user);
    if (!task) {
      throw new Error('Task not found');
    }

    // Check for subtasks
    const hasSubtasks = await this.taskRepository.hasSubtasks(taskId);
    if (hasSubtasks) {
      throw new Error('Cannot delete task with subtasks. Archive it instead.');
    }

    // Log action BEFORE deletion
    await this.taskRepository.logTaskAction(
      taskId,
      user.userId,
      'DELETED',
      'Task',
      {
        changes: {
          removed: task.getTitle(),
        },
        metadata: {
          source: 'web_ui',
          taskTitle: task.getTitle(),
        },
      }
    );

    // Delete
    await this.taskRepository.deleteTask(taskId);
  }

  // ============================================
  // HELPER METHODS
  // ============================================

  // ============================================
  // TASK HIERARCHY OPERATIONS
  // ============================================

  /**
   * Get task hierarchy (parent chain + subtask tree)
   *
   * Returns:
   * - parentChain: All parent tasks from root to current
   * - currentTask: The task itself with full details
   * - subtaskTree: Recursive tree of all subtasks
   *
   * Authorization: User must have access to the task (owner or assigned)
   */
  async getTaskHierarchy(
    taskId: string,
    user: UserContext
  ): Promise<{
    parentChain: Array<{
      id: string;
      title: string;
      status: string;
      parentTaskId: string | null;
    }>;
    currentTask: any;
    subtaskTree: any[];
  }> {
    // Verify user has access to the task
    const task = await this.getTaskById(taskId, user);
    if (!task) {
      throw new Error('Task not found or access denied');
    }

    // Delegate to repository for hierarchy data
    return await this.taskRepository.getTaskHierarchy(taskId);
  }

  // ============================================
  // CALENDAR EVENT OPERATIONS
  // ============================================

  /**
   * Create a calendar event for a task
   *
   * Authorization:
   * - User must have access to the task (owner or assigned)
   * - The userId in the event must be a valid, active user
   *
   * @param taskId - Task ID
   * @param eventUserId - User ID for whom the event is created
   * @param title - Event title
   * @param eventDate - Event date/time
   * @param requestingUser - User making the request
   */
  async createCalendarEvent(
    taskId: string,
    eventUserId: string,
    title: string,
    eventDate: Date,
    requestingUser: UserContext
  ): Promise<any> {
    // Verify requesting user has access to the task
    const task = await this.getTaskById(taskId, requestingUser);
    if (!task) {
      throw new Error('Task not found or access denied');
    }

    // Verify the event user exists and is active
    const validUsers = await this.taskRepository.validateAssignees([
      eventUserId,
    ]);
    if (!validUsers.allExist) {
      throw new Error('Event user not found');
    }
    if (!validUsers.allActive) {
      throw new Error('Event user is inactive');
    }

    // Create the calendar event
    const calendarEvent = await this.taskRepository.createCalendarEvent({
      taskId,
      userId: eventUserId,
      title,
      eventDate,
    });

    // Log the action
    await this.taskRepository.logTaskAction(
      taskId,
      requestingUser.userId,
      'UPDATED',
      'Calendar Event',
      {
        action: 'createCalendarEvent',
        eventId: calendarEvent.id,
        eventUserId,
        eventDate: eventDate.toISOString(),
      }
    );

    return calendarEvent;
  }

  /**
   * Get all calendar events for a task
   *
   * Authorization: User must have access to the task (owner or assigned)
   *
   * @param taskId - Task ID
   * @param user - User making the request
   */
  async getCalendarEvents(taskId: string, user: UserContext): Promise<any[]> {
    // Verify user has access to the task
    const task = await this.getTaskById(taskId, user);
    if (!task) {
      throw new Error('Task not found or access denied');
    }

    // Get calendar events from repository
    return await this.taskRepository.getCalendarEvents(taskId);
  }

  /**
   * Check if a manager can access a specific department
   *
   * Implements UAA0022, UAA0023:
   * - Managers can see tasks in their own department
   * - Managers can see tasks in ALL subordinate departments (full recursive hierarchy)
   * - Managers CANNOT see tasks in peer departments or parent departments
   *
   * Example from UAA0023: "engineering operation division director department
   * can see Senior engineers, junior engineers, call centre and operation planning"
   * This proves full hierarchical access at ALL levels below.
   *
   * @param managerDepartmentId - Manager's department ID
   * @param targetDepartmentId - Target department ID to check access for
   * @returns true if manager can access the department, false otherwise
   */
  private async canManagerAccessDepartment(
    managerDepartmentId: string,
    targetDepartmentId: string
  ): Promise<boolean> {
    // Manager can always access their own department
    if (managerDepartmentId === targetDepartmentId) {
      return true;
    }

    // Recursively check if target department is a subordinate of manager's department
    // by traversing UP the hierarchy from the target department
    let currentDepartmentId: string | null = targetDepartmentId;

    while (currentDepartmentId) {
      const department =
        await this.taskRepository.getDepartmentWithParent(currentDepartmentId);

      if (!department) {
        return false;
      }

      // If we find the manager's department as a parent, access is allowed
      if (department.parentId === managerDepartmentId) {
        return true;
      }

      // Move up to the parent department
      currentDepartmentId = department.parentId;
    }

    // If we reached the root without finding the manager's department, no access
    return false;
  }

  /**
   * Get task logs for a specific task
   * @param taskId - Task ID
   * @param user - User context
   * @returns Array of task logs
   */
  async getTaskLogs(taskId: string, user: UserContext) {
    if (!taskId || taskId.trim() === '') {
      throw new Error('Task ID is required');
    }

    // Check if user has access to the task by using the existing getTaskById method
    // which already includes all the access checking logic
    const task = await this.getTaskById(taskId, user);
    if (!task) {
      throw new Error('Task not found');
    }

    // Get task logs with user details
    const logs = await this.taskRepository.getTaskLogs(taskId);
    return logs;
  }

  // ============================================
  // NOTIFICATION HELPER METHODS
  // ============================================

  /**
   * Send notifications to all assigned users for task updates
   *
   * @param taskId - Task ID
   * @param updateType - Type of update
   * @param actorUserId - User who made the change
   * @param metadata - Additional context
   * @private
   */
  private async sendTaskUpdateNotifications(
    taskId: string,
    updateType:
      | 'COMMENT_ADDED'
      | 'COMMENT_UPDATED'
      | 'ASSIGNEE_ADDED'
      | 'ASSIGNEE_REMOVED',
    actorUserId: string,
    metadata?: {
      addedUserId?: string;
      removedUserId?: string;
      commentContent?: string;
    }
  ): Promise<void> {
    try {
      // Guard: Skip if prisma or notificationService not initialized
      if (!this.prisma || !this.notificationService) {
        console.warn(
          '[sendTaskUpdateNotifications] Notifications disabled - prisma not provided to TaskService'
        );
        return;
      }

      // 1. Get full task details
      const taskData = await this.taskRepository.getTaskByIdFull(taskId);
      if (!taskData) {
        console.error(`[sendTaskUpdateNotifications] Task ${taskId} not found`);
        return;
      }

      // 2. Get actor details
      const actor = await this.prisma.userProfile.findUnique({
        where: { id: actorUserId },
        select: { name: true, email: true },
      });
      const actorName = actor?.name || actor?.email || 'Someone';

      // 3. Get all current assignees (after the update)
      const currentAssignees = taskData.assignments.map(a => a.userId);

      // 4. Determine recipients based on update type
      let recipients: string[] = [];
      let notificationMessage = '';
      let notificationTitle = '';
      let dbNotificationType: NotificationType;

      switch (updateType) {
        case 'COMMENT_ADDED':
          recipients = currentAssignees.filter(
            userId => userId !== actorUserId
          );
          notificationTitle = 'New Comment';
          notificationMessage = `${actorName} commented on "${taskData.title}"`;
          dbNotificationType = 'COMMENT_ADDED';
          break;

        case 'COMMENT_UPDATED':
          recipients = currentAssignees.filter(
            userId => userId !== actorUserId
          );
          notificationTitle = 'Comment Edited';
          notificationMessage = `${actorName} edited a comment on "${taskData.title}"`;
          dbNotificationType = 'COMMENT_ADDED';
          break;

        case 'ASSIGNEE_ADDED':
          recipients = currentAssignees.filter(
            userId => userId !== actorUserId
          );

          const newAssignee = await this.prisma.userProfile.findUnique({
            where: { id: metadata?.addedUserId },
            select: { name: true, email: true },
          });
          const newAssigneeName =
            newAssignee?.name || newAssignee?.email || 'A user';

          notificationTitle = 'New Assignment';
          notificationMessage = `${actorName} added ${newAssigneeName} to "${taskData.title}"`;
          dbNotificationType = 'TASK_REASSIGNED';
          break;

        case 'ASSIGNEE_REMOVED':
          recipients = currentAssignees.filter(
            userId => userId !== actorUserId
          );

          const removedAssignee = await this.prisma.userProfile.findUnique({
            where: { id: metadata?.removedUserId },
            select: { name: true, email: true },
          });
          const removedAssigneeName =
            removedAssignee?.name || removedAssignee?.email || 'A user';

          notificationTitle = 'Assignment Removed';
          notificationMessage = `${actorName} removed ${removedAssigneeName} from "${taskData.title}"`;
          dbNotificationType = 'TASK_REASSIGNED';
          break;
      }

      // 5. If no recipients, skip
      if (recipients.length === 0) {
        console.warn(
          `[sendTaskUpdateNotifications] No recipients for task ${taskId}, skipping`
        );
        return;
      }

      // 6. Send notification to each recipient
      // No duplicate check - database constraints prevent duplicate assignments
      for (const recipientUserId of recipients) {
        try {
          // Create notification in DB + send email (automatic via NotificationService)
          await this.notificationService.create({
            userId: recipientUserId,
            type: dbNotificationType,
            title: notificationTitle,
            message: notificationMessage,
            taskId: taskId,
          });

          // Broadcast real-time toast notification
          // This also triggers dashboard refresh via lastNotificationTime
          await this.broadcastToastNotification(recipientUserId, {
            type: dbNotificationType,
            title: notificationTitle,
            message: notificationMessage,
            taskId: taskId,
          });
        } catch (error) {
          console.error(
            `[sendTaskUpdateNotifications] Failed to notify user ${recipientUserId}:`,
            error
          );
          // Continue to next recipient
        }
      }
    } catch (error) {
      console.error(
        '[sendTaskUpdateNotifications] Error sending notifications:',
        error
      );
      // Don't throw - notifications are non-critical
    }
  }

  /**
   * Broadcast real-time toast notification to specific user
   * Uses RealtimeService (same as deadline notifications)
   * @param userId - User ID
   * @param notification - Notification payload
   * @private
   */
  private async broadcastToastNotification(
    userId: string,
    notification: {
      type: NotificationType;
      title: string;
      message: string;
      taskId: string;
    }
  ): Promise<void> {
    // Guard: Skip if realtimeService not provided
    if (!this.realtimeService) {
      console.warn(
        '[broadcastToastNotification] RealtimeService not provided - skipping real-time broadcast'
      );
      return;
    }

    try {
      await this.realtimeService.sendNotification(userId, {
        type: notification.type,
        title: notification.title,
        message: notification.message,
        taskId: notification.taskId,
        userId: userId,
        broadcast_at: new Date().toISOString(),
      });
    } catch (error) {
      console.error(
        `[broadcastToastNotification] Failed to broadcast to user ${userId}:`,
        error
      );
      // Don't throw - real-time notification is non-critical
    }
  }

  /**
   * Send notification when user becomes a project collaborator
   * Creates DB notification + sends email + broadcasts real-time toast
   *
   * @param projectId - Project ID
   * @param userId - User being added as collaborator
   * @param taskId - Task ID that triggered the collaboration
   * @private
   */
  private async sendProjectCollaborationNotification(
    projectId: string,
    userId: string,
    taskId: string
  ): Promise<void> {
    try {
      // Guard: Skip if prisma or notificationService not initialized
      if (!this.prisma || !this.notificationService) {
        console.warn(
          '[sendProjectCollaborationNotification] Notifications disabled - prisma not provided to TaskService'
        );
        return;
      }

      // Get project details
      const project = await this.prisma.project.findUnique({
        where: { id: projectId },
        select: { id: true, name: true },
      });

      if (!project) {
        console.error(
          `[sendProjectCollaborationNotification] Project ${projectId} not found`
        );
        return;
      }

      const notificationTitle = 'Added to Project';
      const notificationMessage = `You've been added as a collaborator on project "${project.name}"`;

      // Create notification in DB + send email (automatic via NotificationService)
      await this.notificationService.create({
        userId: userId,
        type: 'PROJECT_COLLABORATION_ADDED',
        title: notificationTitle,
        message: notificationMessage,
        taskId: taskId,
      });

      // Broadcast real-time toast
      await this.broadcastToastNotification(userId, {
        type: 'PROJECT_COLLABORATION_ADDED',
        title: notificationTitle,
        message: notificationMessage,
        taskId: taskId,
      });
    } catch (error) {
      console.error(
        `[sendProjectCollaborationNotification] Failed to notify user ${userId}:`,
        error
      );
      // Don't throw - notifications are non-critical
    }
  }
}
