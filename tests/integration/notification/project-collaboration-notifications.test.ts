/**
 * @jest-environment node
 *
 * Integration Tests for Project Collaboration Notifications
 *
 * User Story: As a Staff member, I want to be notified by email and in-app notification
 * when I'm added as a collaborator to a project (via task assignment), so that I'm aware
 * of my new project access.
 *
 * Test Coverage (Full Stack Integration):
 * - AC 1: When user is assigned to a task in a project → becomes project collaborator
 * - AC 2: When user becomes NEW collaborator → In-app notification sent
 * - AC 3: When user becomes NEW collaborator → Email notification sent
 * - AC 4: When user is ALREADY collaborator → No duplicate notification
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
let testUserId3: string;
let testProjectId: string;

// UserContext objects
let testUser1: UserContext;

// Track created resources for cleanup
const createdTaskIds: string[] = [];
const createdUserIds: string[] = [];
const createdNotificationIds: string[] = [];

// Generate unique test run ID to avoid conflicts (parallel execution safety)
// Pattern: timestamp-based for integration tests (per TEST_CREATION_MANUAL.md)
const testRunId = Date.now();
const testNamespace = `proj-collab-notif-${testRunId}`;

/**
 * Helper to create a test task in a project
 */
async function createTestTask(
  ownerId: string,
  departmentId: string,
  projectId: string
): Promise<string> {
  const result = await pgClient.query(
    `INSERT INTO "task" (id, title, description, priority, "dueDate", status, "ownerId", "departmentId", "projectId", "createdAt", "updatedAt")
     VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
     RETURNING id`,
    [
      `Project Task-${testNamespace}`,
      'Test task for project collaboration notification tests',
      5,
      '2025-12-31',
      'TO_DO',
      ownerId,
      departmentId,
      projectId,
    ]
  );
  const taskId = result.rows[0].id;
  createdTaskIds.push(taskId);
  return taskId;
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
 * Helper to check if user is a project collaborator
 */
async function isProjectCollaborator(
  projectId: string,
  userId: string
): Promise<boolean> {
  const result = await pgClient.query(
    `SELECT COUNT(*) FROM "project_collaborator" WHERE "projectId" = $1 AND "userId" = $2`,
    [projectId, userId]
  );
  return parseInt(result.rows[0].count, 10) > 0;
}

/**
 * Helper to get notification count for a user
 */
async function getNotificationCount(
  userId: string,
  type: string
): Promise<number> {
  const result = await pgClient.query(
    `SELECT COUNT(*) FROM "notification" WHERE "userId" = $1 AND type = $2`,
    [userId, type]
  );
  return parseInt(result.rows[0].count, 10);
}

/**
 * Helper to get notifications for a user
 */
async function getNotifications(userId: string, type: string): Promise<any[]> {
  const result = await pgClient.query(
    `SELECT * FROM "notification" WHERE "userId" = $1 AND type = $2 ORDER BY "createdAt" DESC`,
    [userId, type]
  );
  // Track notification IDs for cleanup
  result.rows.forEach(row => {
    if (!createdNotificationIds.includes(row.id)) {
      createdNotificationIds.push(row.id);
    }
  });
  return result.rows;
}

/**
 * Helper to clean up notifications
 * Deletes ALL PROJECT_COLLABORATION_ADDED notifications created in this test run
 */
async function cleanupNotifications(): Promise<void> {
  // Delete all PROJECT_COLLABORATION_ADDED notifications for test users
  // We can't rely on timestamp filtering because notifications might be created
  // before testRunId depending on test execution timing
  await pgClient.query(
    `DELETE FROM "notification" WHERE type = $1 AND "userId" = ANY($2)`,
    ['PROJECT_COLLABORATION_ADDED', [testUserId1, testUserId2, testUserId3]]
  );
  createdNotificationIds.length = 0; // Clear the tracking array
}

describe('Project Collaboration Notifications - Integration Tests', () => {
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
      [`Project Collab Notif Test Dept-${testNamespace}`]
    );
    testDepartmentId = deptResult.rows[0].id;

    // Create test user 1 (staff - will be the actor)
    const user1Result = await pgClient.query(
      `INSERT INTO "user_profile" (id, email, name, role, "departmentId", "isActive", "createdAt", "updatedAt")
       VALUES (gen_random_uuid(), $1, $2, $3, $4, true, NOW(), NOW())
       RETURNING id`,
      [
        `test-user-1-${testNamespace}@example.com`,
        'Project Collab Test User 1',
        'STAFF',
        testDepartmentId,
      ]
    );
    testUserId1 = user1Result.rows[0].id;
    createdUserIds.push(testUserId1);

    // Create test user 2 (staff - will be added to project)
    const user2Result = await pgClient.query(
      `INSERT INTO "user_profile" (id, email, name, role, "departmentId", "isActive", "createdAt", "updatedAt")
       VALUES (gen_random_uuid(), $1, $2, $3, $4, true, NOW(), NOW())
       RETURNING id`,
      [
        `test-user-2-${testNamespace}@example.com`,
        'Project Collab Test User 2',
        'STAFF',
        testDepartmentId,
      ]
    );
    testUserId2 = user2Result.rows[0].id;
    createdUserIds.push(testUserId2);

    // Create test user 3 (staff - for multi-user tests)
    const user3Result = await pgClient.query(
      `INSERT INTO "user_profile" (id, email, name, role, "departmentId", "isActive", "createdAt", "updatedAt")
       VALUES (gen_random_uuid(), $1, $2, $3, $4, true, NOW(), NOW())
       RETURNING id`,
      [
        `test-user-3-${testNamespace}@example.com`,
        'Project Collab Test User 3',
        'STAFF',
        testDepartmentId,
      ]
    );
    testUserId3 = user3Result.rows[0].id;
    createdUserIds.push(testUserId3);

    // Create UserContext objects
    testUser1 = {
      userId: testUserId1,
      role: 'STAFF',
      departmentId: testDepartmentId,
    };

    // Create test project
    const projectResult = await pgClient.query(
      `INSERT INTO "project" (id, name, description, "departmentId", "creatorId", status, priority, "isArchived", "createdAt", "updatedAt")
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, false, NOW(), NOW())
       RETURNING id`,
      [
        `Test Project-${testNamespace}`,
        'Test project for collaboration notification tests',
        testDepartmentId,
        testUserId1,
        'ACTIVE',
        5,
      ]
    );
    testProjectId = projectResult.rows[0].id;
  }, 60000);

  afterAll(async () => {
    // Cleanup in reverse order of dependencies (per TEST_CREATION_MANUAL.md)
    try {
      // 1. Delete notifications (no FK dependencies)
      if (createdNotificationIds.length > 0) {
        await pgClient.query(`DELETE FROM "notification" WHERE id = ANY($1)`, [
          createdNotificationIds,
        ]);
      }

      // 2. Delete task assignments (FK to task, user)
      if (createdTaskIds.length > 0) {
        await pgClient.query(
          `DELETE FROM "task_assignment" WHERE "taskId" = ANY($1)`,
          [createdTaskIds]
        );
      }

      // 3. Delete project collaborators (FK to project, user)
      if (testProjectId) {
        await pgClient.query(
          `DELETE FROM "project_collaborator" WHERE "projectId" = $1`,
          [testProjectId]
        );
      }

      // 4. Delete tasks (FK to project, department, user)
      if (createdTaskIds.length > 0) {
        await pgClient.query(`DELETE FROM "task" WHERE id = ANY($1)`, [
          createdTaskIds,
        ]);
      }

      // 5. Delete project (FK to department, user)
      if (testProjectId) {
        await pgClient.query(`DELETE FROM "project" WHERE id = $1`, [
          testProjectId,
        ]);
      }

      // 6. Delete users (FK to department)
      if (createdUserIds.length > 0) {
        await pgClient.query(`DELETE FROM "user_profile" WHERE id = ANY($1)`, [
          createdUserIds,
        ]);
      }

      // 7. Delete department (no FK dependencies)
      if (testDepartmentId) {
        await pgClient.query(`DELETE FROM "department" WHERE id = $1`, [
          testDepartmentId,
        ]);
      }
    } catch (error) {
      console.error('Cleanup error:', error);
    } finally {
      // Always close connections (per TEST_CREATION_MANUAL.md)
      if (pgClient) {
        try {
          await pgClient.end();
        } catch (error) {
          console.error('Failed to close pgClient:', error);
        }
      }
      if (prisma) {
        try {
          await prisma.$disconnect();
        } catch (error) {
          console.error('Failed to disconnect prisma:', error);
        }
      }
    }
  }, 60000);

  afterEach(async () => {
    // Clean up test-specific data after each test for isolation
    try {
      // Delete all notifications for this test namespace
      await pgClient.query(`DELETE FROM "notification" WHERE type = $1`, [
        'PROJECT_COLLABORATION_ADDED',
      ]);

      // Delete all project collaborators for this project to ensure test isolation
      if (testProjectId) {
        await pgClient.query(
          `DELETE FROM "project_collaborator" WHERE "projectId" = $1`,
          [testProjectId]
        );
      }

      // Clear notification tracking array for next test
      createdNotificationIds.length = 0;
    } catch (error) {
      console.error('afterEach cleanup error:', error);
    }
  }, 30000);

  // ============================================
  // addAssigneeToTask - Project Collaboration Notification Tests
  // ============================================

  describe('addAssigneeToTask - Project Collaboration Notification', () => {
    test('should create PROJECT_COLLABORATION_ADDED notification when user is added to project task', async () => {
      // Arrange - Create task in project
      const taskId = await createTestTask(
        testUserId1,
        testDepartmentId,
        testProjectId
      );
      await assignUsersToTask(taskId, [testUserId1], testUserId1);

      // Act - Add User2 to task (should trigger project collaboration)
      await taskService.addAssigneeToTask(taskId, testUserId2, testUser1);

      // Assert - User2 should be project collaborator
      const isCollaborator = await isProjectCollaborator(
        testProjectId,
        testUserId2
      );
      expect(isCollaborator).toBe(true);

      // Assert - User2 should receive notification
      const notifications = await getNotifications(
        testUserId2,
        'PROJECT_COLLABORATION_ADDED'
      );

      expect(notifications).toHaveLength(1);
      expect(notifications[0]).toMatchObject({
        type: 'PROJECT_COLLABORATION_ADDED',
        title: 'Added to Project',
        isRead: false,
      });
      expect(notifications[0].message).toContain('Test Project');
      expect(notifications[0].message).toContain('collaborator');
      expect(notifications[0].taskId).toBe(taskId);
    }, 300000); // 5 minute timeout

    test('should NOT create duplicate notification when user is already a collaborator', async () => {
      // Arrange - Create task and add User2 as collaborator first
      const taskId1 = await createTestTask(
        testUserId1,
        testDepartmentId,
        testProjectId
      );
      await assignUsersToTask(taskId1, [testUserId1], testUserId1);
      await taskService.addAssigneeToTask(taskId1, testUserId2, testUser1);

      // Verify User2 is a collaborator
      const isCollaboratorBefore = await isProjectCollaborator(
        testProjectId,
        testUserId2
      );
      expect(isCollaboratorBefore).toBe(true);

      // Clear notifications from first assignment
      await cleanupNotifications();

      // Verify User2 is still a collaborator after cleanup
      const isCollaboratorAfter = await isProjectCollaborator(
        testProjectId,
        testUserId2
      );
      expect(isCollaboratorAfter).toBe(true);

      // Create second task in same project
      const taskId2 = await createTestTask(
        testUserId1,
        testDepartmentId,
        testProjectId
      );
      await assignUsersToTask(taskId2, [testUserId1], testUserId1);

      // Act - Add User2 to second task (already collaborator, should NOT notify)
      await taskService.addAssigneeToTask(taskId2, testUserId2, testUser1);

      // Assert - No new PROJECT_COLLABORATION_ADDED notification
      const notificationCount = await getNotificationCount(
        testUserId2,
        'PROJECT_COLLABORATION_ADDED'
      );
      expect(notificationCount).toBe(0);
    }, 300000); // 5 minute timeout

    test('should NOT create notification when task has no project', async () => {
      // Arrange - Create standalone task (no projectId)
      const result = await pgClient.query(
        `INSERT INTO "task" (id, title, description, priority, "dueDate", status, "ownerId", "departmentId", "createdAt", "updatedAt")
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
         RETURNING id`,
        [
          `Standalone Task-${testNamespace}`,
          'Standalone task without project',
          5,
          '2025-12-31',
          'TO_DO',
          testUserId1,
          testDepartmentId,
        ]
      );
      const standaloneTaskId = result.rows[0].id;
      createdTaskIds.push(standaloneTaskId);
      await assignUsersToTask(standaloneTaskId, [testUserId1], testUserId1);

      // Act - Add User2 to standalone task
      await taskService.addAssigneeToTask(
        standaloneTaskId,
        testUserId2,
        testUser1
      );

      // Assert - User2 should NOT be a project collaborator (no project)
      const isCollaborator = await isProjectCollaborator(
        testProjectId,
        testUserId2
      );
      expect(isCollaborator).toBe(false);

      // Assert - No notification
      const notificationCount = await getNotificationCount(
        testUserId2,
        'PROJECT_COLLABORATION_ADDED'
      );
      expect(notificationCount).toBe(0);
    }, 300000); // 5 minute timeout
  });

  // ============================================
  // createTask - Project Collaboration Notification Tests
  // ============================================

  describe('createTask - Project Collaboration Notification', () => {
    test('should create PROJECT_COLLABORATION_ADDED notification for each new collaborator', async () => {
      // Act - Create task with User2 and User3 as assignees
      const result = await taskService.createTask(
        {
          title: `Multi-Assignee Task-${testNamespace}`,
          description: 'Task with multiple assignees',
          priority: 5,
          dueDate: new Date('2025-12-31'),
          assigneeIds: [testUserId2, testUserId3],
          projectId: testProjectId,
        },
        testUser1
      );

      createdTaskIds.push(result.id);

      // Assert - Both users should be collaborators
      const isUser2Collaborator = await isProjectCollaborator(
        testProjectId,
        testUserId2
      );
      const isUser3Collaborator = await isProjectCollaborator(
        testProjectId,
        testUserId3
      );
      expect(isUser2Collaborator).toBe(true);
      expect(isUser3Collaborator).toBe(true);

      // Assert - Both users should receive notifications
      const user2Notifications = await getNotifications(
        testUserId2,
        'PROJECT_COLLABORATION_ADDED'
      );
      const user3Notifications = await getNotifications(
        testUserId3,
        'PROJECT_COLLABORATION_ADDED'
      );

      expect(user2Notifications).toHaveLength(1);
      expect(user3Notifications).toHaveLength(1);

      expect(user2Notifications[0].message).toContain('Test Project');
      expect(user3Notifications[0].message).toContain('Test Project');
    }, 300000); // 5 minute timeout

    test('should NOT create notification for creator who is already a collaborator', async () => {
      // Arrange - Make User1 a collaborator first by creating a task via TaskService
      const result1 = await taskService.createTask(
        {
          title: `First Task-${testNamespace}`,
          description: 'First task to make User1 a collaborator',
          priority: 5,
          dueDate: new Date('2025-12-31'),
          assigneeIds: [testUserId1],
          projectId: testProjectId,
        },
        testUser1
      );
      createdTaskIds.push(result1.id);

      // Clear notifications from first task creation
      await cleanupNotifications();

      // Act - Create new task with User1 as assignee (User1 is already a collaborator)
      const result2 = await taskService.createTask(
        {
          title: `Second Task-${testNamespace}`,
          description: 'Second task created by existing collaborator',
          priority: 5,
          dueDate: new Date('2025-12-31'),
          assigneeIds: [testUserId1],
          projectId: testProjectId,
        },
        testUser1
      );

      createdTaskIds.push(result2.id);

      // Assert - No new notification for User1
      const notificationCount = await getNotificationCount(
        testUserId1,
        'PROJECT_COLLABORATION_ADDED'
      );
      expect(notificationCount).toBe(0);
    }, 300000); // 5 minute timeout
  });

  // ============================================
  // Email Sending - Integration Tests
  // ============================================

  describe('Email Sending via NotificationService', () => {
    test('should trigger NotificationService.create() which sends email for project collaboration', async () => {
      // Note: Resend is mocked (see top of file) to prevent hitting rate limits
      // This test verifies the full flow: TaskService → NotificationService → Database
      // Actual email sending logic is tested in unit tests with proper mocks

      // Arrange
      const taskId = await createTestTask(
        testUserId1,
        testDepartmentId,
        testProjectId
      );
      await assignUsersToTask(taskId, [testUserId1], testUserId1);

      // Act
      await taskService.addAssigneeToTask(taskId, testUserId2, testUser1);

      // Assert - Notification created in DB (email would be sent in production)
      const notifications = await getNotifications(
        testUserId2,
        'PROJECT_COLLABORATION_ADDED'
      );

      expect(notifications.length).toBeGreaterThan(0);
      expect(notifications[0].type).toBe('PROJECT_COLLABORATION_ADDED');

      // In production, NotificationService.create() sends email to user's email
      // Here, Resend is mocked so no actual emails are sent
    }, 300000); // 5 minute timeout
  });

  // ============================================
  // Notification History
  // ============================================

  describe('Notification History and Persistence', () => {
    test('should store notification with taskId for routing to task details', async () => {
      // Arrange
      const taskId = await createTestTask(
        testUserId1,
        testDepartmentId,
        testProjectId
      );
      await assignUsersToTask(taskId, [testUserId1], testUserId1);

      // Act
      await taskService.addAssigneeToTask(taskId, testUserId2, testUser1);

      // Assert - Verify notification has taskId for routing
      const notifications = await getNotifications(
        testUserId2,
        'PROJECT_COLLABORATION_ADDED'
      );

      expect(notifications.length).toBeGreaterThan(0);
      expect(notifications[0].taskId).toBe(taskId); // For routing to task details
      expect(notifications[0].isRead).toBe(false);
      expect(notifications[0].userId).toBe(testUserId2);
    }, 300000); // 5 minute timeout
  });
});
