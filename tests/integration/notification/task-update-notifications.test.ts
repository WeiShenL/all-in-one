/**
 * @jest-environment node
 *
 * Integration Tests for Task Update Notifications
 *
 * User Story: As a Staff member, I want to be notified by email and in-app notification
 * when my assigned tasks are updated (comments and assignments), so that I am always
 * aware of progress and changes.
 *
 * Test Coverage (Full Stack Integration):
 * - AC 1: When task has update (comments OR assignments) → In-app notification sent
 * - AC 2: When task has update (comments OR assignments) → Email notification sent
 * - Notifications sent to ALL assigned users (excluding actor)
 * - Notification history (stored in database)
 *
 * Test Pattern: TaskService → NotificationService → Prisma → Real Database
 * Uses pg client for direct database operations
 * Each test gets fresh database state with complete isolation
 */

import { Client } from 'pg';
import { TaskService, UserContext } from '@/services/task/TaskService';
import { PrismaTaskRepository } from '@/repositories/PrismaTaskRepository';
import { PrismaClient } from '@prisma/client';
import { RealtimeService } from '@/app/server/services/RealtimeService';

// ============================================
// MOCK EMAILSERVICE TO PREVENT RESEND_API_KEY REQUIREMENT
// ============================================
// Integration tests verify the notification flow (TaskService → NotificationService → Database)
// Mocking EmailService prevents needing RESEND_API_KEY and avoids hitting Resend rate limits
jest.mock('@/app/server/services/EmailService', () => ({
  EmailService: jest.fn().mockImplementation(() => ({
    sendEmail: jest.fn().mockResolvedValue(undefined),
  })),
}));

// ============================================
// MOCK RESEND SDK (belt and suspenders)
// ============================================
jest.mock('resend', () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: {
      send: jest
        .fn()
        .mockResolvedValue({ data: { id: 'mock-email-id' }, error: null }),
    },
  })),
}));

// ============================================
// MOCK REALTIMESERVICE TO PREVENT SUPABASE CONNECTION
// ============================================
// Integration tests verify the notification flow, but we don't need actual Supabase realtime
// Mocking prevents channel subscription timeouts in test environment
jest.mock('@/app/server/services/RealtimeService', () => ({
  RealtimeService: jest.fn().mockImplementation(() => ({
    sendNotification: jest.fn().mockResolvedValue(undefined),
  })),
}));

const prisma = new PrismaClient();
let pgClient: Client;
let taskService: TaskService;

// Test data IDs
let testDepartmentId: string;
let testUserId1: string;
let testUserId2: string;
let testTaskId: string;

// UserContext objects
let testUser1: UserContext;

// Track created resources for cleanup
const createdUserIds: string[] = [];

