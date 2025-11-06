/**
 * @jest-environment node
 *
 * Integration Tests for Notification tRPC Router
 *
 * Test Coverage:
 * - getNotifications: Fetches all notifications for a user
 * - getUnreadNotifications: Fetches only unread notifications (max 10)
 * - markAsRead: Marks notifications as read
 * - getUnreadCount: Gets count of unread notifications
 *
 * Test Pattern: tRPC Router → Prisma → Real Database
 * Uses pg client for direct database operations
 * Each test gets fresh database state with complete isolation
 */

import { Client } from 'pg';
import { PrismaClient, NotificationType } from '@prisma/client';
import { notificationRouter } from '@/app/server/routers/notification';

const prisma = new PrismaClient();
let pgClient: Client;

// Test data IDs
let testUserId1: string;
let testUserId2: string;
let testDepartmentId: string;
let testTaskId: string;
let notification1Id: string;
let notification2Id: string;
let notification3Id: string;

// Generate unique test run ID to avoid conflicts
const testNamespace = `notif-router-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

/**
 * Helper to create a tRPC caller with mocked context
 */
function createCaller(ctx: { prisma: typeof prisma }) {
  return notificationRouter.createCaller(ctx);
}

/**
 * Helper to create a notification directly in the database
 */
async function createNotification(
  userId: string,
  taskId: string,
  type: NotificationType,
  title: string,
  message: string,
  isRead: boolean = false
): Promise<string> {
  const result = await pgClient.query(
    `INSERT INTO "notification" (id, "userId", "taskId", type, title, message, "isRead", "createdAt")
     VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, NOW())
     RETURNING id`,
    [userId, taskId, type, title, message, isRead]
  );
  return result.rows[0].id;
}

/**
 * Helper to get notification by ID
 */
async function getNotificationById(notificationId: string): Promise<any> {
  const result = await pgClient.query(
    `SELECT * FROM "notification" WHERE id = $1`,
    [notificationId]
  );
  return result.rows[0];
}

/**
 * Helper to count notifications for a user
 */
async function countNotifications(
  userId: string,
  isRead?: boolean
): Promise<number> {
  let query = `SELECT COUNT(*) FROM "notification" WHERE "userId" = $1`;
  const params: any[] = [userId];

  if (isRead !== undefined) {
    query += ` AND "isRead" = $2`;
    params.push(isRead);
  }

  const result = await pgClient.query(query, params);
  return parseInt(result.rows[0].count, 10);
}

describe('Notification Router - Integration Tests', () => {
  // Setup before all tests
  beforeAll(async () => {
    // Initialize pg client
    pgClient = new Client({
      connectionString: process.env.DATABASE_URL,
      connectionTimeoutMillis: 10000,
    });
    await pgClient.connect();

    // Create test department
    const deptResult = await pgClient.query(
      `INSERT INTO "department" (id, name, "isActive", "createdAt", "updatedAt")
       VALUES (gen_random_uuid(), $1, true, NOW(), NOW())
       RETURNING id`,
      [`Notification Router Test Dept-${testNamespace}`]
    );
    testDepartmentId = deptResult.rows[0].id;

    // Create test user 1
    const user1Result = await pgClient.query(
      `INSERT INTO "user_profile" (id, email, name, role, "departmentId", "isActive", "createdAt", "updatedAt")
       VALUES (gen_random_uuid(), $1, $2, $3, $4, true, NOW(), NOW())
       RETURNING id`,
      [
        `test-user-1-${testNamespace}@example.com`,
        'Notification Router User 1',
        'STAFF',
        testDepartmentId,
      ]
    );
    testUserId1 = user1Result.rows[0].id;

    // Create test user 2
    const user2Result = await pgClient.query(
      `INSERT INTO "user_profile" (id, email, name, role, "departmentId", "isActive", "createdAt", "updatedAt")
       VALUES (gen_random_uuid(), $1, $2, $3, $4, true, NOW(), NOW())
       RETURNING id`,
      [
        `test-user-2-${testNamespace}@example.com`,
        'Notification Router User 2',
        'STAFF',
        testDepartmentId,
      ]
    );
    testUserId2 = user2Result.rows[0].id;

    // Create test task
    const taskResult = await pgClient.query(
      `INSERT INTO "task" (id, title, description, priority, "dueDate", status, "ownerId", "departmentId", "createdAt", "updatedAt")
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
       RETURNING id`,
      [
        `Notification Router Test Task-${testNamespace}`,
        'Test task for notification router integration tests',
        5,
        '2025-12-31',
        'TO_DO',
        testUserId1,
        testDepartmentId,
      ]
    );
    testTaskId = taskResult.rows[0].id;
  }, 60000);

  // Cleanup after all tests
  afterAll(async () => {
    // Delete notifications
    await pgClient.query(`DELETE FROM "notification" WHERE "taskId" = $1`, [
      testTaskId,
    ]);

    // Delete task
    await pgClient.query(`DELETE FROM "task" WHERE id = $1`, [testTaskId]);

    // Delete users
    await pgClient.query(`DELETE FROM "user_profile" WHERE id = ANY($1)`, [
      [testUserId1, testUserId2],
    ]);

    // Delete department
    await pgClient.query(`DELETE FROM "department" WHERE id = $1`, [
      testDepartmentId,
    ]);

    await pgClient.end();
    await prisma.$disconnect();
  }, 60000);

  // Clean up notifications before each test
  beforeEach(async () => {
    await pgClient.query(`DELETE FROM "notification" WHERE "taskId" = $1`, [
      testTaskId,
    ]);
  }, 60000);

  describe('getNotifications', () => {
    it('should fetch all notifications for a user ordered by createdAt DESC', async () => {
      // Create test notifications (with delays to ensure different timestamps)
      notification1Id = await createNotification(
        testUserId1,
        testTaskId,
        'TASK_ASSIGNED',
        'Task Assignment',
        'You were assigned to a task',
        false
      );

      // Small delay to ensure different timestamps
      await new Promise(resolve => setTimeout(resolve, 10));

      notification2Id = await createNotification(
        testUserId1,
        testTaskId,
        'TASK_UPDATED',
        'Task Update',
        'Task was updated',
        true
      );

      await new Promise(resolve => setTimeout(resolve, 10));

      notification3Id = await createNotification(
        testUserId1,
        testTaskId,
        'COMMENT_ADDED',
        'New Comment',
        'New comment added',
        false
      );

      // Create caller with mock context
      const caller = createCaller({ prisma });

      // Call the router
      const result = await caller.getNotifications({ userId: testUserId1 });

      // Assertions
      expect(result).toHaveLength(3);
      expect(result[0].id).toBe(notification3Id); // Most recent first
      expect(result[1].id).toBe(notification2Id);
      expect(result[2].id).toBe(notification1Id);
      expect(result[0].message).toBe('New comment added');
      expect(result[1].isRead).toBe(true);
      expect(result[2].isRead).toBe(false);
    }, 60000);

    it('should return empty array when user has no notifications', async () => {
      const caller = createCaller({ prisma });
      const result = await caller.getNotifications({ userId: testUserId2 });

      expect(result).toEqual([]);
    }, 60000);

    it('should only return notifications for the specified user', async () => {
      // Create notification for user 1
      await createNotification(
        testUserId1,
        testTaskId,
        'TASK_ASSIGNED',
        'User 1 Task',
        'User 1 notification',
        false
      );

      // Create notification for user 2
      await createNotification(
        testUserId2,
        testTaskId,
        'TASK_ASSIGNED',
        'User 2 Task',
        'User 2 notification',
        false
      );

      const caller = createCaller({ prisma });
      const result = await caller.getNotifications({ userId: testUserId1 });

      expect(result).toHaveLength(1);
      expect(result[0].userId).toBe(testUserId1);
      expect(result[0].message).toBe('User 1 notification');
    }, 60000);
  });

  describe('getUnreadNotifications', () => {
    it('should fetch only unread notifications for a user', async () => {
      // Create mix of read and unread notifications
      await createNotification(
        testUserId1,
        testTaskId,
        'TASK_ASSIGNED',
        'Task Assigned',
        'Unread notification 1',
        false
      );
      await createNotification(
        testUserId1,
        testTaskId,
        'TASK_UPDATED',
        'Task Updated',
        'Read notification',
        true
      );
      await createNotification(
        testUserId1,
        testTaskId,
        'COMMENT_ADDED',
        'Comment Added',
        'Unread notification 2',
        false
      );

      const caller = createCaller({ prisma });
      const result = await caller.getUnreadNotifications({
        userId: testUserId1,
      });

      expect(result).toHaveLength(2);
      expect(result[0].isRead).toBe(false);
      expect(result[1].isRead).toBe(false);
      expect(result[0].message).toBe('Unread notification 2'); // Most recent first
    }, 60000);

    it('should limit results to 10 most recent unread notifications', async () => {
      // Create 15 unread notifications
      for (let i = 0; i < 15; i++) {
        await createNotification(
          testUserId1,
          testTaskId,
          'TASK_ASSIGNED',
          `Task ${i}`,
          `Notification ${i}`,
          false
        );
        // Small delay to ensure different timestamps
        await new Promise(resolve => setTimeout(resolve, 5));
      }

      const caller = createCaller({ prisma });
      const result = await caller.getUnreadNotifications({
        userId: testUserId1,
      });

      expect(result).toHaveLength(10);
      expect(result[0].isRead).toBe(false);
      // Verify they're the most recent ones
      expect(result[0].message).toBe('Notification 14');
    }, 60000);

    it('should return empty array when all notifications are read', async () => {
      await createNotification(
        testUserId1,
        testTaskId,
        'TASK_ASSIGNED',
        'Read Task',
        'Read notification',
        true
      );

      const caller = createCaller({ prisma });
      const result = await caller.getUnreadNotifications({
        userId: testUserId1,
      });

      expect(result).toEqual([]);
    }, 60000);
  });

  describe('markAsRead', () => {
    it('should mark specified notifications as read', async () => {
      // Create unread notifications
      const notif1 = await createNotification(
        testUserId1,
        testTaskId,
        'TASK_ASSIGNED',
        'Notification 1 Title',
        'Notification 1',
        false
      );
      const notif2 = await createNotification(
        testUserId1,
        testTaskId,
        'TASK_UPDATED',
        'Notification 2 Title',
        'Notification 2',
        false
      );
      const notif3 = await createNotification(
        testUserId1,
        testTaskId,
        'COMMENT_ADDED',
        'Notification 3 Title',
        'Notification 3',
        false
      );

      const caller = createCaller({ prisma });
      const result = await caller.markAsRead({
        notificationIds: [notif1, notif2],
      });

      expect(result.success).toBe(true);
      expect(result.count).toBe(2);

      // Verify notifications are marked as read
      const updated1 = await getNotificationById(notif1);
      const updated2 = await getNotificationById(notif2);
      const updated3 = await getNotificationById(notif3);

      expect(updated1.isRead).toBe(true);
      expect(updated2.isRead).toBe(true);
      expect(updated3.isRead).toBe(false); // Should remain unread
    }, 60000);

    it('should handle empty array of notification IDs', async () => {
      const caller = createCaller({ prisma });
      const result = await caller.markAsRead({ notificationIds: [] });

      expect(result.success).toBe(true);
      expect(result.count).toBe(0);
    }, 60000);

    it('should not affect already read notifications', async () => {
      const notif = await createNotification(
        testUserId1,
        testTaskId,
        'TASK_ASSIGNED',
        'Read Task',
        'Already read',
        true
      );

      const caller = createCaller({ prisma });
      const result = await caller.markAsRead({ notificationIds: [notif] });

      expect(result.success).toBe(true);
      expect(result.count).toBe(1);

      const updated = await getNotificationById(notif);
      expect(updated.isRead).toBe(true);
    }, 60000);

    it('should mark multiple notifications in bulk', async () => {
      const notifIds: string[] = [];
      for (let i = 0; i < 5; i++) {
        const id = await createNotification(
          testUserId1,
          testTaskId,
          'TASK_ASSIGNED',
          `Task ${i}`,
          `Notification ${i}`,
          false
        );
        notifIds.push(id);
      }

      const caller = createCaller({ prisma });
      const result = await caller.markAsRead({ notificationIds: notifIds });

      expect(result.success).toBe(true);
      expect(result.count).toBe(5);

      // Verify all are marked as read
      const unreadCount = await countNotifications(testUserId1, false);
      expect(unreadCount).toBe(0);
    }, 60000);
  });

  describe('getUnreadCount', () => {
    it('should return correct count of unread notifications', async () => {
      // Create mix of read and unread
      await createNotification(
        testUserId1,
        testTaskId,
        'TASK_ASSIGNED',
        'Unread Task 1',
        'Unread 1',
        false
      );
      await createNotification(
        testUserId1,
        testTaskId,
        'TASK_UPDATED',
        'Read Task 1',
        'Read 1',
        true
      );
      await createNotification(
        testUserId1,
        testTaskId,
        'COMMENT_ADDED',
        'Unread Task 2',
        'Unread 2',
        false
      );
      await createNotification(
        testUserId1,
        testTaskId,
        'TASK_DELETED',
        'Read Task 2',
        'Read 2',
        true
      );
      await createNotification(
        testUserId1,
        testTaskId,
        'TASK_REASSIGNED',
        'Unread Task 3',
        'Unread 3',
        false
      );

      const caller = createCaller({ prisma });
      const result = await caller.getUnreadCount({ userId: testUserId1 });

      expect(result.count).toBe(3);
    }, 60000);

    it('should return 0 when user has no unread notifications', async () => {
      await createNotification(
        testUserId1,
        testTaskId,
        'TASK_ASSIGNED',
        'Read Task',
        'All read',
        true
      );

      const caller = createCaller({ prisma });
      const result = await caller.getUnreadCount({ userId: testUserId1 });

      expect(result.count).toBe(0);
    }, 60000);

    it('should return 0 when user has no notifications at all', async () => {
      const caller = createCaller({ prisma });
      const result = await caller.getUnreadCount({ userId: testUserId2 });

      expect(result.count).toBe(0);
    }, 60000);

    it('should update count after marking notifications as read', async () => {
      // Create 3 unread notifications
      const notif1 = await createNotification(
        testUserId1,
        testTaskId,
        'TASK_ASSIGNED',
        'Notification 1 Title',
        'Notification 1',
        false
      );
      const notif2 = await createNotification(
        testUserId1,
        testTaskId,
        'TASK_UPDATED',
        'Notification 2 Title',
        'Notification 2',
        false
      );
      await createNotification(
        testUserId1,
        testTaskId,
        'COMMENT_ADDED',
        'Notification 3 Title',
        'Notification 3',
        false
      );

      const caller = createCaller({ prisma });

      // Check initial count
      let result = await caller.getUnreadCount({ userId: testUserId1 });
      expect(result.count).toBe(3);

      // Mark 2 as read
      await caller.markAsRead({ notificationIds: [notif1, notif2] });

      // Check updated count
      result = await caller.getUnreadCount({ userId: testUserId1 });
      expect(result.count).toBe(1);
    }, 60000);
  });

  describe('Edge Cases', () => {
    it('should handle notifications with null taskId', async () => {
      // Create notification without taskId (system notification)
      const result = await pgClient.query(
        `INSERT INTO "notification" (id, "userId", type, title, message, "isRead", "createdAt")
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, NOW())
         RETURNING id`,
        [
          testUserId1,
          'TASK_ASSIGNED',
          'System Notification',
          'System notification',
          false,
        ]
      );
      const systemNotifId = result.rows[0].id;

      const caller = createCaller({ prisma });
      const notifications = await caller.getNotifications({
        userId: testUserId1,
      });

      expect(notifications).toHaveLength(1);
      expect(notifications[0].id).toBe(systemNotifId);
      expect(notifications[0].taskId).toBeNull();
    }, 60000);

    it('should handle concurrent mark as read operations', async () => {
      const notif = await createNotification(
        testUserId1,
        testTaskId,
        'TASK_ASSIGNED',
        'Concurrent Test',
        'Concurrent test',
        false
      );

      const caller = createCaller({ prisma });

      // Mark as read twice concurrently
      const [result1, result2] = await Promise.all([
        caller.markAsRead({ notificationIds: [notif] }),
        caller.markAsRead({ notificationIds: [notif] }),
      ]);

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);

      const updated = await getNotificationById(notif);
      expect(updated.isRead).toBe(true);
    }, 60000);
  });
});
