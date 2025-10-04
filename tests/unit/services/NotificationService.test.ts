import { NotificationService } from '@/app/server/services/NotificationService';
import { PrismaClient } from '@prisma/client';

// Mock Prisma Client
const mockPrisma = {
  notification: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
  },
  userProfile: {
    findUnique: jest.fn(),
  },
  task: {
    findUnique: jest.fn(),
  },
} as unknown as PrismaClient;

describe('NotificationService', () => {
  let service: NotificationService;

  beforeEach(() => {
    service = new NotificationService(mockPrisma);
    jest.clearAllMocks();
  });

  describe('CRUD Operations', () => {
    describe('Create', () => {
      it('should create a new notification', async () => {
        const input = {
          userId: 'user1',
          type: 'TASK_ASSIGNED' as const,
          title: 'New Task Assigned',
          message: 'You have been assigned to a new task',
          taskId: 'task1',
        };

        (mockPrisma.userProfile.findUnique as jest.Mock).mockResolvedValue({
          id: 'user1',
          isActive: true,
        });

        (mockPrisma.task.findUnique as jest.Mock).mockResolvedValue({
          id: 'task1',
        });

        const mockCreated = {
          id: 'notif1',
          ...input,
          isRead: false,
          createdAt: new Date(),
          task: {
            id: 'task1',
            title: 'Task',
          },
        };

        (mockPrisma.notification.create as jest.Mock).mockResolvedValue(
          mockCreated
        );

        const result = await service.create(input);

        expect(mockPrisma.notification.create).toHaveBeenCalledWith({
          data: {
            userId: input.userId,
            type: input.type,
            title: input.title,
            message: input.message,
            taskId: input.taskId,
          },
          include: expect.any(Object),
        });

        expect(result.title).toBe('New Task Assigned');
        expect(result.isRead).toBe(false);
      });

      it('should create notification without taskId', async () => {
        const input = {
          userId: 'user1',
          type: 'TASK_UPDATED' as const,
          title: 'General Notification',
          message: 'This is a general notification',
        };

        (mockPrisma.userProfile.findUnique as jest.Mock).mockResolvedValue({
          id: 'user1',
          isActive: true,
        });

        const mockCreated = {
          id: 'notif1',
          ...input,
          taskId: null,
          isRead: false,
          createdAt: new Date(),
          task: null,
        };

        (mockPrisma.notification.create as jest.Mock).mockResolvedValue(
          mockCreated
        );

        const result = await service.create(input);

        expect(result.taskId).toBeNull();
      });

      it('should throw error when user not found or inactive', async () => {
        const input = {
          userId: 'nonexistent',
          type: 'TASK_ASSIGNED' as const,
          title: 'Notification',
          message: 'Message',
        };

        (mockPrisma.userProfile.findUnique as jest.Mock).mockResolvedValue(
          null
        );

        await expect(service.create(input)).rejects.toThrow(
          'User not found or inactive'
        );
      });

      it('should throw error when task not found', async () => {
        const input = {
          userId: 'user1',
          type: 'TASK_ASSIGNED' as const,
          title: 'Notification',
          message: 'Message',
          taskId: 'nonexistent',
        };

        (mockPrisma.userProfile.findUnique as jest.Mock).mockResolvedValue({
          id: 'user1',
          isActive: true,
        });

        (mockPrisma.task.findUnique as jest.Mock).mockResolvedValue(null);

        await expect(service.create(input)).rejects.toThrow('Task not found');
      });
    });

    describe('Read', () => {
      it('should get all notifications for a user', async () => {
        const mockNotifications = [
          {
            id: 'notif1',
            userId: 'user1',
            type: 'TASK_ASSIGNED',
            title: 'Notification 1',
            message: 'Message 1',
            isRead: false,
            createdAt: new Date(),
            task: {
              id: 'task1',
              title: 'Task 1',
            },
          },
          {
            id: 'notif2',
            userId: 'user1',
            type: 'TASK_UPDATED',
            title: 'Notification 2',
            message: 'Message 2',
            isRead: true,
            createdAt: new Date(),
            task: {
              id: 'task2',
              title: 'Task 2',
            },
          },
        ];

        (mockPrisma.notification.findMany as jest.Mock).mockResolvedValue(
          mockNotifications
        );

        const result = await service.getByUser('user1');

        expect(mockPrisma.notification.findMany).toHaveBeenCalledWith({
          where: { userId: 'user1' },
          include: expect.any(Object),
          orderBy: { createdAt: 'desc' },
        });

        expect(result).toHaveLength(2);
      });

      it('should get unread notifications for a user', async () => {
        const mockUnread = [
          {
            id: 'notif1',
            userId: 'user1',
            type: 'TASK_ASSIGNED',
            title: 'Unread Notification',
            isRead: false,
            createdAt: new Date(),
            task: {
              id: 'task1',
              title: 'Task',
            },
          },
        ];

        (mockPrisma.notification.findMany as jest.Mock).mockResolvedValue(
          mockUnread
        );

        const result = await service.getUnread('user1');

        expect(mockPrisma.notification.findMany).toHaveBeenCalledWith({
          where: {
            userId: 'user1',
            isRead: false,
          },
          include: expect.any(Object),
          orderBy: { createdAt: 'desc' },
        });

        expect(result).toHaveLength(1);
        expect(result[0].isRead).toBe(false);
      });

      it('should get notification by ID', async () => {
        const mockNotification = {
          id: 'notif1',
          userId: 'user1',
          type: 'TASK_ASSIGNED',
          title: 'Notification',
          message: 'Message',
          isRead: false,
          task: {
            id: 'task1',
            title: 'Task',
          },
          user: {
            id: 'user1',
            name: 'User',
            email: 'user@example.com',
          },
        };

        (mockPrisma.notification.findUnique as jest.Mock).mockResolvedValue(
          mockNotification
        );

        const result = await service.getById('notif1');

        expect(mockPrisma.notification.findUnique).toHaveBeenCalledWith({
          where: { id: 'notif1' },
          include: expect.any(Object),
        });

        expect(result?.title).toBe('Notification');
      });

      it('should get notifications by type', async () => {
        const mockNotifications = [
          {
            id: 'notif1',
            userId: 'user1',
            type: 'TASK_ASSIGNED',
            title: 'Task Assigned',
            task: {
              id: 'task1',
              title: 'Task',
            },
          },
        ];

        (mockPrisma.notification.findMany as jest.Mock).mockResolvedValue(
          mockNotifications
        );

        const result = await service.getByType('user1', 'TASK_ASSIGNED');

        expect(mockPrisma.notification.findMany).toHaveBeenCalledWith({
          where: {
            userId: 'user1',
            type: 'TASK_ASSIGNED',
          },
          include: expect.any(Object),
          orderBy: { createdAt: 'desc' },
        });

        expect(result).toHaveLength(1);
      });
    });

    describe('Update', () => {
      it('should mark notification as read', async () => {
        const mockUpdated = {
          id: 'notif1',
          isRead: true,
        };

        (mockPrisma.notification.update as jest.Mock).mockResolvedValue(
          mockUpdated
        );

        const result = await service.markAsRead('notif1');

        expect(mockPrisma.notification.update).toHaveBeenCalledWith({
          where: { id: 'notif1' },
          data: { isRead: true },
        });

        expect(result.isRead).toBe(true);
      });

      it('should mark all notifications as read for a user', async () => {
        const mockResult = {
          count: 5,
        };

        (mockPrisma.notification.updateMany as jest.Mock).mockResolvedValue(
          mockResult
        );

        const result = await service.markAllAsRead('user1');

        expect(mockPrisma.notification.updateMany).toHaveBeenCalledWith({
          where: {
            userId: 'user1',
            isRead: false,
          },
          data: { isRead: true },
        });

        expect(result.count).toBe(5);
      });
    });

    describe('Delete', () => {
      it('should delete a notification', async () => {
        const mockDeleted = {
          id: 'notif1',
          userId: 'user1',
        };

        (mockPrisma.notification.delete as jest.Mock).mockResolvedValue(
          mockDeleted
        );

        const result = await service.delete('notif1');

        expect(mockPrisma.notification.delete).toHaveBeenCalledWith({
          where: { id: 'notif1' },
        });

        expect(result.id).toBe('notif1');
      });

      it('should delete all read notifications for a user', async () => {
        const mockResult = {
          count: 3,
        };

        (mockPrisma.notification.deleteMany as jest.Mock).mockResolvedValue(
          mockResult
        );

        const result = await service.deleteAllRead('user1');

        expect(mockPrisma.notification.deleteMany).toHaveBeenCalledWith({
          where: {
            userId: 'user1',
            isRead: true,
          },
        });

        expect(result.count).toBe(3);
      });
    });
  });
});
