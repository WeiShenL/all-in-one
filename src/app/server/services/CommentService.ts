import { BaseService } from './BaseService';
import { CreateCommentInput, UpdateCommentInput } from '../types';

/**
 * CommentService
 *
 * Handles all business logic related to comments including:
 * - Comment CRUD operations
 * - Task comment management
 */
export class CommentService extends BaseService {
  /**
   * Get all comments for a task
   * @param taskId - Task ID
   * @returns Array of comments
   */
  async getByTask(taskId: string) {
    try {
      this.validateId(taskId, 'Task ID');

      return await this.prisma.comment.findMany({
        where: { taskId },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });
    } catch (error) {
      this.handleError(error, 'getByTask');
    }
  }

  /**
   * Get comment by ID
   * @param id - Comment ID
   * @returns Comment or null
   */
  async getById(id: string) {
    try {
      this.validateId(id, 'Comment ID');

      return await this.prisma.comment.findUnique({
        where: { id },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          task: {
            select: {
              id: true,
              title: true,
            },
          },
        },
      });
    } catch (error) {
      this.handleError(error, 'getById');
    }
  }

  /**
   * Create a new comment
   * @param data - Comment creation data
   * @returns Created comment
   */
  async create(data: CreateCommentInput) {
    try {
      // Validate task exists
      const task = await this.prisma.task.findUnique({
        where: { id: data.taskId },
        include: {
          assignments: {
            include: {
              user: true,
            },
          },
        },
      });

      if (!task) {
        throw new Error('Task not found');
      }

      // Validate user exists
      const user = await this.prisma.userProfile.findUnique({
        where: { id: data.userId },
      });

      if (!user || !user.isActive) {
        throw new Error('User not found or inactive');
      }

      if (!data.content || data.content.trim() === '') {
        throw new Error('Comment content cannot be empty');
      }

      const newComment = await this.prisma.comment.create({
        data: {
          content: data.content,
          taskId: data.taskId,
          userId: data.userId,
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      });

      // TODO [NSY003 - NEXT USER STORY]: Add comment notification logic here
      // When implementing comment notifications

      return newComment;
    } catch (error) {
      this.handleError(error, 'create');
    }
  }

  /**
   * Update a comment
   * @param id - Comment ID
   * @param data - Comment update data
   * @returns Updated comment
   */
  async update(id: string, data: UpdateCommentInput) {
    try {
      this.validateId(id, 'Comment ID');

      // Check comment exists
      const existing = await this.prisma.comment.findUnique({
        where: { id },
      });

      if (!existing) {
        throw new Error('Comment not found');
      }

      if (!data.content || data.content.trim() === '') {
        throw new Error('Comment content cannot be empty');
      }

      return await this.prisma.comment.update({
        where: { id },
        data: { content: data.content },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      });
    } catch (error) {
      this.handleError(error, 'update');
    }
  }

  /**
   * Delete a comment
   * @param id - Comment ID
   * @returns Deleted comment
   */
  async delete(id: string) {
    try {
      this.validateId(id, 'Comment ID');

      return await this.prisma.comment.delete({
        where: { id },
      });
    } catch (error) {
      this.handleError(error, 'delete');
    }
  }

  /**
   * Get all comments by a user
   * @param userId - User ID
   * @returns Array of comments
   */
  async getByUser(userId: string) {
    try {
      this.validateId(userId, 'User ID');

      return await this.prisma.comment.findMany({
        where: { userId },
        include: {
          task: {
            select: {
              id: true,
              title: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });
    } catch (error) {
      this.handleError(error, 'getByUser');
    }
  }
}
