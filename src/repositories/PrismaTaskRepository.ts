/**
 * PrismaTaskRepository Implementation
 *
 * This repository bridges the domain Task model and Prisma database layer.
 * It implements the ITaskRepository interface to provide database persistence
 * while keeping the domain layer clean and independent of infrastructure concerns.
 */

import { PrismaClient, Prisma } from '@prisma/client';
import { Task } from '../domain/task/Task';
import { ITaskRepository } from './ITaskRepository';
import { TaskStatus } from '../domain/task/Task';

export class PrismaTaskRepository implements ITaskRepository {
  constructor(private prisma: PrismaClient) {}

  // ============================================
  // CORE TASK OPERATIONS (Domain-driven)
  // ============================================

  /**
   * Save a Task to the database (create or update)
   */
  async save(task: Task): Promise<Task> {
    const assignments = Array.from(task.getAssignees());
    const tags = Array.from(task.getTags());
    const comments = task.getComments();

    const savedTask = await this.prisma.task.upsert({
      where: { id: task.getId() },
      update: {
        title: task.getTitle(),
        description: task.getDescription(),
        priority: task.getPriorityBucket(),
        status: task.getStatus(),
        dueDate: task.getDueDate(),
        recurringInterval: task.getRecurringInterval(),
        departmentId: task.getDepartmentId(),
        ownerId: task.getOwnerId(),
        parentTaskId: task.getParentTaskId(),
        startDate: task.getStartDate(),
        updatedAt: task.getUpdatedAt(),
        assignments: {
          deleteMany: {},
          create: assignments.map(userId => ({
            userId,
            assignedById: task.getOwnerId(),
            assignedAt: new Date(),
          })),
        },
        tags: {
          deleteMany: {},
          create: tags.map(name => ({
            tag: {
              connectOrCreate: {
                where: { name },
                create: { name },
              },
            },
          })),
        },
        comments: {
          deleteMany: {},
          create: comments.map(c => ({
            id: c.id,
            content: c.content,
            userId: c.authorId,
            createdAt: c.createdAt,
            updatedAt: c.updatedAt,
          })),
        },
      },
      create: {
        id: task.getId(),
        title: task.getTitle(),
        description: task.getDescription(),
        priority: task.getPriorityBucket(),
        status: task.getStatus(),
        dueDate: task.getDueDate(),
        recurringInterval: task.getRecurringInterval(),
        departmentId: task.getDepartmentId(),
        ownerId: task.getOwnerId(),
        parentTaskId: task.getParentTaskId(),
        startDate: task.getStartDate(),
        updatedAt: task.getUpdatedAt(),
        assignments: {
          create: assignments.map(userId => ({
            userId,
            assignedById: task.getOwnerId(),
            assignedAt: new Date(),
          })),
        },
        tags: {
          create: tags.map(name => ({
            tag: {
              connectOrCreate: {
                where: { name },
                create: { name },
              },
            },
          })),
        },
        comments: {
          create: comments.map(c => ({
            id: c.id,
            content: c.content,
            userId: c.authorId,
            createdAt: c.createdAt,
            updatedAt: c.updatedAt,
          })),
        },
      },
      include: {
        assignments: true,
        tags: {
          include: {
            tag: true,
          },
        },
        comments: true,
        files: true,
      },
    });

    return this.toDomainTask(savedTask);
  }

  /**
   * Find a Task by ID
   */
  async findById(id: string): Promise<Task | null> {
    const prismaTask = await this.prisma.task.findUnique({
      where: { id },
      include: {
        assignments: true,
        tags: {
          include: {
            tag: true,
          },
        },
        comments: true,
        files: true,
      },
    });

    if (!prismaTask) {
      return null;
    }

    return this.toDomainTask(prismaTask);
  }

  /**
   * Find all Tasks for a specific department
   */
  async findByDepartment(
    departmentId: string,
    includeArchived: boolean = false
  ): Promise<Task[]> {
    const prismaTasks = await this.prisma.task.findMany({
      where: {
        departmentId,
        ...(includeArchived ? {} : { isArchived: false }),
      },
      include: {
        assignments: true,
        tags: {
          include: {
            tag: true,
          },
        },
        comments: true,
        files: true,
      },
    });

    return prismaTasks.map(task => this.toDomainTask(task));
  }

