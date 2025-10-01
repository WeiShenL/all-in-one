/**
 * TDD Tests for Task.addTag() and Task.removeTag()
 *
 * AC: Assigned Staff member can add or update tags (tags are optional)
 */

import { UnauthorizedError } from '../../../../src/domain/task/errors/TaskErrors';
import { createTestTask } from '../../../helpers/taskTestHelpers';

describe('Task - Tags', () => {
  describe('addTag() - Authorization', () => {
    it('should allow assigned user to add tag', () => {
      const task = createTestTask({
        assignees: new Set(['user-1']),
        tags: new Set(),
      });

      task.addTag('urgent', 'user-1');

      expect(task.getTags()).toContain('urgent');
    });

    it('should throw UnauthorizedError when user is not assigned', () => {
      const task = createTestTask({
        assignees: new Set(['user-1']),
        tags: new Set(),
      });

      expect(() => task.addTag('urgent', 'user-999')).toThrow(
        UnauthorizedError
      );
    });
  });

  describe('addTag() - Adding Tags', () => {
    it('should add a single tag to empty set', () => {
      const task = createTestTask({
        assignees: new Set(['user-1']),
        tags: new Set(),
      });

      task.addTag('bug', 'user-1');

      const tags = task.getTags();
      expect(tags.size).toBe(1);
      expect(tags).toContain('bug');
    });

    it('should add multiple tags sequentially', () => {
      const task = createTestTask({
        assignees: new Set(['user-1']),
        tags: new Set(),
      });

      task.addTag('bug', 'user-1');
      task.addTag('urgent', 'user-1');
      task.addTag('backend', 'user-1');

      const tags = task.getTags();
      expect(tags.size).toBe(3);
      expect(tags).toContain('bug');
      expect(tags).toContain('urgent');
      expect(tags).toContain('backend');
    });

    it('should not add duplicate tags', () => {
      const task = createTestTask({
        assignees: new Set(['user-1']),
        tags: new Set(['urgent']),
      });

      task.addTag('urgent', 'user-1'); // Try to add again

      const tags = task.getTags();
      expect(tags.size).toBe(1); // Still only 1 tag
      expect(tags).toContain('urgent');
    });

    it('should preserve existing tags when adding new one', () => {
      const task = createTestTask({
        assignees: new Set(['user-1']),
        tags: new Set(['bug', 'urgent']),
      });

      task.addTag('backend', 'user-1');

      const tags = task.getTags();
      expect(tags.size).toBe(3);
      expect(tags).toContain('bug');
      expect(tags).toContain('urgent');
      expect(tags).toContain('backend');
    });

    it('should update timestamp when tag is added', () => {
      const task = createTestTask({
        assignees: new Set(['user-1']),
        tags: new Set(),
      });

      const oldTimestamp = task.getUpdatedAt();

      task.addTag('new-tag', 'user-1');

      const newTimestamp = task.getUpdatedAt();
      expect(newTimestamp.getTime()).toBeGreaterThanOrEqual(
        oldTimestamp.getTime()
      );
    });
  });

  describe('removeTag() - Authorization', () => {
    it('should allow assigned user to remove tag', () => {
      const task = createTestTask({
        assignees: new Set(['user-1']),
        tags: new Set(['urgent', 'bug']),
      });

      task.removeTag('urgent', 'user-1');

      expect(task.getTags()).not.toContain('urgent');
      expect(task.getTags()).toContain('bug');
    });

    it('should throw UnauthorizedError when user is not assigned', () => {
      const task = createTestTask({
        assignees: new Set(['user-1']),
        tags: new Set(['urgent']),
      });

      expect(() => task.removeTag('urgent', 'user-999')).toThrow(
        UnauthorizedError
      );
    });
  });

  describe('removeTag() - Removing Tags', () => {
    it('should remove an existing tag', () => {
      const task = createTestTask({
        assignees: new Set(['user-1']),
        tags: new Set(['bug', 'urgent', 'backend']),
      });

      task.removeTag('urgent', 'user-1');

      const tags = task.getTags();
      expect(tags.size).toBe(2);
      expect(tags).not.toContain('urgent');
      expect(tags).toContain('bug');
      expect(tags).toContain('backend');
    });

    it('should handle removing non-existent tag gracefully', () => {
      const task = createTestTask({
        assignees: new Set(['user-1']),
        tags: new Set(['bug']),
      });

      task.removeTag('nonexistent', 'user-1'); // Should not throw

      const tags = task.getTags();
      expect(tags.size).toBe(1);
      expect(tags).toContain('bug');
    });

    it('should remove all tags individually', () => {
      const task = createTestTask({
        assignees: new Set(['user-1']),
        tags: new Set(['bug', 'urgent']),
      });

      task.removeTag('bug', 'user-1');
      task.removeTag('urgent', 'user-1');

      const tags = task.getTags();
      expect(tags.size).toBe(0);
    });

    it('should update timestamp when tag is removed', () => {
      const task = createTestTask({
        assignees: new Set(['user-1']),
        tags: new Set(['urgent']),
      });

      const oldTimestamp = task.getUpdatedAt();

      task.removeTag('urgent', 'user-1');

      const newTimestamp = task.getUpdatedAt();
      expect(newTimestamp.getTime()).toBeGreaterThanOrEqual(
        oldTimestamp.getTime()
      );
    });
  });

  describe('Edge Cases', () => {
    it('should work when task has multiple assignees', () => {
      const task = createTestTask({
        assignees: new Set(['user-1', 'user-2', 'user-3']),
        tags: new Set(['bug']),
      });

      task.addTag('urgent', 'user-2');

      expect(task.getTags()).toContain('urgent');
    });

    it('should preserve other task properties when managing tags', () => {
      const task = createTestTask({
        assignees: new Set(['user-1']),
        title: 'Important Task',
        tags: new Set(['bug']),
        priorityBucket: 7,
      });

      task.addTag('urgent', 'user-1');

      expect(task.getTags()).toContain('urgent');
      expect(task.getTitle()).toBe('Important Task');
      expect(task.getPriorityBucket()).toBe(7);
    });
  });
});