// Generate unique test run ID to avoid conflicts (parallel execution safety)
const testNamespace = `notif-test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

/**
 * Helper to create a test task
 */
async function createTestTask(
  ownerId: string,
  departmentId: string
): Promise<string> {
  const result = await pgClient.query(
    `INSERT INTO "task" (id, title, description, priority, "dueDate", status, "ownerId", "departmentId", "createdAt", "updatedAt")
     VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
     RETURNING id`,
    [
      `Notification Test Task-${testNamespace}`,
      'Test task for notification integration tests',
      5,
      '2025-12-31',
      'TO_DO',
      ownerId,
      departmentId,
    ]
  );
  return result.rows[0].id;
}

/**
 * Helper to assign users to task
 */
async function assignUsersToTask(
  taskId: string,
  userIds: string[],
  assignedBy: string
): Promise<void> {
  for (const userId of userIds) {
    await pgClient.query(
      `INSERT INTO "task_assignment" ("taskId", "userId", "assignedById", "assignedAt")
       VALUES ($1, $2, $3, NOW())`,
      [taskId, userId, assignedBy]
    );
  }
}

/**
 * Helper to get notification count for a user
 */
async function getNotificationCount(
  userId: string,
  taskId: string
): Promise<number> {
  const result = await pgClient.query(
    `SELECT COUNT(*) FROM "notification" WHERE "userId" = $1 AND "taskId" = $2`,
    [userId, taskId]
  );
  return parseInt(result.rows[0].count, 10);
}

/**
 * Helper to get notifications for a user
 */
async function getNotifications(
  userId: string,
  taskId: string
): Promise<any[]> {
  const result = await pgClient.query(
    `SELECT * FROM "notification" WHERE "userId" = $1 AND "taskId" = $2 ORDER BY "createdAt" DESC`,
    [userId, taskId]
  );
  return result.rows;
}

/**
 * Helper to clean up notifications
 */
async function cleanupNotifications(taskId: string): Promise<void> {
  await pgClient.query(`DELETE FROM "notification" WHERE "taskId" = $1`, [
    taskId,
  ]);
}

/**
 * Helper to clean up comments
 */
async function cleanupComments(taskId: string): Promise<void> {
  await pgClient.query(`DELETE FROM "comment" WHERE "taskId" = $1`, [taskId]);
}

describe('Task Update Notifications - Integration Tests', () => {
  // Setup before all tests
  beforeAll(async () => {
    // Initialize pg client
    pgClient = new Client({
      connectionString: process.env.DATABASE_URL,
      connectionTimeoutMillis: 10000,
    });
    await pgClient.connect();

    // Initialize TaskService
    const repository = new PrismaTaskRepository(prisma);
    taskService = new TaskService(repository, prisma, new RealtimeService());

    // Create test department
    const deptResult = await pgClient.query(
      `INSERT INTO "department" (id, name, "isActive", "createdAt", "updatedAt")
       VALUES (gen_random_uuid(), $1, true, NOW(), NOW())
       RETURNING id`,
      [`Notification Integration Test Dept-${testNamespace}`]
    );
    testDepartmentId = deptResult.rows[0].id;

    // Create test user 1 (staff - will be the actor)
    const user1Result = await pgClient.query(
      `INSERT INTO "user_profile" (id, email, name, role, "departmentId", "isActive", "createdAt", "updatedAt")
       VALUES (gen_random_uuid(), $1, $2, $3, $4, true, NOW(), NOW())
       RETURNING id`,
      [
        `test-user-1-${testNamespace}@example.com`,
        'Integration Test User 1',
        'STAFF',
        testDepartmentId,
      ]
    );
    testUserId1 = user1Result.rows[0].id;
    createdUserIds.push(testUserId1);

    // Create test user 2 (staff - will receive notifications)
    const user2Result = await pgClient.query(
      `INSERT INTO "user_profile" (id, email, name, role, "departmentId", "isActive", "createdAt", "updatedAt")
       VALUES (gen_random_uuid(), $1, $2, $3, $4, true, NOW(), NOW())
       RETURNING id`,
      [
        `test-user-2-${testNamespace}@example.com`,
        'Integration Test User 2',
        'STAFF',
        testDepartmentId,
      ]
    );
    testUserId2 = user2Result.rows[0].id;
    createdUserIds.push(testUserId2);

    // Create UserContext objects
    testUser1 = {
      userId: testUserId1,
      role: 'STAFF',
      departmentId: testDepartmentId,
    };

    // Create test task with both users assigned
    testTaskId = await createTestTask(testUserId1, testDepartmentId);
    await assignUsersToTask(
      testTaskId,
      [testUserId1, testUserId2],
      testUserId1
    );
  }, 60000);

  afterAll(async () => {
    // Cleanup in reverse order of dependencies
    try {
      // Delete notifications
      await pgClient.query(`DELETE FROM "notification" WHERE "taskId" = $1`, [
        testTaskId,
      ]);

      // Delete comments
      await pgClient.query(`DELETE FROM "comment" WHERE "taskId" = $1`, [
        testTaskId,
      ]);

      // Delete task assignments
      await pgClient.query(
        `DELETE FROM "task_assignment" WHERE "taskId" = $1`,
        [testTaskId]
      );

      // Delete task
      await pgClient.query(`DELETE FROM "task" WHERE id = $1`, [testTaskId]);

      // Delete users
      for (const userId of createdUserIds) {
        await pgClient.query(`DELETE FROM "user_profile" WHERE id = $1`, [
          userId,
        ]);
      }

      // Delete department
      await pgClient.query(`DELETE FROM "department" WHERE id = $1`, [
        testDepartmentId,
      ]);
    } catch (error) {
      console.error('Cleanup error:', error);
    } finally {
      await pgClient.end();
      await prisma.$disconnect();
    }
  }, 60000);

  afterEach(async () => {
    // Clean up notifications and comments after each test
    await cleanupNotifications(testTaskId);
    await cleanupComments(testTaskId);
  }, 30000);

  // ============================================
  // addCommentToTask - Integration Tests
  // ============================================

  describe('addCommentToTask - Full Integration', () => {
    test('should create notification in database when comment is added', async () => {
      // Act - User1 adds comment (User2 should be notified)
      await taskService.addCommentToTask(
        testTaskId,
        'Integration test comment',
        testUser1
      );

      // Assert - Get notifications using helper
      const notifications = await getNotifications(testUserId2, testTaskId);

      expect(notifications).toHaveLength(1);
      expect(notifications[0]).toMatchObject({
        type: 'COMMENT_ADDED',
        title: 'New Comment',
        isRead: false,
      });
      expect(notifications[0].message).toContain('Integration Test User 1');
      expect(notifications[0].message).toContain('Notification Test Task');
    }, 300000); // 5 minute timeout

    test('should NOT create notification for the commenter', async () => {
      // Act
      await taskService.addCommentToTask(testTaskId, 'Test comment', testUser1);

      // Assert - Commenter should NOT be notified
      const count = await getNotificationCount(testUserId1, testTaskId);
      expect(count).toBe(0);
    }, 300000); // 5 minute timeout
  });

  // ============================================
  // updateComment - Integration Tests
  // ============================================

  describe('updateComment - Full Integration', () => {
    test('should create "Comment Edited" notification in database', async () => {
      // Arrange - Add a comment first
      await taskService.addCommentToTask(
        testTaskId,
        'Original comment',
        testUser1
      );

      // Clear notifications from comment add
      await cleanupNotifications(testTaskId);

      // Get comment ID
      const comments = await pgClient.query(
        `SELECT id FROM "comment" WHERE "taskId" = $1 ORDER BY "createdAt" DESC LIMIT 1`,
        [testTaskId]
      );
      const commentId = comments.rows[0].id;

      // Act - Update comment
      await taskService.updateComment(
        testTaskId,
        commentId,
        'Updated comment',
        testUser1
      );

      // Assert
      const notifications = await getNotifications(testUserId2, testTaskId);

      expect(notifications).toHaveLength(1);
      expect(notifications[0]).toMatchObject({
        type: 'COMMENT_ADDED', // Reuse same type
        title: 'Comment Edited',
      });
      expect(notifications[0].message).toContain('edited a comment');
    }, 300000); // 5 minute timeout
  });

  // ============================================
  // addAssigneeToTask - Integration Tests
  // ============================================

  describe('addAssigneeToTask - Full Integration', () => {
    test('should notify existing assignees when new user is added', async () => {
      // Arrange - Create a new user to add
      const newUserResult = await pgClient.query(
        `INSERT INTO "user_profile" (id, email, name, role, "departmentId", "isActive", "createdAt", "updatedAt")
         VALUES (gen_random_uuid(), $1, $2, $3, $4, true, NOW(), NOW())
         RETURNING id`,
        [
          `new-assignee-${testNamespace}@example.com`,
          'New Assignee',
          'STAFF',
          testDepartmentId,
        ]
      );
      const newUserId = newUserResult.rows[0].id;

      try {
        // Act - User1 adds newUser to task
        await taskService.addAssigneeToTask(testTaskId, newUserId, testUser1);

        // Assert - Both user2 and newUser should be notified
        const allNotifications = await pgClient.query(
          `SELECT * FROM "notification" WHERE "taskId" = $1 AND type = $2`,
          [testTaskId, 'TASK_REASSIGNED']
        );

        expect(allNotifications.rows.length).toBeGreaterThanOrEqual(2);

        const userIds = allNotifications.rows.map((n: any) => n.userId);
        expect(userIds).toContain(testUserId2); // Existing assignee notified
        expect(userIds).toContain(newUserId); // New assignee notified
        expect(userIds).not.toContain(testUserId1); // Actor NOT notified

        const notification = allNotifications.rows[0];
        expect(notification.title).toBe('New Assignment');
        expect(notification.message).toContain('New Assignee');
        expect(notification.message).toContain('added');
        expect(notification.message).toContain('to');
      } finally {
        // Cleanup
        await pgClient.query(
          `DELETE FROM "task_assignment" WHERE "taskId" = $1 AND "userId" = $2`,
          [testTaskId, newUserId]
        );
        await pgClient.query(`DELETE FROM "user_profile" WHERE id = $1`, [
          newUserId,
        ]);
      }
    }, 300000); // 5 minute timeout
  });

  // ============================================
  // removeAssigneeFromTask - Integration Tests
  // ============================================

  describe('removeAssigneeFromTask - Full Integration', () => {
    test('should notify remaining assignees when user is removed', async () => {
      // Arrange - Create a temporary user to remove
      const tempUserResult = await pgClient.query(
        `INSERT INTO "user_profile" (id, email, name, role, "departmentId", "isActive", "createdAt", "updatedAt")
         VALUES (gen_random_uuid(), $1, $2, $3, $4, true, NOW(), NOW())
         RETURNING id`,
        [
          `temp-user-${testNamespace}@example.com`,
          'Temp User',
          'STAFF',
          testDepartmentId,
        ]
      );
      const tempUserId = tempUserResult.rows[0].id;

      await pgClient.query(
        `INSERT INTO "task_assignment" ("taskId", "userId", "assignedById", "assignedAt")
         VALUES ($1, $2, $3, NOW())`,
        [testTaskId, tempUserId, testUserId1]
      );

      try {
        // Act - User1 removes tempUser (needs MANAGER role)
        await taskService.removeAssigneeFromTask(testTaskId, tempUserId, {
          ...testUser1,
          role: 'MANAGER', // Override role for this test
        });

        // Assert
        const notifications = await pgClient.query(
          `SELECT * FROM "notification" WHERE "taskId" = $1 AND type = $2 AND title = $3`,
          [testTaskId, 'TASK_REASSIGNED', 'Assignment Removed']
        );

        const userIds = notifications.rows.map((n: any) => n.userId);
        expect(userIds).toContain(testUserId2); // Remaining assignee notified
        expect(userIds).not.toContain(tempUserId); // Removed user NOT notified
        expect(userIds).not.toContain(testUserId1); // Actor NOT notified

        expect(notifications.rows[0].message).toContain('Temp User');
        expect(notifications.rows[0].message).toContain('removed');
        expect(notifications.rows[0].message).toContain('from');
      } finally {
        // Cleanup
        await pgClient.query(`DELETE FROM "user_profile" WHERE id = $1`, [
          tempUserId,
        ]);
      }
    }, 300000); // 5 minute timeout
  });

  // ============================================
  // Email Sending - Integration Tests
  // ============================================

  describe('Email Sending via NotificationService', () => {
    test('should trigger NotificationService.create() which sends email', async () => {
      // Note: Resend is mocked (see top of file) to prevent hitting rate limits
      // This test verifies the full flow: TaskService → NotificationService → Database
      // Actual email sending logic is tested in unit tests with proper mocks

      // Act
      await taskService.addCommentToTask(
        testTaskId,
        'Email trigger test',
        testUser1
      );

      // Assert - Notification created in DB (email would be sent in production)
      const notifications = await getNotifications(testUserId2, testTaskId);

      expect(notifications.length).toBeGreaterThan(0);
      expect(notifications[0].type).toBe('COMMENT_ADDED');

      // In production, NotificationService.create() sends email to TEST_EMAIL_RECIPIENT
      // Here, Resend is mocked so no actual emails are sent
    }, 300000); // 5 minute timeout
  });

  // ============================================
  // Notification History
  // ============================================

  describe('Notification History and Persistence', () => {
    test('should store notification with taskId for routing to task details', async () => {
      // Act
      await taskService.addCommentToTask(testTaskId, 'History test', testUser1);

      // Assert - Verify notification has taskId for routing
      const notifications = await getNotifications(testUserId2, testTaskId);

      expect(notifications.length).toBeGreaterThan(0);
      expect(notifications[0].taskId).toBe(testTaskId); // For routing to task details
      expect(notifications[0].isRead).toBe(false);
    }, 300000); // 5 minute timeout
  });
});