  /**
   * Find all Tasks assigned to a specific user
   */
  async findByAssignee(
    userId: string,
    includeArchived: boolean = false
  ): Promise<Task[]> {
    const prismaTasks = await this.prisma.task.findMany({
      where: {
        assignments: {
          some: {
            userId: userId,
          },
        },
        ...(includeArchived ? {} : { isArchived: false }),
      },
      include: {
        assignments: true,
        tags: {
          include: {
            tag: true,
          },
        },
        comments: true,
        files: true,
      },
    });

    return prismaTasks.map(task => this.toDomainTask(task));
  }

  /**
   * Find tasks in department with assignees (for staff visibility)
   */
  async findByDepartmentWithAssignees(
    departmentId: string,
    includeArchived: boolean = false
  ): Promise<Task[]> {
    // This could be optimized with a more complex query
    // For now, just return department tasks
    return this.findByDepartment(departmentId, includeArchived);
  }

  /**
   * Find subtasks of a parent task
   */
  async findSubtasks(parentTaskId: string): Promise<Task[]> {
    const prismaTasks = await this.prisma.task.findMany({
      where: { parentTaskId },
      include: {
        assignments: true,
        tags: {
          include: {
            tag: true,
          },
        },
        comments: true,
        files: true,
      },
    });

    return prismaTasks.map(task => this.toDomainTask(task));
  }

  /**
   * Find parent task if this is a subtask
   */
  async findParentTask(taskId: string): Promise<Task | null> {
    const task = await this.findById(taskId);
    if (!task || !task.getParentTaskId()) {
      return null;
    }

    return this.findById(task.getParentTaskId()!);
  }

  /**
   * Delete a Task by ID
   */
  async delete(id: string): Promise<void> {
    await this.prisma.task.delete({
      where: { id },
    });
  }

  /**
   * Check if a task exists
   */
  async exists(id: string): Promise<boolean> {
    const count = await this.prisma.task.count({
      where: { id },
    });
    return count > 0;
  }

  /**
   * Find tasks by multiple criteria
   */
  async findByCriteria(criteria: {
    departmentId?: string;
    status?: TaskStatus;
    assigneeId?: string;
    creatorId?: string;
    tag?: string;
  }): Promise<Task[]> {
    const where: Prisma.TaskWhereInput = {};

    if (criteria.departmentId) {
      where.departmentId = criteria.departmentId;
    }
    if (criteria.status) {
      where.status = criteria.status;
    }
    if (criteria.assigneeId) {
      where.assignments = {
        some: { userId: criteria.assigneeId },
      };
    }
    if (criteria.creatorId) {
      where.ownerId = criteria.creatorId;
    }
    if (criteria.tag) {
      where.tags = {
        some: { tag: { name: criteria.tag } },
      };
    }

    const prismaTasks = await this.prisma.task.findMany({
      where,
      include: {
        assignments: true,
        tags: {
          include: {
            tag: true,
          },
        },
        comments: true,
        files: true,
      },
    });

    return prismaTasks.map(task => this.toDomainTask(task));
  }

  /**
   * Find all tasks by project
   */
  async findByProject(
    projectId: string,
    includeArchived: boolean = false
  ): Promise<Task[]> {
    const prismaTasks = await this.prisma.task.findMany({
      where: {
        projectId,
        ...(includeArchived ? {} : { isArchived: false }),
      },
      include: {
        assignments: true,
        tags: {
          include: {
            tag: true,
          },
        },
        comments: true,
        files: true,
      },
    });

    return prismaTasks.map(task => this.toDomainTask(task));
  }

  /**
   * Find all tasks (admin only)
   */
  async findAll(includeArchived: boolean = false): Promise<Task[]> {
    const prismaTasks = await this.prisma.task.findMany({
      where: {
        ...(includeArchived ? {} : { isArchived: false }),
      },
      include: {
        assignments: true,
        tags: {
          include: {
            tag: true,
          },
        },
        comments: true,
        files: true,
      },
    });

    return prismaTasks.map(task => this.toDomainTask(task));
  }

  // ============================================
  // FILE ATTACHMENT OPERATIONS
  // ============================================

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

