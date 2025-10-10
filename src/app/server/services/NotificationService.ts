import { BaseService } from './BaseService';
import { CreateNotificationInput } from '../types';
import { NotificationType } from '@prisma/client';
import { EmailService } from './EmailService';

/**
 * NotificationService
 *
 * Handles all business logic related to notifications including:
 * - Notification CRUD operations
 * - User notification management
 * - Read/unread status tracking
 */
export class NotificationService extends BaseService {
  private emailService: EmailService;

  constructor(emailService: EmailService) {
    super();
    this.emailService = emailService;
  }

  /**
   * Get all notifications for a user
   * @param userId - User ID
   * @returns Array of notifications
   */
  async getByUser(userId: string) {
    try {
      this.validateId(userId, 'User ID');

      return await this.prisma.notification.findMany({
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

  /**
   * Get unread notifications for a user
   * @param userId - User ID
   * @returns Array of unread notifications
   */
  async getUnread(userId: string) {
    try {
      this.validateId(userId, 'User ID');

      return await this.prisma.notification.findMany({
        where: {
          userId,
          isRead: false,
        },
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
      this.handleError(error, 'getUnread');
    }
  }

  /**
   * Get notification by ID
   * @param id - Notification ID
   * @returns Notification or null
   */
  async getById(id: string) {
    try {
      this.validateId(id, 'Notification ID');

      return await this.prisma.notification.findUnique({
        where: { id },
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
    } catch (error) {
      this.handleError(error, 'getById');
    }
  }

  /**
   * Create a new notification
   * @param data - Notification creation data
   * @returns Created notification
   */
  async create(data: CreateNotificationInput) {
    try {
      // Validate user exists
      const user = await this.prisma.userProfile.findUnique({
        where: { id: data.userId },
        select: { email: true, name: true, isActive: true }, // Select email and name
      });

      if (!user || !user.isActive) {
        throw new Error('User not found or inactive');
      }

      // Validate task if provided
      if (data.taskId) {
        const task = await this.prisma.task.findUnique({
          where: { id: data.taskId },
        });

        if (!task) {
          throw new Error('Task not found');
        }
      }

      const newNotification = await this.prisma.notification.create({
        data: {
          userId: data.userId,
          type: data.type,
          title: data.title,
          message: data.message,
          taskId: data.taskId,
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

      // Send email notification
      if (user.email) {
        try {
          await this.emailService.sendEmail({
            to: user.email,
            subject: `New Notification: ${data.title}`,
            text: data.message,
            html: `<p>Dear ${user.name || 'User'},</p><p>${data.message}</p><p>Regards,<br>Your Application Team</p>`,
          });
        } catch (emailError) {
          console.error('Failed to send notification email:', emailError);
          // We don't re-throw the error, as the notification has been created successfully.
        }
      }

      return newNotification;
    } catch (error) {
      this.handleError(error, 'create');
    }
  }

  /**
   * Mark a notification as read
   * @param id - Notification ID
   * @returns Updated notification
   */
  async markAsRead(id: string) {
    try {
      this.validateId(id, 'Notification ID');

      return await this.prisma.notification.update({
        where: { id },
        data: { isRead: true },
      });
    } catch (error) {
      this.handleError(error, 'markAsRead');
    }
  }

  /**
   * Mark all notifications as read for a user
   * @param userId - User ID
   * @returns Count of updated notifications
   */
  async markAllAsRead(userId: string) {
    try {
      this.validateId(userId, 'User ID');

      const result = await this.prisma.notification.updateMany({
        where: {
          userId,
          isRead: false,
        },
        data: { isRead: true },
      });

      return result;
    } catch (error) {
      this.handleError(error, 'markAllAsRead');
    }
  }

  /**
   * Delete a notification
   * @param id - Notification ID
   * @returns Deleted notification
   */
  async delete(id: string) {
    try {
      this.validateId(id, 'Notification ID');

      return await this.prisma.notification.delete({
        where: { id },
      });
    } catch (error) {
      this.handleError(error, 'delete');
    }
  }

  /**
   * Delete all read notifications for a user
   * @param userId - User ID
   * @returns Count of deleted notifications
   */
  async deleteAllRead(userId: string) {
    try {
      this.validateId(userId, 'User ID');

      const result = await this.prisma.notification.deleteMany({
        where: {
          userId,
          isRead: true,
        },
      });

      return result;
    } catch (error) {
      this.handleError(error, 'deleteAllRead');
    }
  }

  /**
   * Get notifications by type
   * @param userId - User ID
   * @param type - Notification type
   * @returns Array of notifications
   */
  async getByType(userId: string, type: NotificationType) {
    try {
      this.validateId(userId, 'User ID');

      return await this.prisma.notification.findMany({
        where: {
          userId,
          type,
        },
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
      this.handleError(error, 'getByType');
    }
  }
}