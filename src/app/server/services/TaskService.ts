import { BaseService } from './BaseService';
import { CreateTaskInput, UpdateTaskInput, TaskFilters } from '../types';
import { TaskStatus, Task } from '@prisma/client';

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
        where: { userId },
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
   * Create a new task
   * @param data - Task creation data
   * @returns Created task
   */
  async create(data: CreateTaskInput) {
    try {
      // Validate owner exists
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

      // Validate parent task if provided
      if (data.parentTaskId) {
        const parentTask = await this.prisma.task.findUnique({
          where: { id: data.parentTaskId },
        });

        if (!parentTask) {
          throw new Error('Parent task not found');
        }
      }

      return await this.prisma.task.create({
        data: {
          title: data.title,
          description: data.description,
          priority: data.priority || 'MEDIUM',
          dueDate: data.dueDate,
          ownerId: data.ownerId,
          departmentId: data.departmentId,
          projectId: data.projectId,
          parentTaskId: data.parentTaskId,
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
        },
      });
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
   * Update task status
   * @param id - Task ID
   * @param status - New status
   * @returns Updated task
   */
  async updateStatus(id: string, status: TaskStatus) {
    try {
      this.validateId(id, 'Task ID');

      return await this.update(id, { status });
    } catch (error) {
      this.handleError(error, 'updateStatus');
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
      });

      if (!task) {
        throw new Error('Task not found');
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
        parentChain,
        currentTask: task,
        subtaskTree,
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
}
