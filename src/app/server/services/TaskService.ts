import { BaseService } from './BaseService';
import {
  CreateTaskInput,
  UpdateTaskInput,
  TaskFilters,
  DashboardData,
  DashboardMetrics,
} from '../types';
import { TaskStatus, Task } from '@prisma/client';
import { AuthorizationService } from './AuthorizationService';

type TaskWithOwner = Task & {
  owner: {
    id: string;
    name: string | null;
  };
};

type TaskHierarchyNode = TaskWithOwner & {
  subtasks: TaskHierarchyNode[];
};

/**
 * TaskService
 *
 * Handles all business logic related to tasks including:
 * - Task CRUD operations
 * - Task assignment management
 * - Subtask relationships
 * - Task status management
 * - Task filtering and queries
 */
export class TaskService extends BaseService {
  /**
   * Get all tasks with optional filters
   * @param filters - Optional filters for tasks
   * @returns Array of tasks
   */
  async getAll(filters?: TaskFilters) {
    try {
      return await this.prisma.task.findMany({
        where: {
          ownerId: filters?.ownerId,
          projectId: filters?.projectId,
          departmentId: filters?.departmentId,
          status: filters?.status,
          isArchived: filters?.isArchived ?? false,
          parentTaskId: filters?.parentTaskId,
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
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                },
              },
            },
          },
          subtasks: {
            where: {
              isArchived: false,
            },
            select: {
              id: true,
              title: true,
              status: true,
              dueDate: true,
            },
          },
        },
        orderBy: {
          dueDate: 'asc',
        },
      });
    } catch (error) {
      this.handleError(error, 'getAll');
    }
  }

  /**
   * Get task by ID with full details
   * @param id - Task ID
   * @returns Task or null
   */
  async getById(id: string) {
    try {
      this.validateId(id, 'Task ID');

      return await this.prisma.task.findUnique({
        where: { id },
        include: {
          owner: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
            },
          },
          project: {
            select: {
              id: true,
              name: true,
              status: true,
            },
          },
          department: {
            select: {
              id: true,
              name: true,
            },
          },
          parentTask: {
            select: {
              id: true,
              title: true,
              status: true,
            },
          },
          subtasks: {
            where: {
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
          },
          assignments: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  role: true,
                },
              },
              assignedBy: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
          comments: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
            orderBy: {
              createdAt: 'desc',
            },
          },
          files: {
            include: {
              uploadedBy: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
            orderBy: {
              uploadedAt: 'desc',
            },
          },
          tags: {
            include: {
              tag: true,
            },
          },
        },
      });
    } catch (error) {
      this.handleError(error, 'getById');
    }
  }

  /**
   * Get tasks in a project
   * @param projectId - Project ID
   * @returns Array of tasks
   */
  async getByProject(projectId: string) {
    try {
      this.validateId(projectId, 'Project ID');

      return await this.getAll({ projectId });
    } catch (error) {
      this.handleError(error, 'getByProject');
    }
  }

  /**
   * Get tasks assigned to a user
   * @param userId - User ID
   * @returns Array of tasks
   */
  async getByAssignee(userId: string) {
    try {
      this.validateId(userId, 'User ID');

      const assignments = await this.prisma.taskAssignment.findMany({
        where: {
          userId,
          task: {
            isArchived: false,
          },
        },
        include: {
          task: {
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
            },
          },
        },
      });

      return assignments.map(a => a.task);
    } catch (error) {
      this.handleError(error, 'getByAssignee');
    }
  }

  /**
   * Get tasks owned by a user
   * @param ownerId - Owner user ID
   * @returns Array of tasks
   */
  async getByOwner(ownerId: string) {
    try {
      this.validateId(ownerId, 'Owner ID');

      return await this.getAll({ ownerId });
    } catch (error) {
      this.handleError(error, 'getByOwner');
    }
  }

  /**
   * Get subtasks of a parent task
   * @param parentTaskId - Parent task ID
   * @returns Array of subtasks
   */
  async getSubtasks(parentTaskId: string) {
    try {
      this.validateId(parentTaskId, 'Parent Task ID');

      return await this.getAll({ parentTaskId });
    } catch (error) {
      this.handleError(error, 'getSubtasks');
    }
  }

  /**
   * Create a new task with assignments and tags
   * @param data - Task creation data
   * @returns Created task with all relations
   */
  async create(data: CreateTaskInput) {
    try {
      // Validate owner exists and is active
      const owner = await this.prisma.userProfile.findUnique({
        where: { id: data.ownerId },
      });

      if (!owner || !owner.isActive) {
        throw new Error('Owner not found or inactive');
      }

      // Validate department exists
      const department = await this.prisma.department.findUnique({
        where: { id: data.departmentId },
      });

      if (!department) {
        throw new Error('Department not found');
      }

      // Validate project if provided
      if (data.projectId) {
        const project = await this.prisma.project.findUnique({
          where: { id: data.projectId },
        });

        if (!project) {
          throw new Error('Project not found');
        }
      }

      // Validate parent task if provided (for subtasks) - TGO026
      if (data.parentTaskId) {
        const parentTask = await this.prisma.task.findUnique({
          where: { id: data.parentTaskId },
          select: {
            id: true,
            parentTaskId: true,
          },
        });

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
        const assignees = await this.prisma.userProfile.findMany({
          where: {
            id: { in: data.assigneeIds },
          },
        });

        if (assignees.length !== data.assigneeIds.length) {
          throw new Error('One or more assignees not found');
        }

        const inactiveAssignees = assignees.filter(a => !a.isActive);
        if (inactiveAssignees.length > 0) {
          throw new Error('One or more assignees are inactive');
        }
      }

      // Handle tags - create or find existing tags
      const tagIds: string[] = [];
      if (data.tags && data.tags.length > 0) {
        for (const tagName of data.tags) {
          // Try to find existing tag
          let tag = await this.prisma.tag.findUnique({
            where: { name: tagName },
          });

          // Create tag if it doesn't exist
          if (!tag) {
            tag = await this.prisma.tag.create({
              data: { name: tagName },
            });
          }

          tagIds.push(tag.id);
        }
      }

      // Create the task with priority defaulting to 5 (medium on 1-10 scale)
      const createdTask = await this.prisma.task.create({
        data: {
          title: data.title,
          description: data.description,
          priority: data.priority ?? 5,
          dueDate: data.dueDate,
          ownerId: data.ownerId,
          departmentId: data.departmentId,
          projectId: data.projectId,
          parentTaskId: data.parentTaskId,
          recurringInterval: data.recurringInterval,
        },
        include: {
          owner: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          department: {
            select: {
              id: true,
              name: true,
            },
          },
          project: {
            select: {
              id: true,
              name: true,
            },
          },
          parentTask: {
            select: {
              id: true,
              title: true,
            },
          },
        },
      });

      // Create task assignments for all assignees
      if (data.assigneeIds && data.assigneeIds.length > 0) {
        await this.prisma.taskAssignment.createMany({
          data: data.assigneeIds.map(userId => ({
            taskId: createdTask.id,
            userId,
            assignedById: data.ownerId,
          })),
        });
      }

      // Link tags to task
      if (tagIds.length > 0) {
        await this.prisma.taskTag.createMany({
          data: tagIds.map(tagId => ({
            taskId: createdTask.id,
            tagId,
          })),
        });
      }

      // Fetch and return the complete task with all relations for immediate dashboard display
      return await this.getById(createdTask.id);
    } catch (error) {
      this.handleError(error, 'create');
    }
  }

  /**
   * Update a task
   * @param id - Task ID
   * @param data - Task update data
   * @returns Updated task
   */
  async update(id: string, data: UpdateTaskInput) {
    try {
      this.validateId(id, 'Task ID');

      // Check task exists
      const existing = await this.prisma.task.findUnique({
        where: { id },
      });

      if (!existing) {
        throw new Error('Task not found');
      }

      return await this.prisma.task.update({
        where: { id },
        data,
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
        },
      });
    } catch (error) {
      this.handleError(error, 'update');
    }
  }

  /**
   * Get tasks in a department
   * @param departmentId - Department ID
   * @returns Array of tasks
   */
  async getByDepartment(departmentId: string) {
    try {
      this.validateId(departmentId, 'Department ID');

      return await this.getAll({ departmentId });
    } catch (error) {
      this.handleError(error, 'getByDepartment');
    }
  }

  /**
   * Update task status
   * Automatically generates next recurring task instance when a recurring task is completed
   * @param id - Task ID
   * @param status - New status
   * @returns Updated task
   */
  async updateStatus(id: string, status: TaskStatus) {
    try {
      this.validateId(id, 'Task ID');

      // Get task details before updating to check for recurring interval
      const task = await this.prisma.task.findUnique({
        where: { id },
        include: {
          assignments: {
            select: {
              userId: true,
            },
          },
          tags: {
            select: {
              tagId: true,
            },
          },
        },
      });

      if (!task) {
        throw new Error('Task not found');
      }

      // If task is being marked as COMPLETED and has a recurring interval, create next instance

      if (status === 'COMPLETED' && (task as any).recurringInterval) {
        await this.generateNextRecurringTask(task as any);
      }

      // Update the task status
      const updatedTask = await this.update(id, { status });

      return updatedTask;
    } catch (error) {
      this.handleError(error, 'updateStatus');
    }
  }

  /**
   * Generate the next instance of a recurring task
   * @param completedTask - The completed recurring task
   * @returns Newly created recurring task instance
   */
  private async generateNextRecurringTask(completedTask: {
    id: string;
    title: string;
    description: string;
    priority: number;
    dueDate: Date;
    ownerId: string;
    projectId: string | null;
    departmentId: string;
    parentTaskId: string | null;
    recurringInterval: number | null;
    assignments: Array<{ userId: string }>;
    tags: Array<{ tagId: string }>;
  }) {
    try {
      if (!completedTask.recurringInterval) {
        return;
      }

      // Calculate new due date by adding recurring interval (in days) to original due date
      // Use UTC methods to avoid timezone issues
      const newDueDate = new Date(completedTask.dueDate);
      newDueDate.setUTCDate(
        newDueDate.getUTCDate() + completedTask.recurringInterval
      );

      // Extract assignee IDs
      const assigneeIds = completedTask.assignments.map(a => a.userId);

      // Extract tag names if tags exist
      let tagNames: string[] = [];
      if (completedTask.tags && completedTask.tags.length > 0) {
        const tagIds = completedTask.tags.map(tt => tt.tagId);
        const tags = await this.prisma.tag.findMany({
          where: { id: { in: tagIds } },
        });
        tagNames = tags.map(tag => tag.name);
      }

      // Create the next task instance
      const nextTask = await this.create({
        title: completedTask.title,
        description: completedTask.description,
        priority: completedTask.priority,
        dueDate: newDueDate,
        ownerId: completedTask.ownerId,
        assigneeIds,
        departmentId: completedTask.departmentId,
        projectId: completedTask.projectId || undefined,
        parentTaskId: completedTask.parentTaskId || undefined,
        recurringInterval: completedTask.recurringInterval, // Keep the recurring interval
        tags: tagNames.length > 0 ? tagNames : undefined,
      });

      return nextTask;
    } catch (error) {
      console.error('Failed to generate next recurring task:', error);
      // Don't throw - we don't want to fail the status update if recurring generation fails
    }
  }

  /**
   * Assign a user to a task
   * @param taskId - Task ID
   * @param userId - User ID to assign
   * @param assignedById - ID of user making the assignment
   * @returns Created task assignment
   */
  async assignUser(taskId: string, userId: string, assignedById: string) {
    try {
      this.validateId(taskId, 'Task ID');
      this.validateId(userId, 'User ID');
      this.validateId(assignedById, 'Assigned By User ID');

      // Verify task exists
      const task = await this.prisma.task.findUnique({
        where: { id: taskId },
        // ===== NEW: Include assignments to count them =====
        include: {
          assignments: true,
        },
      });

      if (!task) {
        throw new Error('Task not found');
      }

      // ===== NEW: Check max 5 assignees limit =====
      if (task.assignments.length >= 5) {
        throw new Error('Maximum 5 assignees allowed per task');
      }

      // Verify user exists
      const user = await this.prisma.userProfile.findUnique({
        where: { id: userId },
      });

      if (!user || !user.isActive) {
        throw new Error('User not found or inactive');
      }

      // Check if already assigned
      const existingAssignment = await this.prisma.taskAssignment.findUnique({
        where: {
          taskId_userId: {
            taskId,
            userId,
          },
        },
      });

      if (existingAssignment) {
        throw new Error('User is already assigned to this task');
      }

      return await this.prisma.taskAssignment.create({
        data: {
          taskId,
          userId,
          assignedById,
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
            },
          },
          assignedBy: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });
    } catch (error) {
      this.handleError(error, 'assignUser');
    }
  }

  /**
   * Remove a user assignment from a task
   * @param taskId - Task ID
   * @param userId - User ID to unassign
   * @returns Deleted task assignment
   */
  async unassignUser(taskId: string, userId: string) {
    try {
      this.validateId(taskId, 'Task ID');
      this.validateId(userId, 'User ID');

      return await this.prisma.taskAssignment.delete({
        where: {
          taskId_userId: {
            taskId,
            userId,
          },
        },
      });
    } catch (error) {
      this.handleError(error, 'unassignUser');
    }
  }

  /**
   * Archive a task
   * @param id - Task ID
   * @returns Updated task
   */
  async archive(id: string) {
    try {
      this.validateId(id, 'Task ID');

      return await this.update(id, { isArchived: true });
    } catch (error) {
      this.handleError(error, 'archive');
    }
  }

  /**
   * Delete a task (hard delete)
   * @param id - Task ID
   * @returns Deleted task
   */
  async delete(id: string) {
    try {
      this.validateId(id, 'Task ID');

      // Check if task has subtasks
      const subtasks = await this.prisma.task.findMany({
        where: { parentTaskId: id },
      });

      if (subtasks.length > 0) {
        throw new Error(
          'Cannot delete task with subtasks. Archive it instead.'
        );
      }

      return await this.prisma.task.delete({
        where: { id },
      });
    } catch (error) {
      this.handleError(error, 'delete');
    }
  }

  /**
   * Get the full task hierarchy (parent and all subtasks)
   * @param taskId - Task ID
   * @returns Object with parent and subtask chain
   */
  async getTaskHierarchy(taskId: string) {
    try {
      this.validateId(taskId, 'Task ID');

      const task = await this.getById(taskId);

      if (!task) {
        throw new Error('Task not found');
      }

      // Get parent chain
      const parentChain = [];
      let currentParentId = task.parentTaskId;

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

        parentChain.unshift(parent);
        currentParentId = parent.parentTaskId;
      }

      // Get all subtasks recursively
      const getAllSubtasks = async (
        parentId: string
      ): Promise<TaskHierarchyNode[]> => {
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

        const subtasksWithChildren = await Promise.all(
          subtasks.map(async subtask => ({
            ...subtask,
            subtasks: await getAllSubtasks(subtask.id),
          }))
        );

        return subtasksWithChildren;
      };

      const subtaskTree = await getAllSubtasks(taskId);

      return {
        parentChain: parentChain.map(parent => ({
          ...parent,
          priority: parent.priority, // Map priority to priorityBucket for frontend consistency
        })),
        currentTask: {
          ...task,
          priority: task.priority, // Map priority to priority for frontend consistency
        },
        subtaskTree: subtaskTree.map(subtask => ({
          ...subtask,
          priority: subtask.priority, // Map priority to priorityBucket for frontend consistency
        })),
      };
    } catch (error) {
      this.handleError(error, 'getTaskHierarchy');
    }
  }

  /**
   * Create a calendar event for a task
   * @param taskId - Task ID
   * @param userId - User ID
   * @param title - Event title
   * @param eventDate - Event date
   * @returns Created calendar event
   */
  async createCalendarEvent(
    taskId: string,
    userId: string,
    title: string,
    eventDate: Date
  ) {
    try {
      this.validateId(taskId, 'Task ID');
      this.validateId(userId, 'User ID');

      const task = await this.prisma.task.findUnique({
        where: { id: taskId },
      });

      if (!task) {
        throw new Error('Task not found');
      }

      return await this.prisma.calendarEvent.create({
        data: {
          taskId,
          userId,
          title,
          eventDate,
        },
        include: {
          task: {
            select: {
              id: true,
              title: true,
            },
          },
        },
      });
    } catch (error) {
      this.handleError(error, 'createCalendarEvent');
    }
  }

  /**
   * Get calendar events for a task
   * @param taskId - Task ID
   * @returns Array of calendar events
   */
  async getCalendarEvents(taskId: string) {
    try {
      this.validateId(taskId, 'Task ID');

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
    } catch (error) {
      this.handleError(error, 'getCalendarEvents');
    }
  }

  /**
   * Add a tag to a task
   * @param taskId - Task ID
   * @param tagId - Tag ID
   * @returns Created task tag relationship
   */
  async addTag(taskId: string, tagId: string) {
    try {
      this.validateId(taskId, 'Task ID');
      this.validateId(tagId, 'Tag ID');

      const task = await this.prisma.task.findUnique({
        where: { id: taskId },
      });

      if (!task) {
        throw new Error('Task not found');
      }

      const tag = await this.prisma.tag.findUnique({
        where: { id: tagId },
      });

      if (!tag) {
        throw new Error('Tag not found');
      }

      const existing = await this.prisma.taskTag.findUnique({
        where: {
          taskId_tagId: {
            taskId,
            tagId,
          },
        },
      });

      if (existing) {
        throw new Error('Task already has this tag');
      }

      return await this.prisma.taskTag.create({
        data: {
          taskId,
          tagId,
        },
        include: {
          tag: true,
        },
      });
    } catch (error) {
      this.handleError(error, 'addTag');
    }
  }

  /**
   * Remove a tag from a task
   * @param taskId - Task ID
   * @param tagId - Tag ID
   * @returns Deleted task tag relationship
   */
  async removeTag(taskId: string, tagId: string) {
    try {
      this.validateId(taskId, 'Task ID');
      this.validateId(tagId, 'Tag ID');

      return await this.prisma.taskTag.delete({
        where: {
          taskId_tagId: {
            taskId,
            tagId,
          },
        },
      });
    } catch (error) {
      this.handleError(error, 'removeTag');
    }
  }

  /**
   * Get subordinate departments (only one level down)
   * @param departmentId - Root department ID
   * @returns Array of department IDs (including the root and direct children only)
   */
  public async getSubordinateDepartments(
    departmentId: string
  ): Promise<string[]> {
    const departmentIds: string[] = [departmentId];
    const children = await this.prisma.department.findMany({
      where: { parentId: departmentId, isActive: true },
      select: { id: true },
    });

    for (const child of children) {
      const subordinateIds = await this.getSubordinateDepartments(child.id);
      departmentIds.push(...subordinateIds);
    }

    return departmentIds;
  }

  /**
   * Calculate metrics from tasks
   * @param tasks - Array of tasks with status
   * @returns Dashboard metrics
   */
  private calculateMetrics(
    tasks: Array<{ status: TaskStatus }>
  ): DashboardMetrics {
    const metrics: DashboardMetrics = {
      toDo: 0,
      inProgress: 0,
      completed: 0,
      blocked: 0,
    };

    for (const task of tasks) {
      switch (task.status) {
        case 'TO_DO':
          metrics.toDo++;
          break;
        case 'IN_PROGRESS':
          metrics.inProgress++;
          break;
        case 'COMPLETED':
          metrics.completed++;
          break;
        case 'BLOCKED':
          metrics.blocked++;
          break;
      }
    }

    return metrics;
  }

  /**
   * Get manager dashboard data
   * Returns tasks from the manager's department and all subordinate departments
   * Filters out tasks owned by peer managers in the same department
   *
   * Access Rules:
   * 1. Manager can see their OWN tasks
   * 2. Manager can see tasks owned by STAFF in their department (not other managers)
   * 3. Manager can see tasks owned by ANY user in subordinate departments
   * 4. Manager can see tasks assigned to users in their hierarchy
   *
   * @param managerId - Manager's user ID
   * @returns Dashboard data with tasks and metrics
   */
  async getManagerDashboardTasks(managerId: string): Promise<DashboardData> {
    try {
      this.validateId(managerId, 'Manager ID');

      // Get manager's user profile
      const manager = await this.prisma.userProfile.findUnique({
        where: { id: managerId, isActive: true },
        select: {
          departmentId: true,
          role: true,
        },
      });

      if (!manager) {
        throw new Error('Manager not found or inactive');
      }

      // Get all subordinate departments (including manager's own department)
      const departmentIds = await this.getSubordinateDepartments(
        manager.departmentId
      );

      const tasks = await this.prisma.task.findMany({
        where: {
          isArchived: false,
          OR: [
            {
              departmentId: {
                in: departmentIds,
              },
            },
            {
              assignments: {
                some: {
                  user: {
                    departmentId: {
                      in: departmentIds,
                    },
                    isActive: true,
                  },
                },
              },
            },
          ],
        },
        select: {
          id: true,
          title: true,
          description: true,
          priority: true,
          dueDate: true,
          status: true,
          ownerId: true,
          departmentId: true,
          assignments: {
            select: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                },
              },
            },
          },
          department: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: {
          dueDate: 'asc',
        },
      });

      // Add canEdit field - all tasks are editable by managers (backward compatibility)
      const tasksWithCanEdit = tasks.map(task => ({
        ...task,
        canEdit: true,
      }));

      // Calculate metrics
      const metrics = this.calculateMetrics(tasks);

      return {
        tasks: tasksWithCanEdit,
        metrics,
      };
    } catch (error) {
      this.handleError(error, 'getManagerDashboardTasks');
      throw error; // This will never be reached, but satisfies TypeScript
    }
  }

  /**
   * Get department tasks for any user (Staff or Manager)
   * Returns tasks with canEdit field calculated based on user role and assignment
   * Matches structure of getUserTasks with full task details including subtasks
   *
   * @param userId - User's ID
   * @returns Array of tasks with canEdit field
   */
  async getDepartmentTasksForUser(userId: string) {
    try {
      this.validateId(userId, 'User ID');

      // Get user's profile
      const user = await this.prisma.userProfile.findUnique({
        where: { id: userId, isActive: true },
        select: {
          id: true,
          departmentId: true,
          role: true,
        },
      });

      if (!user) {
        throw new Error('User not found or inactive');
      }

      // Get all subordinate departments (including user's own department)
      const departmentIds = await this.getSubordinateDepartments(
        user.departmentId
      );

      // Fetch all parent tasks (no parentTaskId) in the department hierarchy
      // Department Dashboard shows ALL tasks in hierarchy for ALL users (STAFF + MANAGER)
      // Edit permissions are controlled by canEdit field based on assignment/role
      const parentTasks = await this.prisma.task.findMany({
        where: {
          isArchived: false,
          parentTaskId: null, // Only parent tasks
          OR: [
            {
              departmentId: {
                in: departmentIds,
              },
            },
            {
              assignments: {
                some: {
                  user: {
                    departmentId: {
                      in: departmentIds,
                    },
                    isActive: true,
                  },
                },
              },
            },
          ],
        },
        include: {
          assignments: {
            select: {
              userId: true,
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                },
              },
            },
          },
          department: {
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
          owner: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          // Fetch subtasks with full details
          subtasks: {
            where: {
              isArchived: false,
            },
            include: {
              assignments: {
                select: {
                  userId: true,
                  user: {
                    select: {
                      id: true,
                      name: true,
                      email: true,
                    },
                  },
                },
              },
              department: {
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
              owner: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                },
              },
            },
          },
        },
        orderBy: {
          dueDate: 'asc',
        },
      });

      // Use AuthorizationService to calculate canEdit for each task and subtask
      const authService = new AuthorizationService();

      const tasksWithCanEdit = parentTasks.map(task => {
        const taskCanEdit = authService.canEditTask(
          {
            departmentId: task.departmentId,
            assignments: task.assignments.map(a => ({ userId: a.userId })),
          },
          {
            userId: user.id,
            role: user.role as 'STAFF' | 'MANAGER' | 'HR_ADMIN',
            departmentId: user.departmentId,
          },
          departmentIds
        );

        // Calculate canEdit for subtasks
        const subtasksWithCanEdit = task.subtasks?.map(subtask => {
          const subtaskCanEdit = authService.canEditTask(
            {
              departmentId: subtask.departmentId,
              assignments: subtask.assignments.map(a => ({ userId: a.userId })),
            },
            {
              userId: user.id,
              role: user.role as 'STAFF' | 'MANAGER' | 'HR_ADMIN',
              departmentId: user.departmentId,
            },
            departmentIds
          );

          return {
            ...subtask,
            tags: subtask.tags.map(t => t.tag.name),
            comments: subtask.comments.map(c => ({
              id: c.id,
              content: c.content,
              authorId: c.userId,
              createdAt: c.createdAt,
              updatedAt: c.updatedAt,
            })),
            owner: subtask.owner || {
              id: subtask.ownerId,
              name: null,
              email: null,
            },
            priorityBucket: subtask.priority, // Map priority to priorityBucket for frontend
            isRecurring: subtask.recurringInterval !== null,
            startDate: subtask.startDate,
            canEdit: subtaskCanEdit,
          };
        });

        return {
          ...task,
          tags: task.tags.map(t => t.tag.name),
          comments: task.comments.map(c => ({
            id: c.id,
            content: c.content,
            authorId: c.userId,
            createdAt: c.createdAt,
            updatedAt: c.updatedAt,
          })),
          owner: task.owner || {
            id: task.ownerId,
            name: null,
            email: null,
          },
          priorityBucket: task.priority, // Map priority to priorityBucket for frontend
          isRecurring: task.recurringInterval !== null,
          startDate: task.startDate,
          canEdit: taskCanEdit,
          subtasks: subtasksWithCanEdit,
        };
      });

      return tasksWithCanEdit;
    } catch (error) {
      this.handleError(error, 'getDepartmentTasksForUser');
      throw error;
    }
  }
}