  // ============================================
  // AUTHORIZATION & LOGGING HELPERS
  // ============================================

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
   * Get full task by ID with all relations for domain reconstruction
   */
  async getTaskByIdFull(taskId: string): Promise<{
    id: string;
    title: string;
    description: string;
    priority: number;
    dueDate: Date;
    status: string;
    ownerId: string;
    departmentId: string;
    projectId: string | null;
    parentTaskId: string | null;
    recurringInterval: number | null;
    isArchived: boolean;
    createdAt: Date;
    startDate: Date | null;
    updatedAt: Date;
    assignments: Array<{ userId: string }>;
    tags: Array<{ tag: { name: string } }>;
    comments: Array<{
      id: string;
      content: string;
      userId: string;
      createdAt: Date;
      updatedAt: Date;
    }>;
    files: Array<{
      id: string;
      fileName: string;
      fileSize: number;
      fileType: string;
      storagePath: string;
      uploadedById: string;
      uploadedAt: Date;
    }>;
  } | null> {
    return await this.prisma.task.findUnique({
      where: { id: taskId },
      include: {
        assignments: {
          select: {
            userId: true,
          },
        },
        tags: {
          include: {
            tag: {
              select: {
                name: true,
              },
            },
          },
        },
        comments: {
          select: {
            id: true,
            content: true,
            userId: true,
            createdAt: true,
            updatedAt: true,
          },
          orderBy: {
            createdAt: 'asc',
          },
        },
        files: {
          select: {
            id: true,
            fileName: true,
            fileSize: true,
            fileType: true,
            storagePath: true,
            uploadedById: true,
            uploadedAt: true,
          },
          orderBy: {
            uploadedAt: 'desc',
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
    field: string,
    data?: {
      changes?: any;
      metadata?: any;
      [key: string]: any;
    }
  ): Promise<void> {
    await this.prisma.taskLog.create({
      data: {
        taskId,
        userId,
        action: action as any, // Cast to any - Prisma expects LogAction enum, interface accepts string
        field,
        changes: data?.changes || null,
        metadata: data?.metadata || {},
      },
    });
  }

  // ============================================
  // PRIVATE HELPER METHODS
  // ============================================

  /**
   * Convert Prisma Task to Domain Task
   */
  private toDomainTask(prismaTask: {
    id: string;
    title: string;
    description: string;
    priority: number;
    dueDate: Date;
    status: string;
    ownerId: string;
    departmentId: string;
    projectId: string | null;
    parentTaskId: string | null;
    recurringInterval: number | null;
    isArchived: boolean;
    createdAt: Date;
    startDate?: Date | null;
    updatedAt: Date;
    assignments?: Array<{ userId: string }>;
    tags?: Array<{ tag: { name: string } }>;
    comments?: Array<{
      id: string;
      content: string;
      userId: string;
      createdAt: Date;
      updatedAt: Date;
    }>;
  }): Task {
    // Extract assignments as a Set of user IDs from assignments relation
    const assignments = new Set(
      prismaTask.assignments?.map(a => a.userId) || []
    );

    // Extract tags as a Set (tags are in TaskTag relation, get tag names)
    const tags = new Set(prismaTask.tags?.map(t => t.tag.name) || []);

    // Extract comments from Prisma relation
    const comments =
      prismaTask.comments?.map(c => ({
        id: c.id,
        content: c.content,
        authorId: c.userId,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
      })) || [];

    // Create Task with all properties (Task constructor takes single TaskData object)
    const task = new Task({
      id: prismaTask.id,
      title: prismaTask.title,
      description: prismaTask.description || '',
      priorityBucket: prismaTask.priority || 5, // Default to 5 if undefined
      dueDate: prismaTask.dueDate,
      status: prismaTask.status as TaskStatus,
      ownerId: prismaTask.ownerId,
      departmentId: prismaTask.departmentId,
      projectId: prismaTask.projectId || null,
      parentTaskId: prismaTask.parentTaskId || null,
      recurringInterval: prismaTask.recurringInterval || null,
      isArchived: prismaTask.isArchived || false,
      createdAt: prismaTask.createdAt,
      startDate: prismaTask.startDate || null,
      updatedAt: prismaTask.updatedAt,
      assignments,
      tags,
      comments,
    });

    return task;
  }

  /**
   * Create a new task with assignments and tags
   */
  async createTask(data: {
    id: string;
    title: string;
    description: string;
    priority: number;
    dueDate: Date;
    ownerId: string;
    departmentId: string;
    projectId?: string;
    parentTaskId?: string;
    assigneeIds: string[];
    tags?: string[];
    recurringInterval?: number;
    createdAt?: Date; // Optional: for recurring tasks to maintain schedule
  }): Promise<{ id: string }> {
    // Create task with assignments and tags
    const result = await this.prisma.task.create({
      data: {
        id: data.id,
        title: data.title,
        description: data.description,
        priority: data.priority,
        dueDate: data.dueDate,
        createdAt: data.createdAt, // Use provided createdAt for recurring tasks
        status: 'TO_DO',
        ownerId: data.ownerId,
        departmentId: data.departmentId,
        projectId: data.projectId,
        parentTaskId: data.parentTaskId,
        recurringInterval: data.recurringInterval,
        isArchived: false,
        // Create assignments
        assignments: {
          create: data.assigneeIds.map(userId => ({
            userId,
            assignedById: data.ownerId,
          })),
        },
        // Create tags (create or connect existing)
        tags: data.tags?.length
          ? {
              create: data.tags.map(tagName => ({
                tag: {
                  connectOrCreate: {
                    where: { name: tagName },
                    create: { name: tagName },
                  },
                },
              })),
            }
          : undefined,
      },
      select: {
        id: true,
      },
    });

    return result;
  }

  /**
   * Validate if project exists
   */
  async validateProjectExists(projectId: string): Promise<boolean> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true },
    });
    return !!project;
  }

  /**
   * Get parent task depth info for subtask validation (TGO026)
   */
  async getParentTaskDepth(
    taskId: string
  ): Promise<{ id: string; parentTaskId: string | null } | null> {
    return await this.prisma.task.findUnique({
      where: { id: taskId },
      select: {
        id: true,
        parentTaskId: true,
      },
    });
  }

  /**
   * Validate assignees exist and are active
   */
  async validateAssignees(
    userIds: string[]
  ): Promise<{ allExist: boolean; allActive: boolean }> {
    const users = await this.prisma.userProfile.findMany({
      where: {
        id: { in: userIds },
      },
      select: {
        id: true,
        isActive: true,
      },
    });

    const allExist = users.length === userIds.length;
    const allActive = users.every(u => u.isActive);

    return { allExist, allActive };
  }

  /**
   * Get all tasks assigned to a user
   */
  async getUserTasks(userId: string, includeArchived: boolean): Promise<any[]> {
    const assignments = await this.prisma.taskAssignment.findMany({
      where: {
        userId,
        task: {
          isArchived: includeArchived ? undefined : false,
        },
      },
      include: {
        task: {
          include: {
            assignments: {
              select: {
                userId: true,
              },
            },
            project: {
              select: {
                id: true,
                name: true,
              },
            },
            tags: {
              include: {
                tag: {
                  select: {
                    name: true,
                  },
                },
              },
            },
            comments: {
              select: {
                id: true,
                content: true,
                userId: true,
                createdAt: true,
                updatedAt: true,
              },
            },
            files: {
              select: {
                id: true,
                fileName: true,
                fileSize: true,
                fileType: true,
                storagePath: true,
                uploadedById: true,
                uploadedAt: true,
              },
            },
          },
        },
      },
      orderBy: {
        task: {
          dueDate: 'asc',
        },
      },
    });

    return assignments.map(a => a.task);
  }

  /**
   * Get all tasks in a department
   */
  async getDepartmentTasks(
    departmentId: string,
    includeArchived: boolean
  ): Promise<any[]> {
    return await this.prisma.task.findMany({
      where: {
        departmentId,
        isArchived: includeArchived ? undefined : false,
      },
      include: {
        assignments: {
          select: {
            userId: true,
          },
        },
        tags: {
          include: {
            tag: {
              select: {
                name: true,
              },
            },
          },
        },
        comments: {
          select: {
            id: true,
            content: true,
            userId: true,
            createdAt: true,
            updatedAt: true,
          },
        },
        files: {
          select: {
            id: true,
            fileName: true,
            fileSize: true,
            fileType: true,
            storagePath: true,
            uploadedById: true,
            uploadedAt: true,
          },
        },
      },
      orderBy: {
        dueDate: 'asc',
      },
    });
  }

  /**
   * Update task fields
   */
  async updateTask(
    taskId: string,
    data: Partial<{
      title: string;
      description: string;
      priority: number;
      dueDate: Date;
      status: TaskStatus;
      recurringInterval: number | null;
      startDate: Date | null;
      updatedAt: Date;
    }>
  ): Promise<void> {
    await this.prisma.task.update({
      where: { id: taskId },
      data,
    });
  }

  /**
   * Add tag to task (two-step: upsert tag, then create relationship)
   */
  async addTaskTag(taskId: string, tagName: string): Promise<void> {
    // Step 1: Ensure tag exists (upsert pattern)
    const tag = await this.prisma.tag.upsert({
      where: { name: tagName },
      create: { name: tagName },
      update: {}, // No updates needed if tag exists
    });

    // Step 2: Create TaskTag relationship with direct foreign keys
    await this.prisma.taskTag.create({
      data: {
        taskId,
        tagId: tag.id,
      },
    });
  }

  /**
   * Remove tag from task
   */
  async removeTaskTag(taskId: string, tagName: string): Promise<void> {
    // First find the tag
    const tag = await this.prisma.tag.findUnique({
      where: { name: tagName },
    });

    if (tag) {
      await this.prisma.taskTag.delete({
        where: {
          taskId_tagId: {
            taskId,
            tagId: tag.id,
          },
        },
      });
    }
  }

  /**
   * Add assignment to task
   */
  async addTaskAssignment(
    taskId: string,
    userId: string,
    assignedById: string
  ): Promise<void> {
    await this.prisma.taskAssignment.create({
      data: {
        taskId,
        userId,
        assignedById,
      },
    });
  }

  /**
   * Create comment
   */
  async createComment(
    taskId: string,
    content: string,
    userId: string
  ): Promise<void> {
    await this.prisma.comment.create({
      data: {
        taskId,
        content,
        userId,
      },
    });
  }

  /**
   * Update comment
   */
  async updateComment(commentId: string, newContent: string): Promise<void> {
    await this.prisma.comment.update({
      where: { id: commentId },
      data: { content: newContent },
    });
  }

  /**
   * Get all tasks with optional filters
   */
  async getAllTasks(filters: {
    ownerId?: string;
    projectId?: string;
    departmentId?: string;
    status?: string;
    isArchived?: boolean;
    parentTaskId?: string;
  }): Promise<any[]> {
    return await this.prisma.task.findMany({
      where: {
        ownerId: filters.ownerId,
        projectId: filters.projectId,
        departmentId: filters.departmentId,
        status: filters.status as any,
        isArchived: filters.isArchived ?? false,
        parentTaskId: filters.parentTaskId,
      },
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        project: {
          select: {
            id: true,
            name: true,
          },
        },
        department: {
          select: {
            id: true,
            name: true,
          },
        },
        assignments: {
          select: {
            userId: true,
          },
        },
        tags: {
          include: {
            tag: {
              select: {
                name: true,
              },
            },
          },
        },
        comments: {
          select: {
            id: true,
            content: true,
            userId: true,
            createdAt: true,
            updatedAt: true,
          },
        },
        files: {
          select: {
            id: true,
            fileName: true,
            fileSize: true,
            fileType: true,
            storagePath: true,
            uploadedById: true,
            uploadedAt: true,
          },
        },
      },
      orderBy: {
        dueDate: 'asc',
      },
    });
  }

