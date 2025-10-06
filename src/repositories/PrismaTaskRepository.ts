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
        isRecurring: task.isTaskRecurring(),
        recurrenceDays: task.getRecurrenceDays(),
        departmentId: task.getDepartmentId(),
        ownerId: task.getOwnerId(),
        parentTaskId: task.getParentTaskId(),
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
        isRecurring: task.isTaskRecurring(),
        recurrenceDays: task.getRecurrenceDays(),
        departmentId: task.getDepartmentId(),
        ownerId: task.getOwnerId(),
        parentTaskId: task.getParentTaskId(),
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
   * Log a task action
   */
  async logTaskAction(
    taskId: string,
    userId: string,
    action: string,
    metadata?: Record<string, string | number | boolean | null>
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
    priorityBucket: number;
    dueDate: Date;
    status: string;
    ownerId: string;
    departmentId: string;
    projectId: string | null;
    parentTaskId: string | null;
    isRecurring: boolean;
    recurrenceDays: number | null;
    isArchived: boolean;
    createdAt: Date;
    updatedAt: Date;
    assignments?: Array<{ userId: string }>;
    tags?: Array<{ tag: { name: string } }>;
    comments?: Array<{
      id: string;
      content: string;
      authorId: string;
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
      isRecurring: prismaTask.isRecurring,
      recurrenceDays: prismaTask.recurrenceDays || null,
      isArchived: prismaTask.isArchived || false,
      createdAt: prismaTask.createdAt,
      updatedAt: prismaTask.updatedAt,
      assignments,
      tags,
      comments,
    });

    return task;
  }
}
