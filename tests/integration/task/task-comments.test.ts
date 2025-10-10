/**
 * @jest-environment node
 *
 * Integration Tests for Task Comment Operations
 *
 * Tests AC 6: Assigned Staff member can add comments (and edit their own comments only - TM021)
 *
 * Test Pattern: TaskService → Domain → Prisma Repository → Real Database
 * Uses pg client for database operations
 *
 * Each test gets a fresh database with complete isolation
 */

import { Client } from 'pg';
import { TaskService, UserContext } from '@/services/task/TaskService';
import { PrismaTaskRepository } from '@/repositories/PrismaTaskRepository';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
let pgClient: Client;
let taskService: TaskService;
let testUser: UserContext;

// Test data IDs
let testDepartmentId: string;
let testUserId: string;
let testUser2Id: string;
let testProjectId: string;

// Track created tasks and comments for cleanup
const createdTaskIds: string[] = [];

/**
 * Helper to create a task with assignment for testing
 */
async function createTaskWithAssignment(taskData: {
  id: string;
  title: string;
  description?: string;
  priority?: number;
  dueDate?: Date;
  status?: 'TO_DO' | 'IN_PROGRESS' | 'COMPLETED';
  recurringInterval?: number | null;
}) {
  const taskResult = await pgClient.query(
    `INSERT INTO "task" (id, title, description, priority, "dueDate", "ownerId", "departmentId", "projectId", status, "recurringInterval", "createdAt", "updatedAt")
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
     RETURNING *`,
    [
      taskData.id,
      taskData.title,
      taskData.description || 'Test description',
      taskData.priority || 5,
      taskData.dueDate || new Date('2025-12-31'),
      testUserId,
      testDepartmentId,
      testProjectId,
      taskData.status || 'TO_DO',
      taskData.recurringInterval !== undefined
        ? taskData.recurringInterval
        : null,
    ]
  );
  const task = taskResult.rows[0];
  createdTaskIds.push(task.id);

  // Assign user to task for authorization
  await pgClient.query(
    `INSERT INTO "task_assignment" ("taskId", "userId", "assignedById", "assignedAt")
     VALUES ($1, $2, $3, NOW())`,
    [task.id, testUserId, testUserId]
  );

  return task;
}

