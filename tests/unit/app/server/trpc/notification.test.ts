/**
 * Unit Tests for Notification tRPC Router (simple wrapper)
 *
 * This router is a thin wrapper around Prisma calls.
 * The actual notification functionality is tested in integration tests.
 */

import type { User } from '@supabase/supabase-js';
import { PrismaClient, NotificationType } from '@prisma/client';

// Mock the prisma module BEFORE importing the router
jest.mock('@/app/lib/prisma', () => ({
  prisma: {
    notification: {
      findMany: jest.fn(),
    },
  },
}));

import { notificationRouter } from '@/app/server/trpc/routers/notification';
import { prisma } from '@/app/lib/prisma';

// Get the mocked function
const mockFindMany = prisma.notification.findMany as jest.MockedFunction<
  typeof prisma.notification.findMany
>;

// Create minimal prisma mock for context (not actually used by the router)
const mockPrisma = {} as PrismaClient;

// Mock session for protected procedures
const mockSession = {
  user: {
    id: 'test-user-id',
    email: 'test@example.com',
    app_metadata: {},
    user_metadata: {},
    aud: 'authenticated',
    created_at: new Date().toISOString(),
  } as User,
};

describe('Notification Router - Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getNotifications', () => {
    it('should fetch notifications for a user with correct query parameters', async () => {
      const mockNotifications = [
        {
          id: '1',
          userId: 'user-1',
          type: NotificationType.TASK_ASSIGNED,
          title: 'Test',
          message: 'Test notification',
          taskId: 'task-1',
          isRead: false,
          createdAt: new Date(),
        },
      ];

      mockFindMany.mockResolvedValue(mockNotifications);

      const caller = notificationRouter.createCaller({
        prisma: mockPrisma,
        session: mockSession,
      });
      const result = await caller.getNotifications({ userId: 'user-1' });

      expect(mockFindMany).toHaveBeenCalledWith({
        where: {
          userId: 'user-1',
        },
        orderBy: {
          createdAt: 'desc',
        },
      });
      expect(result).toEqual(mockNotifications);
    });

    it('should return empty array when user has no notifications', async () => {
      mockFindMany.mockResolvedValue([]);

      const caller = notificationRouter.createCaller({
        prisma: mockPrisma,
        session: mockSession,
      });
      const result = await caller.getNotifications({ userId: 'user-2' });

      expect(result).toEqual([]);
    });

    it('should order notifications by createdAt descending', async () => {
      mockFindMany.mockResolvedValue([]);

      const caller = notificationRouter.createCaller({
        prisma: mockPrisma,
        session: mockSession,
      });
      await caller.getNotifications({ userId: 'user-1' });

      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: {
            createdAt: 'desc',
          },
        })
      );
    });
  });
});
