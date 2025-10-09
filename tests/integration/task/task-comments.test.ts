/**
 * @jest-environment node
 *
 * Integration Tests for Task Comment Operations
 *
 * Tests AC 6: Assigned Staff member can add comments (and edit their own comments only - TM021)
 *
 * Test Pattern: TaskService → Domain → Prisma Repository → Real Database
 * Skips: tRPC/HTTP layer (tested in E2E)
 *
 * Each test gets a fresh database with complete isolation
 */

import { resetAndSeedDatabase } from '../helpers/dbSetup';
import { TaskService, UserContext } from '@/services/task/TaskService';
import { PrismaTaskRepository } from '@/repositories/PrismaTaskRepository';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
let taskService: TaskService;
let testUser: UserContext;

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
  const task = await prisma.task.create({
    data: {
      ...taskData,
      description: taskData.description || 'Test description',
      priority: taskData.priority || 5,
      dueDate: taskData.dueDate || new Date('2025-12-31'),
      status: taskData.status || 'TO_DO',
      ownerId: '10000000-0000-4000-8000-000000000001',
      departmentId: 'dept-engineering',
      projectId: 'proj-001',
      recurringInterval: taskData.recurringInterval ?? null,
    },
  });

  // Assign user to task for authorization
  await prisma.taskAssignment.create({
    data: {
      taskId: task.id,
      userId: '10000000-0000-4000-8000-000000000001',
      assignedById: '10000000-0000-4000-8000-000000000001',
      assignedAt: new Date(),
    },
  });

  return task;
}

describe('Task Comment Integration Tests', () => {
  // Setup before all tests
  beforeAll(async () => {
    const repository = new PrismaTaskRepository(prisma);
    taskService = new TaskService(repository);

    // Test user context (from seed data)
    testUser = {
      userId: '10000000-0000-4000-8000-000000000001',
      role: 'STAFF',
      departmentId: 'dept-engineering',
    };
  });

  // Full DB reset before EACH test for complete independence
  beforeEach(async () => {
    await resetAndSeedDatabase(prisma);
  });

  // Disconnect after all tests
  afterAll(async () => {
    await prisma.$disconnect();
  });

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
    });

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
    });

    it('should reject unauthorized user adding comment', async () => {
      const task = await createTaskWithAssignment({
        id: '123e4567-e89b-12d3-a456-426614174003',
        title: 'Comment Test Task',
      });

      // User not assigned to task
      const unauthorizedUser: UserContext = {
        userId: '10000000-0000-4000-8000-000000000004',
        role: 'STAFF',
        departmentId: 'dept-hr',
      };

      await expect(
        taskService.addCommentToTask(
          task.id,
          'Unauthorized comment',
          unauthorizedUser
        )
      ).rejects.toThrow();
    });
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
    });

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
      await prisma.taskAssignment.create({
        data: {
          taskId: task.id,
          userId: '10000000-0000-4000-8000-000000000002',
          assignedById: '10000000-0000-4000-8000-000000000001',
          assignedAt: new Date(),
        },
      });

      // Second user tries to edit first user's comment
      const secondUser: UserContext = {
        userId: '10000000-0000-4000-8000-000000000002',
        role: 'STAFF',
        departmentId: 'dept-engineering',
      };

      await expect(
        taskService.updateComment(
          task.id,
          commentId!,
          'Hacked comment',
          secondUser
        )
      ).rejects.toThrow();
    });
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
    });
  });
});