describe('Task Comment Integration Tests', () => {
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
      ['Test Engineering Dept']
    );
    testDepartmentId = deptResult.rows[0].id;

    // Create test user (owner)
    const userResult = await pgClient.query(
      `INSERT INTO "user_profile" (id, email, name, role, "departmentId", "isActive", "createdAt", "updatedAt")
       VALUES (gen_random_uuid(), $1, $2, $3, $4, true, NOW(), NOW())
       RETURNING id`,
      [
        'task-comment-owner@test.com',
        'Task Comment Owner',
        'STAFF',
        testDepartmentId,
      ]
    );
    testUserId = userResult.rows[0].id;

    // Create second user for testing edit permissions
    const user2Result = await pgClient.query(
      `INSERT INTO "user_profile" (id, email, name, role, "departmentId", "isActive", "createdAt", "updatedAt")
       VALUES (gen_random_uuid(), $1, $2, $3, $4, true, NOW(), NOW())
       RETURNING id`,
      [
        'task-comment-user2@test.com',
        'Task Comment User 2',
        'STAFF',
        testDepartmentId,
      ]
    );
    testUser2Id = user2Result.rows[0].id;

    // Create test project
    const projectResult = await pgClient.query(
      `INSERT INTO "project" (id, name, description, priority, "departmentId", "creatorId", status, "createdAt", "updatedAt")
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, NOW(), NOW())
       RETURNING id`,
      [
        'Test Project',
        'Integration test project',
        5,
        testDepartmentId,
        testUserId,
        'ACTIVE',
      ]
    );
    testProjectId = projectResult.rows[0].id;

    // Initialize TaskService
    const repository = new PrismaTaskRepository(prisma);
    taskService = new TaskService(repository);

    // Test user context
    testUser = {
      userId: testUserId,
      role: 'STAFF',
      departmentId: testDepartmentId,
    };
  }, 60000);

  // Cleanup after each test
  afterEach(async () => {
    // Clean up tasks and related data
    if (createdTaskIds.length > 0) {
      await pgClient.query(`DELETE FROM "comment" WHERE "taskId" = ANY($1)`, [
        createdTaskIds,
      ]);
      await pgClient.query(
        `DELETE FROM "task_assignment" WHERE "taskId" = ANY($1)`,
        [createdTaskIds]
      );
      await pgClient.query(`DELETE FROM "task" WHERE id = ANY($1)`, [
        createdTaskIds,
      ]);
      createdTaskIds.length = 0;
    }
  }, 30000);

  // Cleanup after all tests
  afterAll(async () => {
    try {
      // Clean up test data
      if (testProjectId) {
        await pgClient.query(`DELETE FROM "project" WHERE id = $1`, [
          testProjectId,
        ]);
      }
      if (testUser2Id) {
        await pgClient.query(`DELETE FROM "user_profile" WHERE id = $1`, [
          testUser2Id,
        ]);
      }
      if (testUserId) {
        await pgClient.query(`DELETE FROM "user_profile" WHERE id = $1`, [
          testUserId,
        ]);
      }
      if (testDepartmentId) {
        await pgClient.query(`DELETE FROM "department" WHERE id = $1`, [
          testDepartmentId,
        ]);
      }
    } catch (error) {
      console.error('Error during cleanup:', error);
    } finally {
      if (pgClient) {
        await pgClient.end();
      }
      await prisma.$disconnect();
    }
  }, 60000);

  // ============================================
  // AC 6: Add Comments
  // ============================================
  describe('Add Comment (AC 6)', () => {
    it('should add a comment to task', async () => {
      const task = await createTaskWithAssignment({
        id: '123e4567-e89b-12d3-a456-426614174000',
        title: 'Comment Test Task',
      });

      const updatedTask = await taskService.addCommentToTask(
        task.id,
        'This is my first comment',
        testUser
      );

      const comments = updatedTask.getComments();
      const newComment = comments.find(
        c => c.content === 'This is my first comment'
      );

      expect(newComment).toBeDefined();
      expect(newComment?.content).toBe('This is my first comment');
      expect(newComment?.authorId).toBe(testUser.userId);
    }, 30000);

    it('should add multiple comments', async () => {
      const task = await createTaskWithAssignment({
        id: '123e4567-e89b-12d3-a456-426614174001',
        title: 'Comment Test Task',
      });

      await taskService.addCommentToTask(task.id, 'First comment', testUser);

      const updatedTask = await taskService.addCommentToTask(
        task.id,
        'Second comment',
        testUser
      );

      const comments = updatedTask.getComments();
      expect(comments.length).toBeGreaterThanOrEqual(2);
      expect(comments.some(c => c.content === 'First comment')).toBe(true);
      expect(comments.some(c => c.content === 'Second comment')).toBe(true);
    }, 30000);

    it('should reject unauthorized user adding comment', async () => {
      const task = await createTaskWithAssignment({
        id: '123e4567-e89b-12d3-a456-426614174003',
        title: 'Comment Test Task',
      });

      // Create unauthorized user in different department
      const hrDeptResult = await pgClient.query(
        `INSERT INTO "department" (id, name, "isActive", "createdAt", "updatedAt")
         VALUES (gen_random_uuid(), $1, true, NOW(), NOW())
         RETURNING id`,
        ['HR Dept']
      );
      const hrDeptId = hrDeptResult.rows[0].id;

      const unauthorizedUserResult = await pgClient.query(
        `INSERT INTO "user_profile" (id, email, name, role, "departmentId", "isActive", "createdAt", "updatedAt")
         VALUES (gen_random_uuid(), $1, $2, $3, $4, true, NOW(), NOW())
         RETURNING id`,
        ['unauthorized@test.com', 'Unauthorized User', 'STAFF', hrDeptId]
      );
      const unauthorizedUserId = unauthorizedUserResult.rows[0].id;

      // User not assigned to task
      const unauthorizedUser: UserContext = {
        userId: unauthorizedUserId,
        role: 'STAFF',
        departmentId: hrDeptId,
      };

      await expect(
        taskService.addCommentToTask(
          task.id,
          'Unauthorized comment',
          unauthorizedUser
        )
      ).rejects.toThrow();

      // Cleanup
      await pgClient.query(`DELETE FROM "user_profile" WHERE id = $1`, [
        unauthorizedUserId,
      ]);
      await pgClient.query(`DELETE FROM "department" WHERE id = $1`, [
        hrDeptId,
      ]);
    }, 30000);
  });

  // ============================================
  // AC 6: Edit Own Comments (TM021)
  // ============================================
  describe('Edit Own Comment (AC 6 - TM021)', () => {
    it('should edit own comment', async () => {
      const task = await createTaskWithAssignment({
        id: '123e4567-e89b-12d3-a456-426614174004',
        title: 'Comment Test Task',
      });

      await taskService.addCommentToTask(task.id, 'Original comment', testUser);

      // Refetch task to get the persisted comment ID from database
      const taskWithComment = await taskService.getTaskById(task.id, testUser);
      expect(taskWithComment).not.toBeNull();
      const commentId = taskWithComment!
        .getComments()
        .find(c => c.content === 'Original comment')?.id;

      expect(commentId).toBeDefined();

      const updatedTask = await taskService.updateComment(
        task.id,
        commentId!,
        'EDITED: Updated comment',
        testUser
      );

      const editedComment = updatedTask
        .getComments()
        .find(c => c.id === commentId);

      expect(editedComment?.content).toBe('EDITED: Updated comment');
    }, 30000);

    it("should reject editing another user's comment", async () => {
      const task = await createTaskWithAssignment({
        id: '123e4567-e89b-12d3-a456-426614174005',
        title: 'Comment Test Task',
      });

      // First user adds comment
      await taskService.addCommentToTask(task.id, 'User 1 comment', testUser);

      // Refetch task to get the persisted comment ID from database
      const taskWithComment = await taskService.getTaskById(task.id, testUser);
      expect(taskWithComment).not.toBeNull();
      const commentId = taskWithComment!
        .getComments()
        .find(c => c.content === 'User 1 comment')?.id;

      expect(commentId).toBeDefined();

      // Add second user as assignee
      await pgClient.query(
        `INSERT INTO "task_assignment" ("taskId", "userId", "assignedById", "assignedAt")
         VALUES ($1, $2, $3, NOW())`,
        [task.id, testUser2Id, testUserId]
      );

      // Second user tries to edit first user's comment
      const secondUser: UserContext = {
        userId: testUser2Id,
        role: 'STAFF',
        departmentId: testDepartmentId,
      };

      await expect(
        taskService.updateComment(
          task.id,
          commentId!,
          'Hacked comment',
          secondUser
        )
      ).rejects.toThrow();
    }, 30000);
  });

  // ============================================
  // View Comments
  // ============================================
  describe('View Comments', () => {
    it('should retrieve all comments for a task', async () => {
      const task = await createTaskWithAssignment({
        id: '123e4567-e89b-12d3-a456-426614174006',
        title: 'Comment Test Task',
      });

      await taskService.addCommentToTask(task.id, 'First comment', testUser);
      await taskService.addCommentToTask(task.id, 'Second comment', testUser);

      const retrievedTask = await taskService.getTaskById(task.id, testUser);
      expect(retrievedTask).not.toBeNull();

      const comments = retrievedTask!.getComments();
      expect(comments.length).toBeGreaterThanOrEqual(2);
      expect(comments.some(c => c.content === 'First comment')).toBe(true);
      expect(comments.some(c => c.content === 'Second comment')).toBe(true);
    }, 30000);
  });
});
