/**
 * TDD Tests for Task.addComment() and Task.updateComment()
 *
 * AC: Assigned Staff member can add comments
 * AC: Staff can edit their own comments only (TM021)
 */

import { UnauthorizedError } from '../../../../src/domain/task/errors/TaskErrors';
import { createTestTask } from '../../../helpers/taskTestHelpers';

describe('Task - Comments', () => {
  describe('addComment() - Authorization', () => {
    it('should allow assigned user to add comment', () => {
      const task = createTestTask({
        assignees: new Set(['user-1']),
      });

      const comment = task.addComment('Great progress!', 'user-1');

      expect(comment).toBeDefined();
      expect(comment.content).toBe('Great progress!');
      expect(comment.authorId).toBe('user-1');
    });

    it('should throw UnauthorizedError when user is not assigned', () => {
      const task = createTestTask({
        assignees: new Set(['user-1']),
      });

      expect(() => task.addComment('Comment', 'user-999')).toThrow(
        UnauthorizedError
      );
    });
  });

  describe('addComment() - Adding Comments', () => {
    it('should add a comment with generated ID', () => {
      const task = createTestTask({
        assignees: new Set(['user-1']),
      });

      const comment = task.addComment('First comment', 'user-1');

      expect(comment.id).toBeDefined();
      expect(comment.id.length).toBeGreaterThan(0);
    });

    it('should add a comment with correct content and author', () => {
      const task = createTestTask({
        assignees: new Set(['user-1']),
      });

      const comment = task.addComment('Test comment', 'user-1');

      expect(comment.content).toBe('Test comment');
      expect(comment.authorId).toBe('user-1');
    });

    it('should add a comment with timestamps', () => {
      const task = createTestTask({
        assignees: new Set(['user-1']),
      });

      const beforeAdd = new Date();
      const comment = task.addComment('Comment', 'user-1');
      const afterAdd = new Date();

      expect(comment.createdAt).toBeDefined();
      expect(comment.updatedAt).toBeDefined();
      expect(comment.createdAt.getTime()).toBeGreaterThanOrEqual(
        beforeAdd.getTime()
      );
      expect(comment.createdAt.getTime()).toBeLessThanOrEqual(
        afterAdd.getTime()
      );
    });

    it('should add comment to task comments array', () => {
      const task = createTestTask({
        assignees: new Set(['user-1']),
      });

      task.addComment('Comment 1', 'user-1');

      const comments = task.getComments();
      expect(comments.length).toBe(1);
      expect(comments[0].content).toBe('Comment 1');
    });

    it('should add multiple comments sequentially', () => {
      const task = createTestTask({
        assignees: new Set(['user-1', 'user-2']),
      });

      task.addComment('First', 'user-1');
      task.addComment('Second', 'user-2');
      task.addComment('Third', 'user-1');

      const comments = task.getComments();
      expect(comments.length).toBe(3);
      expect(comments[0].content).toBe('First');
      expect(comments[1].content).toBe('Second');
      expect(comments[2].content).toBe('Third');
    });

    it('should update task timestamp when comment is added', () => {
      const task = createTestTask({
        assignees: new Set(['user-1']),
      });

      const oldTimestamp = task.getUpdatedAt();

      task.addComment('New comment', 'user-1');

      const newTimestamp = task.getUpdatedAt();
      expect(newTimestamp.getTime()).toBeGreaterThanOrEqual(
        oldTimestamp.getTime()
      );
    });
  });

  describe('updateComment() - Authorization', () => {
    it('should allow author to update own comment', () => {
      const task = createTestTask({
        assignees: new Set(['user-1']),
      });

      const comment = task.addComment('Original', 'user-1');

      task.updateComment(comment.id, 'Updated', 'user-1');

      const comments = task.getComments();
      expect(comments[0].content).toBe('Updated');
    });

    it('should throw UnauthorizedError when non-author tries to edit (TM021)', () => {
      const task = createTestTask({
        assignees: new Set(['user-1', 'user-2']),
      });

      const comment = task.addComment('Original', 'user-1');

      expect(() => task.updateComment(comment.id, 'Hacked', 'user-2')).toThrow(
        UnauthorizedError
      );
    });

    it('should throw error when comment not found', () => {
      const task = createTestTask({
        assignees: new Set(['user-1']),
      });

      expect(() =>
        task.updateComment('nonexistent-id', 'Updated', 'user-1')
      ).toThrow();
    });
  });

  describe('updateComment() - Updating Comments', () => {
    it('should update comment content', () => {
      const task = createTestTask({
        assignees: new Set(['user-1']),
      });

      const comment = task.addComment('Version 1', 'user-1');

      task.updateComment(comment.id, 'Version 2', 'user-1');

      const comments = task.getComments();
      expect(comments[0].content).toBe('Version 2');
    });

    it('should update comment updatedAt timestamp', () => {
      const task = createTestTask({
        assignees: new Set(['user-1']),
      });

      const comment = task.addComment('Original', 'user-1');
      const originalUpdatedAt = comment.updatedAt;

      task.updateComment(comment.id, 'Updated', 'user-1');

      const comments = task.getComments();
      expect(comments[0].updatedAt.getTime()).toBeGreaterThanOrEqual(
        originalUpdatedAt.getTime()
      );
    });

    it('should preserve comment ID and createdAt when updating', () => {
      const task = createTestTask({
        assignees: new Set(['user-1']),
      });

      const comment = task.addComment('Original', 'user-1');
      const originalId = comment.id;
      const originalCreatedAt = comment.createdAt;

      task.updateComment(comment.id, 'Updated', 'user-1');

      const comments = task.getComments();
      expect(comments[0].id).toBe(originalId);
      expect(comments[0].createdAt).toEqual(originalCreatedAt);
    });

    it('should preserve author when updating', () => {
      const task = createTestTask({
        assignees: new Set(['user-1']),
      });

      const comment = task.addComment('Original', 'user-1');

      task.updateComment(comment.id, 'Updated', 'user-1');

      const comments = task.getComments();
      expect(comments[0].authorId).toBe('user-1');
    });

    it('should update task timestamp when comment is edited', () => {
      const task = createTestTask({
        assignees: new Set(['user-1']),
      });

      const comment = task.addComment('Original', 'user-1');
      const oldTaskTimestamp = task.getUpdatedAt();

      task.updateComment(comment.id, 'Updated', 'user-1');

      const newTaskTimestamp = task.getUpdatedAt();
      expect(newTaskTimestamp.getTime()).toBeGreaterThanOrEqual(
        oldTaskTimestamp.getTime()
      );
    });
  });

  describe('Edge Cases', () => {
    it('should handle multiple users commenting', () => {
      const task = createTestTask({
        assignees: new Set(['user-1', 'user-2', 'user-3']),
      });

      task.addComment('Comment by user 1', 'user-1');
      task.addComment('Comment by user 2', 'user-2');
      task.addComment('Comment by user 3', 'user-3');

      const comments = task.getComments();
      expect(comments.length).toBe(3);
      expect(comments[0].authorId).toBe('user-1');
      expect(comments[1].authorId).toBe('user-2');
      expect(comments[2].authorId).toBe('user-3');
    });

    it('should preserve other task properties when managing comments', () => {
      const task = createTestTask({
        assignees: new Set(['user-1']),
        title: 'Important Task',
        priorityBucket: 9,
      });

      task.addComment('Comment', 'user-1');

      expect(task.getTitle()).toBe('Important Task');
      expect(task.getPriorityBucket()).toBe(9);
    });
  });
});
