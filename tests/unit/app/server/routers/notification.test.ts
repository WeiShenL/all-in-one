/**
 * Unit Tests for Notification Router
 * Tests tRPC endpoints for notification broadcasting and retrieval
 */

import { createClient } from '@supabase/supabase-js';
import { notificationRouter } from '@/app/server/routers/notification';
import type { PrismaClient } from '@prisma/client';

// Mock Supabase
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(),
}));

const mockCreateClient = createClient as jest.MockedFunction<
  typeof createClient
>;

describe('Notification Router', () => {
  let mockPrisma: jest.Mocked<PrismaClient>;
  let mockChannel: any;
  let mockSupabase: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock Prisma client
    mockPrisma = {
      notification: {
        findMany: jest.fn(),
        updateMany: jest.fn(),
        count: jest.fn(),
      },
    } as any;

    // Mock Supabase channel
    mockChannel = {
      subscribe: jest.fn().mockResolvedValue(undefined),
      send: jest.fn().mockResolvedValue('ok'),
      unsubscribe: jest.fn().mockResolvedValue(undefined),
    };

    // Mock Supabase client
    mockSupabase = {
      channel: jest.fn().mockReturnValue(mockChannel),
      removeChannel: jest.fn().mockResolvedValue(undefined),
    };

    mockCreateClient.mockReturnValue(mockSupabase as any);

    // Set required environment variables
    process.env.NEXT_PUBLIC_API_EXTERNAL_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';
  });

  afterEach(() => {
    delete process.env.NEXT_PUBLIC_API_EXTERNAL_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  });

  describe('getSupabaseAdmin', () => {
    it('should throw error when NEXT_PUBLIC_API_EXTERNAL_URL is missing', async () => {
      delete process.env.NEXT_PUBLIC_API_EXTERNAL_URL;

      const caller = notificationRouter.createCaller({
        prisma: mockPrisma,
        userId: undefined,
      });

      await expect(
        caller.broadcast({
          type: 'info',
          title: 'Test',
          message: 'Test message',
        })
      ).rejects.toThrow('Missing Supabase environment variables');
    });

    it('should throw error when SUPABASE_SERVICE_ROLE_KEY is missing', async () => {
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;

      const caller = notificationRouter.createCaller({
        prisma: mockPrisma,
        userId: undefined,
      });

      await expect(
        caller.broadcast({
          type: 'info',
          title: 'Test',
          message: 'Test message',
        })
      ).rejects.toThrow('Missing Supabase environment variables');
    });

    it('should create Supabase client with correct config', async () => {
      const caller = notificationRouter.createCaller({
        prisma: mockPrisma,
        userId: undefined,
      });

      await caller.broadcast({
        type: 'info',
        title: 'Test',
        message: 'Test message',
      });

      expect(mockCreateClient).toHaveBeenCalledWith(
        'https://test.supabase.co',
        'test-service-key',
        {
          auth: {
            autoRefreshToken: false,
            persistSession: false,
          },
        }
      );
    });
  });

  describe('broadcast', () => {
    it('should successfully broadcast notification', async () => {
      const caller = notificationRouter.createCaller({
        prisma: mockPrisma,
        userId: undefined,
      });

      const result = await caller.broadcast({
        type: 'info',
        title: 'Test Notification',
        message: 'This is a test',
      });

      expect(result.success).toBe(true);
      expect(result.message).toBe('Notification broadcasted successfully');
      expect(result.payload).toMatchObject({
        type: 'info',
        title: 'Test Notification',
        message: 'This is a test',
        broadcast_at: expect.any(String),
      });
    });

    it('should create channel with correct name', async () => {
      const caller = notificationRouter.createCaller({
        prisma: mockPrisma,
        userId: undefined,
      });

      await caller.broadcast({
        type: 'success',
        title: 'Success',
        message: 'Operation completed',
      });

      expect(mockSupabase.channel).toHaveBeenCalledWith('notifications');
    });

    it('should subscribe to channel before sending', async () => {
      const caller = notificationRouter.createCaller({
        prisma: mockPrisma,
        userId: undefined,
      });

      await caller.broadcast({
        type: 'warning',
        title: 'Warning',
        message: 'Please be careful',
      });

      expect(mockChannel.subscribe).toHaveBeenCalled();
    });

    it('should send broadcast with correct payload structure', async () => {
      const caller = notificationRouter.createCaller({
        prisma: mockPrisma,
        userId: undefined,
      });

      await caller.broadcast({
        type: 'error',
        title: 'Error',
        message: 'Something went wrong',
      });

      expect(mockChannel.send).toHaveBeenCalledWith({
        type: 'broadcast',
        event: 'notification',
        payload: expect.objectContaining({
          type: 'error',
          title: 'Error',
          message: 'Something went wrong',
          broadcast_at: expect.any(String),
        }),
      });
    });

    it('should cleanup channel after sending', async () => {
      const caller = notificationRouter.createCaller({
        prisma: mockPrisma,
        userId: undefined,
      });

      await caller.broadcast({
        type: 'info',
        title: 'Test',
        message: 'Cleanup test',
      });

      expect(mockSupabase.removeChannel).toHaveBeenCalledWith(mockChannel);
    });

    it('should throw error when broadcast fails', async () => {
      mockChannel.send.mockResolvedValue('error');

      const caller = notificationRouter.createCaller({
        prisma: mockPrisma,
        userId: undefined,
      });

      await expect(
        caller.broadcast({
          type: 'info',
          title: 'Test',
          message: 'Should fail',
        })
      ).rejects.toThrow('Failed to broadcast notification');
    });

    it('should validate required title', async () => {
      const caller = notificationRouter.createCaller({
        prisma: mockPrisma,
        userId: undefined,
      });

      await expect(
        caller.broadcast({
          type: 'info',
          title: '',
          message: 'Test',
        })
      ).rejects.toThrow();
    });

    it('should validate required message', async () => {
      const caller = notificationRouter.createCaller({
        prisma: mockPrisma,
        userId: undefined,
      });

      await expect(
        caller.broadcast({
          type: 'info',
          title: 'Test',
          message: '',
        })
      ).rejects.toThrow();
    });

    it('should handle all notification types', async () => {
      const caller = notificationRouter.createCaller({
        prisma: mockPrisma,
        userId: undefined,
      });

      const types = ['info', 'success', 'warning', 'error'] as const;

      for (const type of types) {
        const result = await caller.broadcast({
          type,
          title: `${type} notification`,
          message: `This is a ${type} message`,
        });

        expect(result.success).toBe(true);
        expect(result.payload.type).toBe(type);
      }
    });
  });

  describe('sendTest', () => {
    it('should send test notification successfully', async () => {
      const caller = notificationRouter.createCaller({
        prisma: mockPrisma,
        userId: undefined,
      });

      const result = await caller.sendTest();

      expect(result.success).toBe(true);
      expect(result.message).toBe('Test notification sent');
      expect(result.payload).toMatchObject({
        type: 'info',
        title: 'Test Notification',
        message: 'This is a test notification from the server',
        broadcast_at: expect.any(String),
      });
    });

    it('should handle sendTest failure', async () => {
      mockChannel.send.mockResolvedValue('error');

      const caller = notificationRouter.createCaller({
        prisma: mockPrisma,
        userId: undefined,
      });

      const result = await caller.sendTest();

      expect(result.success).toBe(false);
      expect(result.message).toBe('Failed to send test notification');
    });

    it('should subscribe and cleanup channel in sendTest', async () => {
      const caller = notificationRouter.createCaller({
        prisma: mockPrisma,
        userId: undefined,
      });

      await caller.sendTest();

      expect(mockChannel.subscribe).toHaveBeenCalled();
      expect(mockSupabase.removeChannel).toHaveBeenCalledWith(mockChannel);
    });
  });

  describe('getNotifications', () => {
    it('should fetch all notifications for user', async () => {
      const mockNotifications = [
        {
          id: '1',
          userId: 'user-123',
          type: 'TASK_ASSIGNED',
          title: 'Task assigned',
          message: 'You have been assigned a task',
          isRead: false,
          createdAt: new Date('2025-11-01'),
        },
        {
          id: '2',
          userId: 'user-123',
          type: 'TASK_COMPLETED',
          title: 'Task completed',
          message: 'Task was completed',
          isRead: true,
          createdAt: new Date('2025-11-02'),
        },
      ];

      (mockPrisma.notification.findMany as jest.Mock).mockResolvedValue(
        mockNotifications
      );

      const caller = notificationRouter.createCaller({
        prisma: mockPrisma,
        userId: undefined,
      });

      const result = await caller.getNotifications({ userId: 'user-123' });

      expect(result).toEqual(mockNotifications);
      expect(mockPrisma.notification.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-123' },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should return empty array when no notifications', async () => {
      (mockPrisma.notification.findMany as jest.Mock).mockResolvedValue([]);

      const caller = notificationRouter.createCaller({
        prisma: mockPrisma,
        userId: undefined,
      });

      const result = await caller.getNotifications({ userId: 'user-456' });

      expect(result).toEqual([]);
    });
  });

  describe('getUnreadNotifications', () => {
    it('should fetch only unread notifications', async () => {
      const mockUnreadNotifications = [
        {
          id: '1',
          userId: 'user-123',
          type: 'TASK_ASSIGNED',
          title: 'New task',
          message: 'You have a new task',
          isRead: false,
          createdAt: new Date('2025-11-06'),
        },
        {
          id: '2',
          userId: 'user-123',
          type: 'COMMENT_ADDED',
          title: 'New comment',
          message: 'Someone commented',
          isRead: false,
          createdAt: new Date('2025-11-05'),
        },
      ];

      (mockPrisma.notification.findMany as jest.Mock).mockResolvedValue(
        mockUnreadNotifications
      );

      const caller = notificationRouter.createCaller({
        prisma: mockPrisma,
        userId: undefined,
      });

      const result = await caller.getUnreadNotifications({
        userId: 'user-123',
      });

      expect(result).toEqual(mockUnreadNotifications);
      expect(mockPrisma.notification.findMany).toHaveBeenCalledWith({
        where: {
          userId: 'user-123',
          isRead: false,
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
      });
    });

    it('should limit to 10 most recent unread notifications', async () => {
      const caller = notificationRouter.createCaller({
        prisma: mockPrisma,
        userId: undefined,
      });

      await caller.getUnreadNotifications({ userId: 'user-123' });

      expect(mockPrisma.notification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 10,
        })
      );
    });
  });

  describe('markAsRead', () => {
    it('should mark notifications as read', async () => {
      (mockPrisma.notification.updateMany as jest.Mock).mockResolvedValue({
        count: 3,
      });

      const caller = notificationRouter.createCaller({
        prisma: mockPrisma,
        userId: undefined,
      });

      const result = await caller.markAsRead({
        notificationIds: ['notif-1', 'notif-2', 'notif-3'],
      });

      expect(result).toEqual({ success: true, count: 3 });
      expect(mockPrisma.notification.updateMany).toHaveBeenCalledWith({
        where: {
          id: { in: ['notif-1', 'notif-2', 'notif-3'] },
        },
        data: {
          isRead: true,
        },
      });
    });

    it('should handle empty notification array', async () => {
      const caller = notificationRouter.createCaller({
        prisma: mockPrisma,
        userId: undefined,
      });

      const result = await caller.markAsRead({ notificationIds: [] });

      expect(result).toEqual({ success: true, count: 0 });
    });

    it('should handle single notification', async () => {
      (mockPrisma.notification.updateMany as jest.Mock).mockResolvedValue({
        count: 1,
      });

      const caller = notificationRouter.createCaller({
        prisma: mockPrisma,
        userId: undefined,
      });

      const result = await caller.markAsRead({ notificationIds: ['notif-1'] });

      expect(result).toEqual({ success: true, count: 1 });
    });
  });

  describe('getUnreadCount', () => {
    it('should return count of unread notifications', async () => {
      (mockPrisma.notification.count as jest.Mock).mockResolvedValue(5);

      const caller = notificationRouter.createCaller({
        prisma: mockPrisma,
        userId: undefined,
      });

      const result = await caller.getUnreadCount({ userId: 'user-123' });

      expect(result).toEqual({ count: 5 });
      expect(mockPrisma.notification.count).toHaveBeenCalledWith({
        where: {
          userId: 'user-123',
          isRead: false,
        },
      });
    });

    it('should return zero when no unread notifications', async () => {
      (mockPrisma.notification.count as jest.Mock).mockResolvedValue(0);

      const caller = notificationRouter.createCaller({
        prisma: mockPrisma,
        userId: undefined,
      });

      const result = await caller.getUnreadCount({ userId: 'user-456' });

      expect(result).toEqual({ count: 0 });
    });

    it('should query only unread notifications', async () => {
      const caller = notificationRouter.createCaller({
        prisma: mockPrisma,
        userId: undefined,
      });

      await caller.getUnreadCount({ userId: 'user-123' });

      expect(mockPrisma.notification.count).toHaveBeenCalledWith({
        where: expect.objectContaining({
          isRead: false,
        }),
      });
    });
  });
});