  /**
   * Get all tasks in a project
   */
  async getProjectTasks(
    projectId: string,
    includeArchived: boolean
  ): Promise<any[]> {
    return await this.getAllTasks({
      projectId,
      isArchived: includeArchived ? undefined : false,
    });
  }

  /**
   * Get all subtasks of a parent task
   */
  async getSubtasks(parentTaskId: string): Promise<any[]> {
    return await this.prisma.task.findMany({
      where: {
        parentTaskId,
        isArchived: false,
      },
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        assignments: {
          select: {
            userId: true,
          },
        },
        tags: {
          include: {
            tag: {
              select: {
                name: true,
              },
            },
          },
        },
        comments: {
          select: {
            id: true,
            content: true,
            userId: true,
            createdAt: true,
            updatedAt: true,
          },
        },
        files: {
          select: {
            id: true,
            fileName: true,
            fileSize: true,
            fileType: true,
            storagePath: true,
            uploadedById: true,
            uploadedAt: true,
          },
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    });
  }

  /**
   * Get all tasks owned by a user
   */
  async getOwnerTasks(
    ownerId: string,
    includeArchived: boolean
  ): Promise<any[]> {
    return await this.getAllTasks({
      ownerId,
      isArchived: includeArchived ? undefined : false,
    });
  }

  /**
   * Remove assignment from task
   */
  async removeTaskAssignment(taskId: string, userId: string): Promise<void> {
    await this.prisma.taskAssignment.delete({
      where: {
        taskId_userId: {
          taskId,
          userId,
        },
      },
    });
  }

  /**
   * Archive a task
   */
  async archiveTask(taskId: string): Promise<void> {
    await this.prisma.task.update({
      where: { id: taskId },
      data: {
        isArchived: true,
        updatedAt: new Date(),
      },
    });
  }

  /**
   * Unarchive a task
   */
  async unarchiveTask(taskId: string): Promise<void> {
    await this.prisma.task.update({
      where: { id: taskId },
      data: {
        isArchived: false,
        updatedAt: new Date(),
      },
    });
  }

  /**
   * Delete a task (hard delete)
   */
  async deleteTask(taskId: string): Promise<void> {
    await this.prisma.task.delete({
      where: { id: taskId },
    });
  }

  /**
   * Check if task has subtasks
   */
  async hasSubtasks(taskId: string): Promise<boolean> {
    const count = await this.prisma.task.count({
      where: { parentTaskId: taskId },
    });
    return count > 0;
  }

  /**
   * Get task hierarchy (parent chain + subtask tree)
   */
  async getTaskHierarchy(taskId: string): Promise<{
    parentChain: Array<{
      id: string;
      title: string;
      status: string;
      parentTaskId: string | null;
    }>;
    currentTask: any;
    subtaskTree: any[];
  }> {
    // Get current task with full details
    const currentTask = await this.getTaskByIdFull(taskId);
    if (!currentTask) {
      throw new Error('Task not found');
    }

    // Build parent chain by traversing up
    const parentChain = [];
    let currentParentId = currentTask.parentTaskId;

    while (currentParentId) {
      const parent = await this.prisma.task.findUnique({
        where: { id: currentParentId },
        select: {
          id: true,
          title: true,
          status: true,
          priority: true,
          dueDate: true,
          parentTaskId: true,
        },
      });

      if (!parent) {
        break;
      }

      parentChain.unshift(parent); // Add to beginning to maintain order
      currentParentId = parent.parentTaskId;
    }

    // Recursively get all subtasks
    const getSubtaskTree = async (parentId: string): Promise<any[]> => {
      const subtasks = await this.prisma.task.findMany({
        where: {
          parentTaskId: parentId,
          isArchived: false,
        },
        include: {
          owner: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      // For each subtask, recursively get their subtasks
      const subtasksWithChildren = await Promise.all(
        subtasks.map(async subtask => ({
          ...subtask,
          subtasks: await getSubtaskTree(subtask.id),
        }))
      );

      return subtasksWithChildren;
    };

    const subtaskTree = await getSubtaskTree(taskId);

    return {
      parentChain,
      currentTask,
      subtaskTree,
    };
  }

  /**
   * Create calendar event for a task
   */
  async createCalendarEvent(data: {
    taskId: string;
    userId: string;
    title: string;
    eventDate: Date;
  }): Promise<any> {
    return await this.prisma.calendarEvent.create({
      data: {
        taskId: data.taskId,
        userId: data.userId,
        title: data.title,
        eventDate: data.eventDate,
      },
      include: {
        task: {
          select: {
            id: true,
            title: true,
          },
        },
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });
  }

  /**
   * Get calendar events for a task
   */
  async getCalendarEvents(taskId: string): Promise<any[]> {
    return await this.prisma.calendarEvent.findMany({
      where: { taskId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        eventDate: 'asc',
      },
    });
  }

  /**
   * Get department with parent information for authorization checks
   */
  async getDepartmentWithParent(
    departmentId: string
  ): Promise<{ id: string; parentId: string | null } | null> {
    return await this.prisma.department.findUnique({
      where: { id: departmentId },
      select: {
        id: true,
        parentId: true,
      },
    });
  }

  /**
   * Get task logs for a specific task
   */
  async getTaskLogs(taskId: string): Promise<
    Array<{
      id: string;
      taskId: string;
      userId: string;
      action: string;
      field: string;
      changes: any;
      metadata: any;
      timestamp: Date;
      user: {
        id: string;
        name: string;
        email: string;
      };
    }>
  > {
    const logs = await this.prisma.taskLog.findMany({
      where: { taskId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        timestamp: 'desc',
      },
    });

    return logs.map(log => ({
      id: log.id,
      taskId: log.taskId,
      userId: log.userId,
      action: log.action,
      field: log.field,
      changes: log.changes,
      metadata: log.metadata,
      timestamp: log.timestamp,
      user: {
        id: log.user.id,
        name: log.user.name || 'Unknown User',
        email: log.user.email,
      },
    }));
  }

  /**
   * Get user departments by user IDs
   */
  async getUserDepartments(
    userIds: string[]
  ): Promise<Array<{ userId: string; departmentId: string | null }>> {
    const users = await this.prisma.userProfile.findMany({
      where: { id: { in: userIds } },
      select: {
        id: true,
        departmentId: true,
      },
    });

    return users.map(user => ({
      userId: user.id,
      departmentId: user.departmentId,
    }));
  }

  // ============================================
  // PROJECT COLLABORATOR OPERATIONS
  // SCRUM-XX: Invite Collaborators to Project
  // ============================================

  /**
   * Get user profile with department information
   * Used for retrieving departmentId when creating ProjectCollaborator entries
   */
  async getUserProfile(userId: string): Promise<{
    id: string;
    departmentId: string;
    role: 'STAFF' | 'MANAGER' | 'HR_ADMIN';
    isActive: boolean;
  } | null> {
    const user = await this.prisma.userProfile.findUnique({
      where: { id: userId },
      select: {
        id: true,
        departmentId: true,
        role: true,
        isActive: true,
      },
    });

    if (!user) {
      return null;
    }

    return {
      id: user.id,
      departmentId: user.departmentId,
      role: user.role as 'STAFF' | 'MANAGER' | 'HR_ADMIN',
      isActive: user.isActive,
    };
  }

  /**
   * Check if user is already a collaborator on a project
   * Used to prevent duplicate ProjectCollaborator entries
   */
  async isUserProjectCollaborator(
    projectId: string,
    userId: string
  ): Promise<boolean> {
    const collaborator = await this.prisma.projectCollaborator.findUnique({
      where: {
        projectId_userId: {
          projectId,
          userId,
        },
      },
    });

    return collaborator !== null;
  }

  /**
   * Create ProjectCollaborator entry
   * Uses upsert to handle race conditions gracefully
   * If entry already exists, it will be updated (no-op in this case)
   */
  async createProjectCollaborator(
    projectId: string,
    userId: string,
    departmentId: string
  ): Promise<void> {
    await this.prisma.projectCollaborator.upsert({
      where: {
        projectId_userId: {
          projectId,
          userId,
        },
      },
      create: {
        projectId,
        userId,
        departmentId,
        addedAt: new Date(),
      },
      update: {
        // If already exists, do nothing (keep existing entry)
        // This handles race conditions where multiple tasks are assigned simultaneously
      },
    });
  }

  /**
   * Remove ProjectCollaborator if user has no other active tasks in project
   *
   * Business Logic:
   * 1. Count how many active (non-archived) tasks the user is assigned to in this project
   * 2. If count === 0, delete the ProjectCollaborator entry
   * 3. If count > 0, do nothing (user still has other tasks)
   */
  async removeProjectCollaboratorIfNoTasks(
    projectId: string,
    userId: string
  ): Promise<void> {
    // Step 1: Count user's remaining active task assignments in this project
    const activeTaskCount = await this.prisma.taskAssignment.count({
      where: {
        userId: userId,
        task: {
          projectId: projectId,
          isArchived: false, // Only count active tasks
        },
      },
    });

    // Step 2: Only remove collaborator if NO active tasks remain
    if (activeTaskCount === 0) {
      await this.prisma.projectCollaborator
        .delete({
          where: {
            projectId_userId: {
              projectId,
              userId,
            },
          },
        })
        .catch(() => {
          // Ignore if already deleted (race condition handling)
          // This can happen if multiple removals happen simultaneously
        });
    }

    // If activeTaskCount > 0, user still has tasks in this project, so do nothing
  }
}
