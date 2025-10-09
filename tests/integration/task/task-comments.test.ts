/**
 * Integration Tests for Task Comment Endpoints
 *
 * Tests AC 6: Assigned Staff member can add comments (and edit their own comments only - TM021)
 *
 * Each test gets a fresh database with complete isolation
 */

import {
  resetAndSeedDatabase,
  getPrisma,
  disconnectPrisma,
} from '../helpers/dbSetup';
import { createTestTRPCClient } from '../helpers/trpcTestClient';

const prisma = getPrisma();
const client = createTestTRPCClient();

/**
 * Helper to create a task with assignment for testing
 * The user (10000000-0000-4000-8000-000000000001) is assigned to authorize comments
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
  // Full DB reset before EACH test for complete independence
  beforeEach(async () => {
    await resetAndSeedDatabase();
  });

  // Disconnect after all tests
  afterAll(async () => {
    await disconnectPrisma();
  });

  // ============================================
  // AC 6: Add Comments
  // ============================================
  describe('Add Comment (AC 6)', () => {
    it('should add a comment to task', async () => {
      const task = await createTaskWithAssignment({
        id: '123e4567-e89b-12d3-a456-426614174000',
        title: 'Comment Test Task',
        description: 'Test',
        priority: 5,
        dueDate: new Date('2025-12-31'),
        status: 'TO_DO',
      });

      const result = await client.task.addComment.mutate({
        taskId: task.id,
        content: 'This is my first comment',
      });

      const newComment = result.comments.find(
        c => c.content === 'This is my first comment'
      );
      expect(newComment).toBeDefined();
      expect(newComment?.content).toBe('This is my first comment');
    });

    it('should add multiple comments', async () => {
      const task = await createTaskWithAssignment({
        id: '123e4567-e89b-12d3-a456-426614174001',
        title: 'Comment Test Task',
        description: 'Test',
        priority: 5,
        dueDate: new Date('2025-12-31'),
        status: 'TO_DO',
      });

      await client.task.addComment.mutate({
        taskId: task.id,
        content: 'First comment',
      });

      const result = await client.task.addComment.mutate({
        taskId: task.id,
        content: 'Second comment',
      });

      expect(result.comments.length).toBeGreaterThanOrEqual(2);
    });

    it('should reject empty comment', async () => {
      const task = await createTaskWithAssignment({
        id: '123e4567-e89b-12d3-a456-426614174002',
        title: 'Comment Test Task',
        description: 'Test',
        priority: 5,
        dueDate: new Date('2025-12-31'),
        status: 'TO_DO',
      });

      await expect(
        client.task.addComment.mutate({
          taskId: task.id,
          content: '',
        })
      ).rejects.toThrow();
    });
  });

  // ============================================
  // AC 6: Edit Own Comments (TM021)
  // ============================================
  describe('Edit Own Comment (AC 6 - TM021)', () => {
    it('should edit own comment', async () => {
      const task = await createTaskWithAssignment({
        id: '123e4567-e89b-12d3-a456-426614174003',
        title: 'Comment Test Task',
        description: 'Test',
        priority: 5,
        dueDate: new Date('2025-12-31'),
        status: 'TO_DO',
      });

      const addResult = await client.task.addComment.mutate({
        taskId: task.id,
        content: 'Original comment',
      });

      const commentId = addResult.comments.find(
        c => c.content === 'Original comment'
      )?.id;
      expect(commentId).toBeDefined();

      const editResult = await client.task.updateComment.mutate({
        taskId: task.id,
        commentId: commentId!,
        content: 'EDITED: Updated comment',
      });

      const editedComment = editResult.comments.find(c => c.id === commentId);
      expect(editedComment?.content).toBe('EDITED: Updated comment');
    });
  });

  // ============================================
  // View Comments
  // ============================================
  describe('View Comments', () => {
    it('should retrieve all comments for a task', async () => {
      const task = await createTaskWithAssignment({
        id: '123e4567-e89b-12d3-a456-426614174004',
        title: 'Comment Test Task',
        description: 'Test',
        priority: 5,
        dueDate: new Date('2025-12-31'),
        status: 'TO_DO',
      });

      await client.task.addComment.mutate({
        taskId: task.id,
        content: 'First comment',
      });

      await client.task.addComment.mutate({
        taskId: task.id,
        content: 'Second comment',
      });

      const result = await client.task.getById.query({ taskId: task.id });

      expect(result.comments.length).toBeGreaterThanOrEqual(2);
      expect(result.comments.some(c => c.content === 'First comment')).toBe(
        true
      );
      expect(result.comments.some(c => c.content === 'Second comment')).toBe(
        true
      );
    });
  });
});
