/**
 * Unit Tests for RealtimeService
 * Tests real-time notification broadcasting with mocked Supabase
 */

import { RealtimeService } from '../../../src/app/server/services/RealtimeService';
import type { RealtimeNotification } from '../../../src/types/notification';
import { NotificationType } from '@prisma/client';

// Mock Supabase
const mockSend = jest.fn();
const mockSubscribe = jest.fn();
const mockRemoveChannel = jest.fn();

const mockChannel = {
  send: mockSend,
  subscribe: mockSubscribe,
};

const mockSupabaseClient = {
  channel: jest.fn(() => mockChannel),
  removeChannel: mockRemoveChannel,
};

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => mockSupabaseClient),
}));

// Set up environment variables
process.env.NEXT_PUBLIC_API_EXTERNAL_URL = 'https://test.supabase.co';
process.env.NEXT_PUBLIC_ANON_KEY = 'test-anon-key';

describe('RealtimeService', () => {
  let service: RealtimeService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new RealtimeService();
  });

  describe('constructor', () => {
    it('should initialize successfully with environment variables', () => {
      expect(service).toBeInstanceOf(RealtimeService);
    });

    it('should throw error when NEXT_PUBLIC_API_EXTERNAL_URL is missing', () => {
      const originalUrl = process.env.NEXT_PUBLIC_API_EXTERNAL_URL;
      delete process.env.NEXT_PUBLIC_API_EXTERNAL_URL;

      expect(() => new RealtimeService()).toThrow(
        'Supabase URL and/or Anon Key are not defined in environment variables'
      );

      process.env.NEXT_PUBLIC_API_EXTERNAL_URL = originalUrl;
    });

    it('should throw error when NEXT_PUBLIC_ANON_KEY is missing', () => {
      const originalKey = process.env.NEXT_PUBLIC_ANON_KEY;
      delete process.env.NEXT_PUBLIC_ANON_KEY;

      expect(() => new RealtimeService()).toThrow(
        'Supabase URL and/or Anon Key are not defined in environment variables'
      );

      process.env.NEXT_PUBLIC_ANON_KEY = originalKey;
    });
  });

  describe('sendNotification', () => {
    it('should successfully send notification to user channel', async () => {
      const userId = 'user-123';
      const notification: RealtimeNotification = {
        type: NotificationType.TASK_ASSIGNED,
        title: 'Test Notification',
        message: 'This is a test message',
        userId: userId,
        broadcast_at: new Date().toISOString(),
      };

      // Mock successful subscription
      mockSubscribe.mockImplementation((callback: any) => {
        setTimeout(() => callback('SUBSCRIBED'), 0);
        return mockChannel;
      });

      // Mock successful send
      mockSend.mockResolvedValue('ok');

      await service.sendNotification(userId, notification);

      // Verify channel was created with correct name
      expect(mockSupabaseClient.channel).toHaveBeenCalledWith(
        `notifications:${userId}`,
        {
          config: {
            broadcast: {
              self: true,
            },
          },
        }
      );

      // Verify subscription was established
      expect(mockSubscribe).toHaveBeenCalled();

      // Verify notification was sent
      expect(mockSend).toHaveBeenCalledWith({
        type: 'broadcast',
        event: 'notification',
        payload: expect.objectContaining({
          type: NotificationType.TASK_ASSIGNED,
          title: 'Test Notification',
          message: 'This is a test message',
          broadcast_at: expect.any(String),
        }),
      });

      // Verify channel was cleaned up
      expect(mockRemoveChannel).toHaveBeenCalledWith(mockChannel);
    });

    it('should handle subscription error', async () => {
      const userId = 'user-123';
      const notification: RealtimeNotification = {
        type: NotificationType.TASK_UPDATED,
        title: 'Test',
        message: 'Test message',
        userId: userId,
        broadcast_at: new Date().toISOString(),
      };

      // Mock subscription failure
      mockSubscribe.mockImplementation((callback: any) => {
        setTimeout(() => callback('CHANNEL_ERROR'), 0);
        return mockChannel;
      });

      await expect(
        service.sendNotification(userId, notification)
      ).rejects.toThrow('Failed to subscribe to realtime channel');
    });

    it('should handle subscription timeout', async () => {
      const userId = 'user-123';
      const notification: RealtimeNotification = {
        type: NotificationType.TASK_ASSIGNED,
        title: 'Test',
        message: 'Test message',
        userId: userId,
        broadcast_at: new Date().toISOString(),
      };

      // Mock subscription timeout
      mockSubscribe.mockImplementation((callback: any) => {
        setTimeout(() => callback('TIMED_OUT'), 0);
        return mockChannel;
      });

      await expect(
        service.sendNotification(userId, notification)
      ).rejects.toThrow('Channel subscription timed out');
    });

    it('should handle send failure with non-ok response', async () => {
      const userId = 'user-123';
      const notification: RealtimeNotification = {
        type: NotificationType.TASK_ASSIGNED,
        title: 'Test',
        message: 'Test message',
        userId: userId,
        broadcast_at: new Date().toISOString(),
      };

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      mockSubscribe.mockImplementation((callback: any) => {
        setTimeout(() => callback('SUBSCRIBED'), 0);
        return mockChannel;
      });

      mockSend.mockResolvedValue('error');

      await service.sendNotification(userId, notification);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to send realtime notification'),
        'error'
      );

      consoleErrorSpy.mockRestore();
    });

    it('should include broadcast timestamp in payload', async () => {
      const userId = 'user-123';
      const notification: RealtimeNotification = {
        type: NotificationType.TASK_ASSIGNED,
        title: 'Test',
        message: 'Test message',
        userId: userId,
        broadcast_at: new Date().toISOString(),
      };

      mockSubscribe.mockImplementation((callback: any) => {
        setTimeout(() => callback('SUBSCRIBED'), 0);
        return mockChannel;
      });

      mockSend.mockResolvedValue('ok');

      await service.sendNotification(userId, notification);

      expect(mockSend).toHaveBeenCalledWith({
        type: 'broadcast',
        event: 'notification',
        payload: expect.objectContaining({
          broadcast_at: expect.any(String),
        }),
      });
    });

    it('should handle different notification types', async () => {
      const userId = 'user-123';
      const notificationTypes = [
        NotificationType.TASK_ASSIGNED,
        NotificationType.TASK_UPDATED,
        NotificationType.TASK_OVERDUE,
        NotificationType.COMMENT_ADDED,
        NotificationType.PROJECT_COLLABORATION_ADDED,
      ];

      mockSubscribe.mockImplementation((callback: any) => {
        setTimeout(() => callback('SUBSCRIBED'), 0);
        return mockChannel;
      });

      mockSend.mockResolvedValue('ok');

      for (const type of notificationTypes) {
        const notification: RealtimeNotification = {
          type,
          title: `Test ${type}`,
          message: 'Test message',
          userId: userId,
          broadcast_at: new Date().toISOString(),
        };

        await service.sendNotification(userId, notification);

        expect(mockSend).toHaveBeenCalledWith(
          expect.objectContaining({
            payload: expect.objectContaining({
              type,
            }),
          })
        );
      }
    });

    it('should handle errors during send and rethrow', async () => {
      const userId = 'user-123';
      const notification: RealtimeNotification = {
        type: NotificationType.TASK_ASSIGNED,
        title: 'Test',
        message: 'Test message',
        userId: userId,
        broadcast_at: new Date().toISOString(),
      };

      mockSubscribe.mockImplementation((callback: any) => {
        setTimeout(() => callback('SUBSCRIBED'), 0);
        return mockChannel;
      });

      mockSend.mockRejectedValue(new Error('Network error'));

      await expect(
        service.sendNotification(userId, notification)
      ).rejects.toThrow('Network error');
    });
  });

  describe('sendTaskUpdate', () => {
    it('should send task update using notification channel', async () => {
      const userId = 'user-123';
      const update = {
        type: 'task_assigned' as const,
        taskId: 'task-456',
        userId: userId,
      };

      mockSubscribe.mockImplementation((callback: any) => {
        setTimeout(() => callback('SUBSCRIBED'), 0);
        return mockChannel;
      });

      mockSend.mockResolvedValue('ok');

      await service.sendTaskUpdate(userId, update);

      expect(mockSend).toHaveBeenCalledWith({
        type: 'broadcast',
        event: 'notification',
        payload: expect.objectContaining({
          type: NotificationType.TASK_ASSIGNED,
          title: 'Task Update',
          message: 'Task list updated',
          taskId: update.taskId,
          userId: userId,
          metadata: { taskUpdateType: 'task_assigned' },
        }),
      });
    });

    it('should handle task_updated type', async () => {
      const userId = 'user-123';
      const update = {
        type: 'task_updated' as const,
        taskId: 'task-456',
        userId: userId,
      };

      mockSubscribe.mockImplementation((callback: any) => {
        setTimeout(() => callback('SUBSCRIBED'), 0);
        return mockChannel;
      });

      mockSend.mockResolvedValue('ok');

      await service.sendTaskUpdate(userId, update);

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          payload: expect.objectContaining({
            metadata: { taskUpdateType: 'task_updated' },
          }),
        })
      );
    });

    it('should handle task_deleted type', async () => {
      const userId = 'user-123';
      const update = {
        type: 'task_deleted' as const,
        taskId: 'task-456',
        userId: userId,
      };

      mockSubscribe.mockImplementation((callback: any) => {
        setTimeout(() => callback('SUBSCRIBED'), 0);
        return mockChannel;
      });

      mockSend.mockResolvedValue('ok');

      await service.sendTaskUpdate(userId, update);

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          payload: expect.objectContaining({
            metadata: { taskUpdateType: 'task_deleted' },
          }),
        })
      );
    });

    it('should not throw when task update fails (non-critical)', async () => {
      const userId = 'user-123';
      const update = {
        type: 'task_assigned' as const,
        taskId: 'task-456',
        userId: userId,
      };

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      mockSubscribe.mockImplementation((callback: any) => {
        setTimeout(() => callback('SUBSCRIBED'), 0);
        return mockChannel;
      });

      mockSend.mockRejectedValue(new Error('Network failure'));

      // Should not throw
      await expect(
        service.sendTaskUpdate(userId, update)
      ).resolves.toBeUndefined();

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error sending realtime task update'),
        expect.any(Error)
      );

      consoleErrorSpy.mockRestore();
    });

    it('should include taskId in the notification payload', async () => {
      const userId = 'user-123';
      const taskId = 'task-789';
      const update = {
        type: 'task_assigned' as const,
        taskId,
        userId: userId,
      };

      mockSubscribe.mockImplementation((callback: any) => {
        setTimeout(() => callback('SUBSCRIBED'), 0);
        return mockChannel;
      });

      mockSend.mockResolvedValue('ok');

      await service.sendTaskUpdate(userId, update);

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          payload: expect.objectContaining({
            taskId,
          }),
        })
      );
    });
  });

  describe('channel cleanup', () => {
    it('should remove channel after successful notification', async () => {
      const userId = 'user-123';
      const notification: RealtimeNotification = {
        type: NotificationType.TASK_ASSIGNED,
        title: 'Test',
        message: 'Test message',
        userId: userId,
        broadcast_at: new Date().toISOString(),
      };

      mockSubscribe.mockImplementation((callback: any) => {
        setTimeout(() => callback('SUBSCRIBED'), 0);
        return mockChannel;
      });

      mockSend.mockResolvedValue('ok');

      await service.sendNotification(userId, notification);

      expect(mockRemoveChannel).toHaveBeenCalledWith(mockChannel);
    });

    it('should remove channel even after send failure', async () => {
      const userId = 'user-123';
      const notification: RealtimeNotification = {
        type: NotificationType.TASK_ASSIGNED,
        title: 'Test',
        message: 'Test message',
        userId: userId,
        broadcast_at: new Date().toISOString(),
      };

      mockSubscribe.mockImplementation((callback: any) => {
        setTimeout(() => callback('SUBSCRIBED'), 0);
        return mockChannel;
      });

      mockSend.mockResolvedValue('error');

      await service.sendNotification(userId, notification);

      expect(mockRemoveChannel).toHaveBeenCalledWith(mockChannel);
    });
  });
});
